/**
 * Persian (fa-IR) message catalogue.
 *
 * All user-facing copy lives here so components never hard-code text and a
 * second locale can be added by providing another catalogue with the same
 * shape (`Messages`).
 */
export const fa = {
  app: {
    name: 'بازارچه',
    tagline: 'بازار آنلاین کالاهای ایرانی',
    description: 'فروشگاه اینترنتی با هزاران کالا، ارسال سریع و پرداخت امن',
  },
  nav: {
    home: 'خانه',
    categories: 'دسته‌بندی‌ها',
    products: 'محصولات',
    search: 'جستجو',
    searchPlaceholder: 'جستجو در محصولات…',
    cart: 'سبد خرید',
    wishlist: 'علاقه‌مندی‌ها',
    account: 'حساب کاربری',
    login: 'ورود',
    register: 'ثبت‌نام',
    logout: 'خروج',
    orders: 'سفارش‌ها',
    admin: 'پنل مدیریت',
    seller: 'پنل فروشنده',
    menu: 'منو',
    closeMenu: 'بستن منو',
    skipToContent: 'پرش به محتوای اصلی',
  },
  footer: {
    about: 'درباره ما',
    contact: 'تماس با ما',
    terms: 'قوانین و مقررات',
    privacy: 'حریم خصوصی',
    faq: 'پرسش‌های متداول',
    sellWithUs: 'فروشنده شوید',
    copyright: 'تمامی حقوق محفوظ است.',
    customerService: 'خدمات مشتریان',
    company: 'شرکت',
  },
  common: {
    loading: 'در حال بارگذاری…',
    error: 'خطایی رخ داد',
    retry: 'تلاش مجدد',
    save: 'ذخیره',
    cancel: 'انصراف',
    delete: 'حذف',
    edit: 'ویرایش',
    add: 'افزودن',
    back: 'بازگشت',
    next: 'بعدی',
    previous: 'قبلی',
    confirm: 'تأیید',
    close: 'بستن',
    toman: 'تومان',
    free: 'رایگان',
    notFoundTitle: 'صفحه پیدا نشد',
    notFoundBody: 'صفحه‌ای که به دنبال آن هستید وجود ندارد یا جابه‌جا شده است.',
    backHome: 'بازگشت به صفحه اصلی',
    errorTitle: 'مشکلی پیش آمد',
    errorBody: 'متأسفانه در نمایش این صفحه خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  },
  home: {
    heroTitle: 'هر آنچه نیاز دارید، یک‌جا',
    heroSubtitle: 'خرید آسان از هزاران فروشنده معتبر با ارسال سریع به سراسر ایران',
    shopNow: 'شروع خرید',
    featuredCategories: 'دسته‌بندی‌های محبوب',
    latestProducts: 'جدیدترین محصولات',
    features: {
      fastDelivery: 'ارسال سریع',
      fastDeliveryBody: 'تحویل در کوتاه‌ترین زمان ممکن',
      securePayment: 'پرداخت امن',
      securePaymentBody: 'پرداخت از طریق درگاه‌های معتبر بانکی',
      support: 'پشتیبانی ۷ روز هفته',
      supportBody: 'پاسخگویی به پرسش‌های شما',
      returns: 'ضمانت بازگشت کالا',
      returnsBody: 'تا ۷ روز پس از تحویل',
    },
  },
} as const;

export type Messages = typeof fa;
