// 확인용 읽기 모듈: xdr/fixtures/web-injection.json 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑습니다.
// decide.mjs는 이 파일을 불러오지 않습니다(심판 격리 환경에서는 decide.mjs 한 파일만 돌아갑니다).
// 원본 경보는 읽기만 합니다. 비밀값처럼 보이는 값은 출력 전에 [가림]으로 바꿉니다.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = new URL('../fixtures/web-injection.json', import.meta.url);
const HIDDEN = '[가림]';
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/gu,
  /\bBearer\s+\S+/giu,
  /\b(?:sb_secret|sb_publishable|sk|ghp|gho|xox[abpr])[_-][A-Za-z0-9_-]{8,}/gu,
  /\b((?:password|passwd|pwd|secret|token|api[_-]?key|authorization|비밀번호|토큰)\s*[:=]\s*)\S+/giu,
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/gu,
];
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/u;

export function hideSecrets(value) {
  if (typeof value !== 'string') return '';
  return SECRET_PATTERNS.reduce((text, pattern) =>
    text.replace(pattern, (match, prefix) => (typeof prefix === 'string' && prefix && match.startsWith(prefix) ? `${prefix}${HIDDEN}` : HIDDEN)), value)
    .replace(/[\t\r\n]+/gu, ' ');
}

// 경보 하나에서 다섯 칸만 꺼냅니다. 없는 칸은 빈 문자열(수준은 null)로 둡니다.
// 요청 주소(data.url)는 주입 표기가 들어 있을 수 있어 뽑지 않습니다.
export function pickAlert(alert) {
  const ip = typeof alert?.data?.srcip === 'string' ? alert.data.srcip.trim() : '';
  const level = Number(alert?.rule?.level);
  return {
    timestamp: typeof alert?.timestamp === 'string' ? alert.timestamp : '',
    srcip: IPV4.test(ip) ? ip : hideSecrets(ip),
    srcuser: hideSecrets(alert?.data?.srcuser),
    level: Number.isInteger(level) ? level : null,
    description: hideSecrets(alert?.rule?.description),
  };
}

export async function readAlerts(file = FIXTURE) {
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'web-injection' || !Array.isArray(fixture.alerts)) {
    throw new Error('web-injection 경보 묶음 형식이 아닙니다.');
  }
  return { total: fixture.alerts.length, rows: fixture.alerts.map(pickAlert) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const { total, rows } = await readAlerts();
    for (const row of rows) {
      console.log([row.timestamp, row.srcip, row.srcuser, row.level ?? '', row.description].join('\t'));
    }
    console.error(`경보 ${total}건 · 뽑은 줄 ${rows.length}줄${total === rows.length ? '' : ' (건수가 다릅니다)'}`);
    if (total !== rows.length) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : '읽기 오류');
    process.exitCode = 1;
  }
}
