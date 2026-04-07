# YouMatch - 실시간 1:1 취향 매칭 시스템

## 빠른 시작

### 1. Supabase 설정
1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 전체 실행
3. Realtime 탭 → 모든 테이블 활성화 확인

### 2. 환경변수 설정
`.env.local.example` → `.env.local` 복사 후 값 채우기:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_ADMIN_PASSWORD=admin1234
```

### 3. 로컬 실행
```bash
npm install
npm run dev
```

### 4. Vercel 배포
```bash
vercel --prod
```
환경변수를 Vercel 대시보드에도 동일하게 등록

## 게임 진행 방법

1. 참가자들이 `/` 접속 → 닉네임 입력 → `/game` 이동
2. 관리자가 `/admin` 접속 (비밀번호: admin1234)
3. 관리자 패널에서 **세션 1 시작** 클릭
4. Claude API가 20문제 자동 생성 (5~10초)
5. 참가자 화면에 3-2-1 카운트다운 후 게임 시작
6. 200초 후 세션 종료 → 70% 이상 일치 시 채팅창 자동 오픈
7. 관리자가 다음 세션 시작 → 총 10회 반복

## 기술 스택
- **프레임워크**: Next.js 14 + TypeScript
- **DB/Realtime**: Supabase
- **AI**: Claude Sonnet (문제 자동 생성)
- **배포**: Vercel
- **디자인**: Tailwind CSS (다크 테마)
