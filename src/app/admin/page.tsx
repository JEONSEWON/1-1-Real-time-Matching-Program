'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { GameConfig, GameSession, Participant, Question } from '@/lib/types';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin1234';

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
        const d = new Date(configRes.data.session_start_time);
        setEditStartTime(d.toISOString().slice(0, 16));
      }
    }
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (participantsRes.data) setParticipants(participantsRes.data);
  };

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const startSession = async (sessionNumber: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber }),
      });
      if (!res.ok) throw new Error('Failed');
      showMsg(`세션 ${sessionNumber} 시작 완료!`);
      await loadAdminData();
    } catch (e) {
      showMsg('오류: 세션 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const updateStartTime = async () => {
    if (!editStartTime) return;
    const res = await fetch('/api/admin/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_start_time: new Date(editStartTime).toISOString() }),
    });
    if (res.ok) showMsg('시작 시간 업데이트 완료');
  };

  const resetGame = async () => {
    if (!confirm('게임을 초기화하시겠습니까? 모든 세션, 답변, 매칭 데이터가 삭제됩니다.')) return;
    setLoading(true);
    await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('game_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('game_config').update({
      is_active: false,
      current_session_number: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    showMsg('게임 초기화 완료');
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
    showMsg('문제 수정 완료');
  };

  // 로그인
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-white mb-6 text-center">관리자 로그인</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pw === ADMIN_PASSWORD) setAuthed(true);
                else setPwError('비밀번호가 틀렸습니다');
              }
            }}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
          />
          {pwError && <p className="text-red-400 text-sm mb-2">{pwError}</p>}
          <button
            onClick={() => {
              if (pw === ADMIN_PASSWORD) setAuthed(true);
              else setPwError('비밀번호가 틀렸습니다');
            }}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  const nextSessionNumber = (config?.current_session_number ?? 0) + 1;
  const canStartNextSession = nextSessionNumber <= (config?.total_sessions ?? 10);
  const activeSession = sessions.find(s => s.status === 'active');

  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-white">관리자 패널</h1>
            <p className="text-slate-500 text-sm mt-1">YouMatch 게임 컨트롤</p>
          </div>
          {message && (
            <div className="bg-neon/10 border border-neon/30 text-neon px-4 py-2 rounded-xl text-sm font-medium">
              {message}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 게임 컨트롤 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 현재 상태 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">현재 상태</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className="font-mono font-bold text-2xl text-accent-light">
                    {config?.current_session_number ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">현재 세션</div>
                </div>
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className="font-mono font-bold text-2xl text-neon">{participants.length}</div>
                  <div className="text-xs text-slate-500 mt-1">접속 중</div>
                </div>
                <div className="bg-bg rounded-lg p-3 text-center">
                  <div className={`font-mono font-bold text-2xl ${activeSession ? 'text-coral' : 'text-slate-500'}`}>
                    {activeSession ? '진행 중' : '대기'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">게임 상태</div>
                </div>
              </div>
            </div>

            {/* 세션 제어 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">세션 제어</h2>

              {activeSession ? (
                <div className="bg-coral/10 border border-coral/30 rounded-lg p-4 mb-4">
                  <p className="text-coral text-sm font-medium">
                    🔴 세션 {activeSession.session_number} 진행 중
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    시작: {new Date(activeSession.started_at!).toLocaleTimeString('ko-KR')}
                  </p>
                </div>
              ) : (
                <div className="bg-neon/5 border border-neon/20 rounded-lg p-4 mb-4">
                  <p className="text-neon text-sm font-medium">
                    ✅ 다음 세션: {nextSessionNumber} / {config?.total_sessions ?? 10}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    세션을 시작하면 Claude AI가 문제를 자동 생성합니다 (약 5~10초 소요)
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => startSession(nextSessionNumber)}
                  disabled={loading || !!activeSession || !canStartNextSession}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                >
                  {loading ? '처리 중...' : `세션 ${nextSessionNumber} 시작`}
                </button>
                <button
                  onClick={resetGame}
                  disabled={loading}
                  className="px-4 py-3 rounded-xl border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors text-sm"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 시작 시간 설정 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">세션 시작 시간 설정</h2>
              <div className="flex gap-3">
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-bg border border-border text-white focus:outline-none focus:border-violet-500 text-sm"
                />
                <button
                  onClick={updateStartTime}
                  className="px-5 py-2.5 rounded-xl bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
                >
                  저장
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">참가자 화면에 예정 시간이 표시됩니다</p>
            </div>

            {/* 세션별 문제 수정 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">문제 조회 및 수정</h2>

              {sessions.length === 0 ? (
                <p className="text-slate-500 text-sm">아직 진행된 세션이 없습니다</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => loadSessionQuestions(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selectedSession === s.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-bg border border-border text-slate-400 hover:text-white'
                        }`}
                      >
                        세션 {s.session_number}
                        <span className={`ml-1 ${
                          s.status === 'active' ? 'text-neon' :
                          s.status === 'completed' ? 'text-slate-500' : 'text-slate-600'
                        }`}>
                          {s.status === 'active' ? '●' : s.status === 'completed' ? '✓' : '○'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedSession && sessionQuestions.length > 0 && (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {sessionQuestions.map((q) => (
                        <div key={q.id} className="bg-bg border border-border rounded-lg p-3">
                          {editingQuestion?.id === q.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingQuestion.question_text}
                                onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                                rows={2}
                              />
                              {editingQuestion.options.map((opt, i) => (
                                <input
                                  key={i}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...editingQuestion.options];
                                    newOpts[i] = e.target.value;
                                    setEditingQuestion({ ...editingQuestion, options: newOpts });
                                  }}
                                  className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                  placeholder={`보기 ${i + 1}`}
                                />
                              ))}
                              <div className="flex gap-2">
                                <button onClick={saveQuestionEdit} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors">저장</button>
                                <button onClick={() => setEditingQuestion(null)} className="px-3 py-1.5 bg-bg border border-border text-slate-400 text-xs rounded-lg hover:text-white transition-colors">취소</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <span className="text-xs font-mono text-slate-600 mr-2">Q{q.question_number}</span>
                                  <span className="text-sm text-white">{q.question_text}</span>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {q.options.map((opt, i) => (
                                      <span key={i} className="text-xs bg-border text-slate-400 px-2 py-0.5 rounded">{opt}</span>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setEditingQuestion({ ...q })}
                                  className="text-xs text-slate-500 hover:text-accent-light transition-colors flex-shrink-0 mt-0.5"
                                >
                                  수정
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 우측: 참가자 목록 */}
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-200">접속 중인 참가자</h2>
                <span className="font-mono text-sm text-neon">{participants.length}명</span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {participants.length === 0 ? (
                  <p className="text-slate-500 text-sm">접속자 없음</p>
                ) : (
                  [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
                    .map(p => (
                      <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-neon flex-shrink-0" />
                        <span className="text-sm text-slate-300">{p.nickname}</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* 세션 히스토리 */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-4">세션 히스토리</h2>
              <div className="space-y-2">
                {Array.from({ length: config?.total_sessions ?? 10 }, (_, i) => i + 1).map(num => {
                  const session = sessions.find(s => s.session_number === num);
                  return (
                    <div key={num} className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">세션 {num}</span>
                      <span className={`text-xs font-medium ${
                        !session ? 'text-slate-600' :
                        session.status === 'active' ? 'text-coral' :
                        session.status === 'completed' ? 'text-neon' : 'text-slate-500'
                      }`}>
                        {!session ? '미시작' :
                         session.status === 'active' ? '진행 중' :
                         session.status === 'completed' ? '완료' : session.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
