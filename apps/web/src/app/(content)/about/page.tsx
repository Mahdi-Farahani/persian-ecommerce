import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';
import { t } from '@/i18n';

export const metadata: Metadata = {
  title: t.content.about.title,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <ContentPage title={t.content.about.title}>
      {t.content.about.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </ContentPage>
  );
}
