'use client';

import { formatPersianNumber, type InventorySnapshot, type SellerOfferView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Price } from '@/components/catalog/price';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { assetUrl } from '@/lib/assets';
import { sellerErrorMessage } from '@/lib/seller/errors';
import { offerStatusTone, offerStockState } from '@/lib/seller/status';
import { SellerBadge } from './badge';
import { OfferEditForm } from './offer-edit-form';
import { StockAdjustForm } from './stock-adjust-form';
import { SellerTable, Td } from './table';

const copy = t.seller.offers;

const columns = [
  { key: 'product', label: copy.columns.product },
  { key: 'sku', label: copy.columns.sku },
  { key: 'price', label: copy.columns.price },
  { key: 'stock', label: copy.columns.stock },
  { key: 'status', label: copy.columns.status },
  { key: 'actions', label: copy.columns.actions, srOnly: true, className: 'text-end' },
] as const;

type Editor = 'closed' | 'edit' | 'stock';

/** The seller's offers with inline price/status editing, stock adjustment and removal. */
export function OffersTable({
  offers: initialOffers,
  filtered,
}: {
  offers: SellerOfferView[];
  /** True when a search/low-stock filter is active (changes the empty message). */
  filtered: boolean;
}) {
  const router = useRouter();
  const [offers, setOffers] = useState(initialOffers);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  // Server re-renders (pagination, filters, refresh) replace the local copy
  // (state adjusted during render, as React recommends for derived state).
  const [seenOffers, setSeenOffers] = useState(initialOffers);
  if (seenOffers !== initialOffers) {
    setSeenOffers(initialOffers);
    setOffers(initialOffers);
  }

  const replace = (updated: SellerOfferView) => {
    setOffers((list) => list.map((o) => (o.variantId === updated.variantId ? updated : o)));
  };

  const applySnapshot = (variantId: string, snapshot: InventorySnapshot) => {
    setOffers((list) =>
      list.map((o) =>
        o.variantId === variantId
          ? {
              ...o,
              stockQuantity: snapshot.stockQuantity,
              reservedQuantity: snapshot.reservedQuantity,
              availableQuantity: snapshot.availableQuantity,
              lowStock: snapshot.lowStock,
            }
          : o,
      ),
    );
  };

  const remove = async (offer: SellerOfferView) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setNotice(null);
    try {
      await browserApi.delete<void>(`/seller/offers/${encodeURIComponent(offer.variantId)}`);
      setOffers((list) => list.filter((o) => o.variantId !== offer.variantId));
      setNotice({ tone: 'success', message: copy.deleted });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: sellerErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <SellerTable
        columns={columns}
        empty={offers.length === 0}
        emptyMessage={filtered ? copy.emptyFiltered : copy.empty}
        caption={copy.title}
      >
        {offers.map((offer) => (
          <OfferRow
            key={offer.variantId}
            offer={offer}
            columnCount={columns.length}
            onUpdated={(updated) => {
              replace(updated);
              setNotice({ tone: 'success', message: copy.updated });
              router.refresh();
            }}
            onStockChanged={(snapshot) => {
              applySnapshot(offer.variantId, snapshot);
              router.refresh();
            }}
            onDelete={() => remove(offer)}
          />
        ))}
      </SellerTable>
    </div>
  );
}

function OfferRow({
  offer,
  columnCount,
  onUpdated,
  onStockChanged,
  onDelete,
}: {
  offer: SellerOfferView;
  columnCount: number;
  onUpdated: (offer: SellerOfferView) => void;
  onStockChanged: (snapshot: InventorySnapshot) => void;
  onDelete: () => void;
}) {
  const [editor, setEditor] = useState<Editor>('closed');
  const image = assetUrl(offer.imageUrl);
  const stock = offerStockState(offer);
  const toggle = (next: Exclude<Editor, 'closed'>) =>
    setEditor((current) => (current === next ? 'closed' : next));
  const attributes = offer.attributes.map((a) => `${a.attributeName}: ${a.value}`).join(' · ');

  return (
    <>
      <tr className="hover:bg-surface-muted/60">
        <Td>
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
              {image ? (
                <Image src={image} alt="" fill sizes="48px" className="object-cover" unoptimized />
              ) : null}
            </div>
            <div className="min-w-0">
              <Link
                href={`/products/${offer.productSlug}`}
                className="line-clamp-2 font-medium hover:text-brand-700"
              >
                {offer.productTitle}
              </Link>
              {offer.title ? <p className="text-xs text-ink-muted">{offer.title}</p> : null}
              {attributes ? <p className="text-xs text-ink-muted">{attributes}</p> : null}
            </div>
          </div>
        </Td>
        <Td>
          <span dir="ltr" className="inline-block font-mono text-xs">
            {offer.sku}
          </span>
        </Td>
        <Td>
          <Price amount={offer.price} compareAt={offer.compareAtPrice} size="sm" />
        </Td>
        <Td>
          <SellerBadge tone={stock.tone}>{stock.label}</SellerBadge>
          <p className="mt-1 text-xs text-ink-muted tabular-nums">
            {copy.stock.available(formatPersianNumber(offer.availableQuantity))}
            {offer.reservedQuantity > 0
              ? ` · ${copy.stock.reserved(formatPersianNumber(offer.reservedQuantity))}`
              : ''}
          </p>
        </Td>
        <Td>
          <SellerBadge tone={offerStatusTone(offer.status)}>
            {copy.status[offer.status] ?? offer.status}
          </SellerBadge>
        </Td>
        <Td>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button
              size="sm"
              variant={editor === 'edit' ? 'secondary' : 'outline'}
              aria-expanded={editor === 'edit'}
              onClick={() => toggle('edit')}
            >
              {copy.edit}
            </Button>
            <Button
              size="sm"
              variant={editor === 'stock' ? 'secondary' : 'ghost'}
              aria-expanded={editor === 'stock'}
              onClick={() => toggle('stock')}
            >
              {copy.adjustStock}
            </Button>
            <Button size="sm" variant="ghost" className="text-accent-600" onClick={onDelete}>
              {copy.delete}
            </Button>
          </div>
        </Td>
      </tr>
      {editor !== 'closed' ? (
        <tr className="bg-surface-muted/40">
          <td colSpan={columnCount} className="px-3 py-3">
            {editor === 'edit' ? (
              <OfferEditForm
                offer={offer}
                onCancel={() => setEditor('closed')}
                onSuccess={(updated) => {
                  setEditor('closed');
                  onUpdated(updated);
                }}
              />
            ) : (
              <StockAdjustForm
                variantId={offer.variantId}
                onCancel={() => setEditor('closed')}
                onSuccess={onStockChanged}
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
