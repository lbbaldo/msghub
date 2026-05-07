create table if not exists public.support_contacts (
  phone text primary key,
  name text not null,
  business_name text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_contacts_phone_not_blank check (btrim(phone) <> ''),
  constraint support_contacts_name_not_blank check (btrim(name) <> ''),
  constraint support_contacts_business_name_not_blank check (business_name is null or btrim(business_name) <> ''),
  constraint support_contacts_created_by_not_blank check (btrim(created_by) <> ''),
  constraint support_contacts_updated_by_not_blank check (btrim(updated_by) <> '')
);

alter table public.support_contacts
  add column if not exists business_name text;

alter table public.support_contacts
  drop constraint if exists support_contacts_business_name_not_blank;

alter table public.support_contacts
  add constraint support_contacts_business_name_not_blank
    check (business_name is null or btrim(business_name) <> '');

drop trigger if exists support_contacts_set_updated_at on public.support_contacts;

create trigger support_contacts_set_updated_at
  before update on public.support_contacts
  for each row
  execute function public.set_support_ticket_updated_at();
