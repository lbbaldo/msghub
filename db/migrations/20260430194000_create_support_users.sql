do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_user_role') then
    create type public.support_user_role as enum (
      'admin',
      'supervisor',
      'atendente'
    );
  end if;
end;
$$;

create table if not exists public.support_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role public.support_user_role not null default 'atendente',
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_users_name_not_blank check (btrim(name) <> ''),
  constraint support_users_email_not_blank check (btrim(email) <> ''),
  constraint support_users_password_hash_not_blank check (btrim(password_hash) <> '')
);

create unique index if not exists support_users_email_lower_idx
  on public.support_users (lower(email));

drop trigger if exists support_users_set_updated_at on public.support_users;

create trigger support_users_set_updated_at
  before update on public.support_users
  for each row
  execute function public.set_support_ticket_updated_at();
