-- Supabase schema for Malaysia receipt OCR system.
-- Run in Supabase SQL Editor after reviewing project-specific names.

create extension if not exists pgcrypto;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text,
  file_path text,
  processed_file_path text,
  image_processing jsonb,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'pending_review', 'synced', 'failed')),
  merchant_name text,
  company_reg_no text,
  address text,
  phone text,
  invoice_no text,
  date date,
  time text,
  category text not null default 'Other'
    check (category in ('Grocery', 'Fuel', 'F&B', 'Retail', 'Service', 'Other')),
  doc_type text not null default 'Receipt'
    check (doc_type in ('Receipt', 'Invoice', 'Credit Note', 'Expense')),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  service_charge numeric(10,2) not null default 0,
  rounding numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null default 0,
  payment_method text,
  change numeric(10,2) not null default 0,
  subsidy_details jsonb,
  tags text[] not null default '{}',
  confidence_score numeric(4,3) not null default 0,
  raw_ocr text,
  raw_ai jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  qty numeric(12,3) not null default 1,
  unit text,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_receipts_user_status_created
  on public.receipts (user_id, status, created_at desc);

create index if not exists idx_receipts_user_date
  on public.receipts (user_id, date desc);

create index if not exists idx_receipts_user_doc_type
  on public.receipts (user_id, doc_type);

create index if not exists idx_receipts_tags
  on public.receipts using gin (tags);

create index if not exists idx_receipt_items_receipt_id
  on public.receipt_items (receipt_id, sort_order);

create table if not exists public.ocr_usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  provider text not null,
  units integer not null default 0 check (units >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period, provider)
);

create index if not exists idx_ocr_usage_monthly_provider_period
  on public.ocr_usage_monthly (provider, period);

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.ocr_usage_monthly enable row level security;

create policy "Users can read own receipts"
  on public.receipts for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own receipts"
  on public.receipts for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own receipts"
  on public.receipts for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own receipts"
  on public.receipts for delete
  using ((select auth.uid()) = user_id);

create policy "Users can read own receipt items"
  on public.receipt_items for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own receipt items"
  on public.receipt_items for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own receipt items"
  on public.receipt_items for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own receipt items"
  on public.receipt_items for delete
  using ((select auth.uid()) = user_id);

create policy "Users can read own OCR usage"
  on public.ocr_usage_monthly for select
  using ((select auth.uid()) = user_id);

create or replace function public.consume_ocr_quota(
  p_user_id uuid,
  p_period text,
  p_provider text,
  p_units integer,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_units integer;
  current_units integer;
begin
  if p_user_id is null or p_period is null or p_provider is null then
    raise exception 'Missing quota identity';
  end if;

  if p_units <= 0 or p_limit <= 0 then
    raise exception 'Invalid quota request';
  end if;

  if p_units > p_limit then
    return 0;
  end if;

  insert into public.ocr_usage_monthly (user_id, period, provider, units, updated_at)
  values (p_user_id, p_period, p_provider, p_units, now())
  on conflict (user_id, period, provider)
  do update set
    units = public.ocr_usage_monthly.units + excluded.units,
    updated_at = now()
  where public.ocr_usage_monthly.units + excluded.units <= p_limit
  returning units into new_units;

  if new_units is null then
    select units into current_units
    from public.ocr_usage_monthly
    where user_id = p_user_id
      and period = p_period
      and provider = p_provider;
    return -coalesce(current_units, 0);
  end if;

  return new_units;
end;
$$;

revoke all on function public.consume_ocr_quota(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ocr_quota(uuid, text, text, integer, integer)
  to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

drop trigger if exists receipt_items_set_updated_at on public.receipt_items;
create trigger receipt_items_set_updated_at
  before update on public.receipt_items
  for each row execute function public.set_updated_at();

-- Storage bucket should be created in Supabase Dashboard or via storage API:
-- bucket: receipts
-- public: false
--
-- Recommended object path:
-- receipts/{user_id}/{receipt_id}/original.ext

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

create policy "Users can read own receipt files"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can upload own receipt files"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can update own receipt files"
  on storage.objects for update
  using (
    bucket_id = 'receipts'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'receipts'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own receipt files"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

