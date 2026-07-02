import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { WebhookService } from './webhook.service';

@Public()
@SkipThrottle()
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpay(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature = '',
  ): Promise<{ received: boolean }> {
    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Raw body required — ensure express.raw() is applied to /api/v1/webhooks');
    }
    return this.webhookService.handleRazorpay(req.body as Buffer, signature);
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async stripe(
    @Req() req: Request,
    @Headers('stripe-signature') signature = '',
  ): Promise<{ received: boolean }> {
    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Raw body required — ensure express.raw() is applied to /api/v1/webhooks');
    }
    return this.webhookService.handleStripe(req.body as Buffer, signature);
  }
}
