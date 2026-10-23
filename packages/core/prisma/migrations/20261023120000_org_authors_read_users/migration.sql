-- Lets the tenant app role read the people who wrote something in the current org, so the board
-- list can show who posted without the admin client (the admin client stays the only RLS
-- exemption, with its six enumerated callers).
--
-- `users` is not tenant-owned (a person belongs to many orgs), so it has no tenant_isolation
-- policy and until now the app role saw nothing in it. This adds the narrowest read that serves
-- the list: SELECT only, and only for users who authored a post or a comment in the org named by
-- `app.org_id`. A person who has written nothing here stays invisible, and so does every row of
-- another org's authors. INSERT, UPDATE and DELETE remain denied (no policy covers them).
--
-- The org setting is read in the same `(SELECT nullif((SELECT current_setting(...))))` form as the
-- tenant policies, so it is evaluated once and the `auth_rls_initplan` advisor stays quiet.

CREATE POLICY org_authors_read ON "users"
  FOR SELECT TO feedbackboard_app
  USING (
    id IN (
      SELECT author_id FROM "posts"
      WHERE org_id = (SELECT nullif((SELECT current_setting('app.org_id', true)), '')::uuid)
    )
    OR id IN (
      SELECT author_id FROM "comments"
      WHERE org_id = (SELECT nullif((SELECT current_setting('app.org_id', true)), '')::uuid)
    )
  );
