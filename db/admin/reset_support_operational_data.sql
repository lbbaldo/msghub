begin;

truncate table
  public.support_attendant_sessions,
  public.support_client_notes,
  public.support_contacts,
  public.support_messages,
  public.support_tickets
restart identity cascade;

insert into public.support_audit_events (event, metadata)
values (
  'support_operational_data_reset',
  jsonb_build_object(
    'reason',
    'WhatsApp number migration and production start',
    'preserved',
    jsonb_build_array('support_users', 'support_settings', 'support_audit_events')
  )
);

commit;
