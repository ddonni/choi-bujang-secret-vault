// GET·PUT·DELETE /api/notes/:id.
// 4단계: 서버가 확인한 사용자 ID와 owner_id가 같은 행만 다룹니다. 남의 메모는 없는 메모와 똑같이 404입니다.
import { allowMethods, databaseFailed, denyNote, isUuid, readNoteInput, requireLogin } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PUT', 'DELETE'])) return;
  const login = await requireLogin(request, response);
  if (!login) return;
  const id = request.query?.id;
  if (!isUuid(id)) return denyNote(request, response, 'invalid_note_id');
  const notes = login.db.from('notes');

  if (request.method === 'GET') {
    const { data, error } = await notes.select('id, title, body').eq('id', id)
      .eq('owner_id', login.userId).maybeSingle();
    if (error) return databaseFailed(response, error);
    if (!data) return denyNote(request, response, 'not_owner_or_missing');
    response.status(200).json({ id: data.id, title: data.title, body: data.body });
    return;
  }

  if (request.method === 'PUT') {
    const input = readNoteInput(request);
    if (input.error) {
      response.status(400).json({ error: input.error });
      return;
    }
    const { data, error } = await notes
      .update({ title: input.title, body: input.body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', login.userId).select('id, title, body').maybeSingle();
    if (error) return databaseFailed(response, error);
    if (!data) return denyNote(request, response, 'not_owner_or_missing');
    response.status(200).json({ id: data.id, title: data.title, body: data.body });
    return;
  }

  const { data, error } = await notes.delete().eq('id', id).eq('owner_id', login.userId).select('id');
  if (error) return databaseFailed(response, error);
  if (!data.length) return denyNote(request, response, 'not_owner_or_missing');
  response.status(204).end();
}
