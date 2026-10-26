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

- `/` 화면은 Supabase Auth 이메일·비밀번호 로그인·로그아웃을 공식 SDK(`@supabase/supabase-js`의 `signInWithPassword`·`signOut`)로 처리합니다. 화면 코드에는 공개용 Project URL과 publishable key만 들어 있습니다. 로그인에 실패하면 이유를 화면에 보여 줍니다.
- 자료 API는 시작 틀의 `src/verify-login.mjs`로 `Authorization: Bearer` 토큰을 검사합니다. 토큰이 없거나 검사에 실패하면 자료 없이 `401 LOGIN_REQUIRED`를 돌려줍니다. 브라우저가 보낸 `userId`·`role`·`owner_id`는 읽지 않습니다. 검사에 쓴 발급자 정보는 `aleph.config.json`의 `identityProvider`에 있습니다.
- 로그인한 사용자는 화면에서 가상 메모를 추가·수정·삭제합니다. 경로는 `aleph.config.json`의 `allowedRoutes`와 같습니다.

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

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
