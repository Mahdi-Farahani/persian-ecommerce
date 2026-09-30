/**
 * Deterministic development catalogue. All prices are integers in IRR.
 */

export interface SeedBrand {
  name: string;
  nameEn: string;
  slug: string;
}

export interface SeedCategory {
  name: string;
  slug: string;
  description?: string;
  children?: SeedCategory[];
  attributes?: string[]; // attribute slugs
}

export interface SeedAttributeValue {
  value: string;
  slug: string;
  colorHex?: string;
}

export interface SeedAttribute {
  name: string;
  slug: string;
  type?: 'SELECT' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
  unit?: string;
  isVariant?: boolean;
  isFilterable?: boolean;
  values?: SeedAttributeValue[];
}

export interface SeedVariant {
  sku: string;
  title?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  attributes?: Record<string, string>; // attributeSlug -> valueSlug
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface SeedProduct {
  title: string;
  titleEn?: string;
  slug: string;
  category: string; // slug
  brand?: string; // slug
  shortDescription: string;
  description: string;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW' | 'ARCHIVED' | 'OUT_OF_STOCK';
  attributes?: Record<string, string>; // attributeSlug -> valueSlug or free text
  specifications?: Array<{ group?: string; name: string; value: string }>;
  variants: SeedVariant[];
  imageColor: string;
  weightGrams?: number;
}

export const SEED_BRANDS: SeedBrand[] = [
  { name: 'سامسونگ', nameEn: 'Samsung', slug: 'samsung' },
  { name: 'اپل', nameEn: 'Apple', slug: 'apple' },
  { name: 'شیائومی', nameEn: 'Xiaomi', slug: 'xiaomi' },
  { name: 'ال‌جی', nameEn: 'LG', slug: 'lg' },
  { name: 'ایسوس', nameEn: 'ASUS', slug: 'asus' },
  { name: 'نایک', nameEn: 'Nike', slug: 'nike' },
  { name: 'انکر', nameEn: 'Anker', slug: 'anker' },
  { name: 'نشر چشمه', nameEn: 'Cheshmeh', slug: 'cheshmeh' },
];

export const SEED_ATTRIBUTES: SeedAttribute[] = [
  {
    name: 'رنگ',
    slug: 'color',
    isVariant: true,
    values: [
      { value: 'مشکی', slug: 'black', colorHex: '#111111' },
      { value: 'سفید', slug: 'white', colorHex: '#f5f5f5' },
      { value: 'آبی', slug: 'blue', colorHex: '#2563eb' },
      { value: 'نقره‌ای', slug: 'silver', colorHex: '#c0c0c0' },
      { value: 'قرمز', slug: 'red', colorHex: '#dc2626' },
      { value: 'سبز', slug: 'green', colorHex: '#16a34a' },
    ],
  },
  {
    name: 'حافظه داخلی',
    slug: 'storage',
    isVariant: true,
    unit: 'گیگابایت',
    values: [
      { value: '۶۴ گیگابایت', slug: '64gb' },
      { value: '۱۲۸ گیگابایت', slug: '128gb' },
      { value: '۲۵۶ گیگابایت', slug: '256gb' },
      { value: '۵۱۲ گیگابایت', slug: '512gb' },
      { value: '۱ ترابایت', slug: '1tb' },
    ],
  },
  {
    name: 'حافظه رم',
    slug: 'ram',
    unit: 'گیگابایت',
    values: [
      { value: '۴ گیگابایت', slug: '4gb' },
      { value: '۸ گیگابایت', slug: '8gb' },
      { value: '۱۲ گیگابایت', slug: '12gb' },
      { value: '۱۶ گیگابایت', slug: '16gb' },
      { value: '۳۲ گیگابایت', slug: '32gb' },
    ],
  },
  {
    name: 'اندازه صفحه‌نمایش',
    slug: 'screen-size',
    unit: 'اینچ',
    values: [
      { value: '۶.۱ اینچ', slug: '6-1' },
      { value: '۶.۲ اینچ', slug: '6-2' },
      { value: '۶.۷ اینچ', slug: '6-7' },
      { value: '۱۳.۶ اینچ', slug: '13-6' },
      { value: '۱۵.۶ اینچ', slug: '15-6' },
      { value: '۵۵ اینچ', slug: '55' },
      { value: '۶۵ اینچ', slug: '65' },
    ],
  },
  {
    name: 'سیستم‌عامل',
    slug: 'os',
    values: [
      { value: 'اندروید', slug: 'android' },
      { value: 'iOS', slug: 'ios' },
      { value: 'ویندوز', slug: 'windows' },
      { value: 'macOS', slug: 'macos' },
    ],
  },
  {
    name: 'سایز',
    slug: 'shoe-size',
    isVariant: true,
    values: [
      { value: '۴۰', slug: '40' },
      { value: '۴۱', slug: '41' },
      { value: '۴۲', slug: '42' },
      { value: '۴۳', slug: '43' },
      { value: '۴۴', slug: '44' },
    ],
  },
  {
    name: 'گارانتی',
    slug: 'warranty',
    values: [
      { value: '۱۸ ماه گارانتی', slug: '18-months' },
      { value: '۱۲ ماه گارانتی', slug: '12-months' },
      { value: '۶ ماه گارانتی', slug: '6-months' },
      { value: 'بدون گارانتی', slug: 'none' },
    ],
  },
  { name: 'جنس', slug: 'material', type: 'TEXT', isFilterable: false },
  { name: 'نویسنده', slug: 'author', type: 'TEXT', isFilterable: false },
];

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'کالای دیجیتال',
    slug: 'digital',
    description: 'گوشی، لپ‌تاپ، قطعات و لوازم جانبی',
    attributes: ['warranty'],
    children: [
      {
        name: 'موبایل',
        slug: 'mobile',
        children: [
          {
            name: 'گوشی هوشمند',
            slug: 'smartphones',
            attributes: ['color', 'storage', 'ram', 'screen-size', 'os'],
          },
          { name: 'لوازم جانبی موبایل', slug: 'mobile-accessories', attributes: ['color'] },
        ],
      },
      {
        name: 'لپ‌تاپ',
        slug: 'laptops',
        attributes: ['color', 'ram', 'storage', 'screen-size', 'os'],
      },
      { name: 'قطعات کامپیوتر', slug: 'computer-parts' },
    ],
  },
  {
    name: 'لوازم خانگی',
    slug: 'home-appliances',
    attributes: ['warranty'],
    children: [
      { name: 'تلویزیون', slug: 'tv', attributes: ['screen-size'] },
      { name: 'یخچال و فریزر', slug: 'fridge', attributes: ['color'] },
    ],
  },
  {
    name: 'مد و پوشاک',
    slug: 'fashion',
    children: [
      { name: 'کفش', slug: 'shoes', attributes: ['color', 'shoe-size', 'material'] },
      { name: 'پوشاک مردانه', slug: 'men-clothing', attributes: ['color', 'material'] },
    ],
  },
  {
    name: 'کتاب و لوازم تحریر',
    slug: 'books',
    attributes: ['author'],
  },
];

const M = 1_000_000; // 1 million IRR = 100,000 toman

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    title: 'گوشی موبایل سامسونگ مدل Galaxy S25',
    titleEn: 'Samsung Galaxy S25',
    slug: 'samsung-galaxy-s25',
    category: 'smartphones',
    brand: 'samsung',
    shortDescription: 'پرچمدار جمع‌وجور سامسونگ با پردازنده اسنپدراگون ۸ الیت',
    description:
      'گلکسی S25 با صفحه‌نمایش ۶.۲ اینچی Dynamic AMOLED 2X، دوربین سه‌گانه ۵۰ مگاپیکسلی و باتری ۴۰۰۰ میلی‌آمپرساعتی، انتخابی مطمئن برای کاربران حرفه‌ای است.',
    status: 'ACTIVE',
    attributes: { ram: '12gb', 'screen-size': '6-2', os: 'android', warranty: '18-months' },
    specifications: [
      { group: 'صفحه‌نمایش', name: 'فناوری', value: 'Dynamic AMOLED 2X' },
      { group: 'صفحه‌نمایش', name: 'نرخ نوسازی', value: '۱۲۰ هرتز' },
      { group: 'پردازنده', name: 'تراشه', value: 'Snapdragon 8 Elite' },
      { group: 'دوربین', name: 'دوربین اصلی', value: '۵۰ مگاپیکسل' },
      { group: 'باتری', name: 'ظرفیت', value: '۴۰۰۰ میلی‌آمپرساعت' },
    ],
    variants: [
      {
        sku: 'SM-S25-128-BLK',
        title: '۱۲۸ گیگابایت / مشکی',
        price: 450 * M,
        stock: 12,
        attributes: { storage: '128gb', color: 'black' },
      },
      {
        sku: 'SM-S25-128-WHT',
        title: '۱۲۸ گیگابایت / سفید',
        price: 450 * M,
        stock: 5,
        attributes: { storage: '128gb', color: 'white' },
      },
      {
        sku: 'SM-S25-256-BLK',
        title: '۲۵۶ گیگابایت / مشکی',
        price: 495 * M,
        compareAtPrice: 520 * M,
        stock: 8,
        attributes: { storage: '256gb', color: 'black' },
      },
      {
        sku: 'SM-S25-256-BLU',
        title: '۲۵۶ گیگابایت / آبی',
        price: 495 * M,
        compareAtPrice: 520 * M,
        stock: 0,
        attributes: { storage: '256gb', color: 'blue' },
      },
    ],
    imageColor: '#1b5cf5',
    weightGrams: 162,
  },
  {
    title: 'گوشی موبایل اپل مدل iPhone 16',
    titleEn: 'Apple iPhone 16',
    slug: 'apple-iphone-16',
    category: 'smartphones',
    brand: 'apple',
    shortDescription: 'آیفون ۱۶ با تراشه A18 و دکمه کنترل دوربین',
    description:
      'آیفون ۱۶ با صفحه‌نمایش ۶.۱ اینچی Super Retina XDR، تراشه A18 و دوربین دوگانه ۴۸ مگاپیکسلی عرضه می‌شود.',
    status: 'ACTIVE',
    attributes: { ram: '8gb', 'screen-size': '6-1', os: 'ios', warranty: '12-months' },
    specifications: [
      { group: 'پردازنده', name: 'تراشه', value: 'Apple A18' },
      { group: 'دوربین', name: 'دوربین اصلی', value: '۴۸ مگاپیکسل' },
      { group: 'بدنه', name: 'مقاومت', value: 'IP68' },
    ],
    variants: [
      {
        sku: 'AP-IP16-128-BLK',
        title: '۱۲۸ گیگابایت / مشکی',
        price: 620 * M,
        stock: 6,
        attributes: { storage: '128gb', color: 'black' },
      },
      {
        sku: 'AP-IP16-256-BLK',
        title: '۲۵۶ گیگابایت / مشکی',
        price: 690 * M,
        stock: 4,
        attributes: { storage: '256gb', color: 'black' },
      },
      {
        sku: 'AP-IP16-256-BLU',
        title: '۲۵۶ گیگابایت / آبی',
        price: 690 * M,
        stock: 3,
        attributes: { storage: '256gb', color: 'blue' },
      },
    ],
    imageColor: '#334155',
    weightGrams: 170,
  },
  {
    title: 'گوشی موبایل شیائومی مدل 14T',
    titleEn: 'Xiaomi 14T',
    slug: 'xiaomi-14t',
    category: 'smartphones',
    brand: 'xiaomi',
    shortDescription: 'دوربین لایکا و شارژ سریع ۶۷ واتی',
    description:
      'شیائومی 14T با صفحه‌نمایش ۶.۷ اینچی AMOLED با نرخ نوسازی ۱۴۴ هرتز و دوربین سه‌گانه لایکا.',
    status: 'ACTIVE',
    attributes: { ram: '12gb', 'screen-size': '6-7', os: 'android', warranty: '18-months' },
    variants: [
      {
        sku: 'XI-14T-256-BLK',
        title: '۲۵۶ گیگابایت / مشکی',
        price: 280 * M,
        compareAtPrice: 310 * M,
        stock: 20,
        attributes: { storage: '256gb', color: 'black' },
      },
      {
        sku: 'XI-14T-512-GRN',
        title: '۵۱۲ گیگابایت / سبز',
        price: 320 * M,
        stock: 7,
        attributes: { storage: '512gb', color: 'green' },
      },
    ],
    imageColor: '#f97316',
    weightGrams: 195,
  },
  {
    title: 'گوشی موبایل سامسونگ مدل Galaxy A55',
    titleEn: 'Samsung Galaxy A55',
    slug: 'samsung-galaxy-a55',
    category: 'smartphones',
    brand: 'samsung',
    shortDescription: 'میان‌رده محبوب سامسونگ با بدنه فلزی',
    description:
      'گلکسی A55 با صفحه‌نمایش ۶.۶ اینچی، تراشه Exynos 1480 و باتری ۵۰۰۰ میلی‌آمپرساعتی.',
    status: 'ACTIVE',
    attributes: { ram: '8gb', 'screen-size': '6-7', os: 'android', warranty: '18-months' },
    variants: [
      {
        sku: 'SM-A55-128-BLU',
        title: '۱۲۸ گیگابایت / آبی',
        price: 165 * M,
        stock: 0,
        attributes: { storage: '128gb', color: 'blue' },
      },
      {
        sku: 'SM-A55-256-BLK',
        title: '۲۵۶ گیگابایت / مشکی',
        price: 185 * M,
        stock: 0,
        attributes: { storage: '256gb', color: 'black' },
      },
    ],
    imageColor: '#0ea5e9',
    weightGrams: 213,
  },
  {
    title: 'شارژر دیواری انکر مدل Nano 65W',
    titleEn: 'Anker Nano 65W Charger',
    slug: 'anker-nano-65w',
    category: 'mobile-accessories',
    brand: 'anker',
    shortDescription: 'شارژر سریع ۶۵ وات با سه درگاه',
    description: 'شارژر گن (GaN) انکر با توان ۶۵ وات، مناسب گوشی، تبلت و لپ‌تاپ‌های سبک.',
    status: 'ACTIVE',
    attributes: { warranty: '12-months' },
    variants: [
      {
        sku: 'AN-NANO65-BLK',
        title: 'مشکی',
        price: 18 * M,
        stock: 40,
        attributes: { color: 'black' },
      },
      {
        sku: 'AN-NANO65-WHT',
        title: 'سفید',
        price: 18 * M,
        stock: 25,
        attributes: { color: 'white' },
      },
    ],
    imageColor: '#0f766e',
    weightGrams: 120,
  },
  {
    title: 'لپ‌تاپ ۱۵.۶ اینچی ایسوس مدل Vivobook 15',
    titleEn: 'ASUS Vivobook 15',
    slug: 'asus-vivobook-15',
    category: 'laptops',
    brand: 'asus',
    shortDescription: 'لپ‌تاپ روزمره با پردازنده نسل ۱۳ اینتل',
    description: 'ویووبوک ۱۵ با پردازنده Core i5 نسل ۱۳، ۱۶ گیگابایت رم و حافظه SSD یک ترابایتی.',
    status: 'ACTIVE',
    attributes: { ram: '16gb', 'screen-size': '15-6', os: 'windows', warranty: '18-months' },
    specifications: [
      { group: 'پردازنده', name: 'مدل', value: 'Intel Core i5-1335U' },
      { group: 'حافظه', name: 'رم', value: '۱۶ گیگابایت DDR4' },
      { group: 'حافظه', name: 'SSD', value: '۱ ترابایت NVMe' },
    ],
    variants: [
      {
        sku: 'AS-VB15-1TB-SLV',
        title: '۱ ترابایت / نقره‌ای',
        price: 520 * M,
        stock: 9,
        attributes: { storage: '1tb', color: 'silver' },
      },
      {
        sku: 'AS-VB15-512-BLU',
        title: '۵۱۲ گیگابایت / آبی',
        price: 470 * M,
        compareAtPrice: 499 * M,
        stock: 3,
        attributes: { storage: '512gb', color: 'blue' },
      },
    ],
    imageColor: '#4f46e5',
    weightGrams: 1700,
  },
  {
    title: 'لپ‌تاپ ۱۳.۶ اینچی اپل مدل MacBook Air M3',
    titleEn: 'Apple MacBook Air M3',
    slug: 'apple-macbook-air-m3',
    category: 'laptops',
    brand: 'apple',
    shortDescription: 'سبک، بی‌صدا و با عمر باتری ۱۸ ساعته',
    description: 'مک‌بوک ایر با تراشه M3، صفحه‌نمایش Liquid Retina و بدنه یکپارچه آلومینیومی.',
    status: 'ACTIVE',
    attributes: { ram: '16gb', 'screen-size': '13-6', os: 'macos', warranty: '12-months' },
    variants: [
      {
        sku: 'AP-MBA-M3-256-SLV',
        title: '۲۵۶ گیگابایت / نقره‌ای',
        price: 980 * M,
        stock: 4,
        attributes: { storage: '256gb', color: 'silver' },
      },
      {
        sku: 'AP-MBA-M3-512-BLK',
        title: '۵۱۲ گیگابایت / مشکی',
        price: 1150 * M,
        stock: 2,
        attributes: { storage: '512gb', color: 'black' },
      },
    ],
    imageColor: '#64748b',
    weightGrams: 1240,
  },
  {
    title: 'تلویزیون هوشمند ۵۵ اینچ ال‌جی مدل UR8000',
    titleEn: 'LG 55UR8000 4K Smart TV',
    slug: 'lg-55ur8000',
    category: 'tv',
    brand: 'lg',
    shortDescription: 'تلویزیون 4K با سیستم‌عامل webOS',
    description: 'تلویزیون ۵۵ اینچی ال‌جی با پنل 4K UHD، پردازنده α5 و پشتیبانی از HDR10 Pro.',
    status: 'ACTIVE',
    attributes: { 'screen-size': '55', warranty: '18-months' },
    variants: [{ sku: 'LG-55UR8000', price: 390 * M, compareAtPrice: 420 * M, stock: 6 }],
    imageColor: '#be123c',
    weightGrams: 14000,
  },
  {
    title: 'یخچال فریزر بالا پایین سامسونگ مدل RT53',
    titleEn: 'Samsung RT53 Refrigerator',
    slug: 'samsung-rt53',
    category: 'fridge',
    brand: 'samsung',
    shortDescription: 'یخچال ۲۰ فوت با فناوری Twin Cooling',
    description:
      'یخچال فریزر سامسونگ با ظرفیت ۵۳۰ لیتر، کمپرسور اینورتر دیجیتال و ۱۰ سال گارانتی کمپرسور.',
    status: 'ACTIVE',
    attributes: { warranty: '18-months' },
    variants: [
      {
        sku: 'SM-RT53-SLV',
        title: 'نقره‌ای',
        price: 720 * M,
        stock: 3,
        attributes: { color: 'silver' },
      },
      {
        sku: 'SM-RT53-WHT',
        title: 'سفید',
        price: 700 * M,
        stock: 2,
        attributes: { color: 'white' },
      },
    ],
    imageColor: '#0891b2',
    weightGrams: 92000,
  },
  {
    title: 'کفش پیاده‌روی مردانه نایک مدل Air Zoom Pegasus 41',
    titleEn: 'Nike Air Zoom Pegasus 41',
    slug: 'nike-pegasus-41',
    category: 'shoes',
    brand: 'nike',
    shortDescription: 'کفش دویدن سبک با فوم ReactX',
    description: 'پگاسوس ۴۱ با فوم ReactX و دو واحد Air Zoom، انتخابی محبوب برای دویدن روزانه.',
    status: 'ACTIVE',
    attributes: { material: 'رویه مش، زیره لاستیک', warranty: 'none' },
    variants: [
      {
        sku: 'NK-PEG41-BLK-41',
        title: 'مشکی / ۴۱',
        price: 62 * M,
        stock: 4,
        attributes: { color: 'black', 'shoe-size': '41' },
      },
      {
        sku: 'NK-PEG41-BLK-42',
        title: 'مشکی / ۴۲',
        price: 62 * M,
        stock: 6,
        attributes: { color: 'black', 'shoe-size': '42' },
      },
      {
        sku: 'NK-PEG41-BLK-43',
        title: 'مشکی / ۴۳',
        price: 62 * M,
        stock: 0,
        attributes: { color: 'black', 'shoe-size': '43' },
      },
      {
        sku: 'NK-PEG41-RED-42',
        title: 'قرمز / ۴۲',
        price: 65 * M,
        compareAtPrice: 72 * M,
        stock: 3,
        attributes: { color: 'red', 'shoe-size': '42' },
      },
    ],
    imageColor: '#ea580c',
    weightGrams: 600,
  },
  {
    title: 'تی‌شرت مردانه نایک مدل Dri-FIT',
    titleEn: 'Nike Dri-FIT Tee',
    slug: 'nike-dri-fit-tee',
    category: 'men-clothing',
    brand: 'nike',
    shortDescription: 'تی‌شرت ورزشی با پارچه خنک‌کننده',
    description: 'تی‌شرت Dri-FIT با پارچه پلی‌استر بازیافتی که رطوبت را از پوست دور می‌کند.',
    status: 'ACTIVE',
    attributes: { material: '۱۰۰٪ پلی‌استر' },
    variants: [
      {
        sku: 'NK-DFT-BLK',
        title: 'مشکی',
        price: 14 * M,
        stock: 30,
        attributes: { color: 'black' },
      },
      {
        sku: 'NK-DFT-WHT',
        title: 'سفید',
        price: 14 * M,
        stock: 30,
        attributes: { color: 'white' },
      },
    ],
    imageColor: '#111827',
    weightGrams: 180,
  },
  {
    title: 'کتاب بوف کور',
    titleEn: 'The Blind Owl',
    slug: 'boofe-koor',
    category: 'books',
    brand: 'cheshmeh',
    shortDescription: 'شاهکار صادق هدایت',
    description: 'بوف کور مشهورترین اثر صادق هدایت و یکی از مهم‌ترین آثار ادبیات معاصر فارسی است.',
    status: 'ACTIVE',
    attributes: { author: 'صادق هدایت' },
    specifications: [
      { name: 'قطع', value: 'رقعی' },
      { name: 'تعداد صفحات', value: '۱۱۲' },
      { name: 'جلد', value: 'شومیز' },
    ],
    variants: [{ sku: 'BK-BOOF-KOOR', price: 2_500_000, stock: 50 }],
    imageColor: '#7c3aed',
    weightGrams: 150,
  },
  {
    title: 'کتاب کلیدر (دوره ۱۰ جلدی)',
    titleEn: 'Kelidar',
    slug: 'kelidar',
    category: 'books',
    brand: 'cheshmeh',
    shortDescription: 'رمان حماسی محمود دولت‌آبادی',
    description: 'کلیدر بلندترین رمان فارسی، روایتی از زندگی عشایر خراسان در دهه ۱۳۲۰.',
    status: 'ACTIVE',
    attributes: { author: 'محمود دولت‌آبادی' },
    variants: [{ sku: 'BK-KELIDAR-10', price: 28_000_000, compareAtPrice: 32_000_000, stock: 8 }],
    imageColor: '#b45309',
    weightGrams: 3200,
  },
  {
    title: 'گوشی موبایل سامسونگ مدل Galaxy Z Fold 7 (پیش‌نویس)',
    titleEn: 'Samsung Galaxy Z Fold 7',
    slug: 'samsung-galaxy-z-fold-7',
    category: 'smartphones',
    brand: 'samsung',
    shortDescription: 'محصول در حال آماده‌سازی',
    description: 'این محصول هنوز منتشر نشده است و فقط در پنل مدیریت دیده می‌شود.',
    status: 'DRAFT',
    attributes: { os: 'android' },
    variants: [
      {
        sku: 'SM-ZF7-512-BLK',
        price: 1400 * M,
        stock: 0,
        attributes: { storage: '512gb', color: 'black' },
      },
    ],
    imageColor: '#475569',
    weightGrams: 240,
  },
];
