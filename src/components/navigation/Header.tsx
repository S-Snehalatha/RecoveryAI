'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, UserCheck, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/reviews', label: 'Review Queue', icon: UserCheck, badge: '3' },
  { href: '/audit', label: 'Audit Trail', icon: ShieldAlert },
  { href: '/simulation', label: 'Demo Scenarios', icon: Cpu },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Track */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                RecoverAI
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400">
                Track 03
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Execution Mode Badge */}
          <div className="flex items-center gap-3">
            <Link
              href="/simulation"
              className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>DEMO SIMULATION</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}