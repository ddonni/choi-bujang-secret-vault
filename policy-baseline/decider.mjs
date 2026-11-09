// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
const ZONE_RULES = Object.freeze({
  unknownRoute: 'zone_unknown_route',
  queryDenied: 'zone_query_denied',
  noteList: 'zone_note_list_denied',
  noticeReadOnly: 'zone_notice_read_only',
  instructor: 'zone_instructor_denied',
});
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required', ...Object.values(ZONE_RULES)]);
const DEVICE_RULE = 'device_registered';

const deviceDecision = (request, decision, reasonCode) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds: [DEVICE_RULE],
});

const SIGNAL_KEYS = 'hour,network,region,source';
const EVENT_KEYS = 'ageSeconds,count,kind';
const MAX_RECENT_EVENTS = 12;
const TOKEN = /^[a-z][a-z0-9_-]{0,31}$/u;

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isPlainObject(value) && Object.keys(value).sort().join(',') === keys;
// 'unknown'은 값을 모른다는 뜻이므로 지역·네트워크 값으로 쓰지 않습니다.
const knownToken = value => (typeof value === 'string' && value !== 'unknown' && TOKEN.test(value) ? value : null);
const validHour = value => (Number.isInteger(value) && value >= 0 && value <= 23 ? value : null);
const validEvent = event => hasExactKeys(event, EVENT_KEYS) && typeof event.kind === 'string' && TOKEN.test(event.kind)
  && Number.isFinite(event.ageSeconds) && event.ageSeconds >= 0 && Number.isInteger(event.count) && event.count > 0;

function readBehavior(recentEvents) {
  if (!Array.isArray(recentEvents) || recentEvents.length > MAX_RECENT_EVENTS || !recentEvents.every(validEvent)) return null;
  return Object.freeze(recentEvents.map(event => Object.freeze({ ...event })));
}

function emptyContext(provenance, behavior) {
  return Object.freeze({ provenance, region: null, network: null, hour: null, behavior, complete: false });
}

// 7단계 입력 검사: 계약의 signals·recentEvents만 읽어 출처를 가립니다. 클라이언트 헤더는 읽지 않습니다.
// 없거나 형식이 틀린 값은 null로 남기고 정상값으로 채우지 않습니다.
// judge_fixture는 엔진이 넘긴 가상 신호이며 실제 위치 증거가 아닙니다.
export function readAccessContext(request) {
  const signals = request?.signals;
  const behavior = readBehavior(request?.recentEvents);
  if (!hasExactKeys(signals, SIGNAL_KEYS)) return emptyContext('unknown', behavior);
  if (signals.source === 'none') {
    // 실제 경로는 지역·네트워크를 모릅니다. 값이 적혀 있으면 출처가 맞지 않습니다.
    const consistent = signals.region === 'unknown' && signals.network === 'unknown';
    return emptyContext(consistent ? 'none' : 'unknown', behavior);
  }
  if (signals.source !== 'judge_fixture') return emptyContext('unknown', behavior);
  const region = knownToken(signals.region);
  const network = knownToken(signals.network);
  const hour = validHour(signals.hour);
  return Object.freeze({
    provenance: 'engine_virtual', region, network, hour, behavior,
    complete: region !== null && network !== null && hour !== null && behavior !== null,
  });
}

// 7단계 복합 이상 기준. 계약에 평소 시각 기록이 없어 학생이 정한 연습용 값입니다.
const STEP_UP_RULE = 'step_up_required';
const USUAL_HOUR_START = 6;
const USUAL_HOUR_END = 22;
const BURST_WINDOW_SECONDS = 600;
const BURST_MIN_EVENTS = 10;
const MAX_STEP_UP_AGE_SECONDS = 900;

const stepUpDecision = (request, decision, reasonCode) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds: [STEP_UP_RULE],
});

// 지역은 보지 않습니다. 시각·네트워크·많은 사건이 모두 맞아야 복합 이상입니다.
// 계약에 사건 종류 목록이 없어 kind로 고르지 않고 엔진이 넘긴 최근 사건을 모두 셉니다.
function isUnusualBurst({ hour, network, behavior }) {
  const unusualHour = hour < USUAL_HOUR_START || hour >= USUAL_HOUR_END;
  const recent = behavior.filter(event => event.ageSeconds <= BURST_WINDOW_SECONDS)
    .reduce((total, event) => total + event.count, 0);
  return unusualHour && network !== 'usual' && recent >= BURST_MIN_EVENTS;
}

function needsStepUp(context) {
  if (context.provenance === 'none') return false; // 실제 경로에는 판단할 접속 정보가 없습니다.
  return !context.complete || isUnusualBurst(context); // 불명확한 입력을 정상으로 치지 않습니다.
}

// verified 하나만 믿지 않고 계약의 형식과 시간 범위까지 맞아야 다시 확인된 것으로 봅니다.
function isFreshStepUp(stepUp) {
  return isPlainObject(stepUp) && Object.keys(stepUp).sort().join(',') === 'authAgeSeconds,verified'
    && stepUp.verified === true && Number.isFinite(stepUp.authAgeSeconds)
    && stepUp.authAgeSeconds >= 0 && stepUp.authAgeSeconds <= MAX_STEP_UP_AGE_SECONDS;
}

// 8단계 구역 규칙. 서비스와 정확한 경로 모양이 맞아야 하며, 알 수 없는 경로는 거부합니다.
// 메모 주인 비교는 판정기가 아니라 서버 API가 합니다. 메모 ID 형식도 여기서 좁히지 않습니다.
// 강사의 공지 수정은 역할을 아는 서버의 관리 경로에서 처리합니다(판정기 요청에는 역할이 없습니다).
const ROUTE_SHAPE = /^(GET|POST|PUT|PATCH|DELETE) (\/[^\s?#]*)$/u;
const NOTE_ID_ROUTE = '/notes/:id';
const NOTE_LIST_ROUTE = '/notes';
const NOTE_ID_METHODS = Object.freeze(['GET', 'PUT', 'DELETE']);
const NOTICE_ROUTES = Object.freeze(['/notices', '/notices/:id']);
const PATH_TRICK = /%(?:2f|5c|2e)|\\/iu;

function pathFitsShape(shape, path) {
  if (typeof path !== 'string' || path.includes('?') || path.includes('#')) return false;
  const expected = shape.split('/');
  const actual = path.split('/');
  return expected.length === actual.length && expected.every((part, index) => (part === ':id'
    ? actual[index] !== '' && actual[index] !== '.' && actual[index] !== '..' && !PATH_TRICK.test(actual[index])
    : part === actual[index]));
}

// 거부할 구역 규칙 이름을 돌려줍니다. 통과하면 null이고, 이어서 기존 규칙이 판정합니다.
function zoneDenial(request) {
  const { service, method, route, path, queryLength } = request;
  if (typeof service === 'string' && service.startsWith('instructor')) return ZONE_RULES.instructor;
  if (service === 'notices' && method !== 'GET') return ZONE_RULES.noticeReadOnly;
  const parsed = typeof route === 'string' ? ROUTE_SHAPE.exec(route) : null;
  if (!parsed || parsed[1] !== method || !pathFitsShape(parsed[2], path)) return ZONE_RULES.unknownRoute;
  // 쿼리로 기능을 고르지 않습니다. 길이를 알 수 없는 요청도 통과시키지 않습니다.
  if (queryLength !== 0) return ZONE_RULES.queryDenied;
  const shape = parsed[2].replace(/^\/api(?=\/)/u, '');
  if (service === 'notes' && shape === NOTE_LIST_ROUTE) return ZONE_RULES.noteList;
  if (service === 'notes' && shape === NOTE_ID_ROUTE && NOTE_ID_METHODS.includes(method)) return null;
  if (service === 'notices' && NOTICE_ROUTES.includes(shape)) return null;
  return ZONE_RULES.unknownRoute;
}

export async function decide(request) {
  // 6단계: 엔진이 확인한 deviceRegistered가 정확히 true일 때만 등록 기기로 봅니다.
  if (request.deviceRegistered !== true) return deviceDecision(request, 'deny', 'device_not_registered');
  const zoneRule = zoneDenial(request);
  if (zoneRule) {
    // 새 이유 코드는 운영 등록이 필요해 기존 코드를 쓰고, 막은 구역은 ruleIds로 구별합니다.
    return { schema: 'aleph.decision.v1', requestId: request.requestId, decision: 'deny', reasonCode: 'starter_not_ready', ruleIds: [zoneRule] };
  }
  if (request.method === 'GET' && needsStepUp(readAccessContext(request))) {
    return isFreshStepUp(request.stepUp)
      ? stepUpDecision(request, 'allow', 'approved')
      : stepUpDecision(request, 'step_up', STEP_UP_RULE);
  }
  if (request.method === 'GET') return deviceDecision(request, 'allow', 'approved');

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'deny',
    reasonCode: 'starter_not_ready',
    ruleIds: [RULE_IDS[0]],
  };
}
