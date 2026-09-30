import type { AuditLogView } from '@pe/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { AuditLogRow } from './audit-log-row';

const copy = adminFa.auditLogs;

const entry: AuditLogView = {
  id: 'a1',
  action: 'order.status.update',
  entityType: 'Order',
  entityId: '01a0f326-ee7b-7067-ab20-153f63ac7b06',
  actor: { id: 'u1', name: 'مدیر سیستم', email: 'admin@example.com' },
  metadata: { from: 'PAID', to: 'PROCESSING', note: 'آماده‌سازی' },
  ipAddress: '127.0.0.1',
  createdAt: '2026-09-30T10:00:00.000Z',
};

function renderRow(row: AuditLogView) {
  return render(
    <table>
      <tbody>
        <AuditLogRow entry={row} />
      </tbody>
    </table>,
  );
}

describe('AuditLogRow', () => {
  it('toggles the pretty-printed metadata row', async () => {
    const user = userEvent.setup();
    renderRow(entry);

    expect(screen.getAllByRole('row')).toHaveLength(1);
    const toggle = screen.getByRole('button', { name: copy.showMetadata });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent(copy.hideMetadata);
    expect(screen.getAllByRole('row')).toHaveLength(2);
    const pre = document.querySelector('pre') as HTMLPreElement;
    expect(pre).toHaveAttribute('dir', 'ltr');
    expect(pre.textContent).toBe(JSON.stringify(entry.metadata, null, 2));

    await user.click(toggle);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('links known entity types to their admin page and marks empty metadata', () => {
    renderRow({ ...entry, metadata: null });

    expect(screen.getByRole('link', { name: entry.entityId! })).toHaveAttribute(
      'href',
      `/admin/orders/${entry.entityId}`,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(copy.noMetadata)).toBeInTheDocument();
    expect(screen.getByText(entry.actor!.name)).toBeInTheDocument();
  });

  it('shows "system" for entries without an actor and no link for unknown entities', () => {
    renderRow({ ...entry, actor: null, entityType: 'Settings', metadata: {} });

    expect(screen.getByText(copy.system)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(copy.noMetadata)).toBeInTheDocument();
  });
});
