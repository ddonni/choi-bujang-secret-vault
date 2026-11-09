// 10단계: POST /api/restore/note {id}. 비공개 사본 표(notes_backup)의 메모 한 건만 되살립니다.
// 사본의 주인 본인만 실행할 수 있습니다. 서버가 토큰에서 확인한 사용자 ID로만 대조합니다.
// ID·소유자·내용 해시를 대조하고, 대상 한 건만 쓰며, 감사 기록은 추가만 합니다. 응답·로그에 메모 내용을 넣지 않습니다.
import { createHash } from 'node:crypto';
import { readJsonBody } from '../../src/auth-session.mjs';
import { allowMethods, databaseFailed, denyNote, isUuid, requireLogin } from '../../src/notes-api.mjs';

const contentHash = ({ title, body }) => createHash('sha256').update(`${title}\n${body}`, 'utf8').digest('hex');

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  const login = await requireLogin(request, response);
  if (!login) return;
  const { db, userId } = login;
  const input = readJsonBody(request);
  const id = typeof input?.id === 'string' ? input.id.toLowerCase() : '';
  if (!isUuid(id)) return denyNote(request, response, 'invalid_note_id');

  const { data: copy, error: copyError } = await db.from('notes_backup')
    .select('id, owner_id, title, body, content_sha256').eq('id', id).maybeSingle();
  if (copyError) return databaseFailed(response, copyError);
  if (!copy) return denyNote(request, response, 'no_backup_copy');
  if (copy.owner_id !== userId) return denyNote(request, response, 'not_backup_owner');

  const audit = (result, contentSha256 = copy.content_sha256) => db.from('notes_restore_audit')
    .insert({ note_id: id, actor_id: userId, result, content_sha256: contentSha256 });
  const refuse = async (status, code) => {
    const { error } = await audit(code.toLowerCase());
    if (error) return databaseFailed(response, error);
    response.status(status).json({ error: code });
  };

  if (contentHash(copy) !== copy.content_sha256) return refuse(409, 'BACKUP_HASH_MISMATCH');
  const { data: current, error: currentError } = await db.from('notes').select('id, owner_id').eq('id', id).maybeSingle();
  if (currentError) return databaseFailed(response, currentError);
  // 같은 ID의 메모가 다른 사람 것이면 덮어쓰지 않습니다.
  if (current && current.owner_id !== userId) return refuse(409, 'NOTE_OWNER_CONFLICT');

  // 감사 기록을 남길 수 없으면 복원하지 않습니다.
  const { error: startError } = await audit('restore_started');
  if (startError) return databaseFailed(response, startError);
  const { error: writeError } = current
    ? await db.from('notes').update({ title: copy.title, body: copy.body, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', userId)
    : await db.from('notes').insert({ id, owner_id: userId, title: copy.title, body: copy.body });
  if (writeError) {
    await audit('restore_failed');
    return databaseFailed(response, writeError);
  }

  const { data: restored, error: readError } = await db.from('notes').select('id, owner_id, title, body').eq('id', id).maybeSingle();
  if (readError) return databaseFailed(response, readError);
  const matches = restored && restored.id === copy.id && restored.owner_id === copy.owner_id && contentHash(restored) === copy.content_sha256;
  if (!matches) return refuse(502, 'RESTORE_VERIFY_FAILED');
  const { error: doneError } = await audit('restored');
  if (doneError) return databaseFailed(response, doneError);
  response.status(200).json({ id: copy.id, ownerMatches: true, contentSha256: copy.content_sha256 });
}
