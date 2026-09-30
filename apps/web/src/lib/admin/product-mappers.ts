import {
  fromToman,
  toToman,
  type AttributeSummary,
  type ProductDetail,
  type ProductImageSummary,
  type VariantDetail,
} from '@pe/shared';
import type { DefaultValues } from 'react-hook-form';
import type { ProductFormValues, VariantFormValues } from './schemas';
import type {
  ProductAttributeInput,
  ProductBaseInput,
  ProductImageInput,
  VariantInput,
} from './types';

/** `undefined`/empty strings become `null` so the API clears the column. */
function nullable(value: string | undefined): string | null {
  return value ? value : null;
}

function nullableNumber(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

/**
 * Maps the informational attributes of a product back to form rows. The API
 * only exposes the display value, so SELECT values are matched by text.
 */
export function productAttributesToRows(
  product: ProductDetail,
  attributes: AttributeSummary[],
): ProductFormValues['attributes'] {
  return product.attributes.map((entry) => {
    const definition = attributes.find((a) => a.id === entry.attributeId);
    if (definition?.type === 'SELECT') {
      const match = entry.valueId
        ? definition.values.find((v) => v.id === entry.valueId)
        : definition.values.find((v) => v.value === entry.value);
      return { attributeId: entry.attributeId, value: match?.id ?? '' };
    }
    return { attributeId: entry.attributeId, value: entry.value };
  });
}

export function productToFormValues(
  product: ProductDetail,
  attributes: AttributeSummary[],
): ProductFormValues {
  return {
    title: product.title,
    titleEn: product.titleEn ?? undefined,
    slug: product.slug,
    categoryId: product.category.id,
    brandId: product.brand?.id ?? '',
    status: product.status,
    weightGrams: product.weightGrams ?? undefined,
    shortDescription: product.shortDescription ?? undefined,
    description: product.description ?? undefined,
    seoTitle: product.seoTitle ?? undefined,
    seoDescription: product.seoDescription ?? undefined,
    attributes: productAttributesToRows(product, attributes),
    specifications: [...product.specifications]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ group: s.group ?? undefined, name: s.name, value: s.value })),
  };
}

export function emptyProductFormValues(): ProductFormValues {
  return {
    title: '',
    titleEn: undefined,
    slug: undefined,
    categoryId: '',
    brandId: '',
    status: 'DRAFT',
    weightGrams: undefined,
    shortDescription: undefined,
    description: undefined,
    seoTitle: undefined,
    seoDescription: undefined,
    attributes: [],
    specifications: [],
  };
}

export function attributeRowsToInput(
  rows: ProductFormValues['attributes'],
  attributes: AttributeSummary[],
): ProductAttributeInput[] {
  return rows
    .filter((row) => row.attributeId && row.value)
    .map((row) => {
      const definition = attributes.find((a) => a.id === row.attributeId);
      return definition?.type === 'SELECT'
        ? { attributeId: row.attributeId, valueId: row.value }
        : { attributeId: row.attributeId, valueText: row.value };
    });
}

export function productFormToBaseInput(
  values: ProductFormValues,
  attributes: AttributeSummary[],
): ProductBaseInput {
  return {
    title: values.title,
    titleEn: nullable(values.titleEn),
    slug: values.slug || undefined,
    categoryId: values.categoryId,
    brandId: values.brandId || null,
    description: nullable(values.description),
    shortDescription: nullable(values.shortDescription),
    status: values.status,
    weightGrams: nullableNumber(values.weightGrams),
    seoTitle: nullable(values.seoTitle),
    seoDescription: nullable(values.seoDescription),
    attributes: attributeRowsToInput(values.attributes, attributes),
    specifications: values.specifications.map((row, index) => ({
      group: row.group || undefined,
      name: row.name,
      value: row.value,
      sortOrder: index,
    })),
  };
}

/** Defaults for a brand-new variant; the price is intentionally left blank. */
export function emptyVariantFormValues(): DefaultValues<VariantFormValues> {
  return {
    sku: '',
    barcode: undefined,
    title: undefined,
    priceToman: undefined,
    compareAtPriceToman: undefined,
    status: 'ACTIVE',
    isDefault: false,
    weightGrams: undefined,
    initialStock: undefined,
    lowStockThreshold: undefined,
    attributeValues: {},
  };
}

export function variantDetailToFormValues(variant: VariantDetail): VariantFormValues {
  const attributeValues: Record<string, string> = {};
  for (const selection of variant.attributes) {
    attributeValues[selection.attributeId] = selection.valueId;
  }
  return {
    sku: variant.sku,
    barcode: variant.barcode ?? undefined,
    title: variant.title ?? undefined,
    priceToman: toToman(variant.price),
    compareAtPriceToman:
      variant.compareAtPrice === null ? undefined : toToman(variant.compareAtPrice),
    status: variant.status,
    isDefault: variant.isDefault,
    weightGrams: variant.weightGrams ?? undefined,
    initialStock: undefined,
    lowStockThreshold: undefined,
    attributeValues,
  };
}

/** Converts Toman form values to the IRR API payload. */
export function variantFormToInput(values: VariantFormValues, includeStock: boolean): VariantInput {
  const input: VariantInput = {
    sku: values.sku,
    barcode: nullable(values.barcode),
    title: nullable(values.title),
    price: fromToman(values.priceToman),
    compareAtPrice:
      values.compareAtPriceToman === undefined ? null : fromToman(values.compareAtPriceToman),
    status: values.status,
    isDefault: values.isDefault,
    weightGrams: nullableNumber(values.weightGrams),
    attributeValues: Object.entries(values.attributeValues)
      .filter(([, valueId]) => Boolean(valueId))
      .map(([attributeId, valueId]) => ({ attributeId, valueId })),
  };
  if (includeStock) {
    if (values.initialStock !== undefined) input.initialStock = values.initialStock;
    if (values.lowStockThreshold !== undefined) input.lowStockThreshold = values.lowStockThreshold;
  }
  return input;
}

/** Human-readable labels for a draft variant's attribute selections. */
export function variantAttributeLabels(
  attributeValues: Record<string, string>,
  attributes: AttributeSummary[],
): string[] {
  const labels: string[] = [];
  for (const [attributeId, valueId] of Object.entries(attributeValues)) {
    if (!valueId) continue;
    const definition = attributes.find((a) => a.id === attributeId);
    const value = definition?.values.find((v) => v.id === valueId);
    if (definition && value) labels.push(`${definition.name}: ${value.value}`);
  }
  return labels;
}

export function draftImagesToInput(images: ProductImageSummary[]): ProductImageInput[] {
  return images.map((image, index) => ({
    url: image.url,
    alt: image.alt,
    sortOrder: index,
    isPrimary: image.isPrimary,
  }));
}
