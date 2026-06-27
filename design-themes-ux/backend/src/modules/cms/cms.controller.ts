import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('CMS')
@ApiBearerAuth()
@Controller('cms')
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  // Pages
  @Get('pages')
  @Permissions('cms:read')
  listPages(@CurrentStore() storeId: string, @Query() query: any) {
    return this.cms.listPages(storeId, query);
  }

  @Get('pages/:id')
  @Permissions('cms:read')
  getPage(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.getPage(storeId, id);
  }

  @Post('pages')
  @Permissions('cms:create')
  createPage(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.cms.createPage(storeId, dto);
  }

  @Put('pages/:id')
  @Permissions('cms:update')
  updatePage(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.cms.updatePage(storeId, id, dto);
  }

  @Patch('pages/:id/publish')
  @Permissions('cms:update')
  @ApiOperation({ summary: 'Publish a CMS page' })
  publishPage(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.publishPage(storeId, id);
  }

  @Delete('pages/:id')
  @Permissions('cms:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePage(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.removePage(storeId, id);
  }

  // Menus
  @Get('menus')
  @Permissions('cms:read')
  listMenus(@CurrentStore() storeId: string) {
    return this.cms.listMenus(storeId);
  }

  @Post('menus')
  @Permissions('cms:create')
  createMenu(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.cms.createMenu(storeId, dto);
  }

  @Put('menus/:id')
  @Permissions('cms:update')
  updateMenu(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.cms.updateMenu(storeId, id, dto);
  }

  @Delete('menus/:id')
  @Permissions('cms:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMenu(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.removeMenu(storeId, id);
  }

  // Blog Posts
  @Get('blog')
  @Permissions('cms:read')
  listBlogPosts(@CurrentStore() storeId: string, @Query() query: any) {
    return this.cms.listBlogPosts(storeId, query);
  }

  @Get('blog/:id')
  @Permissions('cms:read')
  getBlogPost(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.getBlogPost(storeId, id);
  }

  @Post('blog')
  @Permissions('cms:create')
  createBlogPost(
    @CurrentStore() storeId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.cms.createBlogPost(storeId, dto, userId);
  }

  @Put('blog/:id')
  @Permissions('cms:update')
  updateBlogPost(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.cms.updateBlogPost(storeId, id, dto);
  }

  @Patch('blog/:id/publish')
  @Permissions('cms:update')
  publishBlogPost(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.publishBlogPost(storeId, id);
  }

  @Delete('blog/:id')
  @Permissions('cms:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBlogPost(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.cms.removeBlogPost(storeId, id);
  }
}
