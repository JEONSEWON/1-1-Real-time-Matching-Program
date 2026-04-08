'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Match, ChatMessage, CommonAnswer } from '@/lib/types';

interface ChatModalProps {
  match: Match;
  myNickname: string;
  onClose?: () => void;
}

export default function ChatModal({ match, myNickname, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showCommon, setShowCommon] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const otherNickname =
    match.participant_a === myNickname ? match.participant_b : match.participant_a;

  // 기존 메시지 로드
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();

    // 실시간 구독
    const channel = supabase
      .channel(`chat:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  // 스크롤 하단 고정
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput('');
    inputRef.current?.focus();

    await supabase.from('chat_messages').insert({
      match_id: match.id,
      sender_nickname: myNickname,
      content,
    });

    setSending(false);
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-border overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon" />
            <span className="font-semibold text-white text-sm">{otherNickname}</span>
          </div>
          <p className="text-xs text-accent-light mt-0.5">
            {Math.round(match.match_percentage)}%의 같은 답을 선택했어요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCommon(!showCommon)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            공통 답변 {showCommon ? '숨기기' : '보기'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 공통 답변 목록 */}
      {showCommon && match.common_answers.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-bg/50 flex-shrink-0">
          <p className="text-xs text-slate-500 mb-2 font-medium">같은 답을 선택한 문항</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {match.common_answers.map((ca: CommonAnswer, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs font-mono text-slate-600 flex-shrink-0 mt-0.5">
                  Q{ca.question_number}
                </span>
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 truncate block">{ca.question_text}</span>
                  <span className="text-xs text-accent-light font-medium">→ {ca.answer_text}</span>
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {/* 시작 안내 */}
        <div className="text-center">
          <span className="text-xs text-slate-600 bg-bg px-3 py-1 rounded-full">
            {Math.round(match.match_percentage)}%의 같은 답을 선택한 {otherNickname}님과 대화해보세요.
          </span>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_nickname === myNickname ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[75%]">
              {msg.sender_nickname !== myNickname && (
                <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_nickname}</p>
              )}
              <div
                className={`px-3 py-2 text-sm text-white ${
                  msg.sender_nickname === myNickname
                    ? 'chat-bubble-me'
                    : 'chat-bubble-other'
                }`}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex gap-2 px-4 py-3 border-t border-border flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="메시지 입력..."
          maxLength={200}
          className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  );
}
