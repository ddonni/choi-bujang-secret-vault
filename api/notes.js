// 3단계: 시작 틀의 src/verify-login.mjs로 요청 토큰을 검사한 뒤에만 가상 메모를 돌려줍니다.
// SUPABASE_SECRET_KEY는 서버에서만 쓰며 응답·로그에 넣지 않습니다.
// 브라우저가 보낸 userId·role 같은 값은 읽지 않습니다. 신원은 검사된 토큰에서만 얻습니다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
let verifyLogin;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('notes: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    response.status(500).json({ error: 'NOTES_NOT_CONFIGURED' });
    return;
  }
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: key });
  } catch (error) {
    // 헬퍼의 설정 오류 이름만 남깁니다.
    console.error('notes: 로그인 검사기 설정 실패', error.message);
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return;
  }
  const login = await verifyLogin(request.headers?.authorization);
  if (!login) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.from('notes').select('title, content').order('id');
  if (error) {
    // Supabase 오류 코드만 남깁니다. 키나 요청 머리글은 기록하지 않습니다.
    console.error('notes: Supabase 조회 실패', error.code ?? 'unknown');
    response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
    return;
  }
  response.status(200).json({ notes: data.map(({ title, content }) => ({ title, content })) });
}
