'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    if (trimmed.length < 2 || trimmed.length > 12) {
      setError('닉네임은 2~12자 사이로 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 닉네임 중복 확인
      const { data: existing } = await supabase
        .from('participants')
        .select('id, is_online')
        .eq('nickname', trimmed)
        .single();

      if (existing && existing.is_online) {
        setError('이미 사용 중인 닉네임입니다');
        setLoading(false);
        return;
      }

      // 기존 오프라인 유저 삭제 후 재등록 or 신규 등록
      if (existing) {
        await supabase
          .from('participants')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('nickname', trimmed);
      } else {
        const { error: insertErr } = await supabase
          .from('participants')
          .insert({ nickname: trimmed, is_online: true });

        if (insertErr) {
          setError('닉네임 등록에 실패했습니다. 다시 시도해주세요.');
          setLoading(false);
          return;
        }
      }

      // 로컬 스토리지에 닉네임 저장
      localStorage.setItem('nickname', trimmed);
      router.push('/game');
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      {/* 배경 그라디언트 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-900/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <span className="text-white text-sm font-bold">Y</span>
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">YouMatch</span>
          </div>
          <h1 className="font-display font-bold text-4xl text-white mb-3 leading-tight">
            취향으로<br />연결되는 순간
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            20개의 질문, 200초.<br />
            70% 이상 같은 답을 고른 사람을 찾아드립니다.
          </p>
        </div>

        {/* 입력 폼 */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            닉네임
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="예) 별빛고양이, jazz_lover"
            maxLength={12}
            className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors text-base"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
          <p className="mt-1.5 text-xs text-slate-600">2~12자, 한/영/숫자 사용 가능</p>

          <button
            onClick={handleJoin}
            disabled={loading || !nickname.trim()}
            className="w-full mt-4 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-accent"
          >
            {loading ? '입장 중...' : '입장하기'}
          </button>
        </div>

        {/* 규칙 안내 */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { num: '20', label: '문제' },
            { num: '10초', label: '문제당' },
            { num: '70%', label: '매칭 기준' },
          ].map((item) => (
            <div key={item.label} className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="font-mono font-bold text-accent-light text-xl">{item.num}</div>
              <div className="text-slate-500 text-xs mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
