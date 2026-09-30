import { ADMIN_SETTABLE_STATUSES, canTransition, ORDER_TRANSITIONS } from './order-status.js';

describe('order status transitions', () => {
  it('follows the happy path', () => {
    expect(canTransition('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'PACKED')).toBe(true);
    expect(canTransition('PACKED', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('rejects skipping and reversing steps', () => {
    expect(canTransition('PENDING_PAYMENT', 'SHIPPED')).toBe(false);
    expect(canTransition('DELIVERED', 'PAID')).toBe(false);
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('REFUNDED', 'PAID')).toBe(false);
  });

  it('never lets admins set payment-driven statuses', () => {
    expect(ADMIN_SETTABLE_STATUSES).not.toContain('PAID');
    expect(ADMIN_SETTABLE_STATUSES).not.toContain('PENDING_PAYMENT');
    for (const status of Object.keys(ORDER_TRANSITIONS)) {
      expect(Array.isArray(ORDER_TRANSITIONS[status as keyof typeof ORDER_TRANSITIONS])).toBe(true);
    }
  });
});
