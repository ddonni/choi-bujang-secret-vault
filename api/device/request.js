// POST /api/device/request. 이 기기의 승인을 요청합니다. 요청만 기록하며 승인 권한을 주지 않습니다.
import { sameOrigin } from '../../src/auth-session.mjs';
import { countPendingDevices, engineConfigured, findDevice, insertDeviceRequest, issueDeviceToken, readDeviceToken, resolveDeviceStatus } from '../../src/device-approval.mjs';
import { databaseFailed, requireLogin } from '../../src/notes-api.mjs';

const MAX_PENDING_DEVICES = 5;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!sameOrigin(request)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST' });
    return;
  }
  const login = await requireLogin(request, response, { device: false });
  if (!login) return;
  const { db, userId } = login;
  // 반 엔진을 쓸 때는 승인을 엔진이 정합니다. 이 경로는 결과만 돌려주고 아무것도 기록하지 않습니다.
  if (engineConfigured()) {
    const device = await resolveDeviceStatus(request, db, userId);
    response.status(200).json({ status: device.status, source: device.source });
    return;
  }
  const existing = readDeviceToken(request);
  if (existing) {
    const { data, error } = await findDevice(db, userId, existing);
    if (error) return databaseFailed(response, error);
    if (data) {
      response.status(200).json({ status: data.status, requestId: data.id });
      return;
    }
  }
  const { data: pending, error: countError } = await countPendingDevices(db, userId);
  if (countError) return databaseFailed(response, countError);
  if (pending.length >= MAX_PENDING_DEVICES) {
    response.status(429).json({ error: 'TOO_MANY_DEVICE_REQUESTS' });
    return;
  }
  const token = existing ?? issueDeviceToken(response);
  const { error: insertError } = await insertDeviceRequest(db, userId, token);
  if (insertError && insertError.code !== '23505') return databaseFailed(response, insertError);
  const { data: created, error: readError } = await findDevice(db, userId, token);
  if (readError) return databaseFailed(response, readError);
  if (!created) return databaseFailed(response, { code: 'device_request_missing' });
  response.status(201).json({ status: created.status, requestId: created.id });
}
