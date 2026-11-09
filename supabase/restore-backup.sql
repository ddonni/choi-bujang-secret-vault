-- 10단계: 시험 계정 B의 가상 메모 한 건을 비공개 사본 표에 복사합니다.
-- SQL Editor에 붙여넣고 <B 이메일>만 그 자리에서 바꿔 실행하세요. 바꾼 이메일을 이 파일에 저장하거나 커밋하지 마세요.
-- 메모 내용은 공개 저장소에 두지 않고 이 표에만 둡니다. 내용 해시는 sha256(title + 줄바꿈 + body)입니다.

create table if not exists public.notes_backup (
  id uuid primary key,
  owner_id uuid not null,
  title text not null,
  body text not null,
  content_sha256 text not null,
  copied_at timestamptz not null default now()
);

-- 감사 기록은 추가만 합니다. 서버 함수에 수정·삭제 권한을 주지 않습니다.
create table if not exists public.notes_restore_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  note_id uuid not null,
  actor_id uuid not null,
  result text not null,
  content_sha256 text
);

alter table public.notes_backup enable row level security;
alter table public.notes_restore_audit enable row level security;
revoke all on table public.notes_backup from public, anon, authenticated;
revoke all on table public.notes_restore_audit from public, anon, authenticated;
revoke all on table public.notes_backup, public.notes_restore_audit from service_role;
grant select on table public.notes_backup to service_role;
grant select, insert on table public.notes_restore_audit to service_role;

do $$
declare
  b_email text := '<B 이메일>';
  b_id uuid;
  matched int;
begin
  select id into b_id from auth.users where lower(email) = lower(b_email);
  if b_id is null then raise exception 'B 계정을 auth.users에서 찾지 못했습니다.'; end if;
  select count(*) into matched from public.notes where owner_id = b_id and title = 'B 시험 메모';
  if matched <> 1 then raise exception 'B 시험 메모가 1건이 아니라 %건입니다.', matched; end if;
  -- 이미 복사했으면 기존 사본을 덮어쓰지 않습니다.
  insert into public.notes_backup (id, owner_id, title, body, content_sha256)
  select id, owner_id, title, body, encode(sha256(convert_to(title || E'\n' || body, 'UTF8')), 'hex')
    from public.notes
   where owner_id = b_id and title = 'B 시험 메모'
  on conflict (id) do nothing;
end $$;

-- 이 결과의 id를 코딩 도구에 알려 주면 README에 적습니다. id는 비밀값이 아닙니다.
select id, owner_id, content_sha256, copied_at from public.notes_backup;
