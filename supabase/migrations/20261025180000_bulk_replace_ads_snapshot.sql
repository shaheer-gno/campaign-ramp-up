-- Bulk INSERT…SELECT from the JSON payload (no per-row loops).
-- Large panda packages were timing out under the nested plpgsql inserts.

create or replace function public.replace_ads_snapshot(payload jsonb)
returns void
language plpgsql
as $$
begin
  -- Allow large imports past the default PostgREST/statement timeout.
  perform set_config('statement_timeout', '5min', true);

  truncate table
    public.target_daily_clicks,
    public.targets,
    public.placement_modifiers,
    public.audience_modifiers,
    public.campaign_daily_spend,
    public.ad_groups,
    public.campaigns
    restart identity;

  if payload is null or jsonb_typeof(payload) <> 'array' then
    return;
  end if;

  insert into public.campaigns (id, name, state)
  select
    c->>'id',
    c->>'name',
    c->>'state'
  from jsonb_array_elements(payload) as c;

  insert into public.ad_groups (id, campaign_id, name)
  select distinct on (ag->>'id')
    ag->>'id',
    c->>'id',
    ag->>'name'
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_array_elements(coalesce(c->'adGroups', '[]'::jsonb)) as ag
  order by ag->>'id';

  insert into public.campaign_daily_spend (campaign_id, day, spend_usd)
  select
    c->>'id',
    d.key::date,
    (d.value #>> '{}')::numeric
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_each(coalesce(c->'spendByDate', '{}'::jsonb)) as d(key, value);

  insert into public.targets (
    id, campaign_id, ad_group_id, kind, label, match_type, bid
  )
  select
    t->>'id',
    c->>'id',
    t->>'adGroupId',
    t->>'kind',
    t->>'label',
    nullif(t->>'matchType', ''),
    (t->>'bid')::numeric
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_array_elements(coalesce(c->'targets', '[]'::jsonb)) as t;

  insert into public.target_daily_clicks (target_id, day, clicks)
  select
    t->>'id',
    d.key::date,
    (d.value #>> '{}')::integer
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_array_elements(coalesce(c->'targets', '[]'::jsonb)) as t
  cross join lateral jsonb_each(coalesce(t->'clicksByDate', '{}'::jsonb)) as d(key, value);

  insert into public.placement_modifiers (campaign_id, placement, percent)
  select
    c->>'id',
    p->>'placement',
    (p->>'percent')::numeric
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_array_elements(coalesce(c->'placements', '[]'::jsonb)) as p;

  insert into public.audience_modifiers (id, campaign_id, name, kind, percent)
  select
    a->>'id',
    c->>'id',
    a->>'name',
    a->>'kind',
    (a->>'percent')::numeric
  from jsonb_array_elements(payload) as c
  cross join lateral jsonb_array_elements(coalesce(c->'audiences', '[]'::jsonb)) as a;
end;
$$;

grant execute on function public.replace_ads_snapshot(jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
