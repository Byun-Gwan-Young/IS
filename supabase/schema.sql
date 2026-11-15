-- Run this in the Supabase SQL editor. Then enable Anonymous Sign-Ins in Auth settings.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.idea_categories (
  id text primary key,
  label text not null,
  sort_order integer not null default 0
);

insert into public.idea_categories (id, label, sort_order) values
  ('education', '교육', 1),
  ('work', '업무', 2),
  ('daily-life', '일상', 3),
  ('health', '건강', 4),
  ('finance', '금융', 5),
  ('creators', '창작자', 6),
  ('accessibility', '접근성', 7),
  ('other', '기타', 8)
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  discomfort text not null check (char_length(discomfort) between 8 and 1200),
  requested_feature text not null check (char_length(requested_feature) between 8 and 1200),
  target_user text not null default '' check (char_length(target_user) <= 300),
  category_id text not null references public.idea_categories(id),
  is_public boolean not null default true,
  normalized_title text not null default '' check (char_length(normalized_title) <= 100),
  problem_summary text not null default '' check (char_length(problem_summary) <= 500),
  audience_label text not null default '' check (char_length(audience_label) <= 200),
  refined_feature text not null default '' check (char_length(refined_feature) <= 500),
  ai_available boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ideas add column if not exists refined_feature text not null default '';

create index if not exists ideas_public_created_idx on public.ideas (is_public, created_at desc);
create index if not exists ideas_public_category_created_idx on public.ideas (category_id, created_at desc) where is_public;

create table if not exists public.idea_votes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

alter table public.idea_categories enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;

drop policy if exists "categories are readable" on public.idea_categories;
create policy "categories are readable" on public.idea_categories
  for select to anon, authenticated using (true);

drop policy if exists "public ideas and own private ideas are readable" on public.ideas;
create policy "public ideas and own private ideas are readable" on public.ideas
  for select to authenticated using (is_public or user_id = (select auth.uid()));

drop policy if exists "anonymous users create their own ideas" on public.ideas;
create policy "anonymous users create their own ideas" on public.ideas
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "authors update their own ideas" on public.ideas;
create policy "authors update their own ideas" on public.ideas
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "authors delete their own ideas" on public.ideas;
create policy "authors delete their own ideas" on public.ideas
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "votes for visible ideas are readable" on public.idea_votes;
create policy "votes for visible ideas are readable" on public.idea_votes
  for select to authenticated using (
    exists (
      select 1 from public.ideas
      where ideas.id = idea_votes.idea_id
        and (ideas.is_public or ideas.user_id = (select auth.uid()))
    )
  );

drop policy if exists "one vote per signed-in browser on public ideas" on public.idea_votes;
create policy "one vote per signed-in browser on public ideas" on public.idea_votes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ideas where ideas.id = idea_votes.idea_id and ideas.is_public)
  );

drop policy if exists "users remove their own public-idea vote" on public.idea_votes;
create policy "users remove their own public-idea vote" on public.idea_votes
  for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.idea_categories to anon, authenticated;
grant select, insert, update, delete on public.ideas to authenticated;
grant select, insert, delete on public.idea_votes to authenticated;

-- No service-role key is used by this application. Anonymous Auth + RLS
-- make the browser's publish, private read, and one-vote-per-anonymous-user
-- operations subject to the policies above.
