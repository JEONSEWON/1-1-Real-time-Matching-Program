export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function generateForSession(sessionNumber: number) {
  const prompt = `당신은 재미있는 취향 테스트 문제를 만드는 전문가입니다.

세션 번호 ${sessionNumber}에 맞는 개인 취향 관련 문제 20개를 생성해주세요.

규칙:
- 가볍고 재미있는 주제 (음식, 생활방식, 여행, 엔터테인먼트, 취미 등)
- 진지하거나 민감한 주제 금지
- 각 문제에 보기는 2~4개
- 한국어로 작성
- 다른 세션과 주제가 겹치지 않도록 세션 ${sessionNumber}만의 독특한 주제로

반드시 아래 JSON 형식만 반환하세요 (마크다운 없이):
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
  try {
    const { totalSessions = 10 } = await req.json();
    const allSessions: { sessionNumber: number; questions: any[] }[] = [];

    for (let i = 1; i <= totalSessions; i++) {
      const questions = await generateForSession(i);
      allSessions.push({ sessionNumber: i, questions });
    }

    return NextResponse.json({ sessions: allSessions });
  } catch (error) {
    console.error('Generate all questions error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
