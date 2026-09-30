import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t.content.faq.title, alternates: { canonical: '/faq' } };

export default function FaqPage() {
  return (
    <ContentPage title={t.content.faq.title}>
      {t.content.faq.items.map((item) => (
        <details key={item.q} className="group rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer list-none font-bold">{item.q}</summary>
          <p className="mt-2 text-ink-muted">{item.a}</p>
        </details>
      ))}
    </ContentPage>
  );
}
