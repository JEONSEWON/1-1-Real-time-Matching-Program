-- ===================================
-- 영희컴퍼니 실시간 1:1 매칭 시스템
-- Supabase Schema
-- ===================================

-- 1. 참가자 테이블
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  is_online boolean default true,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);

-- 2. 게임 전체 설정 (단일 행)
create table if not exists game_config (
  id int primary key default 1,
  session_start_time timestamptz,
  is_active boolean default false,
  current_session_number int default 0,
  total_sessions int default 10,
  questions_per_session int default 20,
  seconds_per_question int default 10,
  between_session_seconds int default 15,
  updated_at timestamptz default now()
);

-- 기본 config 행 삽입
insert into game_config (id) values (1) on conflict (id) do nothing;

-- 3. 세션 테이블 (총 10회)
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  session_number int not null,
  status text default 'waiting' check (status in ('waiting', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 4. 문제 테이블
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  question_number int not null,
  question_text text not null,
  options jsonb not null, -- string[]
  created_at timestamptz default now()
);

-- 5. 답변 테이블
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  question_number int not null,
  participant_nickname text not null,
  answer_index int, -- null = 미응답
  answered_at timestamptz default now(),
  unique(session_id, question_id, participant_nickname)
);

-- 6. 매칭 결과 테이블
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  participant_a text not null,
  participant_b text not null,
  match_percentage float not null,
  common_answers jsonb not null default '[]', -- [{question_number, question_text, answer_text}]
  created_at timestamptz default now(),
  unique(session_id, participant_a, participant_b)
);

-- 7. 채팅 메시지 테이블
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  sender_nickname text not null,
  content text not null,
  created_at timestamptz default now()
);

-- ===================================
-- RLS (Row Level Security)
-- ===================================
alter table participants enable row level security;
alter table game_config enable row level security;
alter table game_sessions enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table matches enable row level security;
alter table chat_messages enable row level security;

-- 모든 테이블 전체 공개 접근 허용 (anon key로 접근)
create policy "public_all" on participants for all using (true) with check (true);
create policy "public_all" on game_config for all using (true) with check (true);
create policy "public_all" on game_sessions for all using (true) with check (true);
create policy "public_all" on questions for all using (true) with check (true);
create policy "public_all" on answers for all using (true) with check (true);
create policy "public_all" on matches for all using (true) with check (true);
create policy "public_all" on chat_messages for all using (true) with check (true);

-- ===================================
-- Realtime 활성화
-- ===================================
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table game_config;
alter publication supabase_realtime add table game_sessions;
alter publication supabase_realtime add table questions;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table chat_messages;

-- ===================================
-- 인덱스
-- ===================================
create index if not exists idx_answers_session on answers(session_id);
create index if not exists idx_answers_participant on answers(participant_nickname);
create index if not exists idx_matches_session on matches(session_id);
create index if not exists idx_matches_participants on matches(participant_a, participant_b);
create index if not exists idx_chat_match on chat_messages(match_id);
create index if not exists idx_questions_session on questions(session_id, question_number);
