import type { CreatePaymentResponse } from '@pe/shared';

/**
 * Sends the browser to the payment gateway. GET redirects navigate directly;
 * providers that require a POST get a hidden, auto-submitted form.
 */
export function redirectToGateway(response: CreatePaymentResponse): void {
  if (response.redirectMethod === 'POST') {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = response.redirectUrl;
    form.style.display = 'none';
    for (const [name, value] of Object.entries(response.redirectFields ?? {})) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return;
  }
  window.location.assign(response.redirectUrl);
}
