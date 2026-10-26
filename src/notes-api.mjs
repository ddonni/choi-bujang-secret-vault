// 3단계: 메모 API 두 함수(api/notes.js, api/notes/[id].js)가 함께 쓰는 부분입니다.
// 로그인 확인은 시작 틀의 src/verify-login.mjs만 씁니다. 사용자 ID는 검사된 토큰에서만 얻고,
// 브라우저가 보낸 userId·role·owner_id는 읽지 않습니다.
// SUPABASE_SECRET_KEY는 서버에서만 쓰며 응답·로그에 넣지 않습니다.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ACCESS_COOKIE, readCookie, sameOrigin } from './auth-session.mjs';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_TITLE = 200;
const MAX_BODY = 5000;
let verifyLogin;
let supabase;

export const isUuid = value => typeof value === 'string' && UUID.test(value);
export const newNoteId = () => randomUUID();

export function allowMethods(request, response, methods) {
  response.setHeader('Cache-Control', 'no-store');
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  return false;
}

// 로그인이 확인되면 { userId, db }를, 아니면 응답을 보낸 뒤 null을 돌려줍니다.
export async function requireLogin(request, response) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('notes: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    response.status(500).json({ error: 'NOTES_NOT_CONFIGURED' });
    return null;
  }
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: key });
  } catch (error) {
    // 헬퍼의 설정 오류 이름만 남깁니다.
    console.error('notes: 로그인 검사기 설정 실패', error.message);
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return null;
  }
  // 심판·도구는 Authorization 머리글로, 화면은 HttpOnly 쿠키로 토큰을 보냅니다. 둘 다 같은 검사기를 거칩니다.
  let authorization = request.headers?.authorization;
  const cookieToken = authorization ? null : readCookie(request, ACCESS_COOKIE);
  if (cookieToken) {
    if (request.method !== 'GET' && !sameOrigin(request)) {
      response.status(403).json({ error: 'CROSS_SITE_REQUEST' });
      return null;
    }
    authorization = `Bearer ${cookieToken}`;
  }
  const login = await verifyLogin(authorization);
  if (!login) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return null;
  }
  supabase ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userId: login.userId, db: supabase };
}

// 요청 본문에서 id·title·body만 꺼냅니다. 잘못되면 { error }를 돌려줍니다.
export function readNoteInput(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return { error: 'INVALID_JSON' }; }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'INVALID_JSON' };
  const { id, title, body } = input;
  if (id !== undefined && !isUuid(id)) return { error: 'INVALID_ID' };
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) return { error: 'INVALID_TITLE' };
  if (typeof body !== 'string' || body.length > MAX_BODY) return { error: 'INVALID_BODY' };
  return { id: id?.toLowerCase(), title: title.trim(), body };
}

export function databaseFailed(response, error) {
  // Supabase 오류 코드만 남깁니다. 키나 요청 머리글은 기록하지 않습니다.
  console.error('notes: Supabase 요청 실패', error?.code ?? 'unknown');
  response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
}
