-- Atomic snapshot replace + apply (single transaction via RPC).
-- Keeps change_log across replace_ads_snapshot.

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
  delete from public.target_daily_clicks;
  delete from public.targets;
  delete from public.placement_modifiers;
  delete from public.audience_modifiers;
  delete from public.campaign_daily_spend;
  delete from public.ad_groups;
  delete from public.campaigns;

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

create or replace function public.apply_ramp_batch(
  p_target_bids jsonb,
  p_placements jsonb,
  p_audiences jsonb,
  p_log jsonb
)
returns void
language plpgsql
as $$
begin
  if p_target_bids is not null then
    update public.targets t
    set bid = (row->>'bid')::numeric
    from jsonb_array_elements(p_target_bids) as row
    where t.id = row->>'id';
  end if;

  if p_placements is not null then
    update public.placement_modifiers pm
    set percent = (row->>'percent')::numeric
    from jsonb_array_elements(p_placements) as row
    where pm.campaign_id = row->>'campaignId'
      and pm.placement = row->>'placement';
  end if;

  if p_audiences is not null then
    update public.audience_modifiers am
    set percent = (row->>'percent')::numeric
    from jsonb_array_elements(p_audiences) as row
    where am.campaign_id = row->>'campaignId'
      and am.id = row->>'id';
  end if;

  if p_log is not null and jsonb_array_length(p_log) > 0 then
    insert into public.change_log (
      id,
      created_at,
      campaign_id,
      campaign_name,
      change_group,
      entity_id,
      label,
      before_value,
      after_value,
      percent
    )
    select
      coalesce((e->>'id')::uuid, gen_random_uuid()),
      coalesce((e->>'createdAt')::timestamptz, now()),
      e->>'campaignId',
      e->>'campaignName',
      e->>'group',
      e->>'entityId',
      e->>'label',
      (e->>'before')::numeric,
      (e->>'after')::numeric,
      (e->>'percent')::integer
    from jsonb_array_elements(p_log) as e;
  end if;
end;
$$;
