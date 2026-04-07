'use client';

import { Question } from '@/lib/types';

interface QuestionDisplayProps {
  question: Question;
  selectedAnswer: number | null;
  onSelect: (index: number) => void;
  questionIndex: number; // 0-based
  totalQuestions: number;
  disabled?: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function QuestionDisplay({
  question,
  selectedAnswer,
  onSelect,
  questionIndex,
  totalQuestions,
  disabled,
}: QuestionDisplayProps) {
  return (
    <div className="animate-slide-up">
      {/* 진행 표시 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i < questionIndex
                  ? 'w-3 bg-violet-500'
                  : i === questionIndex
                  ? 'w-5 bg-accent-light'
                  : 'w-3 bg-border'
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-sm text-slate-500">
          {questionIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* 질문 텍스트 */}
      <div className="mb-8">
        <h2 className="font-display font-bold text-2xl text-white leading-snug">
          {question.question_text}
        </h2>
      </div>

      {/* 선택지 */}
      <div className="grid gap-3">
        {question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => !disabled && onSelect(idx)}
            disabled={disabled}
            className={`option-btn w-full text-left px-5 py-4 rounded-xl border text-base transition-all ${
              selectedAnswer === idx
                ? 'selected border-violet-500 bg-violet-900/30 text-white'
                : 'border-border bg-surface text-slate-300 hover:border-violet-700/60 hover:text-white'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-sm font-bold w-6 flex-shrink-0 ${
                  selectedAnswer === idx ? 'text-accent-light' : 'text-slate-600'
                }`}
              >
                {OPTION_LABELS[idx]}
              </span>
              <span className="flex-1">{option}</span>
              {selectedAnswer === idx && (
                <span className="text-accent-light text-lg flex-shrink-0">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
