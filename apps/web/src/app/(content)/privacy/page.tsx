import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';
import { t } from '@/i18n';

export const metadata: Metadata = {
  title: t.content.privacy.title,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ContentPage title={t.content.privacy.title}>
      {t.content.privacy.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-1 text-lg font-bold">{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </ContentPage>
  );
}
