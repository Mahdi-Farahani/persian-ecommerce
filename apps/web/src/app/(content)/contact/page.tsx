import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';
import { t } from '@/i18n';

export const metadata: Metadata = {
  title: t.content.contact.title,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const c = t.content.contact;
  return (
    <ContentPage title={c.title}>
      {c.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-ink-muted">{c.emailLabel}</dt>
          <dd className="font-medium" dir="ltr">
            {c.email}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{c.phoneLabel}</dt>
          <dd className="font-medium">{c.phone}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{c.hoursLabel}</dt>
          <dd className="font-medium">{c.hours}</dd>
        </div>
      </dl>
    </ContentPage>
  );
}
