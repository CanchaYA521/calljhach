create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_name text not null,
  phone text not null,
  product_type text not null check (product_type in ('reno', 'porta', 'linea_nueva', 'fija', 'migracion', 'upgrade')),
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'agendado', 'recuperado', 'perdido')),
  scheduled_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint scheduled_required_when_agendado check (status <> 'agendado' or scheduled_at is not null)
);

create table if not exists public.sale_follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phone text not null,
  sec text not null,
  product_type text not null default 'reno' check (product_type in ('reno', 'porta', 'linea_nueva', 'fija', 'migracion', 'upgrade')),
  sale_type text not null check (sale_type in ('recojo', 'delivery')),
  sale_result text not null default 'pendiente' check (sale_result in ('pendiente', 'venta', 'caida')),
  picked_up boolean not null default false,
  for_when text not null,
  sale_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  product_type text not null default 'general' check (product_type in ('general', 'reno', 'porta', 'linea_nueva', 'fija', 'migracion', 'upgrade')),
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  summary text,
  extracted_text text,
  page_count integer,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint knowledge_chunks_document_id_chunk_index_key unique (document_id, chunk_index)
);

create table if not exists public.knowledge_document_audits (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  title text not null,
  product_type text not null check (product_type in ('general', 'reno', 'porta', 'linea_nueva', 'fija', 'migracion', 'upgrade')),
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.sale_follow_ups
add column if not exists sale_type text;

update public.sale_follow_ups
set sale_type = 'recojo'
where sale_type is null;

alter table public.sale_follow_ups
alter column sale_type set default 'recojo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_follow_ups_sale_type_check'
      and conrelid = 'public.sale_follow_ups'::regclass
  ) then
    alter table public.sale_follow_ups
    add constraint sale_follow_ups_sale_type_check
    check (sale_type in ('recojo', 'delivery'));
  end if;
end
$$;

alter table public.sale_follow_ups
alter column sale_type set not null;

alter table if exists public.sale_follow_ups
add column if not exists product_type text;

update public.sale_follow_ups
set product_type = 'reno'
where product_type is null;

alter table public.sale_follow_ups
alter column product_type set default 'reno';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_follow_ups_product_type_check'
      and conrelid = 'public.sale_follow_ups'::regclass
  ) then
    alter table public.sale_follow_ups
    add constraint sale_follow_ups_product_type_check
    check (product_type in ('reno', 'porta', 'linea_nueva', 'fija', 'migracion', 'upgrade'));
  end if;
end
$$;

alter table public.sale_follow_ups
alter column product_type set not null;

alter table if exists public.sale_follow_ups
add column if not exists sale_result text;

update public.sale_follow_ups
set sale_result = 'pendiente'
where sale_result is null;

alter table public.sale_follow_ups
alter column sale_result set default 'pendiente';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_follow_ups_sale_result_check'
      and conrelid = 'public.sale_follow_ups'::regclass
  ) then
    alter table public.sale_follow_ups
    add constraint sale_follow_ups_sale_result_check
    check (sale_result in ('pendiente', 'venta', 'caida'));
  end if;
end
$$;

alter table public.sale_follow_ups
alter column sale_result set not null;

alter table if exists public.sale_follow_ups
add column if not exists picked_up boolean;

update public.sale_follow_ups
set picked_up = false
where picked_up is null;

alter table public.sale_follow_ups
alter column picked_up set default false;

alter table public.sale_follow_ups
alter column picked_up set not null;

create index if not exists cases_user_id_idx on public.cases (user_id);
create index if not exists cases_status_idx on public.cases (status);
create index if not exists cases_scheduled_at_idx on public.cases (scheduled_at);
create index if not exists sale_follow_ups_user_id_idx on public.sale_follow_ups (user_id);
create index if not exists sale_follow_ups_product_type_idx on public.sale_follow_ups (product_type);
create index if not exists sale_follow_ups_sale_type_idx on public.sale_follow_ups (sale_type);
create index if not exists sale_follow_ups_sale_result_idx on public.sale_follow_ups (sale_result);
create index if not exists sale_follow_ups_picked_up_idx on public.sale_follow_ups (picked_up);
create index if not exists sale_follow_ups_sale_date_idx on public.sale_follow_ups (sale_date);
create index if not exists knowledge_documents_user_id_idx on public.knowledge_documents (user_id);
create index if not exists knowledge_documents_status_idx on public.knowledge_documents (status);
create index if not exists knowledge_documents_product_type_idx on public.knowledge_documents (product_type);
create index if not exists knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);
create index if not exists knowledge_chunks_user_id_idx on public.knowledge_chunks (user_id);
create index if not exists knowledge_document_audits_document_id_idx on public.knowledge_document_audits (document_id);
create index if not exists knowledge_document_audits_user_id_idx on public.knowledge_document_audits (user_id);
create index if not exists knowledge_document_audits_created_at_idx on public.knowledge_document_audits (created_at desc);

create or replace function public.set_cases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_cases_updated_at on public.cases;
create trigger set_cases_updated_at
before update on public.cases
for each row
execute function public.set_cases_updated_at();

create or replace function public.set_sale_follow_ups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_sale_follow_ups_updated_at on public.sale_follow_ups;
create trigger set_sale_follow_ups_updated_at
before update on public.sale_follow_ups
for each row
execute function public.set_sale_follow_ups_updated_at();

create or replace function public.set_knowledge_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_knowledge_documents_updated_at on public.knowledge_documents;
create trigger set_knowledge_documents_updated_at
before update on public.knowledge_documents
for each row
execute function public.set_knowledge_documents_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.sale_follow_ups enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_document_audits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own"
on public.cases
for select
using (auth.uid() = user_id);

drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own"
on public.cases
for insert
with check (auth.uid() = user_id);

drop policy if exists "cases_update_own" on public.cases;
create policy "cases_update_own"
on public.cases
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sale_follow_ups_select_own" on public.sale_follow_ups;
create policy "sale_follow_ups_select_own"
on public.sale_follow_ups
for select
using (auth.uid() = user_id);

drop policy if exists "sale_follow_ups_insert_own" on public.sale_follow_ups;
create policy "sale_follow_ups_insert_own"
on public.sale_follow_ups
for insert
with check (auth.uid() = user_id);

drop policy if exists "sale_follow_ups_update_own" on public.sale_follow_ups;
create policy "sale_follow_ups_update_own"
on public.sale_follow_ups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "knowledge_documents_select_own" on public.knowledge_documents;
create policy "knowledge_documents_select_own"
on public.knowledge_documents
for select
using (auth.uid() = user_id);

drop policy if exists "knowledge_documents_insert_own" on public.knowledge_documents;
create policy "knowledge_documents_insert_own"
on public.knowledge_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "knowledge_documents_update_own" on public.knowledge_documents;
create policy "knowledge_documents_update_own"
on public.knowledge_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "knowledge_documents_delete_own" on public.knowledge_documents;
create policy "knowledge_documents_delete_own"
on public.knowledge_documents
for delete
using (auth.uid() = user_id);

drop policy if exists "knowledge_chunks_select_own" on public.knowledge_chunks;
create policy "knowledge_chunks_select_own"
on public.knowledge_chunks
for select
using (auth.uid() = user_id);

drop policy if exists "knowledge_chunks_insert_own" on public.knowledge_chunks;
create policy "knowledge_chunks_insert_own"
on public.knowledge_chunks
for insert
with check (auth.uid() = user_id);

drop policy if exists "knowledge_chunks_delete_own" on public.knowledge_chunks;
create policy "knowledge_chunks_delete_own"
on public.knowledge_chunks
for delete
using (auth.uid() = user_id);

drop policy if exists "knowledge_document_audits_select_own" on public.knowledge_document_audits;
create policy "knowledge_document_audits_select_own"
on public.knowledge_document_audits
for select
using (auth.uid() = user_id);

drop policy if exists "knowledge_document_audits_insert_own" on public.knowledge_document_audits;
create policy "knowledge_document_audits_insert_own"
on public.knowledge_document_audits
for insert
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-documents',
  'knowledge-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "knowledge_storage_select_own" on storage.objects;
create policy "knowledge_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'knowledge-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "knowledge_storage_insert_own" on storage.objects;
create policy "knowledge_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'knowledge-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "knowledge_storage_update_own" on storage.objects;
create policy "knowledge_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'knowledge-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'knowledge-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "knowledge_storage_delete_own" on storage.objects;
create policy "knowledge_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'knowledge-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
