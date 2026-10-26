-- Audience modifiers are per campaign. Amazon audience ids (and our synthetic
-- amazon_business row) repeat across campaigns, so id alone cannot be the PK.

alter table public.audience_modifiers
  drop constraint audience_modifiers_pkey;

alter table public.audience_modifiers
  add primary key (campaign_id, id);
