'use client';

import type { MyReviewView, ReviewView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { assetUrl } from '@/lib/assets';
import { ReviewForm } from './review-form';
import { ReviewItem } from './review-item';
import { ReviewStatusBadge } from './review-status-badge';

type Notice = { tone: 'success' | 'error'; message: string } | null;

const copy = t.reviews;

/** "My reviews" list with inline editing and deletion. */
export function MyReviewsList({ initialItems }: { initialItems: MyReviewView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const onSaved = (saved: ReviewView) => {
    setItems((current) =>
      current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
    );
    setEditingId(null);
    setNotice({ tone: 'success', message: copy.updated });
  };

  const onDelete = async (review: MyReviewView) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setDeletingId(review.id);
    setNotice(null);
    try {
      await browserApi.delete(`/reviews/${encodeURIComponent(review.id)}`);
      setItems((current) => current.filter((item) => item.id !== review.id));
      setNotice({ tone: 'success', message: copy.deleted });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="py-16 text-center">
        {notice ? (
          <div className="mb-4 text-start">
            <Alert tone={notice.tone}>{notice.message}</Alert>
          </div>
        ) : null}
        <p className="text-ink-muted">{copy.myEmpty}</p>
        <p className="mt-1 text-xs text-ink-muted">{copy.myEmptyHint}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <ul className="flex flex-col gap-3">
        {items.map((review) => {
          const image = assetUrl(review.product.imageUrl);
          const href = `/products/${review.product.slug}`;
          const editing = editingId === review.id;
          return (
            <li key={review.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={href}
                    className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-muted"
                  >
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="line-clamp-1 text-sm font-bold hover:text-brand-700"
                    >
                      {review.product.title}
                    </Link>
                    <div className="mt-1">
                      <ReviewStatusBadge status={review.status} />
                    </div>
                  </div>
                </div>

                {review.status === 'REJECTED' && review.moderationNote ? (
                  <Alert tone="warning">
                    <span className="font-medium">{copy.moderationNote}: </span>
                    {review.moderationNote}
                  </Alert>
                ) : null}

                {editing ? (
                  <ReviewForm
                    productId={review.productId}
                    review={review}
                    onSaved={onSaved}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="border-t border-border">
                      <ReviewItem review={{ ...review, isMine: false }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(review.id)}>
                        {t.common.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-accent-600"
                        loading={deletingId === review.id}
                        disabled={deletingId !== null}
                        onClick={() => void onDelete(review)}
                      >
                        {t.common.delete}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
