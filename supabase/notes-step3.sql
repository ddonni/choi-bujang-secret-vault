-- 3단계: 메모 API 모양({id, title, body}, id는 UUID)에 맞게 public.notes를 바꿉니다.
-- 2단계 notes.sql을 실행한 뒤, Supabase 대시보드 > SQL Editor에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 됩니다. 실제 학생 자료, 비밀번호, 키를 이 파일에 넣지 마세요.

do $$
begin
  -- content 칸 이름을 API와 같은 body로 바꿉니다.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'notes' and column_name = 'content') then
    alter table public.notes rename column content to body;
  end if;
  -- 숫자 id를 UUID id로 바꿉니다. 기존 메모 네 건에는 새 UUID가 붙습니다.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'notes' and column_name = 'id'
               and data_type = 'bigint') then
    alter table public.notes drop column id;
    alter table public.notes add column id uuid not null default gen_random_uuid() primary key;
  end if;
end $$;

-- 사용자마다 같은 제목을 쓸 수 있게 제목 중복 금지를 풉니다.
alter table public.notes drop constraint if exists notes_title_key;
alter table public.notes add column if not exists updated_at timestamptz not null default now();
-- owner_id는 서버가 확인한 사용자 ID입니다. auth.users 외래키는 걸지 않습니다.
create index if not exists notes_owner_id_idx on public.notes (owner_id);

-- RLS는 켠 채로 두고 anon·authenticated 권한은 계속 주지 않습니다. 서버 함수만 읽고 씁니다.
alter table public.notes enable row level security;
revoke all on table public.notes from anon, authenticated;

-- (선택) 소유자가 없는 기존 메모 네 건을 A 계정 목록에 보이게 하려면
-- Authentication > Users에서 A의 User UID를 복사해 아래 줄의 앞 '--'를 지우고 실행하세요.
-- update public.notes set owner_id = '<A의 User UID>' where owner_id is null;

-- 확인용 조회: 칸 목록, RLS 켜짐, anon·authenticated 권한 없음
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'notes'
 order by ordinal_position;

select relname, relrowsecurity
  from pg_class
 where oid = 'public.notes'::regclass;

select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'notes'
   and grantee in ('anon', 'authenticated');
