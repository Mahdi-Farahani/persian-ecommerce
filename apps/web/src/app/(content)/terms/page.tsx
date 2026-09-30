import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';
import { t } from '@/i18n';

export const metadata: Metadata = {
  title: t.content.terms.title,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <ContentPage title={t.content.terms.title}>
      {t.content.terms.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-1 text-lg font-bold">{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </ContentPage>
  );
}
