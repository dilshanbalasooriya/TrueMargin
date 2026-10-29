import { getTranslations } from 'next-intl/server';
import { SavedSheetsPage } from '@/components/sheets/SavedSheetsPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Sheets' });
  return { title: t('title'), description: t('description') };
}

export default function SheetsPage() {
  return <SavedSheetsPage />;
}
