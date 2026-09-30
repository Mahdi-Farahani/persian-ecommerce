'use client';

import { useEffect } from 'react';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the browser console for diagnostics; never render internals.
    console.error(error);
  }, [error]);

  return (
    <Container className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t.common.errorTitle}</h1>
      <p className="mt-2 text-ink-muted">{t.common.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
      >
        {t.common.retry}
      </button>
    </Container>
  );
}
