'use client';

import { formatJalaliDateTime, type AuditLogView } from '@pe/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Badge } from '@/components/admin/badge';
import { Td } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { adminFa } from '@/i18n/admin-fa';
import { auditEntityHref } from '@/lib/admin/audit-links';

const copy = adminFa.auditLogs;
/** Number of visible columns in the audit table; the details row spans them all. */
const COLUMN_COUNT = 6;

function hasMetadata(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

/** One audit entry plus an expandable row that pretty-prints its metadata. */
export function AuditLogRow({ entry }: { entry: AuditLogView }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const href = auditEntityHref(entry.entityType, entry.entityId);
  const expandable = hasMetadata(entry.metadata);

  return (
    <>
      <tr className="hover:bg-surface-muted/60">
        <Td className="text-xs whitespace-nowrap text-ink-muted">
          <time dateTime={entry.createdAt}>{formatJalaliDateTime(entry.createdAt)}</time>
        </Td>
        <Td>
          {entry.actor ? (
            <div className="flex flex-col">
              <span>{entry.actor.name || copy.system}</span>
              {entry.actor.email ? (
                <span className="text-xs text-ink-muted" dir="ltr">
                  {entry.actor.email}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-ink-muted">{copy.system}</span>
          )}
        </Td>
        <Td>
          <Badge tone="info" className="font-mono">
            <span dir="ltr">{entry.action}</span>
          </Badge>
        </Td>
        <Td>
          <div className="flex flex-col" dir="ltr">
            <span className="text-xs font-medium">{entry.entityType}</span>
            {entry.entityId ? (
              href ? (
                <Link
                  href={href}
                  className="font-mono text-xs text-brand-700 hover:underline"
                  title={copy.openEntity}
                >
                  {entry.entityId}
                </Link>
              ) : (
                <span className="font-mono text-xs text-ink-muted">{entry.entityId}</span>
              )
            ) : null}
          </div>
        </Td>
        <Td className="font-mono text-xs text-ink-muted" dir="ltr">
          {entry.ipAddress ?? adminFa.common.none}
        </Td>
        <Td>
          {expandable ? (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? copy.hideMetadata : copy.showMetadata}
            </Button>
          ) : (
            <span className="text-xs text-ink-muted">{copy.noMetadata}</span>
          )}
        </Td>
      </tr>
      {expandable && open ? (
        <tr id={detailsId} className="bg-surface-muted/40">
          <Td colSpan={COLUMN_COUNT} className="py-3">
            <pre
              dir="ltr"
              className="max-h-80 overflow-auto rounded-lg border border-border bg-surface p-3 text-left font-mono text-xs leading-relaxed"
            >
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </Td>
        </tr>
      ) : null}
    </>
  );
}
