// 보너스 brute-force 대응: decide.mjs의 판단 결과를 받아 알림을 남기고 거부 후보 규칙을 만듭니다.
// decide.mjs는 판단만 하고, 파일 쓰기와 판정기 쪽 연결은 이 파일이 맡습니다.
//
// 아직 판정기(src/decider.mjs)가 집행하지 않습니다. 판정기 요청 계약(docs/DECIDER_REQUEST.md)에는
// 출발 주소가 없고(signals.source는 실제 경로에서 "none"), 사용자는 가명 subjectId로만 오기 때문에
// 이 후보 규칙을 실제 요청에 맞춰 볼 값이 없습니다. 판정기의 기존 규칙도 바꾸지 않습니다.
//
// 규칙은 출발 주소(srcip)로만 만듭니다. 계정 이름은 피해 계정일 수 있어 규칙으로 쓰지 않고,
// 정상(record) 이벤트에 나온 주소는 후보에서 뺍니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const FIXTURE = new URL('../fixtures/brute-force.json', import.meta.url);
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);
const ALERTS_LOG = new URL('../alerts.log', import.meta.url);
// 거부 후보의 유효 시간. MITRE에 정해진 값이 없어 학생이 정한 연습용 값입니다.
const RULE_TTL_MINUTES = 60;
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/u;

const sourceOf = alert => {
  const ip = typeof alert?.data?.srcip === 'string' ? alert.data.srcip.trim() : '';
  return IPV4.test(ip) ? ip : null;
};
const oneLine = value => String(value ?? '').replace(/[\t\r\n]+/gu, ' ').slice(0, 200);

// 경보마다 decide를 불러 결과를 모읍니다. 형식이 틀린 답은 record로 둡니다(scripts/xdr-run.mjs와 같음).
export async function judgeAlerts(alerts) {
  const judged = [];
  for (const alert of alerts) {
    let result;
    try { result = await decide(alert); } catch { result = null; }
    const valid = result && ['block', 'alert', 'record'].includes(result.action)
      && Number.isFinite(result.confidence) && typeof result.reason === 'string';
    judged.push({
      alertId: typeof alert?.id === 'string' ? alert.id : '',
      detectedAt: typeof alert?.timestamp === 'string' ? alert.timestamp : null,
      srcip: sourceOf(alert),
      action: valid ? result.action : 'record',
      confidence: valid ? result.confidence : 0,
      reason: valid ? result.reason : '반환 형식이 아닙니다',
    });
  }
  return judged;
}

// block 판정의 출발 주소만 거부 후보로 만듭니다. 정상 이벤트에 나온 주소는 넣지 않습니다.
export function buildDenyRules(judged, now = new Date()) {
  const normalSources = new Set(judged.filter(item => item.action === 'record' && item.srcip).map(item => item.srcip));
  const bySource = new Map();
  const skipped = [];
  for (const item of judged) {
    if (item.action !== 'block') continue;
    if (!item.srcip) { skipped.push({ alertId: item.alertId, why: '출발 주소 없음' }); continue; }
    if (normalSources.has(item.srcip)) { skipped.push({ alertId: item.alertId, why: '정상 이벤트에도 나온 주소' }); continue; }
    const rule = bySource.get(item.srcip) ?? { srcip: item.srcip, evidenceAlertIds: [], patterns: new Set(), confidence: 0 };
    rule.evidenceAlertIds.push(item.alertId);
    rule.patterns.add(item.reason.split(':')[0]);
    rule.confidence = Math.max(rule.confidence, item.confidence);
    bySource.set(item.srcip, rule);
  }
  const expiresAt = new Date(now.getTime() + RULE_TTL_MINUTES * 60 * 1000).toISOString();
  const rules = [...bySource.values()].map(rule => ({
    ruleId: `xdr.brute-force.deny-src.${rule.srcip}`,
    decision: 'deny',
    match: { srcip: rule.srcip },
    createdAt: now.toISOString(),
    expiresAt,
    evidenceAlertIds: rule.evidenceAlertIds,
    patterns: [...rule.patterns],
    confidence: rule.confidence,
  }));
  return { rules, skipped };
}

// 후보 규칙을 로컬에서 대어 보는 확인용 함수입니다. 판정기가 이 함수를 부르지는 않습니다.
export function isDeniedBy(rules, { srcip, at = new Date() }) {
  const time = at instanceof Date ? at.getTime() : Date.parse(at);
  return rules.find(rule => rule.match.srcip === srcip && Date.parse(rule.expiresAt) > time) ?? null;
}

export async function respond({ fixtureFile = FIXTURE, rulesFile = RULES_FILE, alertsLog = ALERTS_LOG, now = new Date() } = {}) {
  const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'brute-force' || !Array.isArray(fixture.alerts)) {
    throw new Error('brute-force 경보 묶음 형식이 아닙니다.');
  }
  const judged = await judgeAlerts(fixture.alerts);
  const { rules, skipped } = buildDenyRules(judged, now);

  // 알림은 block·alert만 한 줄씩 쌓습니다. 계정 이름과 경보 원문은 남기지 않습니다.
  const lines = judged.filter(item => item.action !== 'record').map(item => [
    now.toISOString(), 'brute-force', item.alertId, item.action, item.confidence.toFixed(2),
    item.srcip ?? '-', oneLine(item.reason),
  ].join('\t'));
  const logPath = alertsLog instanceof URL ? fileURLToPath(alertsLog) : alertsLog;
  await mkdir(dirname(logPath), { recursive: true });
  if (lines.length) await appendFile(logPath, `${lines.join('\n')}\n`, 'utf8');

  await writeFile(rulesFile, `${JSON.stringify({
    moduleKey: 'brute-force',
    enforcedByDecider: false,
    note: '판정기 요청 계약에 출발 주소가 없어 src/decider.mjs가 아직 집행하지 않는 거부 후보입니다.',
    ttlMinutes: RULE_TTL_MINUTES,
    rules,
    skipped,
  }, null, 2)}\n`, 'utf8');
  return { judged, rules, skipped, loggedLines: lines.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const { judged, rules, skipped, loggedLines } = await respond();
    const counts = judged.reduce((all, item) => ({ ...all, [item.action]: all[item.action] + 1 }), { block: 0, alert: 0, record: 0 });
    console.log(`경보 ${judged.length}건 · block ${counts.block} · alert ${counts.alert} · record ${counts.record}`);
    console.log(`거부 후보 ${rules.length}개 (제외 ${skipped.length}개) → xdr/brute-force/deny-rules.json`);
    console.log(`알림 ${loggedLines}줄 추가 → xdr/alerts.log`);
    console.log('이 결과는 로컬 연습이며, 판정기가 집행하거나 심판이 판정한 결과가 아닙니다.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : '대응 실행 오류');
    process.exitCode = 1;
  }
}
