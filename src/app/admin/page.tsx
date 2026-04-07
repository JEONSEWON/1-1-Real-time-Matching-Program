import Link from 'next/link';
import { ArrowRight, CheckCircle, Zap, Shield, BarChart3, Bell, Globe } from 'lucide-react';
import ClientHeader from '@/components/ClientHeader';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'checkapi.io | Simple API Monitoring by Axiom Technologies',
  description: 'Professional API uptime monitoring and public status pages. A core technology by Axiom Technologies for solo founders and engineering teams. Free tier available.',
  openGraph: {
    title: 'checkapi.io | Simple API Monitoring by Axiom Technologies',
    description: 'Professional API uptime monitoring and public status pages.',
    url: 'https://checkapi.io',
    siteName: 'CheckAPI by Axiom Technologies',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'checkapi.io | Simple API Monitoring by Axiom Technologies',
    description: 'Professional API uptime monitoring and public status pages. Free tier available.',
    creator: '@imwon_dev',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
      <ClientHeader />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-medium px-4 py-2 rounded-full mb-8">
            <CheckCircle className="h-4 w-4" />
            Free for Commercial Use — No restrictions
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Stop finding out your API
            <br />
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              is down from your users.
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Minimalist API monitoring & status pages built for solo founders.
            5-minute setup, zero bloat, 24/7 peace of mind.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register" className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition font-semibold text-lg flex items-center gap-2 shadow-lg shadow-green-200 dark:shadow-green-900">
              Protect My API for Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#pricing" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition px-6 py-4">
              View Pricing →
            </a>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
            No credit card required · 5-minute setup · 10 monitors free
          </p>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-16 relative">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">checkapi.io/dashboard</span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Monitors', value: '8', color: 'text-gray-900 dark:text-white' },
                  { label: 'Online', value: '8', color: 'text-green-600 dark:text-green-400' },
                  { label: 'Offline', value: '0', color: 'text-red-500' },
                  { label: 'Avg Uptime', value: '99.9%', color: 'text-green-600 dark:text-green-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="relative bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Response Time — Last 24h</h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Updated 30s ago</span>
                </div>
                <div className="flex items-end gap-1 h-24">
                  {[40,45,42,38,44,80,120,95,48,42,44,41,39,43,46,42,40,38,44,43,41,45,42,40].map((h, i) => (
                    <div key={i} className={`flex-1 rounded-sm ${h > 70 ? 'bg-red-400' : 'bg-green-400'}`} style={{ height: `${(h / 120) * 100}%` }} />
                  ))}
                </div>
                <div className="absolute top-12 left-1/3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  ⚡ Latency spike detected — Slack alert sent in 1s
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Production API', url: 'api.yourapp.com', uptime: '99.9%' },
                  { name: 'Staging Environment', url: 'staging-api.yourapp.com', uptime: '99.8%' },
                  { name: 'Payment Webhook', url: 'hooks.yourapp.com/stripe', uptime: '100%' },
                ].map((monitor) => (
                  <div key={monitor.name} className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{monitor.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{monitor.url}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">{monitor.uptime} uptime</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-10 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Why checkapi.io?</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-6">
            A solo developer built this tool after getting tired of finding out about API downtime from user complaints.
            Enterprise tools were too bloated. Free tools had too many restrictions. So this was built to do one thing well —
            tell you when your API is broken, before anyone else finds out.
          </p>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              Axiom Technologies is dedicated to building minimalist, mission-critical tools for the modern developer. checkapi.io is our first step toward a more reliable web.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Reliable API Uptime Checks</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Everything you need to monitor APIs and communicate status to your users.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />, title: 'Instant Alerts', description: 'Check your APIs every minute. Get instant alerts when something goes wrong.' },
            { icon: <Bell className="h-6 w-6 text-green-600 dark:text-green-400" />, title: 'Multi-Channel Notifications', description: 'Email, Slack, Telegram, Discord, or custom webhooks. You choose how to be notified.' },
            { icon: <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />, title: '24h Response Time Graphs', description: 'Track uptime, response times, and incidents. Distinguish provider lag from your own code.' },
            { icon: <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />, title: 'Customizable Status Pages', description: 'Share a public status page with your users. No more "is it down?" support tickets.' },
            { icon: <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />, title: 'Silent Failure Detection', description: 'Catches failures even when your API returns 200 OK but something is actually broken.' },
            { icon: <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />, title: 'Free for Commercial Use', description: 'Unlike UptimeRobot, no restrictions on how you use the free plan. Build your business.' },
          ].map((feature) => (
            <div key={feature.title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-950 rounded-lg flex items-center justify-center mb-4">{feature.icon}</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">Start free, upgrade when you grow</p>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { name: 'Free', price: '$0', period: '/month', badge: null, features: ['10 monitors','5-minute checks','All alert channels','Public status page','7-day history','Commercial use allowed'], cta: 'Start Free', ctaHref: '/register', highlight: false },
            { name: 'Starter', price: '$5', period: '/month', badge: 'POPULAR', features: ['20 monitors','1-minute checks','All alert channels','Analytics','30-day history','Commercial use allowed'], cta: 'Get Started', ctaHref: '/register', highlight: true },
            { name: 'Pro', price: '$15', period: '/month', badge: 'Best for growing startups', features: ['100 monitors','30-second checks','Team sharing','Priority support','90-day history','Commercial use allowed'], cta: 'Get Started', ctaHref: '/register', highlight: false },
            { name: 'Business', price: '$49', period: '/month', badge: null, features: ['Unlimited monitors','10-second checks','API access','Custom features','SLA','1-year history'], cta: 'Get Started', ctaHref: '/register', highlight: false },
          ].map((plan) => (
            <div key={plan.name} className={`bg-white dark:bg-gray-900 rounded-2xl border-2 p-6 ${plan.highlight ? 'border-green-500 shadow-lg' : 'border-gray-200 dark:border-gray-700'}`}>
              {plan.badge && (
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${plan.badge === 'POPULAR' ? 'bg-green-500 text-white' : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'}`}>
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href={plan.ctaHref} className={`block text-center py-2.5 rounded-lg font-medium transition ${plan.highlight ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-green-500 hover:text-green-600'}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">All plans include commercial use. No hidden fees. Cancel anytime.</p>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start monitoring before your next incident</h2>
          <p className="text-green-100 mb-8 text-lg">Takes 5 minutes to set up. You'll wonder how you managed without it.</p>
          <Link href="/register" className="inline-flex items-center bg-white text-green-600 px-8 py-4 rounded-xl hover:bg-gray-50 transition font-semibold text-lg gap-2">
            Protect My API for Free <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-green-200 text-sm mt-4">No credit card required · 10 monitors free forever</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">CheckAPI</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">by Axiom Technologies</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Simple, reliable API monitoring for developers and teams.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#features" className="hover:text-green-600 dark:hover:text-green-400">Features</a></li>
                <li><a href="#pricing" className="hover:text-green-600 dark:hover:text-green-400">Pricing</a></li>
                <li><Link href="/docs" className="hover:text-green-600 dark:hover:text-green-400">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/about" className="hover:text-green-600 dark:hover:text-green-400">About</Link></li>
                <li><Link href="/blog" className="hover:text-green-600 dark:hover:text-green-400">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-green-600 dark:hover:text-green-400">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/privacy" className="hover:text-green-600 dark:hover:text-green-400">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-green-600 dark:hover:text-green-400">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            © 2026 Axiom Technologies. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
