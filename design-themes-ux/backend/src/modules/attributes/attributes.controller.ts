import {
  Controller, Get, Post, Put, Delete, Body, Param, Patch,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Attributes')
@ApiBearerAuth()
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  // ─── Attributes ─────────────────────────────────────────────────────────────

  @Get()
  @Permissions('attributes:read')
  findAll(@CurrentStore() storeId: string, @Query() query: any) {
    return this.attributes.findAll(storeId, query);
  }

  @Get('sets')
  @Permissions('attributes:read')
  findAllSets(@CurrentStore() storeId: string) {
    return this.attributes.findAllSets(storeId);
  }

  @Get(':id')
  @Permissions('attributes:read')
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.attributes.findOne(storeId, id);
  }

  @Post()
  @Permissions('attributes:create')
  create(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.attributes.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('attributes:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.attributes.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('attributes:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.attributes.remove(storeId, id);
  }

  // ─── Values ─────────────────────────────────────────────────────────────────

  @Post(':id/values')
  @Permissions('attributes:update')
  addValue(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.attributes.addValue(storeId, id, dto);
  }

  @Put(':id/values/:valueId')
  @Permissions('attributes:update')
  updateValue(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @Body() dto: any,
  ) {
    return this.attributes.updateValue(storeId, id, valueId, dto);
  }

  @Delete(':id/values/:valueId')
  @Permissions('attributes:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeValue(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Param('valueId') valueId: string,
  ) {
    return this.attributes.removeValue(storeId, id, valueId);
  }

  @Patch(':id/values/reorder')
  @Permissions('attributes:update')
  reorderValues(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { orders: { id: string; sortOrder: number }[] },
  ) {
    return this.attributes.reorderValues(storeId, id, body.orders);
  }

  // ─── Sets ────────────────────────────────────────────────────────────────────

  @Post('sets')
  @Permissions('attributes:create')
  createSet(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.attributes.createSet(storeId, dto);
  }

  @Put('sets/:id')
  @Permissions('attributes:update')
  updateSet(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.attributes.updateSet(storeId, id, dto);
  }

  @Delete('sets/:id')
  @Permissions('attributes:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSet(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.attributes.removeSet(storeId, id);
  }
}
