alter table public.support_tickets
  add column if not exists internal_note text,
  add column if not exists internal_note_updated_at timestamptz;

alter table public.support_tickets
  drop constraint if exists support_tickets_internal_note_not_blank;

alter table public.support_tickets
  add constraint support_tickets_internal_note_not_blank
    check (internal_note is null or btrim(internal_note) <> '');

create table if not exists public.support_client_notes (
  client_key text primary key,
  note text not null,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_client_notes_client_key_not_blank check (btrim(client_key) <> ''),
  constraint support_client_notes_note_not_blank check (btrim(note) <> ''),
  constraint support_client_notes_created_by_not_blank check (btrim(created_by) <> ''),
  constraint support_client_notes_updated_by_not_blank check (btrim(updated_by) <> '')
);

drop trigger if exists support_client_notes_set_updated_at on public.support_client_notes;

create trigger support_client_notes_set_updated_at
  before update on public.support_client_notes
  for each row
  execute function public.set_support_ticket_updated_at();
