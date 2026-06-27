import {
  Controller, Get, Post, Patch, Param, Body,
  Query, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { DocumentService, SaveDocumentDto }    from './document.service';
import { ShadowRenderService }                 from './shadow-render.service';
import { ConfigStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
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
