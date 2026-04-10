'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameConfig, GameSession, Participant, Question } from '@/lib/types';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin1234';

interface DraftQuestion {
  question_number: number;
  question_text: string;
  options: string[];
}

interface DraftSession {
  sessionNumber: number;
  questions: DraftQuestion[];
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

  // 게임 설정
  const [settingsQCount, setSettingsQCount] = useState(20);
  const [settingsSecs, setSettingsSecs] = useState(10);
  const [settingsOptionsMin, setSettingsOptionsMin] = useState(2);
  const [settingsOptionsMax, setSettingsOptionsMax] = useState(4);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 전체 문제 생성 플로우
  const [genStep, setGenStep] = useState<'idle' | 'generating' | 'review'>('idle');
  const [genProgress, setGenProgress] = useState(0); // 생성 진행 세션 수
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  const [reviewSessionIdx, setReviewSessionIdx] = useState(0); // 현재 검토 중인 세션 인덱스
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  // 예약 시작 자동 감지
  const scheduleCheckRef = useRef<NodeJS.Timeout | null>(null);

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

  // 예약 시간 자동 시작 감지
  useEffect(() => {
    if (!authed || !config?.session_start_time) return;
    if (scheduleCheckRef.current) clearInterval(scheduleCheckRef.current);

    scheduleCheckRef.current = setInterval(async () => {
      const now = new Date();
      const startTime = new Date(config.session_start_time!);
      const diff = now.getTime() - startTime.getTime();
      // 시작 시간이 됐고 (0~30초 이내), 아직 세션 시작 안 됐고, 문제가 준비된 경우
      if (diff >= 0 && diff < 30000 && !config.is_active && draftSessions.length > 0) {
        const nextNum = (config.current_session_number ?? 0) + 1;
        const draft = draftSessions.find(d => d.sessionNumber === nextNum);
        if (draft) {
          await launchSession(draft);
        }
      }
    }, 3000);

    return () => {
      if (scheduleCheckRef.current) clearInterval(scheduleCheckRef.current);
    };
  }, [authed, config?.session_start_time, config?.is_active, draftSessions]);

  const loadAdminData = async () => {
    const [configRes, sessionsRes, participantsRes] = await Promise.all([
      supabase.from('game_config').select('*').eq('id', 1).single(),
      supabase.from('game_sessions').select('*').order('session_number'),
      supabase.from('participants').select('*').eq('is_online', true),
    ]);
    if (configRes.data) {
      setConfig(configRes.data);
      if (configRes.data.session_start_time) {
        const d = new Date(configRes.data.session_start_time);
        const offset = d.getTimezoneOffset() * 60000;
        const localISO = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        setEditStartTime(localISO);
      }
      setSettingsQCount(configRes.data.questions_per_session ?? 20);
      setSettingsSecs(configRes.data.seconds_per_question ?? 10);
    }
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (participantsRes.data) setParticipants(participantsRes.data);
  };

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  // 전체 세션 문제 일괄 생성
  const generateAllQuestions = async () => {
    setGenStep('generating');
    setGenProgress(0);
    const totalSessions = config?.total_sessions ?? 10;
    const allDrafts: DraftSession[] = [];

    try {
      for (let i = 1; i <= totalSessions; i++) {
        setGenProgress(i);
        const res = await fetch('/api/admin/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionNumber: i, count: settingsQCount, optionsMin: settingsOptionsMin, optionsMax: settingsOptionsMax }),
        });
        if (!res.ok) throw new Error(`세션 ${i} 생성 실패`);
        const { questions } = await res.json();
        allDrafts.push({ sessionNumber: i, questions });
      }
      setDraftSessions(allDrafts);
      setReviewSessionIdx(0);
      setGenStep('review');
      showMsg('✅ 전체 문제 생성 완료! 검토 후 세션별로 시작하세요.');
    } catch (e: any) {
      showMsg(`❌ ${e.message}`);
      setGenStep('idle');
    }
  };

  // 특정 세션 시작
  const launchSession = async (draft: DraftSession) => {
    setLaunching(true);
    try {
      const res = await fetch('/api/admin/launch-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber: draft.sessionNumber, questions: draft.questions }),
      });
      if (!res.ok) throw new Error('Failed');
      showMsg(`✅ 세션 ${draft.sessionNumber} 시작!`);
      await loadAdminData();
    } catch (e) {
      showMsg('❌ 세션 시작 실패');
    } finally {
      setLaunching(false);
    }
  };

  const updateStartTime = async () => {
    if (!editStartTime) return;
    const res = await fetch('/api/admin/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_start_time: new Date(editStartTime).toISOString() }),
    });
    if (res.ok) showMsg('✅ 시작 시간 저장 — 해당 시간에 자동으로 세션이 시작됩니다.');
  };

  const saveSettings = async () => {
    if (settingsOptionsMin > settingsOptionsMax) {
      showMsg('❌ 보기 최소값이 최대값보다 클 수 없습니다');
      return;
    }
    const res = await fetch('/api/admin/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions_per_session: settingsQCount,
        seconds_per_question: settingsSecs,
      }),
    });
    if (res.ok) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      showMsg('✅ 설정 저장 완료');
      await loadAdminData();
    }
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
    setGenStep('idle');
    setDraftSessions([]);
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
          <input type="password" value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwError('비밀번호가 틀렸습니다'); } }}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
          />
          {pwError && <p className="text-red-400 text-sm mb-2">{pwError}</p>}
          <button onClick={() => { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwError('비밀번호가 틀렸습니다'); }}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold">
            로그인
          </button>
        </div>
      </div>
    );
  }

  const nextSessionNumber = (config?.current_session_number ?? 0) + 1;
  const activeSession = sessions.find(s => s.status === 'active');
  const currentDraft = draftSessions[reviewSessionIdx];
  const nextDraft = draftSessions.find(d => d.sessionNumber === nextSessionNumber);

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
              <div className="bg-neon/10 border border-neon/30 text-neon px-4 py-2 rounded-xl text-sm font-medium max-w-xs">
                {message}
              </div>
            )}
            <button onClick={resetGame} disabled={loading}
              className="px-4 py-2 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 text-sm transition-colors">
              전체 초기화
            </button>
          </div>
        </div>

        {/* 생성 중 */}
        {genStep === 'generating' && (
          <div className="mb-6 bg-surface border border-border rounded-xl p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-slate-300 font-medium">전체 문제 생성 중... ({genProgress}/{config?.total_sessions ?? 10} 세션)</p>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${(genProgress / (config?.total_sessions ?? 10)) * 100}%` }} />
            </div>
            <p className="text-xs text-slate-600 mt-2">세션당 10~20초 소요 · 총 {(config?.total_sessions ?? 10) * 15}초 내외</p>
          </div>
        )}

        {/* 문제 검토 패널 */}
        {genStep === 'review' && draftSessions.length > 0 && (
          <div className="mb-6 bg-surface border border-violet-700/40 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-xl text-white">문제 검토 및 수정</h2>
                <p className="text-slate-400 text-sm mt-1">총 {draftSessions.length}개 세션 생성 완료 — 수정 후 각 세션을 시작하세요.</p>
              </div>
            </div>

            {/* 세션 탭 */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {draftSessions.map((d, idx) => {
                const launched = sessions.find(s => s.session_number === d.sessionNumber);
                return (
                  <button key={d.sessionNumber}
                    onClick={() => { setReviewSessionIdx(idx); setEditingQIdx(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      reviewSessionIdx === idx
                        ? 'bg-violet-600 text-white'
                        : launched
                        ? 'bg-neon/10 text-neon border border-neon/30'
                        : 'bg-border text-slate-400 hover:text-white'
                    }`}>
                    S{d.sessionNumber} {launched ? '✓' : ''}
                  </button>
                );
              })}
            </div>

            {/* 현재 세션 문제 */}
            {currentDraft && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">세션 {currentDraft.sessionNumber} ({currentDraft.questions.length}문제)</p>
                  {!sessions.find(s => s.session_number === currentDraft.sessionNumber) && !activeSession && (
                    <button
                      onClick={() => launchSession(currentDraft)}
                      disabled={launching}
                      className="px-4 py-2 rounded-lg bg-neon/20 border border-neon/40 text-neon hover:bg-neon/30 text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      {launching ? '시작 중...' : `▶ 세션 ${currentDraft.sessionNumber} 시작`}
                    </button>
                  )}
                  {sessions.find(s => s.session_number === currentDraft.sessionNumber) && (
                    <span className="text-xs text-neon bg-neon/10 px-3 py-1 rounded-full">이미 시작됨</span>
                  )}
                  {activeSession && !sessions.find(s => s.session_number === currentDraft.sessionNumber) && (
                    <span className="text-xs text-slate-500 bg-border px-3 py-1 rounded-full">세션 {activeSession.session_number} 종료 후 시작 가능</span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {currentDraft.questions.map((q, idx) => (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      {editingQIdx === idx ? (
                        <div className="p-3 bg-bg space-y-2">
                          <textarea value={q.question_text}
                            onChange={(e) => {
                              const next = [...draftSessions];
                              next[reviewSessionIdx].questions[idx].question_text = e.target.value;
                              setDraftSessions(next);
                            }}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-white text-sm resize-none focus:outline-none focus:border-violet-500"
                          />
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex gap-2">
                              <span className="text-xs text-slate-600 w-4 pt-2 flex-shrink-0">{oi+1}</span>
                              <input value={opt}
                                onChange={(e) => {
                                  const next = [...draftSessions];
                                  next[reviewSessionIdx].questions[idx].options[oi] = e.target.value;
                                  setDraftSessions(next);
                                }}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                              {q.options.length > 2 && (
                                <button onClick={() => {
                                  const next = [...draftSessions];
                                  next[reviewSessionIdx].questions[idx].options.splice(oi, 1);
                                  setDraftSessions([...next]);
                                }} className="text-red-500 text-sm px-1">×</button>
                              )}
                            </div>
                          ))}
                          {q.options.length < 4 && (
                            <button onClick={() => {
                              const next = [...draftSessions];
                              next[reviewSessionIdx].questions[idx].options.push('');
                              setDraftSessions([...next]);
                            }} className="text-xs text-slate-500 hover:text-slate-300">+ 선택지 추가</button>
                          )}
                          <button onClick={() => setEditingQIdx(null)}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium">완료</button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 p-2.5 hover:bg-bg/50 group transition-colors cursor-pointer"
                          onClick={() => setEditingQIdx(idx)}>
                          <span className="font-mono text-xs text-slate-600 w-6 flex-shrink-0 pt-0.5">Q{q.question_number}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{q.question_text}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{q.options.join(' · ')}</p>
                          </div>
                          <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0">수정</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* 문제 생성 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-1">전체 문제 생성</h2>
              <p className="text-xs text-slate-500 mb-4">
                전체 {config?.total_sessions ?? 10}개 세션 문제를 한번에 생성합니다.
                생성 후 검토·수정하고 세션별로 시작하세요.
              </p>
              {genStep === 'idle' ? (
                <button onClick={generateAllQuestions}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg transition-all">
                  전체 문제 생성 ({config?.total_sessions ?? 10}세션)
                </button>
              ) : genStep === 'generating' ? (
                <div className="w-full py-4 rounded-xl bg-violet-900/30 border border-violet-700/40 text-violet-400 text-center font-semibold">
                  생성 중... ({genProgress}/{config?.total_sessions ?? 10})
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1 py-3 rounded-xl bg-neon/10 border border-neon/30 text-neon text-center text-sm font-semibold">
                    ✅ {draftSessions.length}개 세션 준비 완료
                  </div>
                  <button onClick={generateAllQuestions}
                    className="px-4 py-3 rounded-xl border border-border text-slate-400 hover:text-white text-sm transition-colors">
                    재생성
                  </button>
                </div>
              )}

              {/* 다음 세션 빠른 시작 버튼 */}
              {nextDraft && !activeSession && genStep === 'review' && (
                <button
                  onClick={() => launchSession(nextDraft)}
                  disabled={launching}
                  className="w-full mt-3 py-3 rounded-xl bg-neon/20 border border-neon/40 text-neon hover:bg-neon/30 font-semibold text-sm transition-colors disabled:opacity-40"
                >
                  {launching ? '시작 중...' : `▶ 세션 ${nextSessionNumber} 바로 시작`}
                </button>
              )}
            </div>

            {/* 게임 설정 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-1">게임 설정</h2>
              <p className="text-xs text-slate-500 mb-4">문제 생성 전에 설정해주세요. 이미 생성된 문제에는 적용되지 않습니다.</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">세션당 문제 수</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={5} max={50} value={settingsQCount}
                      onChange={(e) => setSettingsQCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">문제</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">문제당 시간</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={5} max={60} value={settingsSecs}
                      onChange={(e) => setSettingsSecs(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">초</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">보기 최소 수</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={2} max={4} value={settingsOptionsMin}
                      onChange={(e) => setSettingsOptionsMin(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">개</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">보기 최대 수</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={2} max={4} value={settingsOptionsMax}
                      onChange={(e) => setSettingsOptionsMax(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">개</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  총 세션 시간: {settingsQCount * settingsSecs}초 ({Math.floor(settingsQCount * settingsSecs / 60)}분 {settingsQCount * settingsSecs % 60}초)
                </p>
                <button onClick={saveSettings}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSaved
                      ? 'bg-neon/20 border border-neon/40 text-neon'
                      : 'bg-violet-600/80 hover:bg-violet-600 text-white'
                  }`}>
                  {settingsSaved ? '✅ 저장됨' : '설정 저장'}
                </button>
              </div>
            </div>

            {/* 예약 시작 시간 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-1">예약 시작 시간</h2>
              <p className="text-xs text-slate-500 mb-3">
                설정된 시간에 자동으로 다음 세션이 시작됩니다. (문제가 미리 생성되어 있어야 합니다)
              </p>
              <div className="flex gap-2">
                <input type="datetime-local" value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm focus:outline-none focus:border-violet-500"
                />
                <button onClick={updateStartTime}
                  className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-medium">
                  저장
                </button>
              </div>
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
                      {session && <span className="text-xs text-slate-600">문제 보기 →</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 우측: 참가자 + 기존 문제 상세 */}
          <div className="space-y-6">
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
                    <div key={p.id} className="flex items-center gap-2 px-2 py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon flex-shrink-0" />
                      <span className="text-sm text-slate-300 truncate">{p.nickname}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedSession && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="font-semibold text-slate-200 text-sm mb-3">
                  문제 목록 <span className="text-slate-500 font-normal">({sessionQuestions.length}개)</span>
                </h3>
                {editingQuestion ? (
                  <div className="space-y-2">
                    <textarea value={editingQuestion.question_text}
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
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium">저장</button>
                      <button onClick={() => setEditingQuestion(null)}
                        className="px-3 py-1.5 rounded-lg border border-border text-slate-400 text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {sessionQuestions.map(q => (
                      <div key={q.id}
                        className="flex items-start gap-2 p-2 rounded-lg border border-border hover:border-violet-700/50 group cursor-pointer"
                        onClick={() => setEditingQuestion(q)}>
                        <span className="font-mono text-xs text-slate-600 flex-shrink-0 pt-0.5">Q{q.question_number}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white line-clamp-2">{q.question_text}</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{q.options.join(' / ')}</p>
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
