/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Supabase realtime 중복 구독 방지
};

module.exports = nextConfig;
