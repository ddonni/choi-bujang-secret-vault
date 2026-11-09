// 자료실 서버의 기기 등록 기록입니다. 반 엔진의 기기 판정과는 별개입니다.
// 기기 식별값은 서버가 만든 임의값을 HttpOnly 쿠키에만 두고, DB에는 SHA-256 해시만 저장합니다.
// 서버 함수에는 조회·추가 권한만 있어 스스로 승인할 수 없습니다. 승인은 SQL Editor에서만 합니다.
import { createHash, randomBytes } from 'node:crypto';
import { readCookie } from './auth-session.mjs';

const DEVICE_COOKIE = 'vault_device';
const DEVICE_MAX_AGE = 180 * 24 * 60 * 60;
const DEVICE_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

const hashToken = token => createHash('sha256').update(token, 'utf8').digest('hex');

export function readDeviceToken(request) {
  const token = readCookie(request, DEVICE_COOKIE);
  return token && DEVICE_TOKEN.test(token) ? token : null;
}

export function issueDeviceToken(response) {
  const token = randomBytes(32).toString('base64url');
  response.setHeader('Set-Cookie', `${DEVICE_COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DEVICE_MAX_AGE}`);
  return token;
}

// 이 사용자·이 기기의 등록 기록을 돌려줍니다. 없으면 data가 null입니다.
export function findDevice(db, userId, token) {
  return db.from('device_approvals').select('id, status')
    .eq('user_id', userId).eq('token_sha256', hashToken(token)).maybeSingle();
}

export function countPendingDevices(db, userId) {
  return db.from('device_approvals').select('id').eq('user_id', userId).eq('status', 'pending');
}

export function insertDeviceRequest(db, userId, token) {
  return db.from('device_approvals').insert({ user_id: userId, token_sha256: hashToken(token) });
}
