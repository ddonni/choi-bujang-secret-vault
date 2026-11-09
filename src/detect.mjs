// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const METHOD = /^[A-Z]{1,16}$/u;
const MAX_SUB_LENGTH = 256;

// 사건 하나에서 at·method·identity.sub만 읽습니다. 다른 칸은 읽지도 복사하지도 않습니다.
// 세 값 중 하나라도 없거나 형식이 틀리면 null이며, 빠진 값을 지어내지 않습니다.
function readEvent(event) {
  const at = event?.at;
  const method = event?.method;
  const sub = event?.identity?.sub;
  if (typeof at !== 'string' || !ISO_TIME.test(at)) return null;
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs) || typeof method !== 'string' || !METHOD.test(method)) return null;
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > MAX_SUB_LENGTH) return null;
  return Object.freeze({ atMs, method, sub });
}

// 읽을 수 있는 사건만 돌려줍니다. 사건 내용은 저장하거나 출력하지 않습니다.
export function readEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  return events.map(readEvent).filter(Boolean);
}

const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_LIMIT = 120;

// 정렬된 시각에서 10분 창 안의 조회가 120건을 넘는 첫 시각을 찾습니다. 없으면 null입니다.
// 창은 시작 시각부터 10분 미만입니다. 정확히 10분 떨어진 사건은 같은 창에 넣지 않습니다.
function firstBurstAt(times) {
  let start = 0;
  for (let end = 0; end < times.length; end += 1) {
    while (times[end] - times[start] >= BURST_WINDOW_MS) start += 1;
    if (end - start + 1 > BURST_LIMIT) return times[end];
  }
  return null;
}

// burst_read: 사용자마다 따로 세며 at 시각만 씁니다. 여럿이면 가장 먼저 넘긴 사용자를 제안합니다.
function findBurstSubject(readings) {
  const timesBySub = new Map();
  for (const { atMs, method, sub } of readings) {
    if (method !== 'GET') continue;
    if (!timesBySub.has(sub)) timesBySub.set(sub, []);
    timesBySub.get(sub).push(atMs);
  }
  let found = null;
  for (const [sub, times] of timesBySub) {
    const burstAt = firstBurstAt(times.sort((a, b) => a - b));
    if (burstAt !== null && (found === null || burstAt < found.burstAt
      || (burstAt === found.burstAt && sub < found.sub))) found = { sub, burstAt };
  }
  return found?.sub ?? null;
}

export function detect(events) {
  const subject = findBurstSubject(readEvents(events));
  if (subject !== null) return { action: 'propose_revocation', reasonCode: 'burst_read', subject };
  return { action: 'observe' };
}
