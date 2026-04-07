'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  GameConfig, GameSession, Question, Match, Participant, GamePhase,
} from '@/lib/types';
import Timer from './Timer';
import QuestionDisplay from './QuestionDisplay';
import ParticipantsList from './ParticipantsList';
import ChatModal from './ChatModal';

interface GameRoomProps {
  nickname: string;
}

export default function GameRoom({ nickname }: GameRoomProps) {
  const router = useRouter();
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [noMatchMessage, setNoMatchMessage] = useState('');
  const [noMatchCountdown, setNoMatchCountdown] = useState(5);

  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnswerSentRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    loadInitialData();
    const cleanup = setupRealtimeSubscriptions();
    const hb = setInterval(() => {
      supabase.from('participants')
        .update({ last_seen: new Date().toISOString() })
        .eq('nickname', nickname).then(() => {});
    }, 5000);
    const handleUnload = () => {
      navigator.sendBeacon('/api/offline', JSON.stringify({ nickname }));
      supabase.from('participants').update({ is_online: false }).eq('nickname', nickname).then(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(hb);
      window.removeEventListener('beforeunload', handleUnload);
      cleanup?.();
    };
  }, []);

  const loadInitialData = async () => {
    const [configRes, participantsRes, activeSessionRes] = await Promise.all([
      supabase.from('game_config').select('*').eq('id', 1).single(),
      supabase.from('participants').select('*').eq('is_online', true),
      supabase.from('game_sessions').select('*').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (configRes.data) setConfig(configRes.data);
    if (participantsRes.data) setParticipants(participantsRes.data);
    if (activeSessionRes.data) {
      await joinActiveSession(activeSessionRes.data);
    }
  };

  const joinActiveSession = async (session: GameSession) => {
    setCurrentSession(session);
    const { data: qs } = await supabase
      .from('questions').select('*').eq('session_id', session.id)
      .order('question_number');
    if (!qs || qs.length === 0) return;
    setQuestions(qs);
    const startedAt = new Date(session.started_at!).getTime();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const totalSeconds = qs.length * 10;
    if (elapsed >= totalSeconds) {
      await checkMatches(session.id, session.session_number);
      setPhase('result');
      return;
    }
    setSessionElapsed(elapsed);
    setCurrentQuestionIndex(Math.min(Math.floor(elapsed / 10), qs.length - 1));
    setPhase('playing');
    startSessionTimer(session, qs, elapsed);
  };

  const startSessionTimer = useCallback((session: GameSession, qs: Question[], startElapsed: number) => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    let elapsed = startElapsed;
    sessionTimerRef.current = setInterval(async () => {
      elapsed += 1;
      setSessionElapsed(elapsed);
      const qIdx = Math.min(Math.floor(elapsed / 10), qs.length - 1);
      setCurrentQuestionIndex(qIdx);
      if (elapsed >= qs.length * 10) {
        clearInterval(sessionTimerRef.current!);
        setPhase('result');
        await handleSessionEnd(session);
      }
    }, 1000);
  }, []);

  const handleSessionEnd = async (session: GameSession) => {
    try {
      await fetch('/api/calculate-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
    } catch (e) { console.error(e); }
    await supabase.from('game_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session.id);
    await checkMatches(session.id, session.session_number);
  };

  const checkMatches = async (sessionId: string, sessionNumber: number) => {
    const { data } = await supabase.from('matches').select('*')
      .or(`participant_a.eq.${nickname},participant_b.eq.${nickname}`)
      .eq('session_id', sessionId);
    if (data && data.length > 0) {
      setMyMatches(data);
    } else {
      const cfg = await supabase.from('game_config').select('total_sessions').eq('id', 1).single();
      const isLast = sessionNumber >= (cfg.data?.total_sessions ?? 10);
      setNoMatchMessage(
        isLast
          ? '모든 세션이 끝났어요. 이번에는 매칭된 상대가 없었어요.'
          : '이번 세션에서 매칭된 상대가 없어요. 다음 세션을 기다려주세요.'
      );
    }
  };

  // 매칭 없을 때 자동으로 다음 세션 대기로 이동
  useEffect(() => {
    const _isLast = (config?.current_session_number ?? 0) >= (config?.total_sessions ?? 10);
    if (phase !== 'result' || myMatches.length > 0 || _isLast) return;
    let secs = 5;
    setNoMatchCountdown(secs);
    const interval = setInterval(() => {
      secs -= 1;
      setNoMatchCountdown(secs);
      if (secs <= 0) {
        clearInterval(interval);
        setPhase('waiting');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, myMatches.length, config]);

  const submitAnswer = useCallback(async (questionNumber: number, answerIndex: number) => {
    if (!currentSession) return;
    // 같은 답 재선택 시 무시
    setAnswers(prev => {
      if (prev[questionNumber] === answerIndex) return prev;
      return { ...prev, [questionNumber]: answerIndex };
    });
    const question = questions.find(q => q.question_number === questionNumber);
    if (!question) return;
    // upsert로 항상 최신 답변으로 덮어씀
    await supabase.from('answers').upsert({
      session_id: currentSession.id,
      question_id: question.id,
      question_number: questionNumber,
      participant_nickname: nickname,
      answer_index: answerIndex,
    }, { onConflict: 'session_id,question_id,participant_nickname' });
  }, [currentSession, questions, nickname]);

  // 다음 문제로 즉시 이동
  const handleSkipToNext = () => {
    if (!currentSession) return;
    const nextQIdx = currentQuestionIndex + 1;
    if (nextQIdx >= questions.length) return;
    const nextElapsed = nextQIdx * 10;
    setSessionElapsed(nextElapsed);
    setCurrentQuestionIndex(nextQIdx);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    let elapsed = nextElapsed;
    sessionTimerRef.current = setInterval(async () => {
      elapsed += 1;
      setSessionElapsed(elapsed);
      const qIdx = Math.min(Math.floor(elapsed / 10), questions.length - 1);
      setCurrentQuestionIndex(qIdx);
      if (elapsed >= questions.length * 10) {
        clearInterval(sessionTimerRef.current!);
        setPhase('result');
        await handleSessionEnd(currentSession);
      }
    }, 1000);
  };

  const setupRealtimeSubscriptions = () => {
    const configChannel = supabase.channel('game_config_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_config' },
        async (payload) => {
          const newConfig = payload.new as GameConfig;
          setConfig(newConfig);
          if (newConfig.is_active && newConfig.current_session_number > 0) {
            setTimeout(async () => {
              const { data: session } = await supabase.from('game_sessions').select('*')
                .eq('session_number', newConfig.current_session_number)
                .eq('status', 'active').maybeSingle();
              if (!session) return;
              setCurrentSession(session);
              setAnswers({});
              lastAnswerSentRef.current = {};
              setMyMatches([]);
              setNoMatchMessage('');
              const { data: qs } = await supabase.from('questions').select('*')
                .eq('session_id', session.id).order('question_number');
              if (!qs || qs.length === 0) return;
              setQuestions(qs);
              setCurrentQuestionIndex(0);
              setSessionElapsed(0);
              startCountdown(() => {
                setPhase('playing');
                startSessionTimer(session, qs, 0);
              });
            }, 600);
          }
        }
      ).subscribe();

    const participantsChannel = supabase.channel('participants_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' },
        async () => {
          const { data } = await supabase.from('participants').select('*').eq('is_online', true);
          if (data) setParticipants(data);
        }
      ).subscribe();

    const matchesChannel = supabase.channel('matches_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' },
        (payload) => {
          const match = payload.new as Match;
          if (match.participant_a === nickname || match.participant_b === nickname) {
            setMyMatches(prev => prev.find(m => m.id === match.id) ? prev : [...prev, match]);
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(configChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(matchesChannel);
    };
  };

  const startCountdown = (onDone: () => void) => {
    setPhase('countdown');
    let count = 3;
    setCountdownNum(count);
    const cd = setInterval(() => {
      count -= 1;
      if (count <= 0) { clearInterval(cd); setCountdownNum(null); onDone(); }
      else setCountdownNum(count);
    }, 1000);
  };

  const currentQuestion = questions[currentQuestionIndex] || null;
  const questionElapsed = sessionElapsed % 10;
  const currentQuestionNumber = currentQuestion?.question_number ?? 1;
  const sessionNumber = config?.current_session_number ?? 0;
  const totalSessions = config?.total_sessions ?? 10;
  const isLastSession = sessionNumber >= totalSessions;

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 bg-surface/50 backdrop-blur-sm z-10">
        <button
          onClick={async () => {
            await supabase.from('participants').update({ is_online: false }).eq('nickname', nickname);
            localStorage.removeItem('nickname');
            window.location.href = '/';
          }}
          className="flex items-center gap-3 hover:opacity-70 transition-opacity cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
            <span className="text-white text-xs font-bold">Y</span>
          </div>
          <span className="font-display font-bold text-white tracking-tight">YouMatch</span>
        </button>
        <div className="flex items-center gap-4">
          {phase === 'playing' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">세션</span>
              <span className="font-mono text-sm font-bold text-accent-light">
                {sessionNumber} / {totalSessions}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-neon" />
            <span className="text-sm text-slate-300">{nickname}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">

          {/* 대기 */}
          {phase === 'waiting' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-full border-2 border-violet-600/40 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-violet-900/50 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
              </div>
              <h2 className="font-display font-bold text-3xl text-white mb-3">세션 시작 대기 중</h2>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                관리자가 세션을 시작하면 자동으로 게임이 시작됩니다.<br />
                오른쪽에서 접속 중인 참가자를 확인해보세요.
              </p>
              {config?.session_start_time && (
                <div className="mt-6 bg-surface border border-border rounded-xl px-6 py-4">
                  <p className="text-xs text-slate-500 mb-1">예정 시작 시간</p>
                  <p className="font-mono text-accent-light font-bold text-lg">
                    {new Date(config.session_start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 카운트다운 */}
          {phase === 'countdown' && (
            <div className="flex-1 flex items-center justify-center animate-fade-in">
              <div className="text-center">
                {countdownNum !== null && (
                  <div key={countdownNum} className="countdown-number font-display font-extrabold text-[180px] leading-none text-white glow-accent">
                    {countdownNum}
                  </div>
                )}
                <p className="text-slate-400 mt-4 font-semibold text-lg">준비하세요!</p>
              </div>
            </div>
          )}

          {/* 플레이 */}
          {phase === 'playing' && currentQuestion && (
            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
              <div className="mb-6 bg-surface border border-border rounded-xl px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">남은 시간</span>
                  <span className="text-xs text-slate-500">
                    전체 {Math.max(0, questions.length * 10 - sessionElapsed)}초
                  </span>
                </div>
                <Timer totalSeconds={10} elapsedSeconds={questionElapsed} />
              </div>
              <div className="flex-1">
                <QuestionDisplay
                  question={currentQuestion}
                  selectedAnswer={answers[currentQuestionNumber] ?? null}
                  onSelect={(idx) => submitAnswer(currentQuestionNumber, idx)}
                  questionIndex={currentQuestionIndex}
                  totalQuestions={questions.length}
                />
              </div>
            </div>
          )}

          {/* 결과 */}
          {phase === 'result' && (
            <div className="flex-1 animate-fade-in">
              <div className="max-w-5xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-violet-900/30 border border-violet-700/40 rounded-full px-4 py-1.5 mb-4">
                    <span className="text-xs text-accent-light font-medium">세션 {sessionNumber} 완료</span>
                  </div>
                  <h2 className="font-display font-bold text-3xl text-white mb-2">
                    {myMatches.length > 0 ? `${myMatches.length}명과 매칭되었어요! 🎉` : '매칭 결과'}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {myMatches.length > 0
                      ? '아래 채팅창에서 대화를 시작해보세요'
                      : noMatchMessage || '이번 세션에서는 70% 이상 일치한 상대가 없어요'}
                  </p>
                </div>

                {myMatches.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-slate-500 text-center max-w-xs">이번 세션에서는 70% 이상 일치한 상대가 없었어요</p>
                    {!isLastSession && (
                      <div className="mt-6 bg-surface border border-border rounded-xl px-6 py-4 text-center">
                        <p className="text-xs text-slate-500 mb-2">다음 세션 대기 화면으로 이동합니다</p>
                        <p className="font-mono font-bold text-4xl text-accent-light">{noMatchCountdown}</p>
                      </div>
                    )}
                    {isLastSession && (
                      <p className="mt-4 text-slate-600 text-sm">모든 세션이 종료되었습니다</p>
                    )}
                  </div>
                )}

                {myMatches.length > 0 && (
                  <div className={`grid gap-4 ${
                    myMatches.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' :
                    myMatches.length === 2 ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3'
                  }`}>
                    {myMatches.map((match, i) => (
                      <div key={match.id} className="match-card h-[500px]" style={{ animationDelay: `${i * 0.1}s` }}>
                        <ChatModal match={match} myNickname={nickname} />
                      </div>
                    ))}
                  </div>
                )}

                {!isLastSession && (
                  <p className="mt-8 text-center text-sm text-slate-500">다음 세션이 시작되면 자동으로 이동됩니다</p>
                )}
                {isLastSession && (
                  <div className="mt-8 text-center bg-surface border border-border rounded-xl p-6">
                    <p className="font-display font-bold text-xl text-white mb-2">모든 세션이 종료되었습니다</p>
                    <p className="text-slate-400 text-sm">총 {totalSessions}회 세션 완료</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="w-56 border-l border-border p-4 flex-shrink-0 bg-surface/30">
          <ParticipantsList participants={participants} myNickname={nickname} />
        </aside>
      </div>
    </div>
  );
}
