-- 10단계 안전 정책의 DB 접근 기준 문서입니다. 4단계 RLS 정책과 5단계 권한 회수를 합친 목표 상태입니다.
-- 실제 DB에서 읽어 온 사본이 아니며, 학습 DB에 적용됐는지는 코딩 도구가 확인하지 못했습니다.
-- 이 저장소의 어떤 명령도 이 파일을 실행하지 않습니다. 대상은 public.notes 하나입니다.

alter table public.notes enable row level security;

revoke all on table public.notes from public, anon, authenticated;

create policy notes_select_own on public.notes
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy notes_delete_own on public.notes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
