// 3단계: GET·PUT·DELETE /api/notes/:id.
// 알려진 허점: 로그인만 확인하고 소유자는 검사하지 않아, B도 A의 메모를 읽고 고치고 지울 수 있습니다.
// 4단계에서 owner_id 검사로 막습니다.
import { allowMethods, databaseFailed, isUuid, readNoteInput, requireLogin } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PUT', 'DELETE'])) return;
  const login = await requireLogin(request, response);
  if (!login) return;
  const id = request.query?.id;
  if (!isUuid(id)) {
    response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return;
  }
  const notes = login.db.from('notes');

  if (request.method === 'GET') {
    const { data, error } = await notes.select('id, title, body').eq('id', id).maybeSingle();
    if (error) return databaseFailed(response, error);
    if (!data) {
      response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      return;
    }
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
      .eq('id', id).select('id, title, body').maybeSingle();
    if (error) return databaseFailed(response, error);
    if (!data) {
      response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      return;
    }
    response.status(200).json({ id: data.id, title: data.title, body: data.body });
    return;
  }

  const { data, error } = await notes.delete().eq('id', id).select('id');
  if (error) return databaseFailed(response, error);
  if (!data.length) {
    response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return;
  }
  response.status(204).end();
}
