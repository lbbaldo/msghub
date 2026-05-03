alter table public.support_users
  add column if not exists whatsapp_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_users_whatsapp_phone_not_blank'
  ) then
    alter table public.support_users
      add constraint support_users_whatsapp_phone_not_blank
      check (whatsapp_phone is null or btrim(whatsapp_phone) <> '')
      not valid;
  end if;
end;
$$;

alter table public.support_users
  validate constraint support_users_whatsapp_phone_not_blank;
