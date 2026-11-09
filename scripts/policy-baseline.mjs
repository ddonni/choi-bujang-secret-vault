// 10단계 안전 정책 사본 도구입니다. 운영 정책(판정기·allowedRoutes·DB)은 읽기만 하고 바꾸지 않습니다.
//   node scripts/policy-baseline.mjs snapshot [--replace]  안전 정책의 사본과 해시를 만듭니다.
//   node scripts/policy-baseline.mjs verify                사본과 해시를 검증합니다.
//   node scripts/policy-baseline.mjs drill                 시험 사본 한 줄을 바꿔 침공을 흉내 내고 차이를 보여 줍니다.
//   node scripts/policy-baseline.mjs diff                  검증한 사본과 시험 사본의 차이를 보여 줍니다.
//   node scripts/policy-baseline.mjs restore               시험 사본에서 되돌릴 항목만 보여 줍니다(바꾸지 않음).
//   node scripts/policy-baseline.mjs restore --confirm 코드 확인 코드가 맞을 때만 시험 사본을 되돌립니다.
// 해시는 사본이 바뀌었는지 알려 줄 뿐 서명이 아닙니다. 기준 해시 값은 저장소 밖에도 적어 두세요.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASELINE_DIR = join(root, 'policy-baseline');
const DRILL_DIR = join(root, 'artifacts', 'policy-drill');
const AUDIT_LOG = join(root, 'artifacts', 'policy-audit.log');
const QUARANTINE_DIR = join(root, 'artifacts', 'policy-quarantine');
const MANIFEST = join(BASELINE_DIR, 'manifest.json');
const MANIFEST_HASH = join(BASELINE_DIR, 'manifest.sha256');
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bsb_secret_[A-Za-z0-9_-]{8,}|\bsb_publishable_[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{12,}\./u;

const POLICY_FILES = Object.freeze([
  { name: 'decider.mjs', source: 'src/decider.mjs', kind: '판정기 규칙', read: text => text },
  { name: 'allowed-routes.json', source: 'aleph.config.json', kind: 'allowedRoutes', read: text => {
    const routes = JSON.parse(text).allowedRoutes;
    if (!Array.isArray(routes) || !routes.length) throw new Error('aleph.config.json의 allowedRoutes가 비어 있습니다.');
    return `${JSON.stringify(routes, null, 2)}\n`;
  } },
  { name: 'db-access-policy.sql', source: 'supabase/db-access-policy.sql', kind: 'DB 접근 정책(목표 상태, 실제 DB 조회본 아님)', read: text => text },
]);

// 시험 사본에서만 바꾸는 한 줄입니다. 미등록 기기를 들여보내는 침공을 흉내 냅니다.
const DRILL_EDIT = Object.freeze({
  file: 'decider.mjs',
  find: "return deviceDecision(request, 'deny', 'device_not_registered');",
  replace: "return deviceDecision(request, 'allow', 'approved');",
});

class Stop extends Error {}
const stop = message => { throw new Stop(message); };
// Git이 줄바꿈을 바꿔도 같은 해시가 나오도록 LF로 맞춘 뒤 계산합니다.
const normalize = text => text.replace(/\r\n/gu, '\n');
const sha256 = text => createHash('sha256').update(normalize(text), 'utf8').digest('hex');
const readText = path => normalize(readFileSync(path, 'utf8'));
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const short = hash => hash.slice(0, 12);

function readLivePolicy() {
  return POLICY_FILES.map(file => {
    const path = join(root, file.source);
    if (!existsSync(path)) stop(`운영 정책 파일이 없습니다: ${file.source}`);
    const text = file.read(readText(path));
    if (SECRET.test(text)) stop(`비밀값처럼 보이는 내용이 있어 사본을 만들지 않습니다: ${file.source}`);
    return { ...file, text };
  });
}

function snapshot(replace) {
  if (existsSync(MANIFEST) && !replace) stop('이미 사본이 있습니다. 새 기준으로 바꾸려면 --replace를 붙이세요.');
  if (git('status', '--porcelain', '--', 'src/decider.mjs', 'aleph.config.json')) {
    stop('src/decider.mjs 또는 aleph.config.json에 커밋하지 않은 변경이 있습니다. 먼저 커밋하세요.');
  }
  const files = readLivePolicy();
  mkdirSync(BASELINE_DIR, { recursive: true });
  for (const file of files) writeFileSync(join(BASELINE_DIR, file.name), file.text, 'utf8');
  const manifest = {
    schema: 'student.policy-baseline.v1',
    createdAt: new Date().toISOString(),
    sourceCommit: git('rev-parse', 'HEAD'),
    files: files.map(file => ({ name: file.name, source: file.source, kind: file.kind, sha256: sha256(file.text), lines: file.text.split('\n').length - 1 })),
  };
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(MANIFEST, body, 'utf8');
  writeFileSync(MANIFEST_HASH, `${sha256(body)}\n`, 'utf8');
  console.log(`안전 정책 사본을 만들었습니다: policy-baseline/ (기준 커밋 ${short(manifest.sourceCommit)})`);
  for (const file of manifest.files) console.log(`  ${file.name}  ${file.sha256}`);
  console.log(`기준 해시(저장소 밖에도 적어 두세요): ${sha256(body)}`);
}

// 사본이 없거나 해시가 하나라도 맞지 않으면 중단합니다.
function verifiedBaseline() {
  if (!existsSync(MANIFEST) || !existsSync(MANIFEST_HASH)) stop('중단: 안전 정책 사본이 없습니다. 먼저 snapshot을 실행하세요.');
  const body = readText(MANIFEST);
  const expected = readText(MANIFEST_HASH).trim();
  if (!/^[0-9a-f]{64}$/u.test(expected) || sha256(body) !== expected) stop('중단: 사본 목록(manifest.json)의 해시가 맞지 않습니다.');
  let manifest;
  try { manifest = JSON.parse(body); } catch { stop('중단: 사본 목록을 읽을 수 없습니다.'); }
  if (manifest.schema !== 'student.policy-baseline.v1' || !Array.isArray(manifest.files)) stop('중단: 사본 목록 형식이 맞지 않습니다.');
  const expectedNames = POLICY_FILES.map(file => file.name).sort().join(',');
  if (manifest.files.map(file => file.name).sort().join(',') !== expectedNames) stop('중단: 사본 목록의 파일 구성이 맞지 않습니다.');
  const files = manifest.files.map(file => {
    const path = join(BASELINE_DIR, file.name);
    if (!existsSync(path)) stop(`중단: 사본 파일이 없습니다: ${file.name}`);
    const text = readText(path);
    if (sha256(text) !== file.sha256) stop(`중단: 사본 해시가 맞지 않습니다: ${file.name}`);
    return { ...file, text };
  });
  return { manifest, files, manifestHash: expected };
}

function verify() {
  const { manifest, files, manifestHash } = verifiedBaseline();
  console.log(`검증 통과: 파일 ${files.length}개 해시 일치 (기준 커밋 ${short(manifest.sourceCommit)}, 기준 해시 ${short(manifestHash)})`);
  for (const file of files) console.log(`  ${file.name}  ${short(file.sha256)}  ${file.kind}`);
}

// 줄 단위 비교(최장 공통 부분열)로 달라진 줄만 돌려줍니다.
function changedLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const changes = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i += 1; j += 1; }
    else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) { changes.push({ sign: '-', line: i + 1, text: a[i] }); i += 1; }
    else { changes.push({ sign: '+', line: j + 1, text: b[j] }); j += 1; }
  }
  return changes;
}

// 감사 이력은 뒤에 덧붙이기만 합니다. 정책 내용은 적지 않고 해시와 파일 이름만 적습니다.
function audit(baseline, action, files = [], extra = {}) {
  mkdirSync(dirname(AUDIT_LOG), { recursive: true });
  appendFileSync(AUDIT_LOG, `${JSON.stringify({ at: new Date().toISOString(), action, target: 'artifacts/policy-drill',
    baselineCommit: baseline.manifest.sourceCommit, baselineHash: baseline.manifestHash, files, ...extra })}\n`, 'utf8');
}

function showDifference(baseline, { restoring = false } = {}) {
  const allowMissing = restoring;
  const { manifest, files, manifestHash } = baseline;
  if (!existsSync(DRILL_DIR)) stop('중단: 시험 사본이 없습니다. 먼저 drill을 실행하세요.');
  const differences = files.map(file => {
    const path = join(DRILL_DIR, file.name);
    const missing = !existsSync(path);
    if (missing && !allowMissing) stop(`중단: 시험 사본 파일이 없습니다: ${file.name}`);
    const current = missing ? '' : readText(path);
    return { ...file, missing, current, changes: restoring ? changedLines(current, file.text) : changedLines(file.text, current) };
  });
  const changed = differences.filter(file => file.changes.length);
  const count = sign => changed.reduce((total, file) => total + file.changes.filter(change => change.sign === sign).length, 0);
  console.log('[실행 전 미리보기] 아직 아무 파일도 되돌리지 않았습니다. 운영 정책은 이 도구가 바꾸지 않습니다.');
  console.log(`  복원할 버전: 기준 커밋 ${short(manifest.sourceCommit)} · 사본 생성 ${manifest.createdAt} · 기준 해시 ${short(manifestHash)}`);
  console.log('  비교 대상: artifacts/policy-drill/ (시험 사본, 운영 정책 아님)');
  console.log(`  변경 범위: 파일 ${changed.length}개 · 빠지는 줄 ${count('-')}줄 · 들어오는 줄 ${count('+')}줄${changed.length ? ` (${changed.map(file => file.name).join(', ')})` : ''}`);
  for (const file of changed) {
    console.log(`--- ${restoring ? '시험 사본(없어질 줄)' : '검증한 사본'} ${file.name}${file.missing ? ' [시험 사본에 없음]' : ''}`);
    console.log(`+++ ${restoring ? '검증한 사본(돌아올 줄)' : '시험 사본'} ${file.name}`);
    for (const change of file.changes) console.log(`${change.sign}${String(change.line).padStart(4)}: ${change.text.trim()}`);
  }
  if (!changed.length) console.log('차이 없음: 시험 사본이 검증한 사본과 같습니다.');
  return changed;
}

function drill() {
  const baseline = verifiedBaseline();
  const liveBefore = readLivePolicy().map(file => sha256(file.text)).join();
  // 사본 목록의 파일만 덮어씁니다. 시험 폴더의 다른 파일은 지우지 않습니다.
  mkdirSync(DRILL_DIR, { recursive: true });
  for (const file of baseline.files) {
    let text = file.text;
    if (file.name === DRILL_EDIT.file) {
      if (text.split(DRILL_EDIT.find).length !== 2) stop('중단: 시험으로 바꿀 규칙 줄을 정확히 하나 찾지 못했습니다.');
      text = text.replace(DRILL_EDIT.find, DRILL_EDIT.replace);
    }
    writeFileSync(join(DRILL_DIR, file.name), text, 'utf8');
  }
  audit(baseline, 'drill_tamper', [{ name: DRILL_EDIT.file }]);
  showDifference(baseline);
  const liveAfter = readLivePolicy().map(file => sha256(file.text)).join();
  if (liveBefore !== liveAfter) stop('중단: 운영 정책 파일이 시험 중에 바뀌었습니다.');
  console.log('운영 정책 확인: src/decider.mjs, allowedRoutes, DB 기준 문서의 해시가 시험 전후 같습니다.');
}

// 되돌린 시험 판정기가 등록 기기는 허용하고 미등록 기기는 거부하는지 가상 요청으로 확인합니다.
// 복원 뒤 해시가 검증본과 같을 때만 불러옵니다.
async function checkRestoredDecider() {
  const { decide } = await import(`${pathToFileURL(join(DRILL_DIR, 'decider.mjs')).href}?restored=${Date.now()}`);
  const { fixtureRequests } = await import(pathToFileURL(join(root, 'scripts', 'fixture-7.mjs')).href);
  const { normal } = fixtureRequests();
  const registered = await decide(normal);
  const unregistered = await decide({ ...normal, deviceRegistered: false });
  if (registered.decision !== 'allow' || unregistered.decision !== 'deny' || unregistered.reasonCode !== 'device_not_registered') {
    stop('중단: 되돌린 시험 판정기의 가상 요청 결과가 맞지 않습니다.');
  }
  console.log(`복원 뒤 가상 요청: 등록 기기 ${registered.decision} · 미등록 기기 ${unregistered.decision}(${unregistered.reasonCode})`);
}

async function restore(option, confirmCode) {
  if (option !== undefined && option !== '--confirm') stop('사용법: node scripts/policy-baseline.mjs restore [--confirm 코드]');
  const baseline = verifiedBaseline();
  const liveBefore = readLivePolicy().map(file => sha256(file.text)).join();
  const changed = showDifference(baseline, { restoring: true });
  const managed = new Set(baseline.files.map(file => file.name));
  const preserved = readdirSync(DRILL_DIR).filter(name => !managed.has(name));
  console.log(`  보존: 사본 목록 밖 시험 파일 ${preserved.length}개${preserved.length ? ` (${preserved.join(', ')})` : ''} · 감사 이력 artifacts/policy-audit.log`);
  if (!changed.length) {
    if (option === '--confirm') audit(baseline, 'restore_noop');
    return;
  }
  const code = short(baseline.manifestHash);
  if (option === undefined) {
    console.log(`위 항목을 확인했다면 실행하세요: node scripts/policy-baseline.mjs restore --confirm ${code}`);
    return;
  }
  if (confirmCode !== code) stop('중단: 확인 코드가 기준 해시와 맞지 않습니다. 아무 파일도 바꾸지 않았습니다.');
  // 되돌리기 전 시험 파일은 증거로 남깁니다.
  const quarantine = join(QUARANTINE_DIR, new Date().toISOString().replace(/[:.]/gu, '-'));
  mkdirSync(quarantine, { recursive: true });
  const results = [];
  for (const file of changed) {
    const path = join(DRILL_DIR, file.name);
    if (!file.missing) copyFileSync(path, join(quarantine, file.name));
    const temporary = `${path}.restoring`;
    writeFileSync(temporary, file.text, 'utf8');
    renameSync(temporary, path);
    results.push({ name: file.name, before: file.missing ? null : sha256(file.current), after: file.sha256 });
  }
  for (const file of baseline.files) {
    if (sha256(readText(join(DRILL_DIR, file.name))) !== file.sha256) stop(`중단: 되돌린 뒤 해시가 맞지 않습니다: ${file.name}`);
  }
  audit(baseline, 'restore', results, { quarantine: quarantine.slice(root.length + 1).replaceAll('\\', '/') });
  console.log(`되돌림 완료: 시험 사본 파일 ${results.length}개가 검증한 사본과 같습니다.`);
  await checkRestoredDecider();
  const liveAfter = readLivePolicy().map(file => sha256(file.text)).join();
  if (liveBefore !== liveAfter) stop('중단: 운영 정책 파일이 복원 중에 바뀌었습니다.');
  console.log('운영 정책 확인: src/decider.mjs, allowedRoutes, DB 기준 문서의 해시가 복원 전후 같습니다.');
}

try {
  const [command, option, value] = process.argv.slice(2);
  if (command === 'snapshot') snapshot(option === '--replace');
  else if (command === 'verify') verify();
  else if (command === 'drill') drill();
  else if (command === 'diff') showDifference(verifiedBaseline());
  else if (command === 'restore') await restore(option, value);
  else stop('사용법: node scripts/policy-baseline.mjs snapshot [--replace] | verify | drill | diff | restore [--confirm 코드]');
} catch (error) {
  console.error(error instanceof Stop ? error.message : `중단: ${error.message}`);
  process.exitCode = 1;
}
