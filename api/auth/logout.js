// 5단계: POST /api/auth/logout.
// 쿠키의 로그인 세션을 Supabase에서 끝내고 쿠키를 지웁니다.
import { ACCESS_COOKIE, authClient, clearSessionCookies, readCookie, sameOrigin } from '../../src/auth-session.mjs';

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
  const access = readCookie(request, ACCESS_COOKIE);
  const supabase = authClient();
  if (access && supabase) {
    const { error } = await supabase.auth.admin.signOut(access, 'local');
    if (error) console.error('auth: 로그아웃 세션 종료 실패', error.code ?? 'unknown');
  }
  clearSessionCookies(response);
  response.status(204).end();
}
