-- Run this in the Supabase SQL editor to enable server-side profile persistence.
-- The app works without it (preferences mirror into auth.users.user_metadata),
-- but this table gives a clean, dedicated store with row-level security.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  department text,
  matric_number text,
  verified boolean not null default false,
  language text not null default 'en-NG',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Blocked users
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_id text not null,
  full_name text,
  handle text,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (user_id, blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "Users manage their blocked list"
  on public.blocked_users for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Login history
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ip_address text,
  device text,
  location text,
  created_at timestamptz not null default now()
);

alter table public.login_history enable row level security;

create policy "Users read their own login history"
  on public.login_history for select
  using (auth.uid() = user_id);

create policy "Users insert their own login history"
  on public.login_history for insert
  with check (auth.uid() = user_id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, department, preferences)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'department',
    '{}'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
