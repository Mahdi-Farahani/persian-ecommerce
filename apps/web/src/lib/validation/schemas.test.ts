import { describe, expect, it } from 'vitest';
import { addressSchema, registerSchema, reviewSchema } from './schemas';

describe('registerSchema', () => {
  const base = { password: 'Passw0rd1', confirmPassword: 'Passw0rd1', acceptTerms: true };

  it('requires an email or a mobile number', async () => {
    await expect(registerSchema.validate({ ...base, email: '', phone: '' })).rejects.toThrow();
    await expect(
      registerSchema.validate({ ...base, email: 'a@b.co', phone: '' }),
    ).resolves.toMatchObject({ email: 'a@b.co' });
    const withPhone = await registerSchema.validate({ ...base, email: '', phone: '۰۹۱۲۳۴۵۶۷۸۹' });
    expect(withPhone.phone).toBe('09123456789');
  });

  it('enforces the password policy and confirmation', async () => {
    await expect(
      registerSchema.validate({
        ...base,
        email: 'a@b.co',
        password: 'short1',
        confirmPassword: 'short1',
      }),
    ).rejects.toThrow();
    await expect(
      registerSchema.validate({
        ...base,
        email: 'a@b.co',
        password: 'onlyletters',
        confirmPassword: 'onlyletters',
      }),
    ).rejects.toThrow();
    await expect(
      registerSchema.validate({ ...base, email: 'a@b.co', confirmPassword: 'Different1' }),
    ).rejects.toThrow();
  });
});

describe('addressSchema', () => {
  it('normalises persian digits and validates postal code', async () => {
    const result = await addressSchema.validate({
      title: 'خانه',
      recipientName: 'علی رضایی',
      recipientPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان ولیعصر پلاک ۱',
      postalCode: '۱۲۳۴۵۶۷۸۹۰',
    });
    expect(result.recipientPhone).toBe('09123456789');
    expect(result.postalCode).toBe('1234567890');
    await expect(addressSchema.validate({ ...result, province: 'ناکجا' })).rejects.toThrow();
  });
});

describe('reviewSchema', () => {
  const valid = { rating: '4', title: ' عالی بود ', body: 'کیفیت ساخت خوب و ارسال سریع بود.' };

  it('casts the radio value to a number and trims text', async () => {
    await expect(reviewSchema.validate(valid)).resolves.toEqual({
      rating: 4,
      title: 'عالی بود',
      body: 'کیفیت ساخت خوب و ارسال سریع بود.',
    });
  });

  it('requires a star to be picked and enforces lengths', async () => {
    await expect(reviewSchema.validate({ ...valid, rating: '' })).rejects.toThrow();
    await expect(reviewSchema.validate({ ...valid, rating: 6 })).rejects.toThrow();
    await expect(reviewSchema.validate({ ...valid, title: 'خب' })).rejects.toThrow();
    await expect(reviewSchema.validate({ ...valid, body: 'کوتاه' })).rejects.toThrow();
  });
});
