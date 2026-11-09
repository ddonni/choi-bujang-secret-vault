-- 자료실 서버의 기기 등록 기록입니다. 반 엔진의 기기 판정과는 별개입니다.
-- SQL Editor에서 실행하세요. 다시 실행해도 됩니다. 실제 키나 개인정보를 이 파일에 넣지 마세요.
-- 서버 함수는 조회·추가만 할 수 있습니다. 승인은 아래 update를 SQL Editor에서 직접 실행할 때만 됩니다.

create table if not exists public.device_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_sha256 text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, token_sha256)
);

alter table public.device_approvals enable row level security;
revoke all on table public.device_approvals from public, anon, authenticated, service_role;
grant select, insert on table public.device_approvals to service_role;

-- 승인 대기 목록 확인
select id, user_id, status, requested_at from public.device_approvals order by requested_at desc;

-- 화면에 나온 요청 번호로 승인할 때: 맨 앞 '--'를 지우고 <요청 번호>를 바꿔 실행합니다.
-- update public.device_approvals set status = 'approved', decided_at = now() where id = '<요청 번호>' and status = 'pending';
-- 승인을 취소할 때:
-- update public.device_approvals set status = 'revoked', decided_at = now() where id = '<요청 번호>';
