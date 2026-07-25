-- ============================================================
-- Gemini 每日用量計數(配額保護)
-- 以 UTC 日期為 key,午夜自動換日重置
-- 僅 service role 可存取(前端與一般使用者不可讀寫)
-- ============================================================

create table public.ai_usage (
  day date primary key,
  count integer not null default 0
);

alter table public.ai_usage enable row level security;
-- 不建立任何 policy:只有 service role(繞過 RLS)能存取

create or replace function public.increment_ai_usage()
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (day, count)
  values ((now() at time zone 'utc')::date, 1)
  on conflict (day) do update set count = ai_usage.count + 1
  returning count;
$$;

-- 僅允許 service role 呼叫
revoke all on function public.increment_ai_usage() from public;
revoke all on function public.increment_ai_usage() from anon;
revoke all on function public.increment_ai_usage() from authenticated;
grant execute on function public.increment_ai_usage() to service_role;
