import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AdminPaymentGatewaysController } from './admin-payment-gateways.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { CredentialsCryptoService } from './credentials-crypto.service.js';
import { PaymentProviderFactory } from './payment-provider.factory.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

@Module({
  imports: [OrdersModule, AuditModule],
  controllers: [PaymentsController, AdminPaymentGatewaysController, AdminPaymentsController],
  providers: [
    CredentialsCryptoService,
    ProviderRegistryService,
    PaymentProviderFactory,
    PaymentsService,
  ],
  exports: [PaymentsService, ProviderRegistryService, PaymentProviderFactory],
})
export class PaymentsModule {}
