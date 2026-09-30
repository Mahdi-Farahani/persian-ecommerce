import type { Metadata } from 'next';
import {
  PaymentResultPage,
  paymentResultMetadata,
  type PaymentResultSearchParams,
} from '@/components/payment/payment-result-page';

interface RouteProps {
  searchParams: Promise<PaymentResultSearchParams>;
}

export function generateMetadata({ searchParams }: RouteProps): Promise<Metadata> {
  return paymentResultMetadata('success', searchParams);
}

export default function PaymentSuccessRoute({ searchParams }: RouteProps) {
  return <PaymentResultPage path="/payment/success" searchParams={searchParams} />;
}
