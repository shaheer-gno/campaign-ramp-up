-- Ad groups sit between campaigns and targets (Amazon hierarchy).

create table public.ad_groups (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  name text not null
);

create index ad_groups_campaign_idx on public.ad_groups (campaign_id);

alter table public.targets
  add column ad_group_id text references public.ad_groups (id) on delete cascade;

insert into public.ad_groups (id, campaign_id, name) values
  ('ag-exact-core', 'camp-exact', 'Core keywords'),
  ('ag-auto-default', 'camp-auto', 'Auto targeting'),
  ('ag-mature-core', 'camp-mature', 'Core keywords');

update public.targets set ad_group_id = 'ag-exact-core' where id in ('kw-planner', 'kw-adhd');
update public.targets set ad_group_id = 'ag-auto-default' where id = 'auto-close';
update public.targets set ad_group_id = 'ag-mature-core' where id = 'kw-weekly';

alter table public.targets
  alter column ad_group_id set not null;
