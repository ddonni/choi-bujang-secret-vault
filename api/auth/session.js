// 5단계: GET /api/auth/session.
// 쿠키의 로그인 토큰을 Supabase Auth로 확인해 화면에 보여 줄 이메일만 돌려줍니다.
// 토큰이 만료됐으면 갱신 토큰으로 새 토큰을 받아 쿠키를 바꿉니다. 실패하면 쿠키를 지우고 401입니다.
import { ACCESS_COOKIE, REFRESH_COOKIE, authClient, clearSessionCookies, readCookie, setSessionCookies } from '../../src/auth-session.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const supabase = authClient();
  if (!supabase) {
    console.error('auth: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return;
  }
  const access = readCookie(request, ACCESS_COOKIE);
  if (access) {
    const { data, error } = await supabase.auth.getUser(access);
    if (!error && data?.user) {
      response.status(200).json({ email: data.user.email ?? null });
      return;
    }
  }
  const refresh = readCookie(request, REFRESH_COOKIE);
  if (refresh) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refresh });
    if (!error && data?.session) {
      setSessionCookies(response, data.session);
      response.status(200).json({ email: data.user?.email ?? null });
      return;
    }
  }
  clearSessionCookies(response);
  response.status(401).json({ error: 'LOGIN_REQUIRED' });
}
