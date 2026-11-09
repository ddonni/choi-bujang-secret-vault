// GET /api/ops/summary. 탈환 작전실 요약입니다. 로그인·기기 승인을 거친 본인의 기록만 돌려줍니다.
// evidence는 근거를 뜻합니다: code(배포된 코드), api(이번 요청의 DB 조회·해시 검증), not_run(미실행), unavailable(조회 실패).
// 메모 표는 읽지 않습니다. 사용자 번호, 기기 해시, 토큰, 메모 내용은 응답에 넣지 않고 ID와 해시는 앞자리만 보여 줍니다.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RULE_IDS } from '../../src/decider.mjs';
import { requireLogin } from '../../src/notes-api.mjs';

const RECORD_LIMIT = 200;
const BASELINE_FILES = Object.freeze({
  manifest: new URL('../../policy-baseline/manifest.json', import.meta.url),
  manifestHash: new URL('../../policy-baseline/manifest.sha256', import.meta.url),
  'decider.mjs': new URL('../../policy-baseline/decider.mjs', import.meta.url),
  'allowed-routes.json': new URL('../../policy-baseline/allowed-routes.json', import.meta.url),
  'db-access-policy.sql': new URL('../../policy-baseline/db-access-policy.sql', import.meta.url),
});

const readText = url => readFileSync(url, 'utf8').replace(/\r\n/gu, '\n');
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const mask = value => (typeof value === 'string' ? `${value.slice(0, 8)}…` : null);

function countBy(rows, key) {
  return rows.reduce((counts, row) => ({ ...counts, [row[key]]: (counts[row[key]] ?? 0) + 1 }), {});
}

// 복구 기준 사본을 이번 요청에서 다시 읽어 해시를 검증합니다.
function recoveryVersion() {
  try {
    const body = readText(BASELINE_FILES.manifest);
    const expected = readText(BASELINE_FILES.manifestHash).trim();
    const manifest = JSON.parse(body);
    const verified = sha256(body) === expected
      && manifest.files.every(file => sha256(readText(BASELINE_FILES[file.name])) === file.sha256);
    return { evidence: 'api', verified, commit: manifest.sourceCommit.slice(0, 7), createdAt: manifest.createdAt, hash: expected.slice(0, 12), files: manifest.files.length };
  } catch {
    return { evidence: 'unavailable', verified: false };
  }
}

async function recordSection(query, key, toRecord) {
  const { data, error } = await query.limit(RECORD_LIMIT);
  if (error) return { evidence: 'unavailable', total: null, counts: null, records: [] };
  return { evidence: 'api', total: data.length, counts: countBy(data, key), truncated: data.length === RECORD_LIMIT, records: data.map(toRecord) };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const login = await requireLogin(request, response);
  if (!login) return;
  const { db, userId } = login;
  const [devices, restores] = await Promise.all([
    recordSection(db.from('device_approvals').select('id, status, requested_at, decided_at').eq('user_id', userId).order('requested_at', { ascending: false }),
      'status', row => ({ id: mask(row.id), status: row.status, requestedAt: row.requested_at, decidedAt: row.decided_at })),
    recordSection(db.from('notes_restore_audit').select('at, note_id, result, content_sha256').eq('actor_id', userId).order('at', { ascending: false }),
      'result', row => ({ at: row.at, noteId: mask(row.note_id), result: row.result, contentHash: row.content_sha256?.slice(0, 12) ?? null })),
  ]);
  response.status(200).json({
    rules: { evidence: 'code', total: RULE_IDS.length, names: RULE_IDS },
    detection: { evidence: 'not_run', rule: 'burst_read', events: null, reason: '운영 반 엔진의 사건 전달이 연결되지 않았습니다.' },
    revocation: { evidence: 'not_run', revoked: null, reason: '운영 반 엔진의 회수 집행 경로가 연결되지 않았습니다.' },
    devices,
    recovery: recoveryVersion(),
    restores,
  });
}
