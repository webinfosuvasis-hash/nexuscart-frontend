import {
  Injectable, Logger, NotFoundException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService }  from '@/prisma/prisma.service';
import { NodeRefService } from './node-ref.service';
import { ConfigStatus, DocScope } from '@prisma/client';
import type { PageDocumentData, Node } from './transforms/types';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SaveDocumentDto {
  storeId:       string;
  themeId:       string;
  ownerKey:      string;
  scope?:        DocScope;
  tree:          Node;
  seo?:          Record<string, unknown> | null;
  settings?:     Record<string, unknown> | null;
  version:       number;          // client's current version — optimistic lock
}

export interface PublishDocumentDto {
  storeId:   string;
  themeId:   string;
  ownerKey:  string;
  publishedBy?: string;
}

// ─── Document service ─────────────────────────────────────────────────────────

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly nodeRefs: NodeRefService,
  ) {}

  // ── Load (DRAFT or PUBLISHED) ────────────────────────────────────────────────

  async getDocument(
    storeId:  string,
    themeId:  string,
    ownerKey: string,
    status:   ConfigStatus = ConfigStatus.DRAFT,
  ): Promise<PageDocumentData | null> {
    const row = await this.prisma.pageDocument.findUnique({
      where: {
        storeId_themeId_ownerKey_status: { storeId, themeId, ownerKey, status },
      },
    });

    if (!row) return null;

    return {
      id:            row.id,
      storeId:       row.storeId,
      themeId:       row.themeId,
      scope:         row.scope as DocScope,
      ownerKey:      row.ownerKey,
      status:        row.status as ConfigStatus,
      version:       row.version,
      schemaVersion: row.schemaVersion,
      tree:          row.tree as unknown as Node,
      seo:           row.seo as Record<string, unknown> | null,
      settings:      row.settings as Record<string, unknown> | null,
    };
  }

  // ── Save DRAFT (optimistic lock) ─────────────────────────────────────────────

  /**
   * Save the draft PageDocument for (storeId, themeId, ownerKey).
   *
   * Optimistic concurrency:
   *   - Client sends the version it last read.
   *   - If DB row has a different version, reject with 409.
   *   - On success, increment version.
   *
   * Also atomically rebuilds the NodeRef index for this document.
   */
  async saveDraft(dto: SaveDocumentDto): Promise<PageDocumentData> {
    const { storeId, themeId, ownerKey, scope = DocScope.PAGE, tree, seo, settings, version } = dto;

    // Validate tree has a root
    if (!tree || tree.type !== 'root') {
      throw new BadRequestException('Document tree must have a root node with type="root".');
    }
    if (tree.children && tree.children.length > 500) {
      throw new BadRequestException('Document tree exceeds maximum node count (500 top-level children).');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Check existing draft for optimistic lock
      const existing = await tx.pageDocument.findUnique({
        where: {
          storeId_themeId_ownerKey_status: {
            storeId, themeId, ownerKey, status: ConfigStatus.DRAFT,
          },
        },
        select: { id: true, version: true },
      });

      if (existing && existing.version !== version) {
        throw new ConflictException(
          `Document was modified by another session (expected v${version}, found v${existing.version}). ` +
          `Reload the editor to get the latest version.`,
        );
      }

      const newVersion = (existing?.version ?? 0) + 1;

      const saved = await tx.pageDocument.upsert({
        where: {
          storeId_themeId_ownerKey_status: {
            storeId, themeId, ownerKey, status: ConfigStatus.DRAFT,
          },
        },
        create: {
          storeId, themeId, ownerKey, scope,
          status:        ConfigStatus.DRAFT,
          version:       newVersion,
          schemaVersion: 1,
          tree:          tree as any,
          seo:           seo as any ?? null,
          settings:      settings as any ?? null,
        },
        update: {
          tree:     tree as any,
          seo:      seo as any ?? null,
          settings: settings as any ?? null,
          version:  newVersion,
        },
      });

      // Rebuild NodeRef index atomically with the save
      await this.nodeRefs.rebuild(tx, {
        storeId,
        documentId:   saved.id,
        documentType: scope,
        ownerKey,
        status:       ConfigStatus.DRAFT,
        tree,
      });

      return saved;
    });

    this.logger.log(`Draft saved: ${storeId}/${themeId}/${ownerKey} v${result.version}`);

    return {
      id:            result.id,
      storeId:       result.storeId,
      themeId:       result.themeId,
      scope:         result.scope as DocScope,
      ownerKey:      result.ownerKey,
      status:        ConfigStatus.DRAFT,
      version:       result.version,
      schemaVersion: result.schemaVersion,
      tree:          result.tree as unknown as Node,
      seo:           result.seo as Record<string, unknown> | null,
      settings:      result.settings as Record<string, unknown> | null,
    };
  }

  // ── Publish (DRAFT → PUBLISHED atomic swap) ──────────────────────────────────

  /**
   * Atomically promotes DRAFT → PUBLISHED for one page:
   *   1. Snapshot current PUBLISHED state into DocumentVersion (for rollback)
   *   2. Upsert PUBLISHED row from DRAFT content
   *   3. Rebuild NodeRef index for PUBLISHED status
   *
   * Does NOT delete the DRAFT row — it stays until the merchant makes new edits.
   * Storefront serves from PUBLISHED; editor always reads DRAFT.
   */
  async publish(dto: PublishDocumentDto): Promise<{ version: number; snapshotId: string | null }> {
    const { storeId, themeId, ownerKey, publishedBy } = dto;

    // Load draft to publish
    const draft = await this.prisma.pageDocument.findUnique({
      where: {
        storeId_themeId_ownerKey_status: {
          storeId, themeId, ownerKey, status: ConfigStatus.DRAFT,
        },
      },
    });

    if (!draft) {
      throw new NotFoundException(
        `No draft found for ${storeId}/${themeId}/${ownerKey}. ` +
        `Save a draft first before publishing.`,
      );
    }

    let snapshotId: string | null = null;
    let newVersion = 1;

    await this.prisma.$transaction(async (tx) => {
      // 1. Snapshot current published state (for rollback)
      const currentPublished = await tx.pageDocument.findUnique({
        where: {
          storeId_themeId_ownerKey_status: {
            storeId, themeId, ownerKey, status: ConfigStatus.PUBLISHED,
          },
        },
      });

      if (currentPublished) {
        newVersion = currentPublished.version + 1;
        const snap = await tx.documentVersion.create({
          data: {
            documentId:   currentPublished.id,
            documentType: draft.scope,
            version:      currentPublished.version,
            snapshot:     { tree: currentPublished.tree, seo: currentPublished.seo, settings: currentPublished.settings } as any,
            publishedBy:  publishedBy ?? null,
          },
        });
        snapshotId = snap.id;
      }

      // 2. Upsert PUBLISHED row from draft content
      const published = await tx.pageDocument.upsert({
        where: {
          storeId_themeId_ownerKey_status: {
            storeId, themeId, ownerKey, status: ConfigStatus.PUBLISHED,
          },
        },
        create: {
          storeId, themeId, ownerKey,
          scope:         draft.scope,
          status:        ConfigStatus.PUBLISHED,
          version:       newVersion,
          schemaVersion: draft.schemaVersion,
          tree:          draft.tree,
          seo:           draft.seo,
          settings:      draft.settings,
          publishedAt:   new Date(),
        },
        update: {
          tree:          draft.tree,
          seo:           draft.seo,
          settings:      draft.settings,
          version:       newVersion,
          schemaVersion: draft.schemaVersion,
          publishedAt:   new Date(),
        },
      });

      // 3. Rebuild NodeRef for PUBLISHED
      await this.nodeRefs.rebuild(tx, {
        storeId,
        documentId:   published.id,
        documentType: draft.scope as DocScope,
        ownerKey,
        status:       ConfigStatus.PUBLISHED,
        tree:         draft.tree as unknown as Node,
      });
    });

    this.logger.log(
      `Published ${storeId}/${themeId}/${ownerKey} → v${newVersion}` +
      (snapshotId ? ` (snapshot: ${snapshotId})` : ''),
    );

    return { version: newVersion, snapshotId };
  }

  // ── Discard draft (reset to published) ──────────────────────────────────────

  async discardDraft(storeId: string, themeId: string, ownerKey: string): Promise<void> {
    const published = await this.getDocument(storeId, themeId, ownerKey, ConfigStatus.PUBLISHED);
    if (!published) {
      throw new NotFoundException(
        'No published version to restore. Publish at least once before discarding.',
      );
    }

    await this.saveDraft({
      storeId, themeId, ownerKey,
      tree:    published.tree,
      seo:     published.seo,
      settings:published.settings,
      version: 0,
    });

    this.logger.log(`Draft discarded for ${storeId}/${themeId}/${ownerKey} — restored to v${published.version}`);
  }

  // ── Rollback to a prior snapshot ─────────────────────────────────────────────

  async rollback(snapshotId: string, storeId: string, themeId: string, ownerKey: string): Promise<void> {
    const snap = await this.prisma.documentVersion.findUnique({
      where: { id: snapshotId },
    });

    if (!snap) throw new NotFoundException(`Snapshot ${snapshotId} not found.`);

    const snapData = snap.snapshot as any;

    await this.saveDraft({
      storeId, themeId, ownerKey,
      tree:    snapData.tree,
      seo:     snapData.seo ?? null,
      settings:snapData.settings ?? null,
      version: 0,
    });

    this.logger.log(`Rolled back ${storeId}/${themeId}/${ownerKey} to snapshot ${snapshotId}`);
  }

  // ── List version history ─────────────────────────────────────────────────────

  async listVersions(documentId: string): Promise<{ id: string; version: number; createdAt: Date }[]> {
    return this.prisma.documentVersion.findMany({
      where:   { documentId },
      select:  { id: true, version: true, createdAt: true },
      orderBy: { version: 'desc' },
      take:    20,
    });
  }
}
