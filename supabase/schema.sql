-- AI 후기 커뮤니티 저장소 설정
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 로그인 없이 누구나 읽고 쓸 수 있게 하되,
--  · 글은 정해진 함수(add_review, add_comment)로만 넣을 수 있고 길이·점수 범위를 검사한다
--  · 지우기는 글 쓸 때 정한 비밀번호가 맞을 때만 (delete_review, delete_comment)
--  · 비밀번호는 암호화(bcrypt)해서 저장하고, 웹에서는 읽을 수 없다

create extension if not exists pgcrypto with schema extensions;

-- 후기
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  field      text not null check (char_length(field) between 1 and 20),     -- 분야: 컴퓨터, 수학, 인문 ...
  ai         text not null check (char_length(ai) between 1 and 30),        -- AI 이름: ChatGPT, Claude ...
  rating     int  not null check (rating between 1 and 5),                  -- 별점
  task       text check (char_length(task) <= 40),                          -- 어떤 일에 썼나 (선택)
  content    text not null check (char_length(content) between 5 and 1000),
  nickname   text not null check (char_length(nickname) between 1 and 20),
  pw_hash    text not null
);

-- 댓글
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  content    text not null check (char_length(content) between 1 and 500),
  nickname   text not null check (char_length(nickname) between 1 and 20),
  pw_hash    text not null
);

create index if not exists comments_review_idx on public.comments(review_id, created_at);
create index if not exists reviews_created_idx on public.reviews(created_at desc);

-- 보안 규칙: 읽기만 누구나, 직접 쓰기·고치기·지우기는 막음 (함수로만)
alter table public.reviews  enable row level security;
alter table public.comments enable row level security;
drop policy if exists "누구나 후기 읽기" on public.reviews;
drop policy if exists "누구나 댓글 읽기" on public.comments;
create policy "누구나 후기 읽기" on public.reviews  for select to anon, authenticated using (true);
create policy "누구나 댓글 읽기" on public.comments for select to anon, authenticated using (true);

-- 비밀번호 해시 열은 웹에서 읽지 못하게: 필요한 열만 읽기 허용
revoke all on public.reviews, public.comments from anon, authenticated;
grant select (id, created_at, field, ai, rating, task, content, nickname) on public.reviews  to anon, authenticated;
grant select (id, review_id, created_at, content, nickname)              on public.comments to anon, authenticated;

-- 글쓰기 함수
create or replace function public.add_review(p_field text, p_ai text, p_rating int, p_task text,
                                             p_content text, p_nickname text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if char_length(coalesce(p_password, '')) < 4 then raise exception '비밀번호는 4자 이상'; end if;
  insert into reviews(field, ai, rating, task, content, nickname, pw_hash)
  values (trim(p_field), trim(p_ai), p_rating, nullif(trim(p_task), ''), trim(p_content), trim(p_nickname),
          crypt(p_password, gen_salt('bf')))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.add_comment(p_review_id uuid, p_content text, p_nickname text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if char_length(coalesce(p_password, '')) < 4 then raise exception '비밀번호는 4자 이상'; end if;
  insert into comments(review_id, content, nickname, pw_hash)
  values (p_review_id, trim(p_content), trim(p_nickname), crypt(p_password, gen_salt('bf')))
  returning id into new_id;
  return new_id;
end $$;

-- 지우기 함수: 비밀번호가 맞으면 true
create or replace function public.delete_review(p_id uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from reviews where id = p_id and pw_hash = crypt(p_password, pw_hash);
  return found;
end $$;

create or replace function public.delete_comment(p_id uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from comments where id = p_id and pw_hash = crypt(p_password, pw_hash);
  return found;
end $$;

revoke all on function public.add_review, public.add_comment, public.delete_review, public.delete_comment from public;
grant execute on function public.add_review, public.add_comment, public.delete_review, public.delete_comment to anon, authenticated;
