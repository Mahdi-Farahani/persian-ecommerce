/**
 * Maps audit-log entity types to the admin page that shows the entity.
 * Users have no detail page yet, so they resolve to the users list.
 */
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  Order: (id) => `/admin/orders/${encodeURIComponent(id)}`,
  Payment: (id) => `/admin/payments/${encodeURIComponent(id)}`,
  Product: (id) => `/admin/products/${encodeURIComponent(id)}`,
  Review: (id) => `/admin/reviews/${encodeURIComponent(id)}`,
  User: () => '/admin/users',
  PaymentProviderConfig: () => '/admin/settings/payment-gateways',
};

export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  const build = ENTITY_ROUTES[entityType];
  return build ? build(entityId) : null;
}
