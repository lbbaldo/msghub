create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_ticket_status') then
    create type public.support_ticket_status as enum (
      'em_fila',
      'em_atendimento',
      'aguardando_feedback',
      'finalizado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'support_ticket_category') then
    create type public.support_ticket_category as enum (
      'financeiro',
      'suporte',
      'pedido',
      'cadastro',
      'cardapio',
      'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'support_ticket_priority') then
    create type public.support_ticket_priority as enum (
      'baixa',
      'normal',
      'alta',
      'urgente'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'support_message_direction') then
    create type public.support_message_direction as enum (
      'recebida',
      'enviada'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'support_message_kind') then
    create type public.support_message_kind as enum (
      'texto',
      'imagem',
      'audio',
      'documento',
      'video',
      'sticker',
      'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'support_message_sender') then
    create type public.support_message_sender as enum (
      'cliente',
      'bot',
      'atendente'
    );
  end if;
end;
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  contact_name text,
  status public.support_ticket_status not null default 'em_fila',
  assigned_to text,
  category public.support_ticket_category,
  priority public.support_ticket_priority not null default 'normal',
  last_message text,
  last_message_at timestamptz,
  first_response_at timestamptz,
  feedback_score smallint check (feedback_score between 1 and 5),
  feedback_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint support_tickets_customer_phone_not_blank check (btrim(customer_phone) <> ''),
  constraint support_tickets_contact_name_not_blank check (contact_name is null or btrim(contact_name) <> ''),
  constraint support_tickets_assigned_to_not_blank check (assigned_to is null or btrim(assigned_to) <> ''),
  constraint support_tickets_closed_state check (
    (status = 'finalizado' and closed_at is not null)
    or (status <> 'finalizado')
  )
);

create unique index if not exists support_tickets_one_open_per_customer_idx
  on public.support_tickets (customer_phone)
  where status in ('em_fila', 'em_atendimento', 'aguardando_feedback');

create index if not exists support_tickets_status_updated_at_idx
  on public.support_tickets (status, updated_at desc);

create index if not exists support_tickets_assigned_to_updated_at_idx
  on public.support_tickets (assigned_to, updated_at desc)
  where assigned_to is not null;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  direction public.support_message_direction not null,
  content text not null,
  kind public.support_message_kind not null default 'texto',
  sent_by public.support_message_sender not null,
  attendant_id text,
  external_message_id text,
  from_me boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_messages_content_not_blank check (btrim(content) <> ''),
  constraint support_messages_attendant_for_agent check (
    sent_by <> 'atendente' or attendant_id is not null
  )
);

create unique index if not exists support_messages_external_message_id_idx
  on public.support_messages (external_message_id)
  where external_message_id is not null;

create index if not exists support_messages_ticket_created_at_idx
  on public.support_messages (ticket_id, created_at asc);

create table if not exists public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_audit_events_event_not_blank check (btrim(event) <> '')
);

create or replace function public.set_support_ticket_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row
  execute function public.set_support_ticket_updated_at();
