alter table public.support_tickets
  add column if not exists customer_lid text,
  add column if not exists customer_jid text;

update public.support_tickets
set customer_lid = customer_phone
where customer_lid is null
  and customer_phone like 'lid:%';

update public.support_tickets
set customer_phone = null
where customer_phone like 'lid:%';

alter table public.support_tickets
  alter column customer_phone drop not null;

alter table public.support_tickets
  drop constraint if exists support_tickets_customer_phone_not_blank,
  drop constraint if exists support_tickets_customer_identity_present,
  drop constraint if exists support_tickets_customer_lid_not_blank,
  drop constraint if exists support_tickets_customer_jid_not_blank;

alter table public.support_tickets
  add constraint support_tickets_customer_phone_not_blank
    check (customer_phone is null or btrim(customer_phone) <> ''),
  add constraint support_tickets_customer_lid_not_blank
    check (customer_lid is null or btrim(customer_lid) <> ''),
  add constraint support_tickets_customer_jid_not_blank
    check (customer_jid is null or btrim(customer_jid) <> ''),
  add constraint support_tickets_customer_identity_present
    check (customer_phone is not null or customer_lid is not null);

drop index if exists public.support_tickets_one_open_per_customer_idx;

create unique index if not exists support_tickets_one_open_per_customer_phone_idx
  on public.support_tickets (customer_phone)
  where customer_phone is not null
    and status in ('em_fila', 'em_atendimento', 'aguardando_feedback');

create unique index if not exists support_tickets_one_open_per_customer_lid_idx
  on public.support_tickets (customer_lid)
  where customer_lid is not null
    and status in ('em_fila', 'em_atendimento', 'aguardando_feedback');

create index if not exists support_tickets_customer_jid_idx
  on public.support_tickets (customer_jid)
  where customer_jid is not null;
