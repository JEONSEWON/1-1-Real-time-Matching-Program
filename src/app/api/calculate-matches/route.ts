import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  try {
    const { sessionId } = await req.json();

    // 해당 세션의 모든 답변 조회
    const { data: answers, error: answersErr } = await supabase
      .from('answers')
      .select('*')
      .eq('session_id', sessionId)
      .not('answer_index', 'is', null);

    if (answersErr) throw answersErr;
    if (!answers || answers.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 세션의 질문 조회
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number');

    if (qErr) throw qErr;

    // 참가자별 답변 맵 생성: { nickname: { question_number: answer_index } }
    const participantAnswers: Record<string, Record<number, number>> = {};
    for (const answer of answers) {
      if (answer.answer_index === null) continue;
      if (!participantAnswers[answer.participant_nickname]) {
        participantAnswers[answer.participant_nickname] = {};
      }
      participantAnswers[answer.participant_nickname][answer.question_number] = answer.answer_index;
    }

    const participants = Object.keys(participantAnswers);
    if (participants.length < 2) {
      return NextResponse.json({ matches: [] });
    }

    const newMatches = [];

    // 모든 쌍 비교
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i];
        const b = participants[j];
        const answersA = participantAnswers[a];
        const answersB = participantAnswers[b];

        // 둘 다 답한 문제 번호 목록
        const bothAnswered = Object.keys(answersA)
          .map(Number)
          .filter((qNum) => answersB[qNum] !== undefined);

        if (bothAnswered.length === 0) continue;

        // 같은 답 목록
        const sameAnswers = bothAnswered.filter(
          (qNum) => answersA[qNum] === answersB[qNum]
        );

        const matchPercentage = (sameAnswers.length / bothAnswered.length) * 100;

        if (matchPercentage >= 70) {
          // 공통 답변 상세 생성
          const commonAnswers = sameAnswers.map((qNum) => {
            const question = questions?.find((q) => q.question_number === qNum);
            return {
              question_number: qNum,
              question_text: question?.question_text || '',
              answer_text: question?.options[answersA[qNum]] || '',
            };
          });

          newMatches.push({
            session_id: sessionId,
            participant_a: a,
            participant_b: b,
            match_percentage: Math.round(matchPercentage * 10) / 10,
            common_answers: commonAnswers,
          });
        }
      }
    }

    // 매칭 결과 저장
    if (newMatches.length > 0) {
      const { error: insertErr } = await supabase
        .from('matches')
        .insert(newMatches);

      if (insertErr) console.error('Match insert error:', insertErr);
    }

    return NextResponse.json({ matches: newMatches, count: newMatches.length });
  } catch (error) {
    console.error('Match calculation error:', error);
    return NextResponse.json({ error: 'Failed to calculate matches' }, { status: 500 });
  }
}
