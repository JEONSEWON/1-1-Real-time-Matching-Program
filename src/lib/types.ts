// ===================================
// 영희컴퍼니 매칭 시스템 타입 정의
// ===================================

export interface Participant {
  id: string;
  nickname: string;
  is_online: boolean;
  created_at: string;
  last_seen: string;
}

export interface GameConfig {
  id: number;
  session_start_time: string | null;
  is_active: boolean;
  current_session_number: number;
  total_sessions: number;
  questions_per_session: number;
  seconds_per_question: number;
  between_session_seconds: number;
  updated_at: string;
}

export interface GameSession {
  id: string;
  session_number: number;
  status: 'waiting' | 'active' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  session_id: string;
  question_number: number;
  question_text: string;
  options: string[];
  created_at: string;
}

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  question_number: number;
  participant_nickname: string;
  answer_index: number | null;
  answered_at: string;
}

export interface Match {
  id: string;
  session_id: string;
  participant_a: string;
  participant_b: string;
  match_percentage: number;
  common_answers: CommonAnswer[];
  created_at: string;
}

export interface CommonAnswer {
  question_number: number;
  question_text: string;
  answer_text: string;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_nickname: string;
  content: string;
  created_at: string;
}

// 게임 화면 상태
export type GamePhase =
  | 'lobby'         // 닉네임 입력 전
  | 'waiting'       // 세션 시작 대기
  | 'countdown'     // 3-2-1 카운트다운
  | 'playing'       // 문제 풀이 중
  | 'result'        // 결과/채팅
  | 'between'       // 세션 간 대기
  | 'finished';     // 전체 종료
