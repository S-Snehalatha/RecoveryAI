import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/navigation/Header';

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
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
        <Header />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 text-center text-xs text-slate-500">
          <p>RecoverAI · AI Revenue Recovery with Deterministic Policy Controls</p>
          <p className="mt-1 text-slate-600">Razorpay AI Buildathon 2026 · Track 03</p>
        </footer>
      </body>
    </html>
  );
}