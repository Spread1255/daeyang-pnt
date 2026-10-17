-- 관리자 페이지 [장치 기록] 탭에서 쓰는 테이블 (관리자만 읽고 쓸 수 있다).
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 [Run] 한 번 실행하면 된다.
--
--   device_fields     기록 항목 (축 각도, 출력 속도, 온도, 완료 시간 …) — 관리자 페이지에서 추가·수정
--   device_logs       시험·생산 기록 (장치·날짜·품명·코드 + 항목별 값)
--   device_standards  확정 기준값 (장치 + 품목별로 최종 정한 값) — 현장 출력용

create table if not exists public.device_fields (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  unit text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.device_logs (
  id uuid primary key default gen_random_uuid(),
  device text not null,
  log_date date not null default current_date,
  product_name text not null default '',
  product_code text not null default '',
  vals jsonb not null default '{}'::jsonb,   -- { device_fields.id: "값" }
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_standards (
  id uuid primary key default gen_random_uuid(),
  device text not null,
  product_name text not null default '',
  product_code text not null default '',
  vals jsonb not null default '{}'::jsonb,
  memo text not null default '',
  decided_at date not null default current_date,
  source_log_id uuid references public.device_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_logs_date_idx on public.device_logs (log_date desc);
create index if not exists device_standards_device_idx on public.device_standards (device, product_code);

alter table public.device_fields enable row level security;
alter table public.device_logs enable row level security;
alter table public.device_standards enable row level security;

do $$
declare t text;
begin
  foreach t in array array['device_fields', 'device_logs', 'device_standards'] loop
    execute format('drop policy if exists "%1$s admin all" on public.%1$I', t);
    execute format(
      'create policy "%1$s admin all" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 기본 항목 (처음 한 번만)
insert into public.device_fields (label, unit, sort_order)
select * from (values
  ('축 각도', '°', 1),
  ('출력 속도', '', 2),
  ('온도', '℃', 3),
  ('출력 후 완료 시간', '분', 4)
) v(label, unit, sort_order)
where not exists (select 1 from public.device_fields);
