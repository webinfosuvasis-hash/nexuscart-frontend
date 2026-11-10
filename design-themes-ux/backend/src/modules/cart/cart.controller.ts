import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { CartService } from './cart.service';
import { CartMutationGuard } from './guards/cart-mutation.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { ApplyPromotionDto } from './dto/apply-promotion.dto';
import { CartSessionMiddleware } from './middleware/cart-session.middleware';

@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: Request) {
    return this.cartService.getCart(req);
  }

  @Post('items')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  addItem(@Body() dto: AddCartItemDto, @Req() req: Request) {
    return this.cartService.addItem(dto, req);
  }

  @Patch('items/:id')
  @UseGuards(CartMutationGuard)
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
  ) {
    return this.cartService.updateItem(id, dto, req);
  }

  @Delete('items/:id')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  removeItem(@Param('id') id: string, @Req() req: Request) {
    return this.cartService.removeItem(id, req);
  }

  @Delete('items')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  clearCart(@Req() req: Request) {
    return this.cartService.clearCart(req);
  }

  @Post('merge')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  mergeCart(@Body() dto: MergeCartDto, @Req() req: Request) {
    return this.cartService.mergeCarts(dto.guestCartId, req);
  }

  @Post('promotions')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  applyPromotion(@Body() dto: ApplyPromotionDto, @Req() req: Request) {
    return this.cartService.applyPromotion(dto, req);
  }

  @Delete('promotions/:code')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  removePromotion(@Param('code') code: string, @Req() req: Request) {
    return this.cartService.removePromotion(code, req);
  }

  @Post('lock')
  @UseGuards(CartMutationGuard)
  @HttpCode(HttpStatus.OK)
  lockCart(@Req() req: Request) {
    return this.cartService.lockCart(req);
  }

  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  unlockCart(@Req() req: Request) {
    return this.cartService.unlockCart(req);
  }

  @Get('activity')
  getActivity(@Req() req: Request) {
    return this.cartService.getActivity(req);
  }

  /**
   * Called by the storefront on logout: this browser gets a new, empty cart
   * session, so the next person on a shared device can't see or check out
   * the previous shopper's bag, address or in-progress checkout.
   */
  @Post('session/rotate')
  @HttpCode(HttpStatus.NO_CONTENT)
  rotateSession(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    CartSessionMiddleware.rotate(req, res);
  }
}
