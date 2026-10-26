// 5단계: 로그인을 서버 함수로 옮깁니다. 브라우저는 Supabase 키도 로그인 토큰도 보지 않습니다.
// 토큰은 브라우저 스크립트가 읽을 수 없는 HttpOnly 쿠키에만 담고,
// 자료 API는 이 쿠키의 토큰을 src/verify-login.mjs로 검사합니다.
// SUPABASE_SECRET_KEY는 서버에서만 쓰며 응답·로그에 넣지 않습니다.
import { createClient } from '@supabase/supabase-js';

export const ACCESS_COOKIE = 'vault_access';
export const REFRESH_COOKIE = 'vault_refresh';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export function readCookie(request, name) {
  const header = request.headers?.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || null;
  }
  return null;
}

export function setSessionCookies(response, session) {
  const accessMaxAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 24 * 60 * 60));
  response.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE, session.access_token, accessMaxAge),
    cookie(REFRESH_COOKIE, session.refresh_token, REFRESH_MAX_AGE),
  ]);
}

export function clearSessionCookies(response) {
  response.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE, '', 0), cookie(REFRESH_COOKIE, '', 0)]);
}

// 요청마다 새 클라이언트를 만듭니다. 로그인한 사용자 세션이 서버 키로 쓰는 자료 클라이언트에 섞이지 않게 합니다.
export function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// 쿠키로 인증하는 상태 변경 요청은 같은 출처의 화면에서 온 것만 받습니다(CSRF 방어).
export function sameOrigin(request) {
  const origin = request.headers?.origin;
  const host = request.headers?.['x-forwarded-host'] ?? request.headers?.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export const isJson = request => /^application\/json\b/iu.test(request.headers?.['content-type'] ?? '');

export function readJsonBody(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return null; }
  }
  return input && typeof input === 'object' && !Array.isArray(input) ? input : null;
}
