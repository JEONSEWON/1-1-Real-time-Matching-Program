export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  try {
    const { sessionNumber } = await req.json();

    // 문제 생성 요청
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qRes = await fetch(`${baseUrl}/api/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionNumber, count: 20 }),
    });

    if (!qRes.ok) throw new Error('Failed to generate questions');
    const { questions: generatedQuestions } = await qRes.json();

    // 세션 생성
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

    // 문제 저장
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

    // game_config 업데이트
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
