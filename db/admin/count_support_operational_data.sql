select 'support_tickets' as table_name, count(*) as total
from public.support_tickets
union all
select 'support_messages', count(*)
from public.support_messages
union all
select 'support_attendant_sessions', count(*)
from public.support_attendant_sessions
union all
select 'support_contacts', count(*)
from public.support_contacts
union all
select 'support_client_notes', count(*)
from public.support_client_notes
union all
select 'support_users', count(*)
from public.support_users
union all
select 'support_settings', count(*)
from public.support_settings
order by table_name;
