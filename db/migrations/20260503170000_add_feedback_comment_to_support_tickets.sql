alter type public.support_ticket_status
  add value if not exists 'aguardando_feedback_comentario';

alter table public.support_tickets
  add column if not exists feedback_comment text,
  add column if not exists feedback_comment_received_at timestamptz;

alter table public.support_tickets
  drop constraint if exists support_tickets_feedback_comment_not_blank;

alter table public.support_tickets
  add constraint support_tickets_feedback_comment_not_blank
    check (feedback_comment is null or btrim(feedback_comment) <> '');

drop index if exists public.support_tickets_one_open_per_customer_phone_idx;
drop index if exists public.support_tickets_one_open_per_customer_lid_idx;

create unique index if not exists support_tickets_one_open_per_customer_phone_idx
  on public.support_tickets (customer_phone)
  where customer_phone is not null
    and status in (
      'em_fila',
      'em_atendimento',
      'aguardando_feedback',
      'aguardando_feedback_comentario'
    );

create unique index if not exists support_tickets_one_open_per_customer_lid_idx
  on public.support_tickets (customer_lid)
  where customer_lid is not null
    and status in (
      'em_fila',
      'em_atendimento',
      'aguardando_feedback',
      'aguardando_feedback_comentario'
    );
