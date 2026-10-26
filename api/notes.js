// 2단계: 화면은 이 서버 함수를 거쳐 Supabase의 가상 메모를 읽습니다.
// SUPABASE_SECRET_KEY는 서버에서만 쓰며 응답·로그에 넣지 않습니다.
// 아직 로그인 확인이 없어 이 주소를 아는 누구나 메모를 읽을 수 있습니다(3단계에서 막습니다).
import { createClient } from '@supabase/supabase-js';

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
