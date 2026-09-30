'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import {
  ProductStatuses,
  type AttributeSummary,
  type BrandSummary,
  type ProductDetail,
  type ProductImageSummary,
} from '@pe/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import type { CategoryOption } from '@/lib/admin/categories';
import { adminErrorMessage } from '@/lib/admin/errors';
import {
  draftImagesToInput,
  emptyProductFormValues,
  productFormToBaseInput,
  productToFormValues,
  variantAttributeLabels,
  variantDetailToFormValues,
  variantFormToInput,
} from '@/lib/admin/product-mappers';
import { productSchema, type ProductFormValues, type VariantFormValues } from '@/lib/admin/schemas';
import type { CreateProductInput, UploadedImage } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { AttributesEditor } from './attributes-editor';
import { ImagesSection, type ImageActions } from './images-section';
import { InventorySection } from './inventory-section';
import { SpecificationsEditor } from './specifications-editor';
import { VariantsSection, type VariantRow } from './variants-section';

export interface ProductFormPermissions {
  manageCatalog: boolean;
  viewInventory: boolean;
  manageInventory: boolean;
}

interface ProductFormProps {
  product?: ProductDetail;
  categories: CategoryOption[];
  brands: BrandSummary[];
  attributes: AttributeSummary[];
  permissions: ProductFormPermissions;
  /** Shown once after the create flow redirected here. */
  justCreated?: boolean;
}

interface DraftVariant {
  key: string;
  values: VariantFormValues;
}

const FORM_ID = 'admin-product-form';
const copy = adminFa.products;

const statusOptions = ProductStatuses.map((status) => ({
  value: status,
  label: copy.status[status] ?? status,
}));

let draftCounter = 0;
function nextKey(prefix: string): string {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
}

/**
 * Create/edit form for a product. Base fields, attributes and specifications
 * are one react-hook-form; variants, images and inventory are managed in
 * their own sections (locally before creation, through the API afterwards).
 */
export function ProductForm({
  product: initialProduct,
  categories,
  brands,
  attributes,
  permissions,
  justCreated,
}: ProductFormProps) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | undefined>(initialProduct);
  const [notice, setNotice] = useState<Notice | null>(
    justCreated ? { tone: 'success', message: copy.created } : null,
  );
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);
  const [draftImages, setDraftImages] = useState<ProductImageSummary[]>([]);
  const readOnly = !permissions.manageCatalog;
  const isEdit = product !== undefined;

  const form = useForm<ProductFormValues>({
    resolver: yupResolver(productSchema),
    defaultValues: product ? productToFormValues(product, attributes) : emptyProductFormValues(),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const variantAttributes = useMemo(() => attributes.filter((a) => a.isVariant), [attributes]);
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.label })),
    [categories],
  );
  const brandOptions = useMemo(() => brands.map((b) => ({ value: b.id, label: b.name })), [brands]);

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      if (product) {
        const updated = await browserApi.patch<ProductDetail>(
          `/admin/products/${product.id}`,
          productFormToBaseInput(values, attributes),
        );
        setProduct(updated);
        reset(productToFormValues(updated, attributes));
        setNotice({ tone: 'success', message: copy.saved });
        router.refresh();
        return;
      }
      if (draftVariants.length === 0) {
        setNotice({ tone: 'error', message: adminFa.validation.atLeastOneVariant });
        return;
      }
      const body: CreateProductInput = {
        ...productFormToBaseInput(values, attributes),
        variants: draftVariants.map((draft) => variantFormToInput(draft.values, true)),
        images: draftImagesToInput(draftImages),
      };
      const created = await browserApi.post<ProductDetail>('/admin/products', body);
      router.push(`/admin/products/${created.id}?created=1`);
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  // --- Variants -----------------------------------------------------------
  const variantRows: VariantRow[] = product
    ? product.variants.map((variant) => {
        const values = variantDetailToFormValues(variant);
        return {
          key: variant.id,
          values,
          attributeLabels: variant.attributes.map((a) => `${a.attributeName}: ${a.value}`),
          availableQuantity: variant.availableQuantity,
        };
      })
    : draftVariants.map((draft) => ({
        key: draft.key,
        values: draft.values,
        attributeLabels: variantAttributeLabels(draft.values.attributeValues, attributes),
      }));

  const addVariant = async (values: VariantFormValues) => {
    if (product) {
      setProduct(
        await browserApi.post<ProductDetail>(
          `/admin/products/${product.id}/variants`,
          variantFormToInput(values, true),
        ),
      );
      return;
    }
    setDraftVariants((list) => [...list, { key: nextKey('variant'), values }]);
  };

  const updateVariant = async (key: string, values: VariantFormValues) => {
    if (product) {
      setProduct(
        await browserApi.patch<ProductDetail>(
          `/admin/variants/${key}`,
          variantFormToInput(values, false),
        ),
      );
      return;
    }
    setDraftVariants((list) =>
      list.map((draft) => (draft.key === key ? { ...draft, values } : draft)),
    );
  };

  const removeVariant = async (key: string) => {
    if (product) {
      setProduct(await browserApi.delete<ProductDetail>(`/admin/variants/${key}`));
      return;
    }
    setDraftVariants((list) => list.filter((draft) => draft.key !== key));
  };

  // --- Images -------------------------------------------------------------
  const imageActions: ImageActions = product
    ? {
        add: async (uploaded: UploadedImage) => {
          setProduct(
            await browserApi.post<ProductDetail>(`/admin/products/${product.id}/images`, {
              url: uploaded.url,
              isPrimary: product.images.length === 0,
            }),
          );
        },
        remove: async (imageId) => {
          setProduct(await browserApi.delete<ProductDetail>(`/admin/product-images/${imageId}`));
        },
        setPrimary: async (imageId) => {
          setProduct(
            await browserApi.patch<ProductDetail>(`/admin/product-images/${imageId}`, {
              isPrimary: true,
            }),
          );
        },
        reorder: async (imageIds) => {
          setProduct(
            await browserApi.put<ProductDetail>(`/admin/products/${product.id}/images/order`, {
              imageIds,
            }),
          );
        },
      }
    : {
        add: async (uploaded: UploadedImage) => {
          setDraftImages((list) => [
            ...list,
            {
              id: nextKey('image'),
              url: uploaded.url,
              alt: null,
              sortOrder: list.length,
              isPrimary: list.length === 0,
              variantId: null,
            },
          ]);
        },
        remove: async (imageId) => {
          setDraftImages((list) => {
            const next = list
              .filter((image) => image.id !== imageId)
              .map((image, index) => ({ ...image, sortOrder: index }));
            if (next.length > 0 && !next.some((image) => image.isPrimary))
              next[0] = { ...next[0]!, isPrimary: true };
            return next;
          });
        },
        setPrimary: async (imageId) => {
          setDraftImages((list) =>
            list.map((image) => ({ ...image, isPrimary: image.id === imageId })),
          );
        },
        reorder: async (imageIds) => {
          setDraftImages((list) =>
            imageIds
              .map((id) => list.find((image) => image.id === id))
              .filter((image): image is ProductImageSummary => image !== undefined)
              .map((image, index) => ({ ...image, sortOrder: index })),
          );
        },
      };

  const refreshProduct = async () => {
    if (!product) return;
    setProduct(await browserApi.get<ProductDetail>(`/admin/products/${product.id}`));
  };

  return (
    <div className="flex flex-col gap-6">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <FormProvider {...form}>
        <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <fieldset disabled={readOnly} className="flex flex-col gap-6">
            <Card>
              <CardTitle>{copy.sections.basic}</CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={copy.fields.title}
                  error={errors.title?.message}
                  {...register('title')}
                />
                <TextField
                  label={copy.fields.titleEn}
                  optional
                  dir="ltr"
                  className="text-left"
                  error={errors.titleEn?.message}
                  {...register('titleEn')}
                />
                <TextField
                  label={copy.fields.slug}
                  optional
                  hint={adminFa.common.slugHint}
                  dir="ltr"
                  className="text-left"
                  error={errors.slug?.message}
                  {...register('slug')}
                />
                <SelectField
                  label={copy.fields.category}
                  placeholder={copy.fields.selectCategory}
                  options={categoryOptions}
                  error={errors.categoryId?.message}
                  {...register('categoryId')}
                />
                <SelectField
                  label={copy.fields.brand}
                  placeholder={copy.fields.noBrand}
                  options={brandOptions}
                  error={errors.brandId?.message}
                  {...register('brandId')}
                />
                <SelectField
                  label={copy.fields.status}
                  options={statusOptions}
                  error={errors.status?.message}
                  {...register('status')}
                />
                <TextField
                  label={copy.fields.weightGrams}
                  optional
                  inputMode="numeric"
                  dir="ltr"
                  className="text-left"
                  error={errors.weightGrams?.message}
                  {...register('weightGrams')}
                />
              </div>
            </Card>
            <Card>
              <CardTitle>{copy.sections.content}</CardTitle>
              <div className="flex flex-col gap-4">
                <TextAreaField
                  label={copy.fields.shortDescription}
                  optional
                  error={errors.shortDescription?.message}
                  {...register('shortDescription')}
                />
                <TextAreaField
                  label={copy.fields.description}
                  optional
                  rows={8}
                  error={errors.description?.message}
                  {...register('description')}
                />
              </div>
            </Card>
            <Card>
              <CardTitle>{copy.sections.attributes}</CardTitle>
              <AttributesEditor attributes={attributes} disabled={readOnly} />
            </Card>
            <Card>
              <CardTitle>{copy.sections.specifications}</CardTitle>
              <SpecificationsEditor disabled={readOnly} />
            </Card>
            <Card>
              <CardTitle>{copy.sections.seo}</CardTitle>
              <div className="flex flex-col gap-4">
                <TextField
                  label={copy.fields.seoTitle}
                  optional
                  error={errors.seoTitle?.message}
                  {...register('seoTitle')}
                />
                <TextAreaField
                  label={copy.fields.seoDescription}
                  optional
                  error={errors.seoDescription?.message}
                  {...register('seoDescription')}
                />
              </div>
            </Card>
          </fieldset>
        </form>
      </FormProvider>

      <Card>
        <CardTitle>{copy.sections.variants}</CardTitle>
        <VariantsSection
          rows={variantRows}
          variantAttributes={variantAttributes}
          showStockFields
          readOnly={readOnly}
          onAdd={addVariant}
          onUpdate={updateVariant}
          onRemove={removeVariant}
        />
      </Card>

      <Card>
        <CardTitle>{copy.sections.images}</CardTitle>
        <ImagesSection
          images={product ? product.images : draftImages}
          actions={imageActions}
          readOnly={readOnly}
        />
      </Card>

      {isEdit && permissions.viewInventory ? (
        <Card>
          <CardTitle>{copy.sections.inventory}</CardTitle>
          <InventorySection
            variants={product.variants}
            canManage={permissions.manageInventory}
            onChanged={refreshProduct}
          />
        </Card>
      ) : null}
      {!isEdit ? <p className="text-sm text-ink-muted">{copy.inventory.saveAfterCreate}</p> : null}

      {readOnly ? null : (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-md">
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? t.common.saving
                : adminFa.common.creating
              : isEdit
                ? t.common.save
                : adminFa.common.create}
          </Button>
          <Link href="/admin/products" className="text-sm text-ink-muted hover:text-brand-700">
            {t.common.back}
          </Link>
          {product ? (
            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              className="ms-auto text-sm text-brand-700 hover:underline"
            >
              {copy.viewInStore}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
