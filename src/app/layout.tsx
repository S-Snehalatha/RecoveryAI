import type { Metadata } from 'next';
import './globals.css';
import { env } from '@/lib/config/env';

export const metadata: Metadata = {
  title: 'RecoverAI — Autonomous AI Revenue Recovery',
  description: 'Built for Razorpay AI Buildathon 2026, Track 03: AI Revenue Recovery',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                RecoverAI
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 font-mono">
                Track 03 · AI Revenue Recovery
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                MODE: {env.EXECUTION_MODE}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-800 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
          RecoverAI · Deterministic Guarded Revenue Recovery Engine · Razorpay AI Buildathon 2026
        </footer>
      </body>
    </html>
  );
}
