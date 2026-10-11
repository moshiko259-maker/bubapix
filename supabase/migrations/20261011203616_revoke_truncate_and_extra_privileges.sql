-- TRUNCATE is not covered by row level security, so signed-in accounts must
-- not have it. Also removes REFERENCES and TRIGGER, which nobody needs.
revoke truncate, references, trigger on public.submissions, public.submission_contacts, public.ratings, public.admin_emails from authenticated, anon;
