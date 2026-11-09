// GET /api/device/status. 로그인한 사용자의 이 기기 등록 상태만 돌려줍니다. 기기 식별값은 응답에 넣지 않습니다.
import { findDevice, readDeviceToken } from '../../src/device-approval.mjs';
import { databaseFailed, requireLogin } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const login = await requireLogin(request, response, { device: false });
  if (!login) return;
  const token = readDeviceToken(request);
  if (!token) {
    response.status(200).json({ status: 'none' });
    return;
  }
  const { data, error } = await findDevice(login.db, login.userId, token);
  if (error) return databaseFailed(response, error);
  response.status(200).json(data ? { status: data.status, requestId: data.id } : { status: 'none' });
}
