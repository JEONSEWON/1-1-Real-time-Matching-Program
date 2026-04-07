import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { nickname } = await req.json();
    if (!nickname) return NextResponse.json({ ok: true });
    const supabase = createServerClient();
    await supabase.from('participants').update({ is_online: false }).eq('nickname', nickname);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
