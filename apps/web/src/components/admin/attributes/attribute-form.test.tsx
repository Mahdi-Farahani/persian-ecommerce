import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { AttributeForm } from './attribute-form';

const post = vi.fn();
const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

const copy = adminFa.attributes;

describe('AttributeForm with values editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires at least one value for SELECT attributes', async () => {
    const user = userEvent.setup();
    render(<AttributeForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(adminFa.common.name), 'سایز');
    await user.click(screen.getByRole('button', { name: /ذخیره/ }));
    expect(await screen.findByText(adminFa.validation.valuesRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects duplicate values and invalid colours', async () => {
    const user = userEvent.setup();
    render(<AttributeForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(adminFa.common.name), 'رنگ');
    await user.click(screen.getByRole('button', { name: copy.addValue }));
    await user.click(screen.getByRole('button', { name: copy.addValue }));
    const valueInputs = screen.getAllByLabelText(copy.value);
    expect(valueInputs).toHaveLength(2);
    await user.type(valueInputs[0]!, 'مشکی');
    await user.type(valueInputs[1]!, 'مشکی');
    await user.type(
      document.querySelector('input[name="values.0.colorHex"]') as HTMLInputElement,
      'not-a-colour',
    );
    await user.click(screen.getByRole('button', { name: /ذخیره/ }));
    expect(await screen.findByText(adminFa.validation.duplicateValues)).toBeInTheDocument();
    expect(await screen.findByText(adminFa.validation.colorHex)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('submits values with slugs, colours and sort order', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    post.mockResolvedValue({ id: 'attr-1' });
    render(<AttributeForm onSaved={onSaved} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(adminFa.common.name), 'رنگ');
    await user.click(screen.getByLabelText(copy.isVariant));
    await user.click(screen.getByRole('button', { name: copy.addValue }));
    await user.type(screen.getByLabelText(copy.value), 'قرمز');
    await user.type(
      document.querySelector('input[name="values.0.slug"]') as HTMLInputElement,
      'red',
    );
    await user.type(
      document.querySelector('input[name="values.0.colorHex"]') as HTMLInputElement,
      '#ff0000',
    );
    await user.click(screen.getByRole('button', { name: /ذخیره/ }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/admin/attributes', {
      name: 'رنگ',
      slug: undefined,
      type: 'SELECT',
      unit: null,
      isVariant: true,
      isFilterable: true,
      sortOrder: 0,
      values: [{ id: undefined, value: 'قرمز', slug: 'red', colorHex: '#ff0000', sortOrder: 0 }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'attr-1' }));
  });

  it('hides the values editor for non-SELECT types and omits values', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ id: 'attr-2' });
    render(<AttributeForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(adminFa.common.name), 'وزن');
    await user.selectOptions(screen.getByLabelText(copy.type), 'NUMBER');
    expect(screen.queryByRole('button', { name: copy.addValue })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(copy.unit, { exact: false }), 'گرم');
    await user.click(screen.getByRole('button', { name: /ذخیره/ }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toMatchObject({ type: 'NUMBER', unit: 'گرم' });
    expect(body['values']).toBeUndefined();
  });
});
