'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { GameConfig, GameSession, Participant, Question } from '@/lib/types';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin1234';

interface DraftQuestion {
  question_number: number;
  question_text: string;
  options: string[];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');

  const [config, setConfig] = useState<GameConfig | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editStartTime, setEditStartTime] = useState('');

  // 문제 생성 → 검토 → 시작 플로우
  const [step, setStep] = useState<'idle' | 'generating' | 'review' | 'launching'>('idle');
  const [pendingSessionNumber, setPendingSessionNumber] = useState<number | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // 기존 세션 문제 보기
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    if (!authed) return;
    loadAdminData();
    const interval = setInterval(loadAdminData, 5000);
    return () => clearInterval(interval);
  }, [authed]);

  const loadAdminData = async () => {
    const [configRes, sessionsRes, participantsRes] = await Promise.all([
      supabase.from('game_config').select('*').eq('id', 1).single(),
      supabase.from('game_sessions').select('*').order('session_number'),
      supabase.from('participants').select('*').eq('is_online', true),
    ]);
    if (configRes.data) {
      setConfig(configRes.data);
      if (configRes.data.session_start_time) {
        setEditStartTime(new Date(configRes.data.session_start_time).toISOString().slice(0, 16));
      }
    }
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (participantsRes.data) setParticipants(participantsRes.data);
  };

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  // 1단계: 문제 생성만 (세션 아직 시작 안 함)
  const generateQuestions = async (sessionNumber: number) => {
    setStep('generating');
    setPendingSessionNumber(sessionNumber);
    try {
      const res = await fetch('/api/admin/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber, count: 20 }),
      });
      if (!res.ok) throw new Error('Failed');
      const { questions } = await res.json();
      setDraftQuestions(questions);
      setStep('review');
    } catch (e) {
      showMsg('❌ 문제 생성 실패');
      setStep('idle');
    }
  };

  // 2단계: 검토 완료 후 실제 세션 시작
  const launchSession = async () => {
    if (!pendingSessionNumber) return;
    setStep('launching');
    try {
      const res = await fetch('/api/admin/launch-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber: pendingSessionNumber, questions: draftQuestions }),
      });
      if (!res.ok) throw new Error('Failed');
      showMsg(`✅ 세션 ${pendingSessionNumber} 시작!`);
      setStep('idle');
      setDraftQuestions([]);
      setPendingSessionNumber(null);
      setEditingIdx(null);
      await loadAdminData();
    } catch (e) {
      showMsg('❌ 세션 시작 실패');
      setStep('idle');
    }
  };

  const updateStartTime = async () => {
    if (!editStartTime) return;
    const res = await fetch('/api/admin/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_start_time: new Date(editStartTime).toISOString() }),
    });
    if (res.ok) showMsg('✅ 시작 시간 저장');
  };

  const resetGame = async () => {
    if (!confirm('모든 데이터를 초기화하겠습니까?')) return;
    setLoading(true);
    await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('game_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('game_config').update({
      is_active: false, current_session_number: 0, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setStep('idle');
    setDraftQuestions([]);
    showMsg('✅ 초기화 완료');
    setLoading(false);
    await loadAdminData();
  };

  const loadSessionQuestions = async (sessionId: string) => {
    setSelectedSession(sessionId);
    const { data } = await supabase.from('questions').select('*')
      .eq('session_id', sessionId).order('question_number');
    if (data) setSessionQuestions(data);
  };

  const saveQuestionEdit = async () => {
    if (!editingQuestion) return;
    await supabase.from('questions').update({
      question_text: editingQuestion.question_text,
      options: editingQuestion.options,
    }).eq('id', editingQuestion.id);
    setEditingQuestion(null);
    await loadSessionQuestions(selectedSession!);
    showMsg('✅ 문제 수정 완료');
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-white mb-6 text-center">관리자 로그인</h1>
          <input
            type="password" value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwError('비밀번호가 틀렸습니다'); } }}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
          />
          {pwError && <p className="text-red-400 text-sm mb-2">{pwError}</p>}
          <button
            onClick={() => { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwError('비밀번호가 틀렸습니다'); }}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold"
          >로그인</button>
        </div>
      </div>
    );
  }

  const nextSessionNumber = (config?.current_session_number ?? 0) + 1;
  const canStartNext = nextSessionNumber <= (config?.total_sessions ?? 10);
  const activeSession = sessions.find(s => s.status === 'active');

  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-white">관리자 패널</h1>
            <p className="text-slate-500 text-sm mt-1">YouMatch 게임 컨트롤</p>
          </div>
          <div className="flex items-center gap-3">
            {message && (
              <div className="bg-neon/10 border border-neon/30 text-neon px-4 py-2 rounded-xl text-sm font-medium">
                {message}
              </div>
            )}
            <button onClick={resetGame} disabled={loading}
              className="px-4 py-2 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 text-sm transition-colors">
              전체 초기화
            </button>
          </div>
        </div>

        {/* 문제 검토 패널 (step === 'review') */}
        {step === 'review' && (
          <div className="mb-6 bg-surface border border-violet-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-xl text-white">
                  세션 {pendingSessionNumber} 문제 검토
                </h2>
                <p className="text-slate-400 text-sm mt-1">문제를 확인하고 수정한 뒤 세션을 시작하세요.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('idle'); setDraftQuestions([]); setPendingSessionNumber(null); }}
                  className="px-4 py-2 rounded-lg border border-border text-slate-400 hover:text-white text-sm transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={launchSession}
                  className="px-6 py-2 rounded-lg bg-neon/20 border border-neon/50 text-neon hover:bg-neon/30 font-semibold text-sm transition-colors"
                >
                  ▶ 세션 시작
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {draftQuestions.map((q, idx) => (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  {editingIdx === idx ? (
                    <div className="p-4 bg-bg space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">문제 내용</label>
                        <textarea
                          value={q.question_text}
                          onChange={(e) => {
                            const next = [...draftQuestions];
                            next[idx] = { ...next[idx], question_text: e.target.value };
                            setDraftQuestions(next);
                          }}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-white text-sm resize-none focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">선택지</label>
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex gap-2 mb-1.5">
                            <span className="text-xs text-slate-600 w-4 pt-2 flex-shrink-0">{oi + 1}</span>
                            <input
                              value={opt}
                              onChange={(e) => {
                                const next = [...draftQuestions];
                                const opts = [...next[idx].options];
                                opts[oi] = e.target.value;
                                next[idx] = { ...next[idx], options: opts };
                                setDraftQuestions(next);
                              }}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                            />
                            {q.options.length > 2 && (
                              <button onClick={() => {
                                const next = [...draftQuestions];
                                next[idx].options = next[idx].options.filter((_, j) => j !== oi);
                                setDraftQuestions(next);
                              }} className="text-red-500 hover:text-red-400 px-1 text-sm">×</button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 4 && (
                          <button onClick={() => {
                            const next = [...draftQuestions];
                            next[idx].options = [...next[idx].options, ''];
                            setDraftQuestions(next);
                          }} className="text-xs text-slate-500 hover:text-slate-300 mt-1">+ 선택지 추가</button>
                        )}
                      </div>
                      <button onClick={() => setEditingIdx(null)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium">
                        완료
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 hover:bg-bg/50 group transition-colors">
                      <span className="font-mono text-xs text-slate-600 w-6 flex-shrink-0 pt-0.5">Q{q.question_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{q.question_text}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {q.options.map((o, i) => `${i + 1}.${o}`).join(' · ')}
                        </p>
                      </div>
                      <button onClick={() => setEditingIdx(idx)}
                        className="text-xs text-slate-600 hover:text-accent-light opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 px-2">
                        수정
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 문제 생성 중 */}
        {step === 'generating' && (
          <div className="mb-6 bg-surface border border-border rounded-xl p-8 flex items-center justify-center gap-4">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300">세션 {pendingSessionNumber} 문제 생성 중... (10~20초)</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 게임 컨트롤 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 상태 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">현재 상태</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className="font-mono font-bold text-2xl text-accent-light">
                    {config?.current_session_number ?? 0}/{config?.total_sessions ?? 10}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">진행 세션</div>
                </div>
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className="font-mono font-bold text-2xl text-neon">{participants.length}</div>
                  <div className="text-xs text-slate-500 mt-1">접속 중</div>
                </div>
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className={`font-mono font-bold text-2xl ${activeSession ? 'text-neon' : 'text-slate-500'}`}>
                    {activeSession ? '진행 중' : '대기 중'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">게임 상태</div>
                </div>
              </div>
            </div>

            {/* 세션 시작 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-1">세션 시작</h2>
              <p className="text-xs text-slate-500 mb-4">
                [문제 생성] → 내용 검토 및 수정 → [세션 시작] 순서로 진행됩니다.
              </p>

              {canStartNext && !activeSession ? (
                <button
                  onClick={() => generateQuestions(nextSessionNumber)}
                  disabled={step !== 'idle'}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg transition-all"
                >
                  {step === 'generating'
                    ? '문제 생성 중...'
                    : `세션 ${nextSessionNumber} 문제 생성`}
                </button>
              ) : activeSession ? (
                <div className="w-full py-4 rounded-xl bg-neon/10 border border-neon/30 text-neon text-center font-semibold">
                  세션 {activeSession.session_number} 진행 중
                </div>
              ) : (
                <div className="w-full py-4 rounded-xl bg-surface border border-border text-slate-500 text-center">
                  모든 세션 완료
                </div>
              )}
            </div>

            {/* 시작 시간 설정 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">예약 시작 시간</h2>
              <div className="flex gap-2">
                <input
                  type="datetime-local" value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                />
                <button onClick={updateStartTime}
                  className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
                  저장
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">참가자 대기 화면에 예정 시간이 표시됩니다.</p>
            </div>

            {/* 세션 목록 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">세션 목록</h2>
              <div className="space-y-1.5">
                {Array.from({ length: config?.total_sessions ?? 10 }, (_, i) => i + 1).map((num) => {
                  const session = sessions.find(s => s.session_number === num);
                  return (
                    <div key={num}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        session && selectedSession === session.id
                          ? 'border-violet-500 bg-violet-900/20'
                          : 'border-border hover:border-violet-700/50'
                      }`}
                      onClick={() => session && loadSessionQuestions(session.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-500 w-6">S{num}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          session?.status === 'active' ? 'bg-neon/20 text-neon' :
                          session?.status === 'completed' ? 'bg-slate-700 text-slate-400' :
                          'bg-border text-slate-600'
                        }`}>
                          {session?.status === 'active' ? '진행 중' :
                           session?.status === 'completed' ? '완료' : '대기'}
                        </span>
                      </div>
                      {session && (
                        <span className="text-xs text-slate-600">문제 보기 →</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 우측: 참가자 + 문제 상세 */}
          <div className="space-y-6">
            {/* 참가자 */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-200 text-sm">접속 중인 참가자</h3>
                <span className="text-xs font-mono text-neon bg-neon/10 px-2 py-0.5 rounded-full">{participants.length}명</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {participants.length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-4">접속자 없음</p>
                ) : (
                  [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')).map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon flex-shrink-0" />
                      <span className="text-sm text-slate-300 truncate">{p.nickname}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 선택된 세션 문제 목록 */}
            {selectedSession && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="font-semibold text-slate-200 text-sm mb-3">
                  문제 목록 <span className="text-slate-500 font-normal">({sessionQuestions.length}개)</span>
                </h3>

                {editingQuestion ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingQuestion.question_text}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-xs resize-none focus:outline-none focus:border-violet-500"
                    />
                    {editingQuestion.options.map((opt, i) => (
                      <input key={i} value={opt}
                        onChange={(e) => {
                          const opts = [...editingQuestion.options];
                          opts[i] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: opts });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-white text-xs focus:outline-none focus:border-violet-500 mb-1"
                      />
                    ))}
                    <div className="flex gap-2">
                      <button onClick={saveQuestionEdit}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium">저장</button>
                      <button onClick={() => setEditingQuestion(null)}
                        className="px-3 py-1.5 rounded-lg border border-border text-slate-400 text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {sessionQuestions.map(q => (
                      <div key={q.id}
                        className="flex items-start gap-2 p-2 rounded-lg border border-border hover:border-violet-700/50 group transition-colors cursor-pointer"
                        onClick={() => setEditingQuestion(q)}
                      >
                        <span className="font-mono text-xs text-slate-600 flex-shrink-0 pt-0.5">Q{q.question_number}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white line-clamp-2">{q.question_text}</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {q.options.join(' / ')}
                          </p>
                        </div>
                        <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0">수정</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
