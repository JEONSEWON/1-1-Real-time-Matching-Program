import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  try {
    const body = await req.json();
    const allowedFields = ['session_start_time', 'is_active', 'current_session_number', 'between_session_seconds'];

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const { data, error } = await supabase
      .from('game_config')
      .update(updateData)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('Config update error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
