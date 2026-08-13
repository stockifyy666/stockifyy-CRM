-- ============================================================
-- Stockifyy CRM — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends auth.users) ───────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('admin', 'finance', 'support')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Helper: security definer so it runs as owner (bypasses RLS, no recursion)
create or replace function public.get_my_role()
returns text language sql security definer stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Profiles: own row OR admin (non-recursive via helper function)
create policy "Users can read profiles"
  on public.profiles for select
  using (auth.uid() = id or public.get_my_role() = 'admin');

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (public.get_my_role() = 'admin');

-- Auto-create profile on signup (called from trigger)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'support')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CUSTOMERS ───────────────────────────────────────────────
create table public.customers (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  mobile              text not null,
  subscription_type   text not null check (subscription_type in ('Advisory', 'Paltanium Group', 'Invest with Stockifyy', 'Other')),
  amount              numeric(12,2) not null check (amount >= 0),
  subscription_start  timestamptz not null,
  subscription_end    timestamptz not null,
  notes               text,
  screenshot_url      text,
  added_by            uuid references public.profiles(id),
  updated_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.customers enable row level security;

-- All authenticated users can read customers
create policy "Authenticated users can read customers"
  on public.customers for select
  using (auth.uid() is not null);

-- Admin, Finance, Support can insert
create policy "Auth users can insert customers"
  on public.customers for insert
  with check (auth.uid() is not null);

-- Admin, Finance, Support can update
create policy "Auth users can update customers"
  on public.customers for update
  using (auth.uid() is not null);

-- Only admin can delete
create policy "Admins can delete customers"
  on public.customers for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

-- ─── COMMENTS ────────────────────────────────────────────────
create table public.comments (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  text        text not null,
  created_at  timestamptz default now()
);

alter table public.comments enable row level security;

-- All authenticated users can read comments
create policy "Auth users can read comments"
  on public.comments for select
  using (auth.uid() is not null);

-- Only admin and finance can insert comments
create policy "Admin and Finance can add comments"
  on public.comments for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'finance')
    )
  );

-- Only admin can delete comments
create policy "Admins can delete comments"
  on public.comments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─── STORAGE: payment-screenshots ────────────────────────────
insert into storage.buckets (id, name, public) values ('payment-screenshots', 'payment-screenshots', false)
  on conflict do nothing;

create policy "Auth users can upload screenshots"
  on storage.objects for insert
  with check (bucket_id = 'payment-screenshots' and auth.uid() is not null);

create policy "Auth users can view screenshots"
  on storage.objects for select
  using (bucket_id = 'payment-screenshots' and auth.uid() is not null);

create policy "Admins can delete screenshots"
  on storage.objects for delete
  using (
    bucket_id = 'payment-screenshots' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─── SEED: first admin user ──────────────────────────────────
-- After running this schema, create your first user via Supabase Auth UI
-- then run: UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-id>';
