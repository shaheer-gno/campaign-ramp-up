-- Campaign ramp-up: local store for report + apply.
-- Amazon ids can land later in external_id columns. Rules stay in app code.

create table public.campaigns (
  id text primary key,
  name text not null,
  state text not null check (state in ('enabled', 'paused')),
  external_id text
);

create table public.campaign_daily_spend (
  campaign_id text not null references public.campaigns (id) on delete cascade,
  day date not null,
  spend_usd numeric(12, 2) not null,
  primary key (campaign_id, day)
);

create table public.targets (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('keyword', 'product_target')),
  label text not null,
  match_type text,
  bid numeric(12, 2) not null
);

create index targets_campaign_idx on public.targets (campaign_id);

create table public.target_daily_clicks (
  target_id text not null references public.targets (id) on delete cascade,
  day date not null,
  clicks integer not null,
  primary key (target_id, day)
);

create table public.placement_modifiers (
  campaign_id text not null references public.campaigns (id) on delete cascade,
  placement text not null check (
    placement in ('top_of_search', 'rest_of_search', 'product_pages')
  ),
  percent numeric(8, 2) not null,
  primary key (campaign_id, placement)
);

create table public.audience_modifiers (
  id text not null,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('standard', 'b2b')),
  percent numeric(8, 2) not null,
  primary key (campaign_id, id)
);

create index audience_modifiers_campaign_idx on public.audience_modifiers (campaign_id);

create table public.change_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id text not null,
  campaign_name text not null,
  change_group text not null check (
    change_group in ('bidding', 'placements', 'audience', 'b2b')
  ),
  entity_id text not null,
  label text not null,
  before_value numeric(12, 4) not null,
  after_value numeric(12, 4) not null,
  percent integer not null
);

create index change_log_created_idx on public.change_log (created_at desc);

-- Sample day: as-of 2026-10-22, yesterday spend 2026-10-21.

insert into public.campaigns (id, name, state) values
  ('camp-exact', 'SP | Planners | Exact | Ramp', 'enabled'),
  ('camp-auto', 'SP | Planners | Auto | Ramp', 'enabled'),
  ('camp-mature', 'SP | Planners | Phrase | Mature', 'enabled');

insert into public.campaign_daily_spend (campaign_id, day, spend_usd) values
  ('camp-exact', '2026-10-21', 1.40),
  ('camp-exact', '2026-10-20', 0.80),
  ('camp-auto', '2026-10-21', 0),
  ('camp-auto', '2026-10-20', 0.20),
  ('camp-mature', '2026-10-21', 42.50),
  ('camp-mature', '2026-10-20', 38.00);

insert into public.targets (id, campaign_id, kind, label, match_type, bid) values
  ('kw-planner', 'camp-exact', 'keyword', 'panda planner', 'exact', 0.85),
  ('kw-adhd', 'camp-exact', 'keyword', 'adhd daily planner', 'exact', 1.10),
  ('auto-close', 'camp-auto', 'product_target', 'close-match', 'auto', 0.60),
  ('kw-weekly', 'camp-mature', 'keyword', 'weekly planner', 'phrase', 1.40);

insert into public.target_daily_clicks (target_id, day, clicks) values
  ('kw-planner', '2026-10-21', 1),
  ('kw-planner', '2026-10-20', 0),
  ('kw-adhd', '2026-10-21', 3),
  ('kw-adhd', '2026-10-20', 3),
  ('auto-close', '2026-10-21', 0),
  ('auto-close', '2026-10-20', 1),
  ('kw-weekly', '2026-10-21', 20),
  ('kw-weekly', '2026-10-20', 18);

insert into public.placement_modifiers (campaign_id, placement, percent) values
  ('camp-exact', 'top_of_search', 0),
  ('camp-exact', 'rest_of_search', 15),
  ('camp-exact', 'product_pages', 0),
  ('camp-auto', 'top_of_search', 0),
  ('camp-auto', 'rest_of_search', 0),
  ('camp-auto', 'product_pages', 25),
  ('camp-mature', 'top_of_search', 40),
  ('camp-mature', 'rest_of_search', 10),
  ('camp-mature', 'product_pages', 0);

insert into public.audience_modifiers (id, campaign_id, name, kind, percent) values
  ('aud-views', 'camp-exact', 'Views remarketing', 'standard', 0),
  ('aud-b2b', 'camp-exact', 'Amazon Business', 'b2b', 10),
  ('aud-purchased', 'camp-auto', 'Purchased brand', 'standard', 5);
