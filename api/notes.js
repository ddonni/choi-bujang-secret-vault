// 3단계: GET /api/notes(로그인 사용자의 메모 목록), POST /api/notes(메모 추가).
// 로그인 확인과 입력 검사는 src/notes-api.mjs에 있습니다.
import { allowMethods, databaseFailed, newNoteId, readNoteInput, requireLogin } from '../src/notes-api.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'POST'])) return;
  const login = await requireLogin(request, response);
  if (!login) return;

  if (request.method === 'GET') {
    const { data, error } = await login.db.from('notes').select('id, title, body')
      .eq('owner_id', login.userId).order('created_at');
    if (error) return databaseFailed(response, error);
    response.status(200).json(data.map(({ id, title, body }) => ({ id, title, body })));
    return;
  }

  const input = readNoteInput(request);
  if (input.error) {
    response.status(400).json({ error: input.error });
    return;
  }
  const id = input.id ?? newNoteId();
  // owner_id는 서버가 확인한 사용자 ID로만 저장합니다.
  const { error } = await login.db.from('notes')
    .insert({ id, owner_id: login.userId, title: input.title, body: input.body });
  if (error?.code === '23505') {
    response.status(409).json({ error: 'NOTE_ID_TAKEN' });
    return;
  }
  if (error) return databaseFailed(response, error);
  response.status(201).json({ id });
}
