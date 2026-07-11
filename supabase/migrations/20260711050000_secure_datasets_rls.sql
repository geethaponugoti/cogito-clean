-- `datasets` had RLS policies defined but row level security was never
-- actually enabled on the table, so the policies were never enforced.
-- Confirmed via `supabase db advisors` (rls_disabled_in_public) and a live
-- anon-key request that returned another session's owner_token — any
-- anonymous caller could read (and, per RLS being off entirely, likely
-- write/delete) every row, including the owner_token that gates access
-- to `analyses`, comments, and share links elsewhere in the schema.

alter table public.datasets enable row level security;

drop policy if exists "Enable read access for all users" on public.datasets;

drop policy if exists "datasets_select_own" on public.datasets;
create policy "datasets_select_own" on public.datasets
  for select
  using (owner_token = coalesce(current_setting('request.headers', true)::json ->> 'x-owner-token', ''));

drop policy if exists "datasets_insert_own" on public.datasets;
create policy "datasets_insert_own" on public.datasets
  for insert
  with check (owner_token = coalesce(current_setting('request.headers', true)::json ->> 'x-owner-token', ''));

-- No update/delete policy: the app never updates or deletes dataset rows from
-- the client, so those operations stay fully denied once RLS is enabled.

-- match_similar_datasets() is SECURITY DEFINER and only ever returns
-- filename/row_count/col_count/similarity (never owner_token), so it keeps
-- working for cross-owner discovery unaffected by this table-level lockdown.
