import { Card } from '@/components/ui/card';
import { t } from '@/i18n';

/** Inline "not allowed" card for admin pages the user may not open. */
export function Forbidden() {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <h1 className="text-lg font-bold">{t.common.forbiddenTitle}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t.common.forbiddenBody}</p>
    </Card>
  );
}
