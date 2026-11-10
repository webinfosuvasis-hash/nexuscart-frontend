import {
  Controller, Get, Post, Patch, Param, Body,
  Query, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { DocumentService, SaveDocumentDto }    from './document.service';
import { ShadowRenderService }                 from './shadow-render.service';
import { ConfigStatus } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

// Permissions mirror the theme engine: theme:read (view), theme:update (edit
// drafts — managers), theme:publish (make live / roll back — owners).
// Authenticated by the global JwtAuthGuard. Not re-applied here: a controller-level
// JwtAuthGuard re-runs passport and replaces the store-scoped principal set by StoreContextGuard.
@Controller('content')
export class DocumentController {
  constructor(
    private readonly docs:   DocumentService,
    private readonly shadow: ShadowRenderService,
  ) {}

  private assertStoreAccess(user: any, storeId: string) {
    if (user.role !== 'SUPER_ADMIN' && user.storeId !== storeId) {
      throw new ForbiddenException('Access denied to this store');
    }
  }

  // GET /content/:storeId/:themeId/:ownerKey?status=DRAFT
  @Get(':storeId/:themeId/:ownerKey')
  @Permissions('theme:read')
  async getDocument(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @Query('status')   status:   string,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    const s = status === 'PUBLISHED' ? ConfigStatus.PUBLISHED : ConfigStatus.DRAFT;
    return this.docs.getDocument(storeId, themeId, ownerKey, s);
  }

  // PATCH /content/:storeId/:themeId/:ownerKey  — save draft
  @Patch(':storeId/:themeId/:ownerKey')
  @Permissions('theme:update')
  async saveDraft(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @Body() body: Omit<SaveDocumentDto, 'storeId' | 'themeId' | 'ownerKey'>,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    return this.docs.saveDraft({ storeId, themeId, ownerKey, ...body });
  }

  // POST /content/:storeId/:themeId/:ownerKey/publish
  @Post(':storeId/:themeId/:ownerKey/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions('theme:publish')
  async publish(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    return this.docs.publish({ storeId, themeId, ownerKey });
  }

  // POST /content/:storeId/:themeId/:ownerKey/discard
  @Post(':storeId/:themeId/:ownerKey/discard')
  @HttpCode(HttpStatus.OK)
  @Permissions('theme:update')
  async discardDraft(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    return this.docs.discardDraft(storeId, themeId, ownerKey);
  }

  // GET /content/:storeId/:themeId/:ownerKey/versions
  @Get(':storeId/:themeId/:ownerKey/versions')
  @Permissions('theme:read')
  async listVersions(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    const doc = await this.docs.getDocument(storeId, themeId, ownerKey, ConfigStatus.PUBLISHED);
    if (!doc?.id) return [];
    return this.docs.listVersions(doc.id);
  }

  // GET /content/:storeId/:themeId/:ownerKey/shadow-check?draft=true
  @Get(':storeId/:themeId/:ownerKey/shadow-check')
  @Permissions('theme:read')
  async shadowCheck(
    @Param('storeId')  storeId:  string,
    @Param('themeId')  themeId:  string,
    @Param('ownerKey') ownerKey: string,
    @Query('draft')    draft:    string,
    @CurrentUser()     user:     any,
  ) {
    this.assertStoreAccess(user, storeId);
    const isDraft = draft !== 'false';
    return this.shadow.check(storeId, themeId, ownerKey, isDraft);
  }

  // GET /content/shadow-check/all  — SUPER_ADMIN only
  @Get('shadow-check/all')
  @Roles('SUPER_ADMIN')
  async shadowCheckAll() {
    return this.shadow.checkAll();
  }

  // POST /content/:storeId/:themeId/:ownerKey/rollback/:snapshotId
  @Post(':storeId/:themeId/:ownerKey/rollback/:snapshotId')
  @HttpCode(HttpStatus.OK)
  @Permissions('theme:publish')
  async rollback(
    @Param('storeId')    storeId:    string,
    @Param('themeId')    themeId:    string,
    @Param('ownerKey')   ownerKey:   string,
    @Param('snapshotId') snapshotId: string,
    @CurrentUser()       user:       any,
  ) {
    this.assertStoreAccess(user, storeId);
    return this.docs.rollback(snapshotId, storeId, themeId, ownerKey);
  }
}
