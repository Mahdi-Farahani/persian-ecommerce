import { fromToman, type AttributeSummary } from '@pe/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { ProductForm } from './product-form';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh }),
}));

const post = vi.fn();
const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const categories = [
  { id: 'c1', name: 'دیجیتال', depth: 0, parentId: null, isActive: true, label: 'دیجیتال' },
  { id: 'c2', name: 'موبایل', depth: 1, parentId: 'c1', isActive: true, label: '└ موبایل' },
];
const brands = [{ id: 'b1', name: 'سامسونگ', nameEn: 'Samsung', slug: 'samsung', logoUrl: null }];
const attributes: AttributeSummary[] = [
  {
    id: 'a-color',
    name: 'رنگ',
    slug: 'color',
    type: 'SELECT',
    unit: null,
    isVariant: true,
    isFilterable: true,
    sortOrder: 0,
    values: [{ id: 'v-black', value: 'مشکی', slug: 'black', colorHex: '#000000', sortOrder: 0 }],
  },
  {
    id: 'a-os',
    name: 'سیستم‌عامل',
    slug: 'os',
    type: 'TEXT',
    unit: null,
    isVariant: false,
    isFilterable: false,
    sortOrder: 1,
    values: [],
  },
];

const permissions = { manageCatalog: true, viewInventory: true, manageInventory: true };

function renderCreateForm() {
  return render(
    <ProductForm
      categories={categories}
      brands={brands}
      attributes={attributes}
      permissions={permissions}
    />,
  );
}

describe('ProductForm (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required fields before calling the API', async () => {
    const user = userEvent.setup();
    renderCreateForm();
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(post).not.toHaveBeenCalled();
  });

  it('requires at least one variant', async () => {
    const user = userEvent.setup();
    renderCreateForm();
    await user.type(screen.getByLabelText(adminFa.products.fields.title), 'گوشی تستی');
    await user.selectOptions(screen.getByLabelText(adminFa.products.fields.category), 'c2');
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));
    expect(await screen.findByText(adminFa.validation.atLeastOneVariant)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the product with variants priced in rials and redirects to the edit page', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ id: 'p-new' });
    renderCreateForm();

    await user.type(screen.getByLabelText(adminFa.products.fields.title), 'گوشی تستی');
    await user.selectOptions(screen.getByLabelText(adminFa.products.fields.category), 'c2');
    await user.selectOptions(screen.getByLabelText(adminFa.products.fields.brand), 'b1');

    // Informational attribute (TEXT).
    await user.click(screen.getByRole('button', { name: adminFa.products.attributes.add }));
    await user.selectOptions(screen.getByLabelText(adminFa.products.attributes.attribute), 'a-os');
    await user.type(screen.getByLabelText(adminFa.products.attributes.value), 'اندروید');

    // Variant through the inline variant form.
    await user.click(screen.getByRole('button', { name: adminFa.products.variants.add }));
    const variantForm = screen
      .getByRole('heading', { name: adminFa.products.variants.add })
      .closest('form');
    expect(variantForm).not.toBeNull();
    const scoped = within(variantForm as HTMLFormElement);
    await user.type(scoped.getByLabelText(adminFa.products.variants.sku), 'TEST-SKU-1');
    await user.type(scoped.getByLabelText(adminFa.products.variants.price), '۱۲۵۰۰۰');
    await user.type(
      scoped.getByLabelText(adminFa.products.variants.initialStock, { exact: false }),
      '7',
    );
    await user.selectOptions(scoped.getByLabelText('رنگ'), 'v-black');
    await user.click(scoped.getByRole('button', { name: /ذخیره/ }));
    expect(await screen.findByText('TEST-SKU-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: adminFa.common.create }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [path, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/admin/products');
    expect(body).toMatchObject({
      title: 'گوشی تستی',
      categoryId: 'c2',
      brandId: 'b1',
      status: 'DRAFT',
      attributes: [{ attributeId: 'a-os', valueText: 'اندروید' }],
    });
    expect(body['variants']).toEqual([
      expect.objectContaining({
        sku: 'TEST-SKU-1',
        price: fromToman(125000),
        compareAtPrice: null,
        initialStock: 7,
        attributeValues: [{ attributeId: 'a-color', valueId: 'v-black' }],
      }),
    ]);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/products/p-new?created=1'));
  });

  it('shows the API error when creation fails', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(422, 'SKU_TAKEN', 'x'));
    renderCreateForm();
    await user.type(screen.getByLabelText(adminFa.products.fields.title), 'گوشی تستی');
    await user.selectOptions(screen.getByLabelText(adminFa.products.fields.category), 'c1');
    await user.click(screen.getByRole('button', { name: adminFa.products.variants.add }));
    const variantForm = screen
      .getByRole('heading', { name: adminFa.products.variants.add })
      .closest('form') as HTMLFormElement;
    await user.type(within(variantForm).getByLabelText(adminFa.products.variants.sku), 'DUP');
    await user.type(within(variantForm).getByLabelText(adminFa.products.variants.price), '1000');
    await user.click(within(variantForm).getByRole('button', { name: /ذخیره/ }));
    await screen.findByText('DUP');
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));
    expect(await screen.findByText(adminFa.errors['SKU_TAKEN']!)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
