import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PaymentModule } from '@/modules/payment/payment.module';
import { PaymentOrchestratorModule } from '@/modules/payment-orchestrator/payment-orchestrator.module';
import { CheckoutModule } from '@/modules/checkout/checkout.module';
import { CartSessionMiddleware } from '@/modules/cart/middleware/cart-session.middleware';
import { CustomerPaymentController } from './customer-payment.controller';
import { GuestPaymentController } from './guest-payment.controller';
import { CustomerPaymentService } from './customer-payment.service';

@Module({
  imports: [PaymentModule, PaymentOrchestratorModule, CheckoutModule],
  controllers: [CustomerPaymentController, GuestPaymentController],
  providers: [CustomerPaymentService],
})
export class CustomerPaymentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Guest payment ownership is proven by the cart-session cookie, and a
    // signed-in customer may only claim a checkout from the cart session that
    // started it — so these routes need req.cartSessionId. Bound here
    // explicitly rather than relying on CheckoutModule's `checkout/*path`
    // binding; the middleware is a no-op on a second run.
    consumer
      .apply(CartSessionMiddleware)
      .forRoutes(
        { path: 'guest-checkout',             method: RequestMethod.ALL },
        { path: 'guest-checkout/*path',       method: RequestMethod.ALL },
        { path: 'checkout/:checkoutId/pay',   method: RequestMethod.POST },
      );
  }
}
