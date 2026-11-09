# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`과 `api` 폴더의 서버 함수를 배포하고, 2단계부터 모든 응답에 보안 헤더 `X-Content-Type-Options: nosniff`를 붙입니다. 빌드 명령 `npm run build`는 `aleph.config.json`의 `step`(1~12)을 확인하고, Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증해 `public/aleph.json`을 생성합니다. 2단계부터 빌드는 `public/data.json`을 만들지 않습니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 1단계에서 자리표시자였고 학생이 편집하지 않습니다. 2단계 저장점부터 실제 GitHub 저장소와 Vercel Production 주소가 들어 있습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포 주소에 비로그인 요청을 보냅니다. 1단계에서는 `/data.json`의 공개 가상 메모 확인 표시를 읽었고, 2단계부터는 `/data.json`과 `/api/notes`에서 보이는 가상 메모 수를 셉니다. 3단계부터는 무로그인·가짜 토큰으로 GET·POST·PUT·DELETE를 보내 거부되는지 기록합니다. 학생 계정이 필요한 정상 A·B 요청은 미실행으로 남깁니다.

## 2단계: 자료를 코드 밖으로 옮깁니다

- 가상 메모 네 건은 학습용 Supabase 테이블 `public.notes`에 있습니다. 테이블은 RLS가 켜져 있고 정책이 없어서, `anon`·`authenticated`는 직접 읽을 수 없습니다. `owner_id uuid` 칸은 이후 단계에서 쓰려고 미리 만들어 두었습니다.
- 화면(`/`)은 서버 함수 `api/notes.js`(`GET /api/notes`)를 거쳐 메모를 읽습니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 씁니다. 두 값은 Vercel 대시보드 → Settings → Environment Variables에 직접 넣습니다. 코드·Git·브라우저 파일·응답·로그에는 넣지 않습니다.
- `/data.json`과 Git의 공개 파일에는 메모가 없습니다.
- 다시 실행하기: Supabase SQL Editor에서 테이블 생성 SQL을 실행하고, Vercel에 환경변수 두 개를 넣은 뒤 다시 배포합니다. 테이블 생성 SQL(`supabase/notes.sql`)은 가상 메모 문장을 담고 있어 `.gitignore`로 로컬에만 둡니다.
- 2단계 저장점부터 `aleph.config.json`의 `repoUrl`과 `publicAppUrl`에 실제 GitHub 저장소와 Vercel Production 주소를 적습니다.
- 자기 점검 `npm run bundle`(먼저 `bundle-notes.json`의 `explanation`을 적습니다): `src/attack-check.mjs`가 배포 주소에 비로그인 요청을 보냅니다. 정상이면 `/data.json`은 메모 0건이고, `/api/notes`는 메모 4건으로 남은 약점이 기록됩니다. 이 결과는 학생의 자기 점검이며 심판 판정이 아닙니다.

**남은 약점:** `/api/notes`는 아직 로그인 확인이 없는 공개 주소입니다. 서버 전용 키는 숨겨졌지만, 이 주소를 아는 누구나 메모 네 건을 그대로 받을 수 있습니다. 3단계에서 로그인 확인으로 막아야 합니다.

### 가상 메모 노출 확인 절차

검색식은 `실습용 가상 (과제|포트폴리오|리추얼|행정) 기록`입니다. 이 README 자체는 이 검색식에 걸리지 않습니다. `<배포주소>`에는 Vercel **Settings → Domains**의 Production 주소를 넣습니다. 배포마다 생기는 주소는 배포 보호 때문에 302가 나올 수 있습니다.

1. GitHub 최신 파일 검색 (저장소 폴더의 Git Bash):

   ```bash
   git fetch origin && git grep -nE "실습용 가상 (과제|포트폴리오|리추얼|행정) 기록" origin/main
   ```

   정상: 아무것도 출력되지 않습니다.
2. 현재 배포의 정적 파일 검색:

   ```bash
   for p in / /data.json /aleph.json; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' https://<배포주소>$p) $(curl -s https://<배포주소>$p | grep -oE '실습용 가상 (과제|포트폴리오|리추얼|행정) 기록' | wc -l)"; done
   ```

   정상: `/`과 `/aleph.json`은 `200 0`, `/data.json`은 `404 0`입니다.
3. 공개 API 약점 확인 (약점 기록용이며, 정적 파일 검색과 따로 적습니다):

   ```bash
   curl -s https://<배포주소>/api/notes | grep -oE '실습용 가상 (과제|포트폴리오|리추얼|행정) 기록' | wc -l
   ```

   현재 결과는 `4`여야 합니다. 이 숫자는 로그인 없이 메모를 받을 수 있다는 약점을 뜻합니다.

### 확인 기록

| 항목 | 결과 | 확인한 사람·날짜 |
| --- | --- | --- |
| GitHub 최신 파일(`origin/main` = `8d3a0b1`) | 0건 | 코딩 도구가 로컬에서 `git grep` 실행, 2026-10-26 |
| 2단계 당시 배포 `/`, `/data.json`, `/aleph.json` | `/` 200·0건(`X-Content-Type-Options: nosniff`), `/data.json` 404·0건, `/aleph.json` 200·0건 (`step` 2, 커밋 `8d3a0b1`) | 코딩 도구가 Production 주소에 비로그인 요청, 2026-10-26 |
| 2단계 당시 공개 API `/api/notes` 약점 | 200·**4건**: 로그인 없이 메모 네 건을 받을 수 있음 (3단계에서 401로 막음) | 코딩 도구가 Production 주소에 비로그인 요청, 2026-10-26 |

**과거 노출은 해소되지 않았습니다.** 첫 공개 커밋 `89a0dfc`의 `data.json`과 `public/data.json`에는 메모 네 건이 그대로 남아 있습니다. GitHub에서 이 커밋을 누구나 열 수 있습니다. 그 커밋으로 만든 옛 Vercel 배포도 남아 있다면 `/data.json`에서 메모가 보일 수 있습니다. 최신 파일 검색 결과가 0건이라는 것은 "지금 파일에 없다"는 뜻일 뿐, 이미 공개됐던 기록이 지워졌다는 뜻이 아닙니다.

## 3단계: 진짜 로그인을 붙입니다

- `/` 화면은 Supabase Auth 이메일·비밀번호 로그인·로그아웃을 공식 SDK(`@supabase/supabase-js`의 `signInWithPassword`·`signOut`)로 처리했습니다. 3단계 당시 화면 코드에는 공개용 Project URL과 publishable key만 들어 있었고, 5단계에서 로그인을 서버 함수로 옮기며 화면에서 지웠습니다. 로그인에 실패하면 이유를 화면에 보여 줍니다.
- 자료 API는 시작 틀의 `src/verify-login.mjs`로 `Authorization: Bearer` 토큰을 검사합니다. 토큰이 없거나 검사에 실패하면 자료 없이 `401 LOGIN_REQUIRED`를 돌려줍니다. 브라우저가 보낸 `userId`·`role`·`owner_id`는 읽지 않습니다. 검사에 쓴 발급자 정보는 `aleph.config.json`의 `identityProvider`에 있습니다.
- 로그인한 사용자는 화면에서 가상 메모를 추가·수정·삭제합니다. 경로는 아래 표와 같습니다. 8단계부터 `aleph.config.json`의 `allowedRoutes`에는 판정기가 허용하는 경로만 적습니다.

| 경로 | 동작 |
| --- | --- |
| `GET /api/notes` | 서버가 확인한 사용자의 메모 `[{id,title,body}]` |
| `POST /api/notes` | `{id?,title,body}`, `id`(UUID)가 없으면 서버가 만들어 `201 {id}`, `owner_id`는 확인된 사용자 ID |
| `GET /api/notes/:id` | `{id,title,body}`, 없으면 404 |
| `PUT /api/notes/:id` | `{title,body}`로 고친 뒤 `{id,title,body}`, 없으면 404 |
| `DELETE /api/notes/:id` | 204, 지운 뒤 GET은 404 |

- 다시 실행하기: Supabase SQL Editor에서 2단계 `supabase/notes.sql`(로컬 전용) 다음에 `supabase/notes-step3.sql`을 실행합니다. 이 SQL은 `id`를 UUID로, `content`를 `body`로 바꾸고 RLS와 권한 회수를 유지합니다. 그다음 Supabase **Authentication → Users**에서 A 계정을 만들고(Auto Confirm), 배포 주소에서 로그인합니다.
- 2단계의 남은 약점(무로그인 `/api/notes`)은 막혔습니다. 3단계 저장점의 자기 점검에서 무로그인과 가짜 토큰으로 보낸 GET·POST·PUT·DELETE 요청이 모두 자료 없이 401이었습니다.
- 자기 점검 `npm run bundle`은 무로그인·가짜 토큰 요청만 보냅니다. 정상 A의 추가·수정·삭제는 학생 비밀번호를 쓰지 않으려고 자동 점검에서 보내지 않으며, 결과에는 미실행으로 남습니다. 이 결과는 학생의 자기 점검이며 심판 판정이 아닙니다.

### 3단계 남은 약점

- (3단계 당시) `/api/notes/:id`의 GET·PUT·DELETE는 로그인만 확인하고 메모 주인은 검사하지 않았습니다. 4단계에서 `owner_id` 검사로 막았습니다.
- Supabase Auth의 공개 가입이 켜져 있으면 누구나 계정을 만들어 "로그인한 사용자"가 될 수 있습니다.
- (3단계 당시) 2단계 이전 메모 네 건은 `owner_id`가 비어 있었습니다. 4단계에서 학생이 SQL로 A에게 연결합니다.

## 4단계: 로그인해도 내 자료만 보이게 합니다

- 앱 API는 서버가 토큰에서 확인한 사용자 ID로만 메모를 고릅니다. 목록 `GET /api/notes`는 `owner_id`가 같은 메모만 돌려주고, `POST`는 그 ID를 `owner_id`로 저장합니다. `GET·PUT·DELETE /api/notes/:id`는 `id`와 `owner_id`가 모두 맞는 행만 다룹니다. 남의 메모와 없는 메모는 똑같이 `404 NOTE_NOT_FOUND`입니다.
- 앱 API는 서버 전용 키로 DB에 접속하므로 RLS를 거치지 않습니다. 앱의 A/B 분리는 위 API의 `owner_id` 조건이 맡습니다.
- 학습 DB 준비(학생이 Supabase SQL Editor에서 직접 실행하며, 이메일이 들어가므로 저장소에 저장하지 않음):
  1. 이메일로 `auth.users`에서 A·B의 ID를 찾아, 기존 가상 메모 네 건의 `owner_id`를 A로 연결하고 B 소유 시험 메모 한 건을 넣습니다.
  2. `public.notes`에 RLS 최소 권한을 둡니다. `PUBLIC`·`anon`·`authenticated` 권한을 모두 회수한 뒤 `authenticated`에만 SELECT·INSERT·UPDATE·DELETE를 줍니다. 정책 네 개(`notes_select_own`, `notes_insert_own`, `notes_update_own`, `notes_delete_own`)는 모두 `auth.uid() = owner_id`일 때만 허용합니다. 이 정책은 publishable key로 DB에 직접 들어오는 요청을 막습니다.
  - 두 SQL의 적용 결과는 코딩 도구가 확인하지 못했습니다. 학생이 `pg_policies`, `information_schema.role_table_grants`, `has_table_privilege`로 확인합니다.
- 다시 실행하기: 3단계까지 준비한 뒤 Supabase **Authentication → Users**에서 B 계정을 만들고(Auto Confirm), 위 두 SQL을 실행하고 배포 주소에서 A와 B로 각각 로그인합니다.
- 4단계 저장점 전 로컬 시험(가짜 Supabase, 시험용 키로 서명한 A·B 토큰을 실제 `src/verify-login.mjs`로 검사): B가 A 메모를 읽기·수정·삭제하면 모두 404였고 A 메모는 그대로였습니다. A가 B 메모를 읽거나 지울 때도 404였고, 각자 자기 메모는 추가·수정·삭제할 수 있었습니다. 이 결과는 실제 배포의 A·B 계정 시험이 아닙니다.
- 자기 점검 `npm run bundle`의 A·B 교차 요청은 학생 비밀번호를 쓰지 않으려고 보내지 않으며, 결과에는 미실행으로 남습니다. 화면에서 직접 확인합니다.

### 4단계 남은 약점

- Supabase Auth의 공개 가입이 켜져 있으면 누구나 계정을 만들 수 있습니다. 새 계정은 자기 메모만 다룰 수 있습니다.
- `POST /api/notes`에 남의 메모 `id`를 넣으면 `409 NOTE_ID_TAKEN`이 나옵니다. 내용은 보이지 않지만, 그 `id`가 있다는 사실은 알 수 있습니다.
- 옛 커밋 `89a0dfc`과 옛 배포의 과거 노출은 그대로입니다.

## 5단계: 자료 요청을 서버 한곳으로 모읍니다

- 브라우저 코드(`public/index.html`)는 메모 자료를 Supabase에서 직접 읽거나 고치지 않습니다. 5단계에서 찾아본 결과, `supabase.from`·`/rest/v1` 같은 직접 자료 호출은 없었고 모든 자료 요청은 서버 함수 `/api/notes`, `/api/notes/:id`로 갑니다. 당시 화면의 Supabase 호출은 로그인(`supabase.auth`)뿐이었습니다.
- 로그인도 서버 함수로 옮겼습니다. 이제 화면 코드에는 Supabase SDK도, Project URL도, publishable key도 없습니다(배포된 `/`에서 `sb_publishable_` 0건).
  - `POST /api/auth/login`: 서버가 공식 SDK의 `signInWithPassword`를 부릅니다. 받은 토큰은 응답 본문에 넣지 않고 `HttpOnly; Secure; SameSite=Strict` 쿠키(`vault_access`, `vault_refresh`)로만 보냅니다. 실패하면 `INVALID_CREDENTIALS` 같은 이유를 JSON으로 돌려줍니다.
  - `GET /api/auth/session`: 쿠키의 토큰을 Supabase Auth로 확인해 이메일만 돌려줍니다. 만료됐으면 갱신 토큰으로 새 토큰을 받습니다.
  - `POST /api/auth/logout`: Supabase 세션을 끝내고 쿠키를 지웁니다.
  - 공통 코드는 `src/auth-session.mjs`에 있습니다. 로그인용 Supabase 클라이언트는 요청마다 새로 만들어, 사용자 세션이 자료용 서버 클라이언트에 섞이지 않게 합니다.
- 자료 API는 `Authorization: Bearer` 머리글(심판·도구)과 쿠키(화면)의 토큰을 같은 `src/verify-login.mjs`로 검사합니다. 쿠키로 보낸 로그인·로그아웃·쓰기 요청은 `Origin`이 같은 출처일 때만 받습니다(CSRF 방어). 다르거나 없으면 `403 CROSS_SITE_REQUEST`입니다.
- 소유자 검사(`owner_id`)와 서버 전용 설정(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)은 4단계 그대로입니다. 로그인도 이 두 값만 쓰며, 새 환경변수는 없습니다.
- 서버 로그인 배포(`246908e`) 뒤 실제 주소에서 확인한 결과: 없는 계정 로그인은 `401 INVALID_CREDENTIALS`, 다른 출처에서 보낸 로그인은 `403`, 무로그인 세션·목록과 가짜 쿠키 목록은 모두 `401` JSON이었습니다. 실제 A 계정 로그인과 메모 CRUD는 자동 점검으로 보내지 않으며 학생이 화면에서 확인합니다.
- 원본 자료 API는 `aleph.config.json`의 `originalApiUrl`(`https://xvttauolkmecdscuthnb.supabase.co/rest/v1/notes`, 쿼리 없음)입니다. 심판은 anon 키로 이 주소에 직접 요청해 확인합니다.
- 학습 DB 준비(학생이 SQL Editor에서 검토 후 실행): `public.notes`의 `PUBLIC`·`anon`·`authenticated` 테이블·칸 권한을 모두 회수하는 SQL을 제안했습니다. RLS와 4단계 정책은 남겨 두고, 서버 함수가 쓰는 `service_role`과 다른 테이블은 건드리지 않습니다. 적용 전후 `information_schema.role_table_grants`, `has_table_privilege`, `information_schema.column_privileges`로 대조합니다. SQL 적용 여부는 코딩 도구가 확인하지 못했습니다.
- 자기 점검에서 anon 키로 원본 API에 직접 보낸 GET·POST의 실제 결과는 `npm run bundle` 결과에 기록됩니다. 화면에 키가 없으므로 공개용 키는 실행할 때 환경변수로 넘깁니다(Git Bash: `SUPABASE_PUBLISHABLE_KEY=sb_publishable_… npm run bundle`). 넘기지 않으면 이 두 점검은 미실행으로 남습니다. 서버 전용 키(`sb_secret_`)를 넣으면 점검 코드가 거부합니다.
- 심판은 배포된 커밋의 `aleph.config.json`을 GitHub에서 로그인 없이 읽습니다. 저장소가 비공개였을 때는 값이 있어도 `originalApiUrl`이 없다고 판정됐고, 저장소를 Public으로 바꾸자 통과했습니다.
- 다시 실행하기: 4단계까지 준비한 뒤 위 권한 회수 SQL을 실행하고, A로 로그인해 추가·수정·삭제가 그대로 되는지 화면에서 확인합니다.

### 5단계 남은 약점

- 실제 A 계정의 추가·수정·삭제와 A·B 교차 요청은 자동 점검에서 보내지 않습니다. 화면에서 직접 확인합니다.
- Supabase Auth의 공개 가입, `POST`의 남의 `id`에 대한 `409` 응답, 옛 커밋 `89a0dfc`의 과거 노출은 4단계와 같이 남아 있습니다.
- 저장소를 Public으로 바꾸면서 2단계 이후 커밋의 작성자 이메일도 공개됐습니다. 이후 커밋은 GitHub `noreply` 주소로 기록하며, 이미 남은 기록은 고쳐 쓰지 않았습니다.

## 6단계: 등록한 기기만 자료실에 들어옵니다

`src/decider.mjs`의 `device_registered` 규칙은 엔진이 확인한 `request.deviceRegistered`가 정확히 `true`일 때만 등록 기기로 봅니다. 등록 기기의 `GET`은 `allow`이고, 미등록이거나 값이 없으면 `deny`·`device_not_registered`입니다. 등록 기기의 쓰기 요청은 기존 `starter.deny`로 거부됩니다. 이번 과정에는 따로 설치할 접속 프로그램이 없습니다.

### 판정기 확인 순서

저장소 루트의 Git Bash에서 실행합니다.

1. 판정기 연습을 실행합니다.

   ```bash
   npm run decider:test
   ```

   정상: `통과 · 등록 기기의 정상 요청`과 `통과 · 미등록 기기의 가상 요청`이 모두 나옵니다.
2. 같은 가상 요청의 실제 응답을 봅니다. 1번은 통과 여부만 출력하므로 결정과 이유 코드는 이 명령으로 확인합니다.

   ```bash
   node --input-type=module -e 'import { decide } from "./src/decider.mjs"; import { fixtureRequests } from "./scripts/fixture-7.mjs"; const { normal } = fixtureRequests(); for (const [name, request] of [["등록 기기", normal], ["미등록 기기", { ...normal, deviceRegistered: false }]]) { const r = await decide(request); console.log(`${name}: ${r.decision} · ${r.reasonCode}`); }'
   ```

   정상: `등록 기기: allow · approved`와 `미등록 기기: deny · device_not_registered`가 나옵니다.

두 명령은 로컬 가상 요청 연습이며 실제 접속이나 심판 판정의 증거가 아닙니다. 미등록 기기 공격은 심판이 확인합니다.

자기 점검 `npm run bundle`에서 미등록 기기 항목은 미실행으로 남습니다. 무로그인·가짜 토큰 요청과 공개 키의 원본 API 직접 요청은 5단계와 같이 실제로 보냅니다.

### 6단계 남은 약점

- 판정기는 `GET`만 허용하므로, 실제 경로에 연결하면 등록 기기의 메모 추가·수정·삭제는 `starter.deny`로 거부됩니다.
- 허용 이유 코드 `approved`는 계약 문서의 예시입니다. 운영 등록부의 `allowedReasonCodes`는 이 저장소에 없어 등록 여부를 확인하지 못했습니다.
- (6단계 당시) `npm run fixture:7`은 복합 이상 요청을 `step_up`으로 돌리는 규칙이 없어 실패했습니다. 7단계에서 규칙을 넣어 통과합니다.
- `/` 화면과 `/api/notes`는 이 판정기를 부르지 않습니다. 판정기는 반 엔진이 호출하는 경로이며, 그 연결은 이 저장소에서 확인하지 못했습니다.

## 7단계: 평소와 다른 접속은 다시 확인합니다

`src/decider.mjs`의 `step_up_required` 규칙은 평소와 다른 시각, `usual`이 아닌 네트워크, 최근 10분 사건 10건 이상이 모두 맞는 등록 기기의 `GET`을 `step_up`으로 돌립니다. 지역은 보지 않습니다. 시각 범위와 사건 기준은 연습용 값입니다.

### 다시 로그인 계약 확인 결과

- 판정기 입력에는 `request.stepUp`의 `{verified, authAgeSeconds}`가 있습니다. 다시 확인한 뒤 지난 초만 알려 주며, 다시 로그인한 시각이나 같은 로그인인지를 확인하는 방법은 계약에 없습니다.
- 재인증 화면, 재로그인 시각 확인 경로, 판정을 다시 요청하는 엔진 코드와 주소는 이 저장소에 없습니다. `/` 화면과 `/api/notes`도 판정기를 부르지 않습니다.
- 그래서 가상 사건 규칙만 시험했습니다. 시험에는 토큰을 쓰지 않았습니다.

| 시험 | 결과 |
| --- | --- |
| 가상: 다시 확인 전 복합 이상 요청 | `step_up · step_up_required` |
| 가상: 다시 확인 뒤 새 요청 (60초, 900초 경계) | `allow · approved` |
| 가상: 다시 확인이 오래된 요청 (901초) | `step_up · step_up_required` |
| 실제: 다시 로그인 전 자료 차단 | **미실행** (계약·엔진 연결 없음) |
| 실제: 새 로그인 뒤 요청 허용 | **미실행** (계약·엔진 연결 없음) |

위 가상 결과는 로컬 연습이며 실제 접속이나 심판 판정의 증거가 아닙니다. 다시 실행하기: `npm run decider:test`, `npm run fixture:7`. 자기 점검 `npm run bundle`에서 실제 다시 로그인 시험은 한 항목으로 묶여 미실행으로 남습니다.

### 7단계 남은 약점

- 계약상 실제 경로의 `signals`는 `source: "none"`이라, 복합 이상 판단은 엔진의 가상 요청에서만 작동합니다. 실제 요청은 기존 기기 규칙대로 처리됩니다.
- 출처가 불명확하거나 값이 빠진 입력은 정상으로 치지 않고 `step_up`으로 보냅니다.
- 사건 종류 목록이 계약에 없어 `kind`를 가리지 않고 최근 사건을 모두 셉니다.
- `approved`, `step_up_required` 이유 코드가 운영 등록부에 있는지는 이 저장소에서 확인하지 못했습니다.

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다

### 자원 ID

`src/resource-ids.mjs`에 메모 `vault.note`, 강사 공지 `vault.instructor_notice`를 정했습니다. 메모 API의 모든 응답에는 서버가 `X-Resource-Id: vault.note`를 붙입니다. 브라우저가 보낸 머리글이나 쿼리로는 바뀌지 않습니다. 강사 공지는 아직 자료와 주소가 없어 ID만 정해 두었습니다.

### 판정기 구역 규칙

`src/decider.mjs`는 기기 규칙 다음, 추가 확인 규칙 앞에서 서비스와 정확한 경로 모양을 확인합니다. 경로는 연습 요청의 `/notes/...`와 `/api/notes/...` 표기를 모두 받습니다.

| 구역 | 판정 | `ruleIds` |
| --- | --- | --- |
| 메모 `GET /notes/:id` | 기존 규칙으로 이어져 허용 또는 추가 확인 | `device_registered`, `step_up_required` |
| 메모 `PUT`·`DELETE /notes/:id` | 기존 규칙으로 이어져 거부 | `starter.deny` |
| 메모 ID 없는 목록 | 거부 | `zone_note_list_denied` |
| 공지 `GET /notices`, `GET /notices/:id` | 기존 규칙으로 이어져 허용 또는 추가 확인 | `device_registered`, `step_up_required` |
| 공지 쓰기 | 누구에게나 거부 | `zone_notice_read_only` |
| `instructor`로 시작하는 서비스 | 모두 거부 | `zone_instructor_denied` |
| 쿼리가 있거나 길이를 알 수 없는 요청 | 거부 | `zone_query_denied` |
| 그 밖의 서비스·경로, 경로와 모양 불일치 | 거부 | `zone_unknown_route` |

판정기는 메모 ID 형식을 좁히지 않고 메모 주인도 비교하지 않습니다. 강사의 공지 수정은 판정기 요청에 역할이 없으므로 서버의 관리 경로에서 처리해야 합니다.

### 자료 API 대조

메모의 모든 경로는 서버가 토큰에서 확인한 사용자 ID로 `owner_id`를 비교합니다. 요청 본문과 쿼리의 `role`·`userId`·`owner_id`는 읽지 않습니다. 남의 메모와 없는 메모는 같은 `404`이고, 서버 로그에는 `not_owner_or_missing`, `invalid_note_id` 같은 사유와 메서드만 남습니다.

- 다시 실행하기: `npm run decider:test`, `npm run fixture:7`. 구역 규칙 38건과 메뉴 우회 API 요청은 코딩 도구가 임시 스크립트와 가짜 Supabase로 시험했습니다. 실제 계정 시험이나 심판 판정이 아닙니다.
- 자기 점검 `npm run bundle`은 강사·공지 구역에 무로그인 직접 요청을 실제로 보내 결과를 기록합니다.

### 8단계 남은 약점

- 저장된 강사 권한은 없습니다. 역할 표나 강사 칸이 없어 강사 권한 대조는 구현하지 않았습니다. 강사·공지 서버 함수도 없어 해당 주소는 `404`입니다.
- `allowedRoutes`의 `GET /api/notices`, `GET /api/notices/:id`는 판정기가 허용하는 모양이며, 아직 서버 함수가 없습니다.
- 공지 서비스 이름 `notices`와 강사 서비스 접두사 `instructor`는 계약에 없어 연습용으로 정했습니다.
- 구역 거부용 이유 코드를 몰라 기존 `starter_not_ready`를 쓰고, 막은 구역은 `ruleIds`로 구별합니다.
- 경로 모양이 `GET /notes/:id`이면 실제 경로 `/notes/export`의 `export`는 자료 ID로 봅니다.
- 화면은 `GET`·`POST /api/notes`를 씁니다. 판정기를 실제 경로에 연결하면 구역 규칙이 이 요청을 거부합니다. 지금은 자료 API가 판정기를 부르지 않습니다.

## 9단계: 도플갱어를 찾고 권한을 거둡니다

`src/detect.mjs`의 `detect(events)`는 사건마다 `at`·`method`·`identity.sub` 세 값만 읽습니다. 형식이 틀린 사건은 건너뛰고, 네트워크·기기·지역 값은 쓰지 않으며, 사건 내용을 저장하거나 출력하지 않습니다.

- 규칙 `burst_read`: 같은 `identity.sub`의 `GET` 사건이 어느 10분 구간에서든 120건을 넘으면 `{action: "propose_revocation", reasonCode: "burst_read", subject}`를 돌려줍니다. 그 밖에는 `{action: "observe"}`입니다.
- 정확히 120건, 10분 밖의 사건, 다른 사용자의 사건은 의심으로 합치지 않습니다.
- 다시 실행하기: `npm run detect:test`. 정상이면 `통과`로 시작하는 줄이 6개 나옵니다. 이 명령은 가상 사건 연습이며 실제 접속 회수나 심판 판정의 증거가 아닙니다.

### 9단계 남은 약점

- `detect`는 회수를 제안만 합니다. 운영 반 엔진이 검증한 사건을 전달하고 회수를 집행하는 경로는 이 저장소에 없어, 실제 접속 회수는 미실행입니다. 이 저장소에는 회수 API를 만들지 않았고 기기 권한도 바꾸지 않았습니다.
- 계약에 없어 정한 값: 10분 창은 시작 시각부터 10분 미만입니다. 정확히 10분 떨어진 사건은 같은 창에 넣지 않습니다. 여러 사용자가 넘으면 가장 먼저 넘긴 사용자를 제안합니다.
- `burst_read`는 판정기 규칙이 아니어서 `src/decider.mjs`의 `RULE_IDS`와 제출 묶음의 `policyRules`에 나오지 않습니다.

## 10단계: 백업에서 자료실을 되살립니다

### 안전 정책 사본과 시험 복원

`scripts/policy-baseline.mjs`는 판정기 규칙, `allowedRoutes`, DB 접근 기준 문서의 사본과 SHA-256 해시를 `policy-baseline/`에 둡니다. DB 사본은 목표 상태 문서이며 실제 DB 조회본이 아닙니다. 운영 정책은 읽기만 합니다.

- `verify`: 사본과 해시를 검증합니다. 사본이 없거나 해시가 맞지 않으면 중단합니다.
- `drill`: `artifacts/policy-drill/`의 시험 사본에서 규칙 한 줄을 바꿔 침공을 흉내 내고 차이를 보여 줍니다.
- `restore`: 복원할 버전과 바뀔 줄만 보여 줍니다. `restore --confirm <기준 해시 앞 12자리>`일 때만 시험 사본을 되돌립니다. 사본 목록 밖 시험 파일은 건드리지 않고, 감사 이력 `artifacts/policy-audit.log`는 뒤에 추가만 합니다.

정책 복원은 다음 순서로 진행합니다.

1. **복원 직전 사본 검증:** `restore`를 실행할 때마다 `policy-baseline/`의 사본과 해시 목록을 다시 읽어 SHA-256 해시를 검증합니다. `--confirm`을 붙여 실제로 되돌릴 때도 쓰기 전에 다시 검증합니다.
2. **버전·변경 줄 미리보기:** 복원할 버전(기준 커밋, 사본 생성 시각, 기준 해시)과 변경 범위, 없어질 줄과 돌아올 줄을 먼저 보여 줍니다. `--confirm` 없이 실행하면 여기서 끝나고 아무 파일도 바꾸지 않습니다.
3. **확인 뒤 진행:** 미리보기를 확인한 뒤 `restore --confirm <기준 해시 앞 12자리>`를 실행합니다. 코드가 맞을 때만 시험 사본을 되돌립니다.
4. **사본 누락·검증 실패 시 중단:** 사본이 없거나 해시 검증에 실패하면 아무것도 복원하지 않고 `중단:` 메시지와 함께 종료합니다.

### 메모 한 건 복원

| 항목 | 값 |
| --- | --- |
| 서비스 | Vercel 서버 함수 `api/restore/note.js` |
| 경로 | `POST /api/restore/note`, 본문 `{id}` |
| 복원 대상 | 시험 계정 B의 가상 메모 `B 시험 메모` |
| 대상 ID | `b4b52e9e-ce68-4470-8de8-0b6eb5156b16` (`supabase/restore-backup.sql` 실행 결과) |
| 비공개 사본 | DB 표 `notes_backup` (RLS 켜짐, `PUBLIC`·`anon`·`authenticated` 권한 없음) |
| 감사 기록 | DB 표 `notes_restore_audit` (서버 함수는 조회·추가만 가능) |

- 사본의 주인 본인만 실행할 수 있습니다. 서버가 토큰에서 확인한 사용자 ID로만 대조하고, 요청 본문의 `owner_id`·`role`은 읽지 않습니다.
- 사본의 ID·소유자·내용 해시(`sha256(title + 줄바꿈 + body)`)를 대조하고 대상 한 건만 씁니다. 같은 ID가 다른 사람의 메모이면 `409`로 멈춥니다. 복원 뒤 다시 읽어 세 값을 대조합니다.
- 감사 기록을 남길 수 없으면 복원하지 않습니다. 응답·로그·감사 기록에 메모 내용을 넣지 않습니다.
- 다시 실행하기: Supabase SQL Editor에서 `supabase/restore-backup.sql`의 `<B 이메일>`만 그 자리에서 바꿔 실행합니다. 바꾼 이메일은 파일에 저장하지 않습니다.
- 학생이 SQL을 실행해 위 대상 ID를 확인했습니다. 코딩 도구의 경로 시험은 가짜 Supabase로 한 것이며, 실제 B 계정의 복원 결과는 기록되지 않았습니다.
- `aleph.config.json`의 `restoreRoute`에 이 경로를 적었습니다. 판정기가 허용하는 경로가 아니므로 `allowedRoutes`에는 넣지 않았습니다.

### 복구 뒤 다시 확인하는 순서

저장소 루트의 Git Bash에서 위에서 아래로 실행합니다. 먼저 `H=https://choi-bujang-secret-vault-dony5.vercel.app`를 입력합니다. 이 순서는 자료를 바꾸지 않습니다.

1. 정책 사본: `node scripts/policy-baseline.mjs verify`
   정상: `검증 통과: 파일 3개 해시 일치`
2. 1·2단계 공개 자료: `curl -s -o /dev/null -w "%{http_code}\n" $H/data.json`, `git fetch origin && git grep -lE "실습용 가상 (과제|포트폴리오|리추얼|행정) 기록" origin/main`
   정상: `404`, 두 번째 명령은 출력 없음
3. 공개 설정: `curl -sI $H/ | grep -i x-content-type`, `curl -s -o /dev/null -w "%{http_code}\n" $H/aleph.json`
   정상: `nosniff`, `200`
4. 3단계 금지 요청: `/api/notes`와 `/api/notes/<임의 UUID>`, `/api/restore/note`에 로그인 없이 요청합니다. `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"title":"x","body":"y"}' $H/api/notes`처럼 메서드와 주소만 바꿉니다.
   정상: 모두 `401`
5. 5단계 원본 직접 요청: `curl -s -H "apikey: <공개 키>" https://xvttauolkmecdscuthnb.supabase.co/rest/v1/notes`. 표 이름을 `notes_backup`, `notes_restore_audit`로 바꿔 반복합니다. 서버 전용 키는 넣지 않습니다.
   정상: 세 표 모두 `permission denied`
6. 6·7·8·9단계 가상 요청: `npm run decider:test`, `npm run fixture:7`, `npm run detect:test`
   정상: `통과` 4줄, `정상 사건: allow`와 `복합 이상 사건: step_up`, `통과` 6줄
7. 화면 확인(학생 계정으로 직접): A로 로그인해 메모를 추가·수정·삭제합니다. B 창의 주소창에 `$H/api/notes/<A 메모 id>`를 넣습니다. B 창에서 대상 메모를 복원하고, A 창에서 같은 복원 요청을 보냅니다.
   정상: A 작업이 반영되고, B 창은 `NOTE_NOT_FOUND`, B 복원은 `200`, A 복원은 `404`입니다.

### 복구 뒤 확인 기록

| 항목 | 결과 | 실행 |
| --- | --- | --- |
| 정책 사본 검증 | 파일 3개 해시 일치 | 코딩 도구, 2026-11-09, 커밋 `8c4c0bd` |
| `/data.json`, 최신 저장소의 메모 문장 | `404`, 0개 파일 | 코딩 도구, 2026-11-09 |
| 첫 화면 보안 헤더, `/aleph.json`, 화면 키 흔적 | `nosniff`, `200`, 0줄 | 코딩 도구, 2026-11-09 |
| 무로그인 `GET`·`POST /api/notes`, `GET`·`PUT`·`DELETE /api/notes/:id`, `POST /api/restore/note`, 가짜 토큰 목록 | 모두 `401` | 코딩 도구, 2026-11-09 |
| 공개 키로 `notes`·`notes_backup`·`notes_restore_audit` 직접 요청 | 모두 `401`, `permission denied` | 코딩 도구, 2026-11-09 |
| `decider:test`, `fixture:7`, `detect:test` (가상) | 통과 4건, `allow`·`step_up`, 통과 6건 | 코딩 도구, 2026-11-09 |
| `/api/instructor`, `/api/admin` 직접 요청 | `404` | 코딩 도구, 2026-11-09 |
| A의 메모 추가·수정·삭제 | 미실행 | 학생 계정 필요 |
| B의 A 메모 요청 거부 | 미실행 | 학생 계정 필요 |
| B의 대상 메모 복원, A의 복원 요청 거부 | 미실행 | 학생 계정 필요 |
| 실제 DB의 정책·권한 조회 | 미실행 | Supabase SQL Editor 필요 |
| 미등록 기기 공격, 실제 다시 로그인, 실제 접속 회수 | 미실행 | 심판 또는 운영 엔진 필요 |

위 결과는 자기 점검이며 심판 판정이 아닙니다. 가상 요청 결과는 실제 접속의 증거가 아닙니다.

### 10단계 남은 약점

- 안전 정책 해시는 서명이 아닙니다. 기준 해시 값을 저장소 밖에도 적어 두어야 합니다.
- 복원은 사본의 주인만 실행합니다. 저장된 강사·관리자 권한이 없어 대리 복원은 없습니다.
- 판정기 구역 규칙은 이 경로를 모르므로, 판정기를 실제 경로에 연결하면 `zone_unknown_route`로 거부됩니다.

## 11단계: 설치형 웹앱과 기기 승인 화면

### 설치형 웹앱

`public/manifest.webmanifest`에 앱 이름 `BYTE BACK 자료실`을 적었습니다. `public/sw.js`는 `public/offline.html` 한 장만 저장해 네트워크가 끊겼을 때 안내합니다. 메모와 `/api/` 응답은 저장하지 않습니다. 설치 여부는 기기 승인과 관계없습니다. 따로 설치하는 접속 프로그램은 없습니다.

### 기기 승인

자료실 서버의 기기 등록 기록입니다. 반 엔진의 기기 판정과는 별개입니다.

| 경로 | 동작 |
| --- | --- |
| `GET /api/device/status` | 로그인한 사용자의 이 기기 상태(`none`·`pending`·`approved`·`revoked`) |
| `POST /api/device/request` | 승인 요청만 기록합니다. 권한을 주지 않습니다. |

- 기기 식별값은 서버가 만든 임의값을 HttpOnly 쿠키 `vault_device`에만 두고, DB 표 `device_approvals`에는 해시만 저장합니다. 브라우저 저장소에는 넣지 않습니다.
- 서버 함수에는 표의 조회·추가 권한만 있습니다. 승인은 SQL Editor에서 `status`를 `approved`로 바꿀 때만 됩니다.
- 학생 로그인은 이 사용자·이 기기의 기록이 `approved`일 때만 자료를 받습니다. 그 밖에는 자료 없이 `403 DEVICE_NOT_APPROVED`입니다. 심판 토큰은 서명이 검증된 별도 경로라 이 검사를 거치지 않습니다.
- 다시 실행하기: `supabase/device-approvals.sql`을 실행하고, 로그인해 **이 기기 승인 요청**을 누른 뒤, 화면의 요청 번호를 파일 끝의 `update`로 승인하고 **승인 상태 다시 확인**을 누릅니다.
- 코딩 도구의 시험은 가짜 Supabase로 한 것입니다. 실제 A·B 계정의 승인 전 차단과 승인 뒤 화면은 미실행입니다.

### 11단계 남은 약점

- 쿠키 기반 기록이라 쿠키를 지우면 새 기기로 보입니다. 하드웨어를 증명하지 않으며, 반 엔진의 기기 승인을 대신하지 않습니다.
- 승인은 SQL Editor에서만 할 수 있어 대기 요청을 사람이 직접 확인해야 합니다.
- 아이콘은 SVG 하나뿐이라 브라우저에 따라 설치 안내가 나오지 않을 수 있습니다.

## 보너스 xdr-01: 무차별 로그인 공격을 잡아 냅니다

`xdr/fixtures/brute-force.json`(수업용 Wazuh 모양 경보 28건, 원본은 고치지 않음)을 읽어 판단합니다.

| 파일 | 하는 일 |
| --- | --- |
| `xdr/brute-force/patterns.json` | MITRE ATT&CK T1110 근거 패턴 두 개: `same-source-failure-burst`(T1110.001, 같은 주소의 짧은 시간 로그인 실패 연속), `password-spraying`(T1110.003, 여러 계정에 같은 비밀번호 대입) |
| `xdr/brute-force/decide.mjs` | 심판이 격리 환경에서 불러오는 판정기. `import`·파일 읽기·바깥 요청 없이 위 패턴을 맨 위 상수로 옮겨 적고 `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상은 `block`, 0.5 이상은 `alert`, 그 아래는 `record`입니다. T1110 표시가 없으면 0.1, 있으면 0.5에서 시작해 실패 건수(2~30건)와 대입 계정 수(2~8개) 중 더 뚜렷한 신호만큼 0.95까지 올립니다. 숫자 기준은 MITRE에 없어 연습용으로 정한 값입니다. |
| `xdr/brute-force/respond.mjs` | `decide` 결과 중 `block`의 출발 주소만 거부 후보로 `xdr/brute-force/deny-rules.json`에 씁니다(만료 시각 = 처리 시각 + 60분, 근거 경보 번호 포함). 계정 이름으로는 규칙을 만들지 않고, 정상(`record`) 이벤트에 나온 주소는 뺍니다. `block`·`alert`는 `xdr/alerts.log`에 한 줄씩 쌓습니다. |
| `xdr/brute-force/read-alerts.mjs` | 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. `decide.mjs`가 불러오지 않습니다. |

- 다시 실행하기: `npm run xdr:run -- brute-force`(결과 `xdr/brute-force/result.json`), `node xdr/brute-force/respond.mjs`(거부 후보와 알림), `node xdr/brute-force/read-alerts.mjs`(경보 확인).
- 저장점의 `npm run xdr:run -- brute-force` 결과: `block` 10, `alert` 9, `record` 9. T1110 표시가 없는 정상 이벤트 9건은 모두 `record`였습니다. 이 결과는 학생의 로컬 실행이며, 심판이 격리 환경에서 `decide.mjs`를 다시 실행해 판정합니다.
- 거부 후보는 **아직 ZTNA 판정기(`src/decider.mjs`)가 집행하지 않습니다.** 판정기 요청 계약(`docs/DECIDER_REQUEST.md`)에는 출발 주소가 없고(`signals.source`는 실제 경로에서 `none`) 사용자는 가명 `subjectId`로만 와서, 후보를 실제 요청에 맞춰 볼 값이 없습니다. 판정기의 기존 규칙(`starter.deny`)은 바꾸지 않았습니다. 로컬에서 후보 규칙에 시험 경보를 다시 대어 보면 명확한 공격 10건만 막히고 애매한 시도·정상 이벤트 18건은 통과했습니다.

## 보너스 xdr-02: 웹 주입 공격을 잡아 냅니다

`xdr/fixtures/web-injection.json`(수업용 Wazuh 모양 경보 26건, 원본은 고치지 않음)을 읽어 판단합니다.

| 파일 | 하는 일 |
| --- | --- |
| `xdr/web-injection/patterns.json` | MITRE ATT&CK T1190 근거 패턴 세 개: `sql-injection-in-params`(요청 인자 안의 SQL 구문, CWE-89), `script-tag-in-params`(스크립트 태그, CWE-79), `path-traversal-repeat`(경로 거슬러 올라가기 반복, CWE-22) |
| `xdr/web-injection/decide.mjs` | 심판이 격리 환경에서 불러오는 판정기. `import`·파일 읽기·바깥 요청 없이 위 패턴을 맨 위 상수로 옮겨 적고 `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 확신도 0.85 이상은 `block`, 0.5 이상은 `alert`, 그 아래는 `record`입니다. T1190 표시나 패턴 일치가 없으면 0.1, 있으면 0.5에서 시작해 같은 출발 주소(`data.srcip`)의 반복 횟수(1~8번)만큼 0.95까지 올립니다. 출발 주소가 없으면 반복을 세지 않습니다. 숫자 기준은 MITRE에 없어 연습용으로 정한 값입니다. |
| `xdr/web-injection/respond.mjs` | `decide` 결과 중 `block`의 출발 주소만 거부 후보로 `xdr/web-injection/deny-rules.json`에 씁니다(만료 시각 = 처리 시각 + 60분, 근거 경보 번호 포함). 계정 이름으로는 규칙을 만들지 않고, 정상(`record`) 이벤트에 나온 주소는 뺍니다. `block`·`alert`는 `xdr/alerts.log`에 한 줄씩 쌓고, 시험 경보를 후보 규칙에 다시 흘려 막힘·통과를 셉니다. |
| `xdr/web-injection/read-alerts.mjs` | 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. 요청 주소는 뽑지 않습니다. `decide.mjs`가 불러오지 않습니다. |

- 다시 실행하기: `npm run xdr:run -- web-injection`(결과 `xdr/web-injection/result.json`, 성공하면 화면 출력 없음), `node xdr/web-injection/respond.mjs`(거부 후보·알림·다시 흘리기), `node xdr/web-injection/read-alerts.mjs`(경보 확인).
- 저장점의 `npm run xdr:run -- web-injection` 결과: `block` 8, `alert` 9, `record` 9. T1190 표시가 없는 정상 이벤트 9건은 모두 `record`였습니다. 이 결과는 학생의 로컬 실행이며, 심판이 격리 환경에서 `decide.mjs`를 다시 실행해 판정합니다.
- 다시 흘리기 결과: `block` 8건만 막혔고, `alert` 9건과 `record` 9건은 통과했습니다.
- 첫 제출 기록: `decide.mjs`를 push하기 전에 제출해 심판이 파일을 찾지 못했습니다. 두 번째 제출은 `X02_CLEAR_NOT_BLOCKED`였습니다. `wi-06`(명령 구분자 표기 11번 반복)을 세 패턴에 맞지 않는다는 이유로 `alert`로 낮췄고, 출발 주소를 확인하지 않았기 때문입니다. 지금은 T1190 표시와 같은 주소의 반복으로 `block`합니다.
- 남은 약점: `wi-06`의 차단 근거는 세 패턴이 아니라 T1190 표시와 반복입니다. 명령 주입 패턴(CWE-78)은 `patterns.json`에 없습니다.
- 거부 후보는 xdr-01과 같은 이유로 **아직 ZTNA 판정기(`src/decider.mjs`)가 집행하지 않습니다.** 판정기 요청 계약에는 출발 주소가 없고 쿼리도 길이·지문으로만 옵니다. 판정기의 기존 규칙(`starter.deny`)은 바꾸지 않았습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
