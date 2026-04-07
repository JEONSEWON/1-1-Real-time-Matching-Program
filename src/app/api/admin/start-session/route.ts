export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function generateQuestions(sessionNumber: number, count: number = 20) {
  const prompt = `당신은 재미있는 취향 테스트 문제를 만드는 전문가입니다.

세션 번호 ${sessionNumber}에 맞는 개인 취향 관련 문제 ${count}개를 생성해주세요.

규칙:
- 가볍고 재미있는 주제 (음식, 생활방식, 여행, 엔터테인먼트, 취미 등)
- 진지하거나 민감한 주제 금지
- 각 문제에 보기는 2~4개
- 한국어로 작성
- 매 세션마다 완전히 다른 주제를 다루도록 변화를 줄 것

반드시 아래 JSON 형식만 반환하세요 (마크다운이나 설명 없이):
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "문제 내용",
      "options": ["보기1", "보기2", "보기3"]
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(clean);
  return parsed.questions;
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  try {
    const { sessionNumber } = await req.json();

    const generatedQuestions = await generateQuestions(sessionNumber, 20);

    const { data: session, error: sessionErr } = await supabase
      .from('game_sessions')
      .insert({
        session_number: sessionNumber,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionErr) throw sessionErr;

    const questionsToInsert = generatedQuestions.map((q: any) => ({
      session_id: session.id,
      question_number: q.question_number,
      question_text: q.question_text,
      options: q.options,
    }));

    const { error: qInsertErr } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (qInsertErr) throw qInsertErr;

    await supabase
      .from('game_config')
      .update({
        is_active: true,
        current_session_number: sessionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Start session error:', error);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
