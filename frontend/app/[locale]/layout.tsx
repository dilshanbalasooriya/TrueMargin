import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ThemeProvider } from '@/components/app/ThemeProvider';
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
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

  // Fetch initial auth state
  const supabase = await import('@/lib/supabase/server').then(mod => mod.createClient());
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${notoSansSinhala.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <AuthProvider initialUser={user} initialSession={session}>
              {children}
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
