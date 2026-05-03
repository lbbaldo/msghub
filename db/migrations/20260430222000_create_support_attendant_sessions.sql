create table if not exists public.support_attendant_sessions (
  id uuid primary key default gen_random_uuid(),
  attendant_jid text not null,
  attendant_phone text,
  attendant_name text,
  active_ticket_id uuid references public.support_tickets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_attendant_sessions_attendant_jid_not_blank check (btrim(attendant_jid) <> ''),
  constraint support_attendant_sessions_attendant_phone_not_blank check (
    attendant_phone is null or btrim(attendant_phone) <> ''
  ),
  constraint support_attendant_sessions_attendant_name_not_blank check (
    attendant_name is null or btrim(attendant_name) <> ''
  )
);

create unique index if not exists support_attendant_sessions_attendant_jid_idx
  on public.support_attendant_sessions (attendant_jid);

create unique index if not exists support_attendant_sessions_active_ticket_idx
  on public.support_attendant_sessions (active_ticket_id)
  where active_ticket_id is not null;

drop trigger if exists support_attendant_sessions_set_updated_at on public.support_attendant_sessions;

create trigger support_attendant_sessions_set_updated_at
  before update on public.support_attendant_sessions
  for each row
  execute function public.set_support_ticket_updated_at();
