import { formatJalaliDateTime, type OrderStatusEvent } from '@pe/shared';
import { orderStatusLabel } from '@/lib/orders/status';

/** Chronological status history of an order. */
export function OrderTimeline({ events }: { events: OrderStatusEvent[] }) {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <ol className="relative flex flex-col gap-4 border-s border-border ps-4 text-sm">
      {sorted.map((event, index) => {
        const last = index === sorted.length - 1;
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden="true"
              className={
                last
                  ? 'absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-brand-600'
                  : 'absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-border'
              }
            />
            <p className="font-medium">{orderStatusLabel(event.toStatus)}</p>
            <p className="text-xs text-ink-muted">{formatJalaliDateTime(event.createdAt)}</p>
            {event.note ? <p className="mt-1 text-xs text-ink-muted">{event.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
