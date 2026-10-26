-- safeupdate (enabled on Supabase) rejects DELETE without a WHERE clause,
-- including inside plpgsql. Use WHERE true / TRUNCATE instead.

create or replace function public.replace_ads_snapshot(payload jsonb)
returns void
language plpgsql
as $$
declare
  c jsonb;
  ag jsonb;
  t jsonb;
  day_key text;
  day_val numeric;
begin
  -- Wipe working snapshot only (change_log is intentionally kept).
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

  for c in select * from jsonb_array_elements(payload)
  loop
    insert into public.campaigns (id, name, state)
    values (
      c->>'id',
      c->>'name',
      c->>'state'
    );

    if c ? 'adGroups' then
      for ag in select * from jsonb_array_elements(c->'adGroups')
      loop
        insert into public.ad_groups (id, campaign_id, name)
        values (ag->>'id', c->>'id', ag->>'name');
      end loop;
    end if;

    if c ? 'spendByDate' then
      for day_key, day_val in
        select key, value::text::numeric
        from jsonb_each(c->'spendByDate')
      loop
        insert into public.campaign_daily_spend (campaign_id, day, spend_usd)
        values ((c->>'id'), day_key::date, day_val);
      end loop;
    end if;

    if c ? 'targets' then
      for t in select * from jsonb_array_elements(c->'targets')
      loop
        insert into public.targets (
          id, campaign_id, ad_group_id, kind, label, match_type, bid
        )
        values (
          t->>'id',
          c->>'id',
          t->>'adGroupId',
          t->>'kind',
          t->>'label',
          nullif(t->>'matchType', ''),
          (t->>'bid')::numeric
        );

        if t ? 'clicksByDate' then
          for day_key, day_val in
            select key, value::text::numeric
            from jsonb_each(t->'clicksByDate')
          loop
            insert into public.target_daily_clicks (target_id, day, clicks)
            values (t->>'id', day_key::date, day_val::integer);
          end loop;
        end if;
      end loop;
    end if;

    if c ? 'placements' then
      insert into public.placement_modifiers (campaign_id, placement, percent)
      select
        c->>'id',
        p->>'placement',
        (p->>'percent')::numeric
      from jsonb_array_elements(c->'placements') as p;
    end if;

    if c ? 'audiences' then
      insert into public.audience_modifiers (id, campaign_id, name, kind, percent)
      select
        a->>'id',
        c->>'id',
        a->>'name',
        a->>'kind',
        (a->>'percent')::numeric
      from jsonb_array_elements(c->'audiences') as a;
    end if;
  end loop;
end;
$$;

grant execute on function public.replace_ads_snapshot(jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
