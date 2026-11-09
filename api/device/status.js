// GET /api/device/status. 로그인한 사용자의 이 기기 상태와 그 출처만 돌려줍니다. 기기 식별값은 응답에 넣지 않습니다.
import { resolveDeviceStatus } from '../../src/device-approval.mjs';
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
  const device = await resolveDeviceStatus(request, login.db, login.userId);
  if (device.error) return databaseFailed(response, device.error);
  const { status, source, requestId } = device;
  response.status(200).json(requestId ? { status, source, requestId } : { status, source });
}
