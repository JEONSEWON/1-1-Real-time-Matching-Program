'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GameRoom from '@/components/GameRoom';

export default function GamePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('nickname');
    if (!stored) {
      router.replace('/');
    } else {
      setNickname(stored);
    }
  }, []);

  if (!nickname) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <GameRoom nickname={nickname} />;
}
