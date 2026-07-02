import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { CheckoutService } from './checkout.service';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';

@Public()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  startCheckout(@Req() req: Request) {
    return this.checkoutService.startCheckout(req);
  }

  @Get(':id')
  getCheckout(@Param('id') id: string, @Req() req: Request) {
    return this.checkoutService.getCheckout(id, req);
  }

  @Patch(':id/address')
  updateAddress(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: Request,
  ) {
    return this.checkoutService.updateAddress(id, dto, req);
  }

  @Patch(':id/shipping')
  updateShipping(
    @Param('id') id: string,
    @Body() dto: UpdateShippingDto,
    @Req() req: Request,
  ) {
    return this.checkoutService.updateShipping(id, dto, req);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  validateCheckout(@Param('id') id: string, @Req() req: Request) {
    return this.checkoutService.validateCheckout(id, req);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string, @Req() req: Request) {
    return this.checkoutService.getSummary(id, req);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelCheckout(@Param('id') id: string, @Req() req: Request) {
    return this.checkoutService.cancelCheckout(id, req);
  }

  @Get(':id/activity')
  getActivity(@Param('id') id: string, @Req() req: Request) {
    return this.checkoutService.getActivity(id, req);
  }
}
