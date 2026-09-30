import type { ProductDetail, VariantDetail } from '@pe/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Price } from './price';
import { initialVariant, VariantSelector } from './variant-selector';

const COLOR = 'a1';
const STORAGE = 'a2';

function variant(
  partial: Partial<VariantDetail> & { id: string; color: string; storage: string },
): VariantDetail {
  return {
    id: partial.id,
    sku: `SKU-${partial.id}`,
    barcode: null,
    title: null,
    price: partial.price ?? 1_000_000,
    compareAtPrice: partial.compareAtPrice ?? null,
    discountPercent: partial.discountPercent ?? 0,
    status: 'ACTIVE',
    isDefault: partial.isDefault ?? false,
    weightGrams: null,
    seller: partial.seller ?? null,
    attributes: [
      {
        attributeId: COLOR,
        attributeName: 'رنگ',
        attributeSlug: 'color',
        valueId: partial.color,
        value: partial.color,
        valueSlug: partial.color,
        colorHex: null,
      },
      {
        attributeId: STORAGE,
        attributeName: 'حافظه',
        attributeSlug: 'storage',
        valueId: partial.storage,
        value: partial.storage,
        valueSlug: partial.storage,
        colorHex: null,
      },
    ],
    availableQuantity: partial.availableQuantity ?? 10,
    inStock: partial.inStock ?? true,
    lowStock: partial.lowStock ?? false,
    imageIds: [],
  };
}

const product: ProductDetail = {
  id: 'p1',
  title: 'محصول',
  titleEn: null,
  slug: 'p1',
  brand: null,
  category: { id: 'c', name: 'دسته', slug: 'c' },
  price: 1_000_000,
  compareAtPrice: null,
  discountPercent: 0,
  inStock: true,
  ratingAverage: 0,
  ratingCount: 0,
  status: 'ACTIVE',
  description: null,
  shortDescription: null,
  images: [],
  variants: [
    variant({
      id: 'v1',
      color: 'black',
      storage: '128',
      price: 1_000_000,
      inStock: false,
      availableQuantity: 0,
    }),
    variant({
      id: 'v2',
      color: 'black',
      storage: '256',
      price: 1_200_000,
      lowStock: true,
      availableQuantity: 2,
    }),
    variant({ id: 'v3', color: 'white', storage: '128', price: 1_000_000 }),
  ],
  variantAttributes: [
    {
      id: COLOR,
      name: 'رنگ',
      slug: 'color',
      values: [
        { id: 'black', value: 'مشکی', slug: 'black', colorHex: '#000', sortOrder: 0 },
        { id: 'white', value: 'سفید', slug: 'white', colorHex: '#fff', sortOrder: 1 },
      ],
    },
    {
      id: STORAGE,
      name: 'حافظه',
      slug: 'storage',
      values: [
        { id: '128', value: '۱۲۸', slug: '128', colorHex: null, sortOrder: 0 },
        { id: '256', value: '۲۵۶', slug: '256', colorHex: null, sortOrder: 1 },
      ],
    },
  ],
  attributes: [],
  specifications: [],
  breadcrumb: [],
  weightGrams: null,
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('initialVariant', () => {
  it('prefers the cheapest in-stock variant', () => {
    expect(initialVariant(product.variants)?.id).toBe('v3');
  });
});

describe('VariantSelector', () => {
  it('starts on the cheapest available variant and switches on selection', async () => {
    const user = userEvent.setup();
    render(<VariantSelector product={product} />);
    expect(screen.getByText(/SKU-v3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'مشکی' }));
    // black + 128 is out of stock
    expect(screen.getByText(/SKU-v1/)).toBeInTheDocument();
    expect(screen.getByText('ناموجود')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '۲۵۶' }));
    expect(screen.getByText(/SKU-v2/)).toBeInTheDocument();
    expect(screen.getByText('تنها ۲ عدد باقی مانده')).toBeInTheDocument();
  });
});

describe('Price', () => {
  it('renders toman with persian digits and discount', () => {
    render(<Price amount={1_250_000} compareAt={1_500_000} discountPercent={17} />);
    expect(screen.getByText('۱۲۵٬۰۰۰')).toBeInTheDocument();
    expect(screen.getByText('۱۵۰٬۰۰۰')).toBeInTheDocument();
    expect(screen.getByText('۱۷٪')).toBeInTheDocument();
  });
});
