-- BubaPix visitor participation: comments, questions, ideas, private
-- consultations and ratings. Visitors never write to these tables
-- directly: the "community" Edge Function validates and inserts with the
-- service role. The public reads only approved content through the
-- functions at the end. Only admins (admin_emails) can moderate.

-- ---------- Admins ----------
create table public.admin_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;

-- True when the signed-in user has a confirmed email listed in admin_emails.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on a.email = lower(u.email)
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- Submissions ----------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('comment', 'question', 'idea', 'consult')),
  project_slug text check (project_slug is null or project_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  lang text not null default 'en' check (lang in ('en', 'he')),
  display_name text not null check (char_length(display_name) between 1 and 60),
  body text not null check (char_length(body) between 2 and 2000),
  public_ok boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  reply text check (reply is null or char_length(reply) <= 2000),
  replied_at timestamptz,
  edited boolean not null default false,
  moderated_at timestamptz,
  ip_hash text not null,
  -- A private consultation can never be published.
  constraint consult_never_public check (kind <> 'consult' or status <> 'approved'),
  -- An idea can be published only if the visitor agreed.
  constraint idea_needs_consent check (kind <> 'idea' or status <> 'approved' or public_ok),
  -- Comments and questions belong to a project.
  constraint comment_has_project check (kind not in ('comment', 'question') or project_slug is not null)
);
create index submissions_status_created on public.submissions (status, created_at desc);
create index submissions_ip_created on public.submissions (ip_hash, created_at desc);
create index submissions_project on public.submissions (project_slug, status);
alter table public.submissions enable row level security;

-- Email addresses are kept apart and are never readable by the public.
create table public.submission_contacts (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
alter table public.submission_contacts enable row level security;

-- ---------- Ratings ----------
create table public.ratings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  project_slug text not null check (project_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  stars smallint not null check (stars between 1 and 5),
  voter_hash text not null,
  unique (project_slug, voter_hash)
);
create index ratings_voter_created on public.ratings (voter_hash, created_at desc);
alter table public.ratings enable row level security;

-- ---------- Table privileges ----------
-- The public role has no direct table access at all.
revoke all on public.admin_emails, public.submissions, public.submission_contacts, public.ratings from anon;
-- Signed-in users (admins, via the policies below) can read and moderate,
-- but cannot insert, and can never change or delete a rating.
revoke all on public.admin_emails from authenticated;
revoke insert on public.submissions, public.submission_contacts from authenticated;
revoke insert, update, delete, truncate on public.ratings from authenticated;
revoke update, truncate on public.submission_contacts from authenticated;
-- Admins may only change moderation fields, never who sent what.
revoke update on public.submissions from authenticated;
grant update (status, reply, replied_at, body, edited, moderated_at) on public.submissions to authenticated;

-- ---------- Row level security: admins only ----------
create policy "admins read submissions" on public.submissions
  for select to authenticated using ((select public.is_admin()));
create policy "admins moderate submissions" on public.submissions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete submissions" on public.submissions
  for delete to authenticated using ((select public.is_admin()));
create policy "admins read contacts" on public.submission_contacts
  for select to authenticated using ((select public.is_admin()));
create policy "admins delete contacts" on public.submission_contacts
  for delete to authenticated using ((select public.is_admin()));
create policy "admins read ratings" on public.ratings
  for select to authenticated using ((select public.is_admin()));

-- ---------- Public read functions (approved content only) ----------
create or replace function public.public_comments(p_slug text)
returns table (id uuid, created_at timestamptz, kind text, display_name text, body text,
               reply text, replied_at timestamptz, edited boolean)
language sql stable security definer
set search_path = ''
as $$
  select s.id, s.created_at, s.kind, s.display_name, s.body, s.reply, s.replied_at, s.edited
  from public.submissions s
  where s.project_slug = p_slug
    and s.status = 'approved'
    and s.kind in ('comment', 'question')
  order by s.created_at
  limit 200;
$$;

create or replace function public.public_ideas()
returns table (id uuid, created_at timestamptz, display_name text, body text,
               reply text, replied_at timestamptz, edited boolean)
language sql stable security definer
set search_path = ''
as $$
  select s.id, s.created_at, s.display_name, s.body, s.reply, s.replied_at, s.edited
  from public.submissions s
  where s.kind = 'idea' and s.status = 'approved' and s.public_ok
  order by s.created_at desc
  limit 100;
$$;

-- Average and count are returned only when at least 3 real ratings exist.
create or replace function public.rating_summary(p_slug text)
returns json
language sql stable security definer
set search_path = ''
as $$
  select case when count(*) >= 3
    then json_build_object('enough', true, 'count', count(*), 'average', round(avg(stars)::numeric, 1))
    else json_build_object('enough', false, 'count', null, 'average', null)
  end
  from public.ratings
  where project_slug = p_slug;
$$;

revoke all on function public.public_comments(text), public.public_ideas(), public.rating_summary(text) from public;
grant execute on function public.public_comments(text), public.public_ideas(), public.rating_summary(text) to anon, authenticated;

-- ---------- Admin statistics ----------
create or replace function public.admin_rating_stats()
returns table (project_slug text, ratings bigint, average numeric,
               s1 bigint, s2 bigint, s3 bigint, s4 bigint, s5 bigint)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select r.project_slug, count(*), round(avg(r.stars)::numeric, 2),
           count(*) filter (where r.stars = 1), count(*) filter (where r.stars = 2),
           count(*) filter (where r.stars = 3), count(*) filter (where r.stars = 4),
           count(*) filter (where r.stars = 5)
    from public.ratings r
    group by r.project_slug
    order by r.project_slug;
end;
$$;
revoke all on function public.admin_rating_stats() from public, anon;
grant execute on function public.admin_rating_stats() to authenticated;
