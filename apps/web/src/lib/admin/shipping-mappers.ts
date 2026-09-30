import { fromToman, toToman } from '@pe/shared';
import type { ShippingMethodFormValues } from './schemas';
import type { AdminShippingMethod, ShippingMethodInput } from './types';

const DEFAULT_DAYS_MIN = 1;
const DEFAULT_DAYS_MAX = 3;

/** Form defaults for a new shipping method. */
export function emptyShippingMethodFormValues(): ShippingMethodFormValues {
  return {
    code: '',
    name: '',
    description: undefined,
    baseFeeToman: undefined as unknown as number,
    freeAboveToman: undefined,
    estimatedDaysMin: DEFAULT_DAYS_MIN,
    estimatedDaysMax: DEFAULT_DAYS_MAX,
    isActive: true,
    sortOrder: 0,
  };
}

/** Maps an API shipping method to form values (IRR shown as Toman). */
export function shippingMethodToFormValues(method: AdminShippingMethod): ShippingMethodFormValues {
  return {
    code: method.code,
    name: method.name,
    description: method.description ?? undefined,
    baseFeeToman: toToman(method.baseFee),
    freeAboveToman: method.freeAboveAmount === null ? undefined : toToman(method.freeAboveAmount),
    estimatedDaysMin: method.estimatedDaysMin,
    estimatedDaysMax: method.estimatedDaysMax,
    isActive: method.isActive,
    sortOrder: method.sortOrder,
  };
}

/** Maps validated form values to the API payload (Toman -> IRR). */
export function shippingMethodFormToInput(values: ShippingMethodFormValues): ShippingMethodInput {
  return {
    code: values.code,
    name: values.name,
    description: values.description,
    baseFee: fromToman(values.baseFeeToman),
    freeAboveAmount: values.freeAboveToman === undefined ? null : fromToman(values.freeAboveToman),
    estimatedDaysMin: values.estimatedDaysMin,
    estimatedDaysMax: values.estimatedDaysMax,
    isActive: values.isActive,
    sortOrder: values.sortOrder,
  };
}
