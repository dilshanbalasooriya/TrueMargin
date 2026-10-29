'use client';

import { useLocale, useTranslations } from 'next-intl';

export function HeroBanner() {
  const locale = useLocale();
  const t = useTranslations('Index');

  const isSi = locale === 'si';

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-indigo-50/80 p-6 sm:p-8 lg:p-10 shadow-xs dark:border-sky-900/40 dark:from-slate-900/90 dark:via-blue-950/40 dark:to-slate-900/90">
      {/* Decorative background blur shapes */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-600/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-12 -bottom-12 size-60 rounded-full bg-blue-200/30 blur-2xl dark:bg-blue-600/10"
        aria-hidden="true"
      />

      <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] xl:gap-8">
        {/* Left Copy */}
        <div className="space-y-3.5 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-sky-100/70 px-3 py-1 text-xs font-semibold text-sky-800 backdrop-blur-xs dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300">
            <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
            {isSi ? 'ඒකක පිරිවැය සහ විකුණුම් මිල ගණනය' : 'Unit Cost & Selling Price Calculator'}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15] dark:text-slate-100">
            {isSi ? (
              <>
                නියම වියදම ගණනය කරන්න.{' '}
                <span className="text-primary block sm:inline">නිවැරදි මිල තීරණය කරන්න.</span>
              </>
            ) : (
              <>
                Calculate the <span className="text-slate-900 dark:text-white">real cost.</span>{' '}
                <span className="text-primary block sm:inline">Set the right price.</span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {isSi
              ? 'ඔබගේ නිෂ්පාදනයේ, සේවාවේ හෝ කාර්යයේ සැබෑ ඒකක පිරිවැය පහසුවෙන් සොයාගෙන නිවැරදි ලාභදායී මිලක් තීරණය කරන්න.'
              : 'Find the true cost of your product, service or job — quickly and easily. Make smarter decisions for your business.'}
          </p>
        </div>

        {/* Center 3D Illustration matching user reference */}
        <div className="flex justify-center py-2 lg:py-0">
          <svg
            className="w-48 sm:w-56 md:w-64 h-auto drop-shadow-md select-none"
            viewBox="0 0 280 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              {/* Calculator Gradients */}
              <linearGradient id="calcBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="calcScreen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#bfdbfe" />
              </linearGradient>
              {/* Document Gradients */}
              <linearGradient id="docBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f8fafc" />
              </linearGradient>
              {/* Coin Gradients */}
              <linearGradient id="goldCoinTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="goldCoinSide" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              {/* Plant Gradient */}
              <linearGradient id="leafGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              {/* Chart Line Gradient */}
              <linearGradient id="chartLine" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>

            {/* Subtle soft backdrop clouds */}
            <path
              d="M30 140 C 45 125, 70 125, 85 140 C 95 130, 120 130, 130 145 C 145 140, 170 140, 185 155 Z"
              fill="#e0f2fe"
              fillOpacity="0.6"
            />
            <path
              d="M170 150 C 185 135, 210 135, 225 150 C 235 142, 255 142, 265 155 Z"
              fill="#e0f2fe"
              fillOpacity="0.4"
            />

            {/* Plant leaf accent on the left */}
            <g transform="translate(42, 45)">
              {/* Stem */}
              <path d="M15 90 Q 18 50 16 20" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
              {/* Bottom leaf */}
              <path
                d="M15 80 C 5 75, -5 60, 5 50 C 15 50, 18 65, 15 80 Z"
                fill="url(#leafGrad)"
              />
              {/* Mid leaf */}
              <path
                d="M16 60 C 25 50, 35 40, 32 30 C 20 30, 15 45, 16 60 Z"
                fill="url(#leafGrad)"
              />
              {/* Top leaf */}
              <path
                d="M16 35 C 10 22, 10 10, 16 5 C 22 10, 22 22, 16 35 Z"
                fill="url(#leafGrad)"
              />
            </g>

            {/* Financial Report Document Sheet (Back/Center) */}
            <g transform="translate(135, 20)">
              {/* Document Base with subtle shadow */}
              <rect
                x="0"
                y="0"
                width="95"
                height="130"
                rx="10"
                fill="url(#docBg)"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                filter="drop-shadow(0 8px 12px rgba(0,0,0,0.06))"
              />
              {/* Header Bar */}
              <rect x="14" y="16" width="40" height="7" rx="3.5" fill="#94a3b8" />
              <rect x="14" y="28" width="67" height="4" rx="2" fill="#e2e8f0" />
              <rect x="14" y="36" width="55" height="4" rx="2" fill="#e2e8f0" />

              {/* Mini Chart Graphic with Trend Arrow */}
              <rect x="12" y="48" width="71" height="52" rx="6" fill="#eff6ff" />
              {/* Grid lines */}
              <line x1="16" y1="62" x2="79" y2="62" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="16" y1="76" x2="79" y2="76" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="16" y1="90" x2="79" y2="90" stroke="#dbeafe" strokeWidth="1" strokeDasharray="2 2" />

              {/* Upward Line Chart with Arrow */}
              <path
                d="M18 88 L 32 74 L 46 80 L 62 60 L 74 54"
                stroke="url(#chartLine)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Arrow Head */}
              <polygon points="74,50 78,57 70,57" fill="#2563eb" />

              {/* Bottom Document Status Bars */}
              <rect x="14" y="108" width="30" height="8" rx="4" fill="#3b82f6" />
              <rect x="48" y="108" width="33" height="8" rx="4" fill="#10b981" />
            </g>

            {/* 3D Modern Calculator (Center-Left foreground) */}
            <g transform="translate(85, 45)">
              {/* Calculator Body */}
              <rect
                x="0"
                y="0"
                width="72"
                height="102"
                rx="12"
                fill="url(#calcBody)"
                filter="drop-shadow(0 10px 18px rgba(37,99,235,0.28))"
              />

              {/* Inner Screen */}
              <rect x="9" y="10" width="54" height="24" rx="6" fill="url(#calcScreen)" />
              {/* Screen text indicator */}
              <rect x="15" y="19" width="30" height="5" rx="2.5" fill="#1e40af" />
              <circle cx="53" cy="21.5" r="2.5" fill="#1e40af" />

              {/* Calculator Keypad Matrix */}
              {/* Row 1 */}
              <rect x="10" y="42" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="29" y="42" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="48" y="42" width="13" height="11" rx="3.5" fill="#93c5fd" />
              {/* Row 2 */}
              <rect x="10" y="57" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="29" y="57" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="48" y="57" width="13" height="11" rx="3.5" fill="#93c5fd" />
              {/* Row 3 */}
              <rect x="10" y="72" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="29" y="72" width="13" height="11" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="48" y="72" width="13" height="11" rx="3.5" fill="#fbbf24" />
              {/* Row 4 (Big Equals / Zero Key) */}
              <rect x="10" y="86" width="32" height="10" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
              <rect x="48" y="86" width="13" height="10" rx="3.5" fill="#34d399" />
            </g>

            {/* 3D Stack of Gold Coins (Front-Center) */}
            {/* Coin 1 (Left single coin) */}
            <g transform="translate(125, 138)">
              <path d="M0 6 C 0 10, 20 10, 20 6 L 20 12 C 20 16, 0 16, 0 12 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="10" cy="6" rx="10" ry="4" fill="url(#goldCoinTop)" />
            </g>
            {/* Stack 1 (Middle stack of 3 coins) */}
            <g transform="translate(142, 126)">
              {/* Coin bottom */}
              <path d="M0 16 C 0 20, 22 20, 22 16 L 22 22 C 22 26, 0 26, 0 22 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="11" cy="16" rx="11" ry="4.5" fill="url(#goldCoinTop)" />
              {/* Coin middle */}
              <path d="M0 10 C 0 14, 22 14, 22 10 L 22 16 C 22 20, 0 20, 0 16 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="11" cy="10" rx="11" ry="4.5" fill="url(#goldCoinTop)" />
              {/* Coin top */}
              <path d="M0 4 C 0 8, 22 8, 22 4 L 22 10 C 22 14, 0 14, 0 10 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="11" cy="4" rx="11" ry="4.5" fill="url(#goldCoinTop)" />
            </g>
            {/* Stack 2 (Right stack of 2 coins) */}
            <g transform="translate(162, 132)">
              <path d="M0 8 C 0 12, 18 12, 18 8 L 18 14 C 18 18, 0 18, 0 14 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="9" cy="8" rx="9" ry="3.8" fill="url(#goldCoinTop)" />
              <path d="M0 3 C 0 7, 18 7, 18 3 L 18 9 C 18 13, 0 13, 0 9 Z" fill="url(#goldCoinSide)" />
              <ellipse cx="9" cy="3" rx="9" ry="3.8" fill="url(#goldCoinTop)" />
            </g>
          </svg>
        </div>

        {/* Right Calligraphy Quote matching screenshot */}
        <div className="flex flex-col items-center lg:items-end text-center lg:text-right space-y-1 py-1">
          <div className="relative inline-block">
            <span
              className="text-xl sm:text-2xl font-serif italic text-slate-700 dark:text-slate-200 tracking-wide select-none"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
            >
              {isSi ? 'සැබෑ පිරිවැය දැනගන්න.' : 'Know your true cost.'}
            </span>
          </div>

          <div className="relative inline-block">
            <span
              className="text-xl sm:text-2xl font-serif italic text-slate-700 dark:text-slate-200 tracking-wide select-none"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
            >
              {isSi ? 'විශ්වාසයෙන් මිල තබන්න.' : 'Price with confidence.'}
            </span>

            {/* Elegant curved hand-drawn underline accent */}
            <svg
              className="w-full h-3.5 text-primary mt-1"
              viewBox="0 0 160 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 9 C 40 2, 110 3, 156 11"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
