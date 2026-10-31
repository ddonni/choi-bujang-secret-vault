// 보너스 web-injection 판정기. 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 import·파일 읽기·바깥 요청 없이 이 파일 안에서만 계산합니다.
// 아래 PATTERNS는 xdr/web-injection/patterns.json을 옮겨 적은 것입니다. 그 파일을 고치면 여기도 같이 고칩니다.
const TECHNIQUE = 'T1190';
const PATTERNS = Object.freeze([
  Object.freeze({
    name: 'sql-injection-in-params',
    label: '요청 인자 안의 SQL 구문',
    condition: "rule.mitre에 T1190이 있고, 요청 인자(data.url의 ? 뒤)에 SQL 구문을 이어 붙이거나 조회를 덧붙인 표기(rule.description의 'SQL 구문'·'SQL 표식'·'데이터베이스 조회를 이어 붙이는')가 같은 출발 주소(data.srcip)에서 반복(data.count)됐다.",
    basis: 'MITRE ATT&CK T1190: 공개된 웹 앱의 약점을 노리는 공격이며, 탐지 항목은 요청 내용에서 SQL 주입 문자열 같은 공격 흔적을 찾으라고 적는다(CWE-89 SQL Injection). https://attack.mitre.org/techniques/T1190/',
    // 설명 문구: '수업명 select'·'SQL 이라는 공지 제목'처럼 낱말만 나온 경우는 맞지 않게 '구문·표식·이어 붙이는'까지 봅니다.
    description: /SQL\s*(?:구문|표식)|데이터베이스\s*조회를\s*이어/u,
    params: /'\s*(?:or|and)\s+[^=\s]+\s*=|\bunion\b[\s\S]*\bselect\b|;\s*(?:drop|delete|insert|update)\b|--\s*$/iu,
  }),
  Object.freeze({
    name: 'script-tag-in-params',
    label: '요청 인자 안의 스크립트 태그',
    condition: "rule.mitre에 T1190이 있고, 요청 인자(data.url의 ? 뒤)에 스크립트 태그 삽입 표기(rule.description의 '스크립트 삽입 표기'·'스크립트 표식')가 같은 출발 주소(data.srcip)에서 반복(data.count)됐다.",
    basis: 'MITRE ATT&CK T1190: 웹 앱의 흔한 약점은 OWASP Top 10·CWE Top 25를 보라고 안내하며, 그 목록의 스크립트 삽입이 여기에 해당한다(CWE-79 Cross-site Scripting). https://attack.mitre.org/techniques/T1190/',
    description: /스크립트\s*(?:삽입|표식)/u,
    params: /<\s*script\b/iu,
  }),
  Object.freeze({
    name: 'path-traversal-repeat',
    label: '경로 거슬러 올라가기(../) 반복',
    condition: "rule.mitre에 T1190이 있고, 파일 경로 인자(data.url의 path·name 등)에 상위 폴더로 거슬러 올라가는 표기(rule.description의 '여러 단계 거슬러 올라가는'·'경로 이탈')가 같은 출발 주소(data.srcip)에서 반복(data.count)됐다.",
    basis: 'MITRE ATT&CK T1190: 웹 앱의 흔한 약점은 OWASP Top 10·CWE Top 25를 보라고 안내하며, 그 목록의 경로 거슬러 올라가기가 여기에 해당한다(CWE-22 Path Traversal). https://attack.mitre.org/techniques/T1190/',
    description: /거슬러\s*올라|경로\s*이탈/u,
    params: /\.\.[\\/]/u,
  }),
]);

// 신호 세기 기준값. MITRE ATT&CK에는 숫자 기준이 없어 학생이 정한 연습용 값입니다.
// 반복 횟수는 REPEAT_WEAK 이하이면 세기 0, REPEAT_STRONG 이상이면 세기 1이고 그 사이는 고르게 올라갑니다.
const REPEAT_WEAK = 1;
const REPEAT_STRONG = 8;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const clamp01 = value => Math.min(1, Math.max(0, value));
const ramp = (value, weak, strong) => clamp01((value - weak) / (strong - weak));
const round2 = value => Math.round(value * 100) / 100;

function repeatCount(alert, description) {
  const raw = alert?.data?.count;
  const number = Number(typeof raw === 'number' ? raw : String(raw ?? '').trim() || NaN);
  if (Number.isFinite(number) && number >= 0) return Math.floor(number);
  const match = /(\d+)\s*(?:번|건)/u.exec(description);
  return match ? Number(match[1]) : 0;
}

// 요청 인자(? 뒤)만 꺼내 한 번 풀어 읽습니다. 풀 수 없으면 그대로 씁니다.
function requestParams(alert) {
  const url = typeof alert?.data?.url === 'string' ? alert.data.url : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  try {
    return decodeURIComponent(query.replace(/\+/gu, ' '));
  } catch {
    return query;
  }
}

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const tagged = mitre.some(id => typeof id === 'string' && (id === TECHNIQUE || id.startsWith(`${TECHNIQUE}.`)));
  const params = requestParams(alert);
  const repeats = repeatCount(alert, description);
  const matched = PATTERNS.filter(pattern => pattern.description.test(description) || pattern.params.test(params));

  if (!tagged && matched.length === 0) {
    return { action: 'record', confidence: 0.1, reason: `패턴 해당 없음: ${TECHNIQUE} 표시와 주입 표기가 없는 일반 요청` };
  }
  if (matched.length === 0) {
    return { action: 'alert', confidence: ALERT_AT, reason: `${TECHNIQUE} 표시만 있음: 세 패턴 중 맞는 표기 없음(반복 ${repeats}번)` };
  }

  // 패턴에 걸린 경보는 0.5에서 시작하고, 같은 표기의 반복이 뚜렷할수록 0.95까지 올립니다.
  const strength = ramp(repeats, REPEAT_WEAK, REPEAT_STRONG);
  const confidence = round2(ALERT_AT + 0.45 * strength);
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: `${matched.map(pattern => pattern.name).join('+')}: 반복 ${repeats}번, 신호 세기 ${round2(strength)}` };
}
