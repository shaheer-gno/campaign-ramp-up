-- PostgREST / service_role must be able to call snapshot RPCs.
grant execute on function public.replace_ads_snapshot(jsonb) to anon, authenticated, service_role;
grant execute on function public.apply_ramp_batch(jsonb, jsonb, jsonb, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
