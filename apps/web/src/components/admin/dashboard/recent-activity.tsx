import { formatJalaliDateTime, type AuditLogView } from '@pe/shared';
import Link from 'next/link';
import { Badge } from '@/components/admin/badge';
import { Card } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { auditEntityHref } from '@/lib/admin/audit-links';

const copy = adminFa.dashboard.recentActivity;

interface RecentActivityProps {
  entries: AuditLogView[];
  /** Whether the viewer may open the full audit log. */
  canViewAll: boolean;
}

/** Compact feed of the latest audit-log entries. */
export function RecentActivity({ entries, canViewAll }: RecentActivityProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{copy.title}</h2>
        {canViewAll ? (
          <Link
            href="/admin/audit-logs"
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            {copy.viewAll}
          </Link>
        ) : null}
      </div>
      <Card className="p-0 sm:p-0">
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">{copy.empty}</p>
        ) : (
          <ol className="divide-y divide-border text-sm">
            {entries.map((entry) => {
              const href = auditEntityHref(entry.entityType, entry.entityId);
              const entity = (
                <span dir="ltr" className="inline-block text-xs text-ink-muted">
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                </span>
              );
              return (
                <li key={entry.id} className="flex flex-col gap-1 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{entry.actor?.name || copy.system}</span>
                    <Badge tone="info" className="font-mono">
                      <span dir="ltr">{entry.action}</span>
                    </Badge>
                    {href ? (
                      <Link href={href} className="hover:text-brand-700">
                        {entity}
                      </Link>
                    ) : (
                      entity
                    )}
                  </div>
                  <time dateTime={entry.createdAt} className="text-xs text-ink-muted">
                    {formatJalaliDateTime(entry.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </section>
  );
}
