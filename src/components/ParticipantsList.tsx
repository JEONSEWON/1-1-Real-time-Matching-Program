'use client';

import { Participant } from '@/lib/types';

interface ParticipantsListProps {
  participants: Participant[];
  myNickname: string;
}

export default function ParticipantsList({ participants, myNickname }: ParticipantsListProps) {
  const online = participants.filter((p) => p.is_online);
  const sorted = [...online].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

  return (
    <div className="bg-surface border border-border rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">접속 중</h3>
        <span className="text-xs font-mono text-neon bg-neon/10 px-2 py-0.5 rounded-full">
          {sorted.length}명
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {sorted.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              p.nickname === myNickname
                ? 'bg-violet-900/30 border border-violet-700/40'
                : 'hover:bg-bg/50'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-neon flex-shrink-0" />
            <span
              className={`text-sm truncate ${
                p.nickname === myNickname ? 'text-accent-light font-medium' : 'text-slate-300'
              }`}
            >
              {p.nickname}
              {p.nickname === myNickname && (
                <span className="ml-1 text-xs text-slate-500">(나)</span>
              )}
            </span>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-4">
            아직 아무도 없어요
          </div>
        )}
      </div>
    </div>
  );
}
