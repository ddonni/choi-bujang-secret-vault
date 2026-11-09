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

export const engineConfigured = () => Boolean(process.env.ENGINE_DEVICE_STATUS_URL);

// 반 엔진 조회 연결부입니다. 조회 계약이 저장소에 없어 요청·응답 모양은 가정입니다.
// 주소와 키는 Vercel 환경변수로만 받습니다. deviceRegistered가 정확히 true일 때만 승인이며, 실패하면 승인으로 치지 않습니다.
async function askEngine(userId, token) {
  const url = process.env.ENGINE_DEVICE_STATUS_URL;
  const key = process.env.ENGINE_DEVICE_STATUS_KEY;
  if (!key || !url.startsWith('https://')) return { source: 'engine', status: 'unknown' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: userId, deviceHash: token ? hashToken(token) : null }),
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    const result = response.ok ? await response.json() : null;
    if (result?.deviceRegistered === true) return { source: 'engine', status: 'approved' };
    return { source: 'engine', status: result?.deviceRegistered === false ? 'none' : 'unknown' };
  } catch {
    return { source: 'engine', status: 'unknown' };
  }
}

// 메모 접근과 상태 표시가 함께 쓰는 승인 결과입니다.
// 엔진이 설정되면 엔진 결과만 쓰고, 설정되지 않았을 때만 자체 기록을 씁니다(source로 구분).
export async function resolveDeviceStatus(request, db, userId) {
  const token = readDeviceToken(request);
  if (engineConfigured()) return askEngine(userId, token);
  if (!token) return { source: 'local', status: 'none' };
  const { data, error } = await findDevice(db, userId, token);
  if (error) return { source: 'local', status: 'unknown', error };
  return data ? { source: 'local', status: data.status, requestId: data.id } : { source: 'local', status: 'none' };
}

export function countPendingDevices(db, userId) {
  return db.from('device_approvals').select('id').eq('user_id', userId).eq('status', 'pending');
}

export function insertDeviceRequest(db, userId, token) {
  return db.from('device_approvals').insert({ user_id: userId, token_sha256: hashToken(token) });
}
