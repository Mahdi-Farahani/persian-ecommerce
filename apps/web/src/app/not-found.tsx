import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <p className="text-6xl font-extrabold text-brand-600">۴۰۴</p>
      <h1 className="mt-4 text-2xl font-bold">{t.common.notFoundTitle}</h1>
      <p className="mt-2 text-ink-muted">{t.common.notFoundBody}</p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
      >
        {t.common.backHome}
      </Link>
    </Container>
  );
}
