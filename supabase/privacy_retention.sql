-- 개인정보처리방침의 보유 기간을 지키도록 오래된 기록을 자동 파기한다.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 [Run] 한 번 실행하면 된다.

-- 1) 제휴문의: 새 문의가 들어올 때마다 접수일로부터 1년 지난 문의를 지운다.
create or replace function public.inquiries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 제휴문의 도배 방지: 시각은 서버 시각으로 고정, 1시간에 전체 20건까지만 받는다.
  new.created_at := now();
  new.page := left(coalesce(new.page, ''), 200);
  if (select count(*) from public.inquiries where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many inquiries' using errcode = 'P0001';
  end if;
  delete from public.inquiries where created_at < now() - interval '1 year';
  return new;
end;
$$;

-- 2) 챗봇 이용 기록: 기록이 쌓일 때마다 2일 지난 기록을 지운다.
create or replace function public.chat_usage_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_usage where created_at < now() - interval '2 days';
  return null;
end;
$$;
revoke execute on function public.chat_usage_cleanup() from public, anon, authenticated;
drop trigger if exists chat_usage_cleanup on public.chat_usage;
create trigger chat_usage_cleanup after insert on public.chat_usage
  for each statement execute function public.chat_usage_cleanup();
