// 1~11단계의 정상·금지 요청을 실제 배포에 보내 표로 남깁니다.
//   node scripts/evidence-table.mjs [--allow-restore]
// 실제로 보낸 요청만 통과·실패로 적습니다. 보낼 수 없는 시험은 미실행과 사유로 남깁니다.
// 응답 본문은 저장하지 않고 응답 코드, 오류 코드, 서버가 돌려준 요청 ID, 확인 시각만 적습니다.
//
// A·B 시험은 실행하는 터미널의 환경변수로만 받습니다. 값은 파일·로그·표에 쓰지 않습니다.
//   EVIDENCE_A_EMAIL, EVIDENCE_A_PASSWORD, EVIDENCE_A_DEVICE (B도 같은 형식)
//   EVIDENCE_*_DEVICE는 승인된 기기의 vault_device 쿠키 값입니다. SUPABASE_PUBLISHABLE_KEY는 공개용 키입니다.
// 계정을 넘기면 시험용 메모 한 건을 만들고 끝에 지웁니다. --allow-restore를 붙일 때만 B 메모 복원을 실행합니다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(readFileSync(join(root, 'aleph.config.json'), 'utf8'));
const APP = new URL(config.publicAppUrl).origin;
const RESTORE_TARGET = 'b4b52e9e-ce68-4470-8de8-0b6eb5156b16';
const PROBE_ID = '00000000-0000-4000-8000-000000000000';
const OUTPUT_DIR = join(root, 'artifacts', 'evidence');
const NOTE_SENTENCE = /실습용 가상 (?:과제|포트폴리오|리추얼|행정) 기록/gu;
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bsb_secret_[A-Za-z0-9_-]{8,}|\bsb_publishable_[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{12,}\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u;
const allowRestore = process.argv.includes('--allow-restore');

const rows = [];
const addRow = row => rows.push({ checkedAt: new Date().toISOString(), requestId: '-', actual: '-', ...row });
const skip = (stage, kind, label, expected, reason) => addRow({ stage, kind, label, expected: expected, actual: `미실행: ${reason}`, verdict: '미실행' });

const JSON_HEADERS = { 'Content-Type': 'application/json', Origin: APP };
const NOTE_BODY = JSON.stringify({ title: '실측 시험용 메모', body: '자동 시험이 만들고 지우는 메모입니다.' });

async function send(url, { method = 'GET', headers = {}, body, redirect = 'manual' } = {}) {
  const response = await fetch(url, { method, headers, body, redirect, signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  let errorCode = '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === 'string' && /^[A-Z_]{1,60}$/u.test(parsed.error)) errorCode = parsed.error;
    if (typeof parsed?.code === 'string' && /^[A-Z0-9]{1,10}$/u.test(parsed.code)) errorCode = parsed.code;
  } catch { /* 본문은 저장하지 않습니다. */ }
  return { response, text, status: response.status, errorCode,
    requestId: response.headers.get('sb-request-id') ?? response.headers.get('x-vercel-id') ?? response.headers.get('cf-ray') ?? '없음' };
}

// 실제 요청을 보내고 기대한 응답 코드와 비교합니다. 네트워크 실패는 실패로 적습니다.
async function probe(stage, kind, label, expected, url, options = {}) {
  try {
    const result = await send(url, options);
    const extra = options.check ? options.check(result) : null;
    const memoLeak = (result.text.match(NOTE_SENTENCE)?.length ?? 0) > 0 && kind === '금지';
    const passed = result.status === expected && extra !== false && !memoLeak;
    addRow({ stage, kind, label, expected: String(expected), actual: `HTTP ${result.status}${result.errorCode ? ` ${result.errorCode}` : ''}${memoLeak ? ' 메모 노출' : ''}`, requestId: result.requestId, verdict: passed ? '통과' : '실패' });
    return result;
  } catch (error) {
    addRow({ stage, kind, label, expected: String(expected), actual: `요청 실패: ${error.cause?.code ?? error.name}`, verdict: '실패' });
    return null;
  }
}

const cookieHeader = jar => Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');
function readCredentials(name) {
  const email = process.env[`EVIDENCE_${name}_EMAIL`];
  const password = process.env[`EVIDENCE_${name}_PASSWORD`];
  const device = process.env[`EVIDENCE_${name}_DEVICE`];
  return email && password ? { email, password, device } : null;
}

async function login(name, credentials, stage) {
  if (!credentials) {
    skip(stage, '정상', `${name} 로그인`, '200', `EVIDENCE_${name}_EMAIL·PASSWORD 없음`);
    return null;
  }
  const result = await probe(stage, '정상', `${name} POST /api/auth/login`, 200, `${APP}/api/auth/login`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email: credentials.email, password: credentials.password }) });
  if (result?.status !== 200) return null;
  const jar = {};
  for (const cookie of result.response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    jar[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return { name, jar, device: credentials.device };
}

const sessionHeaders = (session, { device = true, json = false } = {}) => ({
  Cookie: cookieHeader({ ...session.jar, ...(device && session.device ? { vault_device: session.device } : {}) }),
  ...(json ? JSON_HEADERS : {}),
  Origin: APP,
});

async function publicChecks() {
  await probe(1, '정상', 'GET / (첫 화면)', 200, `${APP}/`, { check: r => r.response.headers.get('x-content-type-options') === 'nosniff' });
  await probe(1, '정상', 'GET /aleph.json', 200, `${APP}/aleph.json`);
  await probe(2, '금지', 'GET /data.json (공개 메모)', 404, `${APP}/data.json`);
  await probe(11, '정상', 'GET /manifest.webmanifest', 200, `${APP}/manifest.webmanifest`);
  const denied = [
    [3, 'GET /api/notes', 'GET', '/api/notes'], [3, 'POST /api/notes', 'POST', '/api/notes'],
    [3, 'GET /api/notes/:id', 'GET', `/api/notes/${PROBE_ID}`], [3, 'PUT /api/notes/:id', 'PUT', `/api/notes/${PROBE_ID}`],
    [3, 'DELETE /api/notes/:id', 'DELETE', `/api/notes/${PROBE_ID}`], [10, 'POST /api/restore/note', 'POST', '/api/restore/note'],
    [11, 'GET /api/device/status', 'GET', '/api/device/status'], [11, 'GET /api/ops/summary', 'GET', '/api/ops/summary'],
  ];
  for (const [stage, label, method, path] of denied) {
    await probe(stage, '금지', `무로그인 ${label}`, 401, `${APP}${path}`, { method, headers: method === 'GET' ? {} : JSON_HEADERS, body: method === 'GET' || method === 'DELETE' ? undefined : NOTE_BODY });
  }
  await probe(3, '금지', '가짜 토큰 GET /api/notes', 401, `${APP}/api/notes`, { headers: { Authorization: 'Bearer a.b.c' } });
  await probe(3, '금지', '없는 계정 POST /api/auth/login', 401, `${APP}/api/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email: 'nobody-check@example.com', password: 'not-a-real-password' }) });
  await probe(5, '금지', '다른 사이트 POST /api/auth/login', 403, `${APP}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' }, body: '{}' });
  await probe(8, '금지', '무로그인 GET /api/instructor', 404, `${APP}/api/instructor`);
  await probe(8, '금지', '무로그인 POST /api/notices', 404, `${APP}/api/notices`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  await probe(11, '금지', '다른 사이트 POST /api/device/request', 403, `${APP}/api/device/request`, { method: 'POST', headers: { Origin: 'https://evil.example.com' } });
}

async function originChecks() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key || key.startsWith('sb_secret_')) {
    skip(5, '금지', '공개 키로 원본 API 직접 GET', '401', 'SUPABASE_PUBLISHABLE_KEY 없음');
    skip(5, '금지', '공개 키로 원본 API 직접 POST', '401', 'SUPABASE_PUBLISHABLE_KEY 없음');
    return;
  }
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  await probe(5, '금지', '공개 키로 원본 API 직접 GET', 401, config.originalApiUrl, { headers });
  await probe(5, '금지', '공개 키로 원본 API 직접 POST', 401, config.originalApiUrl, { method: 'POST', headers, body: NOTE_BODY });
}

async function accountChecks() {
  const A = await login('A', readCredentials('A'), 3);
  const B = await login('B', readCredentials('B'), 3);
  const needDevice = session => session?.device;
  if (A) await probe(11, '금지', 'A, 기기 쿠키 없이 GET /api/notes', 403, `${APP}/api/notes`, { headers: sessionHeaders(A, { device: false }) });
  else skip(11, '금지', 'A, 기기 쿠키 없이 GET /api/notes', '403', 'A 로그인 안 됨');

  if (!needDevice(A)) {
    for (const [stage, kind, label, expected] of [[4, '정상', 'A 메모 추가·목록·읽기·수정·삭제', '201·200·200·200·204'], [4, '금지', 'B가 A 메모 읽기·수정·삭제', '404·404·404'], [11, '정상', 'A 승인 기기 GET /api/ops/summary', '200'], [10, '금지', 'A가 B 복원 대상 복원', '404']]) {
      skip(stage, kind, label, expected, 'A 로그인 또는 EVIDENCE_A_DEVICE 없음');
    }
  } else {
    await probe(11, '정상', 'A 승인 기기 GET /api/ops/summary', 200, `${APP}/api/ops/summary`, { headers: sessionHeaders(A) });
    const created = await probe(4, '정상', 'A POST /api/notes', 201, `${APP}/api/notes`, { method: 'POST', headers: sessionHeaders(A, { json: true }), body: NOTE_BODY });
    let noteId = null;
    try { noteId = created?.status === 201 ? JSON.parse(created.text).id : null; } catch { noteId = null; }
    if (!noteId) {
      skip(4, '정상', 'A 메모 읽기·수정·삭제', '200·200·204', '메모 추가 실패');
      skip(4, '금지', 'B가 A 메모 읽기·수정·삭제', '404·404·404', '메모 추가 실패');
    } else {
      const url = `${APP}/api/notes/${noteId}`;
      await probe(4, '정상', 'A GET /api/notes (목록)', 200, `${APP}/api/notes`, { headers: sessionHeaders(A) });
      await probe(4, '정상', 'A GET /api/notes/:id', 200, url, { headers: sessionHeaders(A) });
      await probe(4, '정상', 'A PUT /api/notes/:id', 200, url, { method: 'PUT', headers: sessionHeaders(A, { json: true }), body: NOTE_BODY });
      if (needDevice(B)) {
        await probe(4, '금지', 'B GET A 메모', 404, url, { headers: sessionHeaders(B) });
        await probe(4, '금지', 'B PUT A 메모 (role 위조)', 404, url, { method: 'PUT', headers: sessionHeaders(B, { json: true }), body: JSON.stringify({ title: 'B 위조', body: 'x', role: 'instructor' }) });
        await probe(4, '금지', 'B DELETE A 메모', 404, url, { method: 'DELETE', headers: sessionHeaders(B) });
        await probe(4, '정상', 'B의 시도 뒤 A 메모 그대로', 200, url, { headers: sessionHeaders(A) });
      } else skip(4, '금지', 'B가 A 메모 읽기·수정·삭제', '404·404·404', 'B 로그인 또는 EVIDENCE_B_DEVICE 없음');
      await probe(4, '정상', 'A DELETE /api/notes/:id', 204, url, { method: 'DELETE', headers: sessionHeaders(A) });
      await probe(4, '금지', '지운 뒤 A GET', 404, url, { headers: sessionHeaders(A) });
    }
    await probe(10, '금지', 'A가 B 복원 대상 복원', 404, `${APP}/api/restore/note`, { method: 'POST', headers: sessionHeaders(A, { json: true }), body: JSON.stringify({ id: RESTORE_TARGET }) });
  }
  if (!needDevice(B)) skip(10, '정상', 'B 대상 메모 복원', '200', 'B 로그인 또는 EVIDENCE_B_DEVICE 없음');
  else if (!allowRestore) skip(10, '정상', 'B 대상 메모 복원', '200', '--allow-restore 없음(대상 메모를 사본으로 덮어씀)');
  else await probe(10, '정상', 'B 대상 메모 복원', 200, `${APP}/api/restore/note`, { method: 'POST', headers: sessionHeaders(B, { json: true }), body: JSON.stringify({ id: RESTORE_TARGET }) });
}

function engineRows() {
  const reason = '운영 반 엔진 연결 없음(가상 시험은 실제 API 결과가 아님)';
  skip(6, '금지', '미등록 기기 실제 요청', 'deny', '미등록 기기 공격은 심판이 확인');
  skip(7, '금지', '다시 로그인 전 실제 자료 차단', '차단', reason);
  skip(7, '정상', '다시 로그인 뒤 새 요청 허용', '허용', reason);
  skip(9, '금지', '폭주 조회의 실제 접속 회수', '회수', reason);
}

const escapeCell = value => String(value).replace(/\|/gu, '\\|').replace(/[\r\n]+/gu, ' ');

function report() {
  rows.sort((a, b) => a.stage - b.stage);
  const count = verdict => rows.filter(row => row.verdict === verdict).length;
  const summary = { total: rows.length, passed: count('통과'), failed: count('실패'), notRun: count('미실행') };
  const header = ['단계', '구분', '요청', '기대 결과', '실제 API 결과', '요청 ID', '확인 시각', '판정'];
  const lines = [
    '# 실측 결과표', '',
    `대상: ${APP} · 총 ${summary.total}건 · 통과 ${summary.passed} · 실패 ${summary.failed} · 미실행 ${summary.notRun}`,
    '이 표는 학생의 자기 점검이며 심판 판정이 아닙니다. 미실행은 통과가 아닙니다.', '',
    `| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${[row.stage, row.kind, row.label, row.expected, row.actual, row.requestId, row.checkedAt, row.verdict].map(escapeCell).join(' | ')} |`),
  ];
  const markdown = `${lines.join('\n')}\n`;
  const json = `${JSON.stringify({ target: APP, summary, rows }, null, 2)}\n`;
  if (SECRET.test(markdown.replace('nobody-check@example.com', '')) || SECRET.test(json.replace('nobody-check@example.com', ''))) {
    throw new Error('표에 비밀값처럼 보이는 내용이 있어 저장하지 않습니다.');
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'table.md'), markdown, 'utf8');
  writeFileSync(join(OUTPUT_DIR, 'table.json'), json, 'utf8');
  for (const row of rows) console.log([row.stage, row.kind, row.verdict, row.label, row.actual, row.requestId].join(' | '));
  console.log(`총 ${summary.total}건 · 통과 ${summary.passed} · 실패 ${summary.failed} · 미실행 ${summary.notRun} → artifacts/evidence/table.md`);
  if (summary.failed) process.exitCode = 1;
}

try {
  await publicChecks();
  await originChecks();
  await accountChecks();
  engineRows();
  report();
} catch (error) {
  console.error(`중단: ${error.message}`);
  process.exitCode = 1;
}
