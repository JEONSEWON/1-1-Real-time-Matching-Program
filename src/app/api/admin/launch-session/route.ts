export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  try {
    const { sessionNumber, questions } = await req.json();

    // 세션 생성 (status: active)
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
    const questionsToInsert = questions.map((q: any) => ({
      session_id: session.id,
      question_number: q.question_number,
      question_text: q.question_text,
      options: q.options,
    }));

    const { error: qErr } = await supabase.from('questions').insert(questionsToInsert);
    if (qErr) throw qErr;

    // game_config 업데이트
    await supabase.from('game_config').update({
      is_active: true,
      current_session_number: sessionNumber,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Launch session error:', error);
    return NextResponse.json({ error: 'Failed to launch session' }, { status: 500 });
  }
}
