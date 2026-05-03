create table if not exists public.support_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_settings_key_not_blank check (btrim(key) <> '')
);

drop trigger if exists support_settings_set_updated_at on public.support_settings;

create trigger support_settings_set_updated_at
  before update on public.support_settings
  for each row
  execute function public.set_support_ticket_updated_at();
