// 5단계: POST /api/auth/login {email, password}.
// 서버가 공식 SDK의 signInWithPassword를 부르고, 받은 토큰은 HttpOnly 쿠키로만 돌려줍니다.
// 비밀번호와 이메일은 로그에 남기지 않습니다.
import { authClient, clearSessionCookies, isJson, readJsonBody, sameOrigin, setSessionCookies } from '../../src/auth-session.mjs';

const FAILURES = {
  invalid_credentials: [401, 'INVALID_CREDENTIALS'],
  email_not_confirmed: [403, 'EMAIL_NOT_CONFIRMED'],
  user_banned: [403, 'USER_BANNED'],
  over_request_rate_limit: [429, 'TOO_MANY_REQUESTS'],
  validation_failed: [400, 'INVALID_LOGIN_INPUT'],
};

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!isJson(request) || !sameOrigin(request)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST' });
    return;
  }
  const input = readJsonBody(request);
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!email || email.length > 320 || !password || password.length > 1024) {
    response.status(400).json({ error: 'INVALID_LOGIN_INPUT' });
    return;
  }
  const supabase = authClient();
  if (!supabase) {
    console.error('auth: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    const [status, code] = FAILURES[error?.code] ?? [400, 'LOGIN_FAILED'];
    if (!FAILURES[error?.code]) console.error('auth: 로그인 실패', error?.code ?? 'no_session');
    clearSessionCookies(response);
    response.status(status).json({ error: code });
    return;
  }
  setSessionCookies(response, data.session);
  response.status(200).json({ email: data.user?.email ?? null });
}
