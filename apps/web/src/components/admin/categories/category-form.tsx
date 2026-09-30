'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { AttributeSummary } from '@pe/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { categoryOptionsFromFlat, descendantIds } from '@/lib/admin/categories';
import { adminErrorMessage } from '@/lib/admin/errors';
import { categorySchema, type CategoryFormValues } from '@/lib/admin/schemas';
import type { AdminCategory, CategoryInput } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

interface CategoryFormProps {
  category?: AdminCategory;
  categories: AdminCategory[];
  attributes: AttributeSummary[];
  onSaved: (category: AdminCategory) => void;
  onCancel: () => void;
}

const copy = adminFa.categories;

function toInput(values: CategoryFormValues): CategoryInput {
  return {
    name: values.name,
    slug: values.slug || undefined,
    parentId: values.parentId || null,
    description: values.description ?? null,
    imageUrl: values.imageUrl || null,
    sortOrder: values.sortOrder,
    isActive: values.isActive,
    seoTitle: values.seoTitle ?? null,
    seoDescription: values.seoDescription ?? null,
    attributes: values.attributes.map((link, index) => ({
      attributeId: link.attributeId,
      isRequired: link.isRequired,
      sortOrder: index,
    })),
  };
}

export function CategoryForm({
  category,
  categories,
  attributes,
  onSaved,
  onCancel,
}: CategoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: yupResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId ?? '',
          description: category.description ?? undefined,
          imageUrl: category.imageUrl ?? '',
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          seoTitle: category.seoTitle ?? undefined,
          seoDescription: category.seoDescription ?? undefined,
          attributes: [...category.attributes]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((link) => ({ attributeId: link.attributeId, isRequired: link.isRequired })),
        }
      : { parentId: '', imageUrl: '', isActive: true, sortOrder: 0, attributes: [] },
  });

  const imageUrl = useWatch({ control, name: 'imageUrl' });
  const links = useWatch({ control, name: 'attributes' });

  // A category cannot be moved under itself or one of its descendants.
  const excluded = category ? descendantIds(categories, category.id) : new Set<string>();
  const parentOptions = categoryOptionsFromFlat(categories)
    .filter((option) => !excluded.has(option.id))
    .map((option) => ({ value: option.id, label: option.label }));

  const toggleAttribute = (attributeId: string, checked: boolean) => {
    const next = checked
      ? [...links, { attributeId, isRequired: false }]
      : links.filter((link) => link.attributeId !== attributeId);
    setValue('attributes', next, { shouldDirty: true });
  };

  const toggleRequired = (attributeId: string, isRequired: boolean) => {
    setValue(
      'attributes',
      links.map((link) => (link.attributeId === attributeId ? { ...link, isRequired } : link)),
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const body = toInput(values);
      const saved = category
        ? await browserApi.patch<AdminCategory>(`/admin/categories/${category.id}`, body)
        : await browserApi.post<AdminCategory>('/admin/categories', body);
      onSaved(saved);
    } catch (error) {
      setServerError(adminErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={adminFa.common.name} error={errors.name?.message} {...register('name')} />
        <TextField
          label={adminFa.common.slug}
          optional
          hint={adminFa.common.slugHint}
          dir="ltr"
          className="text-left"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <SelectField
          label={copy.parent}
          placeholder={copy.root}
          options={parentOptions}
          error={errors.parentId?.message}
          {...register('parentId')}
        />
        <TextField
          label={adminFa.common.sortOrder}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />
      </div>
      <TextAreaField
        label={adminFa.common.description}
        optional
        error={errors.description?.message}
        {...register('description')}
      />
      <ImageUploadField
        label={adminFa.common.image}
        value={imageUrl}
        onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{copy.attributes}</legend>
        <p className="text-xs text-ink-muted">{copy.attributesHint}</p>
        {attributes.length === 0 ? (
          <p className="text-sm text-ink-muted">{adminFa.attributes.empty}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attributes.map((attribute) => {
              const link = links.find((item) => item.attributeId === attribute.id);
              return (
                <li
                  key={attribute.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-border px-3 py-2"
                >
                  <Checkbox
                    label={attribute.name}
                    checked={link !== undefined}
                    onChange={(event) => toggleAttribute(attribute.id, event.target.checked)}
                  />
                  <Checkbox
                    label={copy.isRequired}
                    containerClassName="ms-auto text-xs text-ink-muted"
                    checked={link?.isRequired ?? false}
                    disabled={link === undefined}
                    onChange={(event) => toggleRequired(attribute.id, event.target.checked)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={adminFa.common.seoTitle}
          optional
          error={errors.seoTitle?.message}
          {...register('seoTitle')}
        />
        <TextField
          label={adminFa.common.seoDescription}
          optional
          error={errors.seoDescription?.message}
          {...register('seoDescription')}
        />
      </div>
      <Checkbox label={copy.isActive} {...register('isActive')} />
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? t.common.saving : t.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
