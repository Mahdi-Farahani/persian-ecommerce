import { formatToman, toPersianDigits } from '@pe/shared';

/** Minimal RTL page standing in for a real gateway during development and E2E tests. */
export function renderMockGatewayPage(input: {
  authority: string;
  amount: number;
  callbackUrl: string;
}): string {
  const target = (status: string): string => {
    const url = new URL(input.callbackUrl);
    url.searchParams.set('authority', input.authority);
    url.searchParams.set('status', status);
    return url.toString();
  };
  const amountLabel = escapeHtml(formatToman(input.amount));
  const authorityLabel = escapeHtml(toPersianDigits(input.authority));
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>درگاه پرداخت آزمایشی</title>
<style>
  body{font-family:system-ui,Tahoma,sans-serif;background:#f3f4f6;margin:0;display:grid;place-items:center;min-height:100vh;color:#111827}
  main{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:32px;width:min(440px,92vw)}
  h1{font-size:20px;margin:0 0 8px}
  p{margin:6px 0;color:#4b5563}
  .amount{font-size:26px;font-weight:700;color:#111827;margin:16px 0}
  .badge{display:inline-block;background:#fef3c7;color:#92400e;border-radius:999px;padding:4px 12px;font-size:12px}
  .actions{display:grid;gap:10px;margin-top:20px}
  a{display:block;text-align:center;text-decoration:none;border-radius:10px;padding:12px;font-weight:700}
  .pay{background:#16a34a;color:#fff}.cancel{background:#e5e7eb;color:#111827}.fail{background:#dc2626;color:#fff}
  code{direction:ltr;display:inline-block;font-size:12px;color:#6b7280}
</style>
</head>
<body>
<main>
  <span class="badge">محیط آزمایشی — هیچ مبلغی برداشت نمی‌شود</span>
  <h1>درگاه پرداخت آزمایشی</h1>
  <p>شناسهٔ تراکنش: <code>${authorityLabel}</code></p>
  <div class="amount">${amountLabel}</div>
  <div class="actions">
    <a class="pay" href="${escapeHtml(target('OK'))}" data-testid="mock-pay">پرداخت موفق</a>
    <a class="cancel" href="${escapeHtml(target('NOK'))}" data-testid="mock-cancel">انصراف از پرداخت</a>
    <a class="fail" href="${escapeHtml(target('FAIL'))}" data-testid="mock-fail">شبیه‌سازی خطای بانک</a>
  </div>
</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
