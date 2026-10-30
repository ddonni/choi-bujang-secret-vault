// 보너스 brute-force 판정기. 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 import·파일 읽기·바깥 요청 없이 이 파일 안에서만 계산합니다.
// 아래 PATTERNS는 xdr/brute-force/patterns.json을 옮겨 적은 것입니다. 그 파일을 고치면 여기도 같이 고칩니다.
const TECHNIQUE = 'T1110';
const PATTERNS = Object.freeze([
  Object.freeze({
    name: 'same-source-failure-burst',
    label: '같은 주소의 짧은 시간 로그인 실패 연속',
    condition: 'rule.mitre에 T1110이 있고, 같은 출발 주소(data.srcip)에서 짧은 시간(rule.description에 적힌 분 단위) 안에 로그인 실패(data.count)가 여러 건 쌓였다.',
    basis: 'MITRE ATT&CK T1110.001 Password Guessing: 한 곳에서 계정 비밀번호를 거듭 추측하는 시도이며, 같은 출발지의 짧은 시간 로그인 실패 연속으로 드러난다. https://attack.mitre.org/techniques/T1110/001/',
  }),
  Object.freeze({
    name: 'password-spraying',
    label: '여러 계정에 같은 비밀번호 대입',
    condition: "rule.mitre에 T1110이 있고, 같은 출발 주소(data.srcip)가 여러 계정(data.accounts 목록, 또는 rule.description의 '여러 계정'·'계정 이름을 바꿔 가며')에 같은 비밀번호를 넣었다.",
    basis: 'MITRE ATT&CK T1110.003 Password Spraying: 흔한 비밀번호 하나(또는 몇 개)를 여러 계정에 대입해 계정 잠금을 피하는 시도다. https://attack.mitre.org/techniques/T1110/003/',
  }),
]);

// 신호 세기 기준값. MITRE ATT&CK에는 숫자 기준이 없어 학생이 정한 연습용 값입니다.
// 실패 건수는 BURST_WEAK 이하이면 세기 0, BURST_STRONG 이상이면 세기 1이고 그 사이는 고르게 올라갑니다.
const BURST_WEAK = 2;
const BURST_STRONG = 30;
// 대입한 계정 수는 SPRAY_WEAK 이하이면 세기 0, SPRAY_STRONG 이상이면 세기 1입니다.
const SPRAY_WEAK = 2;
const SPRAY_STRONG = 8;
// 계정 수가 적혀 있지 않고 '여러 계정'처럼 말로만 적힌 대입의 세기입니다.
const SPRAY_PHRASE = 0.8;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const KOREAN_COUNTS = Object.freeze({ 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 });

const clamp01 = value => Math.min(1, Math.max(0, value));
const ramp = (value, weak, strong) => clamp01((value - weak) / (strong - weak));
const round2 = value => Math.round(value * 100) / 100;

function toCount(value) {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function failureCount(alert, description) {
  const fromData = toCount(alert?.data?.count);
  if (fromData !== null) return fromData;
  const match = /실패[^0-9]{0,6}(\d+)\s*건/u.exec(description);
  return match ? Number(match[1]) : 0;
}

function windowMinutes(description) {
  const match = /(\d+)\s*분/u.exec(description);
  return match ? Number(match[1]) : null;
}

function accountCount(alert, description) {
  const listed = typeof alert?.data?.accounts === 'string'
    ? new Set(alert.data.accounts.split(',').map(name => name.trim()).filter(Boolean)).size
    : 0;
  const digits = /계정\s*(\d+)\s*개/u.exec(description) ?? /(\d+)\s*개\s*계정/u.exec(description);
  const words = /(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*계정/u.exec(description);
  return Math.max(listed, digits ? Number(digits[1]) : 0, words ? KOREAN_COUNTS[words[1]] : 0);
}

function sprayPhrase(description) {
  return /여러\s*계정|계정\s*이름을\s*바꿔/u.test(description) && /같은\s*비밀번호|바꿔\s*가며/u.test(description);
}

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const failures = failureCount(alert, description);

  if (!mitre.some(id => typeof id === 'string' && (id === TECHNIQUE || id.startsWith(`${TECHNIQUE}.`)))) {
    return { action: 'record', confidence: 0.1, reason: `패턴 해당 없음: ${TECHNIQUE} 표시가 없는 일반 로그인 기록(실패 ${failures}건)` };
  }

  const minutes = windowMinutes(description);
  const accounts = accountCount(alert, description);
  const burst = ramp(failures, BURST_WEAK, BURST_STRONG);
  const spray = Math.max(ramp(accounts, SPRAY_WEAK, SPRAY_STRONG), sprayPhrase(description) ? SPRAY_PHRASE : 0);
  const [pattern, strength, detail] = spray > burst
    ? [PATTERNS[1], spray, accounts ? `계정 ${accounts}개에 대입` : '여러 계정에 같은 비밀번호 대입']
    : [PATTERNS[0], burst, `같은 주소 실패 ${failures}건${minutes ? `(${minutes}분)` : ''}`];

  // T1110 경보는 패턴에 걸린 것이므로 0.5에서 시작하고, 더 뚜렷한 신호만큼 0.95까지 올립니다.
  const confidence = round2(ALERT_AT + 0.45 * strength);
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: `${pattern.name}: ${detail}, 신호 세기 ${round2(strength)}` };
}
