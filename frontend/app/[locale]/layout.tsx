import { Noto_Sans_Sinhala, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ThemeProvider } from '@/components/app/ThemeProvider';
import { AppShell } from '@/components/app/AppShell';
import "../globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});



export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const { locale } = await params;
  const t = await getTranslations({locale, namespace: 'Index'});
  return {
    title: t('title'),
    description: t('description')
  };
}

import { cookies } from 'next/headers';
import { cn } from 'cn';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;
  if (!routing.locales.some((supportedLocale) => supportedLocale === locale)) {
    notFound();
  }
 
  const messages = await getMessages();

  // Read theme cookie on server so SSR and language switches never flash light mode
  const cookieStore = await cookies();
  const themeCookie =
    cookieStore.get('truemargin-theme')?.value ||
    cookieStore.get('theme')?.value;
  const isDark = themeCookie === 'dark';

  // Fetch initial auth state
  const supabase = await import('@/lib/supabase/server').then(mod => mod.createClient());
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        plusJakartaSans.variable,
        notoSansSinhala.variable,
        isDark && 'dark',
        'h-full antialiased bg-background text-foreground'
      )}
      style={{ colorScheme: isDark ? 'dark' : 'light' }}
    >
      <head>
        <meta name="darkreader-lock" content="" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )truemargin-theme=([^;]*)/);var v=m?decodeURIComponent(m[1]):localStorage.getItem('truemargin-theme')||localStorage.getItem('theme');var d=v==='dark';var el=document.documentElement;if(d){el.classList.add('dark');el.style.colorScheme='dark';document.cookie='truemargin-theme=dark; path=/; max-age=31536000; SameSite=Lax';document.cookie='theme=dark; path=/; max-age=31536000; SameSite=Lax';}else if(v==='light'){el.classList.remove('dark');el.style.colorScheme='light';document.cookie='truemargin-theme=light; path=/; max-age=31536000; SameSite=Lax';document.cookie='theme=light; path=/; max-age=31536000; SameSite=Lax';}if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){var ck=document.cookie.match(/(?:^|; )truemargin-theme=([^;]*)/);var cur=ck?decodeURIComponent(ck[1]):(localStorage.getItem('truemargin-theme')||localStorage.getItem('theme'));if(cur==='dark'&&!el.classList.contains('dark')){el.classList.add('dark');el.style.colorScheme='dark';}});mo.observe(el,{attributes:true,attributeFilter:['class']});}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider initialTheme={isDark ? 'dark' : 'light'}>
          <NextIntlClientProvider messages={messages}>
            <AuthProvider initialUser={user} initialSession={session}>
              <AppShell>
                {children}
              </AppShell>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
