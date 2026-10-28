-- 라벨용 정보: 관리자 페이지 [라벨 출력]이 MSDS에서 읽은 "라벨에 찍히는 내용"만 모아 둔 표.
-- 재고관리 앱(포천)의 [라벨 출력] 탭이 이 표를 읽어 라벨을 만든다. MSDS 파일 자체는 계속 관리자 전용이다.
-- Supabase 대시보드(대양피앤티 홈페이지 프로젝트) → SQL Editor에 붙여 넣고 [Run] 한 번 실행하면 된다.
--
--   읽기: 누구나 (라벨에 인쇄되어 밖으로 나가는 내용만 들어 있음)
--   쓰기: 관리자만 (관리자 페이지 [라벨 출력]에서 제품을 고르거나 [전체 저장]을 누를 때 저장)

create table if not exists public.label_products (
  product_code text primary key,                 -- 예: DY#2-YL043
  product_name text not null default '',         -- 예: 외장형 PANTONE 3985C 반광
  resin text not null default '',                -- 괄호 안 표기 (예: 폴리에스테르)
  kind text not null default '',                 -- 종류 (예: 폴리에스테르계)
  pictos text[] not null default '{}',           -- GHS 그림문자 (예: {GHS07,GHS08})
  signal text not null default '',               -- 신호어 (위험 / 경고)
  codes text[] not null default '{}',            -- H코드 (예: {H315,H351,H302})
  h text[] not null default '{}',                -- 유해·위험문구 (라벨 순서로 정렬됨)
  p text[] not null default '{}',                -- 예방조치문구 전체 (라벨에는 그림문자에 맞춰 3줄만 고름)
  supplier_name text not null default '',        -- MSDS의 회사명
  supplier_tel text not null default '',         -- MSDS의 긴급전화번호
  source text not null default '',               -- 읽은 파일 (원본 보관함 엑셀 등)
  updated_at timestamptz not null default now()
);

alter table public.label_products enable row level security;

drop policy if exists "label_products read" on public.label_products;
create policy "label_products read" on public.label_products
  for select to anon, authenticated using (true);

drop policy if exists "label_products admin write" on public.label_products;
create policy "label_products admin write" on public.label_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.label_products to anon, authenticated;
grant insert, update, delete on public.label_products to authenticated;
