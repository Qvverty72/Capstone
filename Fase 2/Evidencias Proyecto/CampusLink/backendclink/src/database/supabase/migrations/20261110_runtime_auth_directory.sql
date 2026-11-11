-- Supabase owns auth schema and cannot delegate its USAGE to this isolated runtime role.
-- Fixed projection owned by the operator: no password hashes/tokens, parameters or dynamic SQL.
CREATE OR REPLACE VIEW public.campuslink_auth_directory WITH (security_barrier=true)
 AS SELECT id,email,created_at FROM auth.users;
REVOKE ALL ON public.campuslink_auth_directory FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.campuslink_auth_directory TO service_role;
