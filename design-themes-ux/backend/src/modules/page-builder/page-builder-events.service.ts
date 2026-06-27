import { Injectable, Logger } from '@nestjs/common';

/**
 * BuilderEventsService — typed event hooks for the Page Builder.
 *
 * Phase 1B: all methods are no-ops. They exist to give future phases a stable
 * call-site to plug into without touching service business logic.
 *
 * Future phases will add implementations for:
 *   Phase 3 — CDN cache tag invalidation on section update/reorder
 *   Phase 4 — Publish versioning, webhook dispatch, analytics events
 *   Phase 5 — Real-time dashboard notifications via WebSocket
 */
@Injectable()
export class BuilderEventsService {
  private readonly logger = new Logger(BuilderEventsService.name);

  /** Fired when a section's config, label, status, or visibility changes. */
  onSectionUpdated(payload: {
    storeId: string;
    pageId: string;
    sectionId: string;
    sectionType: string;
    field: 'config' | 'label' | 'status' | 'isEnabled' | 'goLiveAt' | 'expireAt';
    userId?: string;
  }): void {
    this.logger.debug(
      `[builder.section.updated] store=${payload.storeId} section=${payload.sectionId} ` +
      `type=${payload.sectionType} field=${payload.field} by=${payload.userId ?? 'system'}`,
    );
    // Phase 3+: invalidate CDN cache tag for this section
    // Phase 4+: record in section version history
    // Phase 5+: emit WebSocket event to connected admin clients
  }

  /** Fired when sections are reordered on a page. */
  onSectionsReordered(payload: {
    storeId: string;
    pageId: string;
    sectionCount: number;
    userId?: string;
  }): void {
    this.logger.debug(
      `[builder.sections.reordered] store=${payload.storeId} page=${payload.pageId} ` +
      `count=${payload.sectionCount} by=${payload.userId ?? 'system'}`,
    );
    // Phase 3+: invalidate CDN cache for the full page
  }

  /** Fired when a new page is seeded with its default sections. */
  onPageSeeded(payload: {
    storeId: string;
    pageId: string;
    pageType: string;
    sectionCount: number;
  }): void {
    this.logger.debug(
      `[builder.page.seeded] store=${payload.storeId} page=${payload.pageId} ` +
      `type=${payload.pageType} sections=${payload.sectionCount}`,
    );
    // Phase 3+: trigger default theme config association
    // Phase 4+: notify store owner of homepage readiness
  }

  /** Fired when a page is published (status promoted to LIVE, version incremented). */
  onPagePublished(payload: {
    storeId: string;
    pageId: string;
    pageType: string;
    version: number;
    userId?: string;
  }): void {
    this.logger.debug(
      `[builder.page.published] store=${payload.storeId} page=${payload.pageId} ` +
      `v${payload.version} by=${payload.userId ?? 'system'}`,
    );
    // Phase 4+: full cache bust, deploy static snapshot, audit log
  }

  /** Fired when a draft is saved without publishing. */
  onDraftSaved(payload: {
    storeId: string;
    pageId: string;
    userId?: string;
  }): void {
    this.logger.debug(
      `[builder.draft.saved] store=${payload.storeId} page=${payload.pageId} ` +
      `by=${payload.userId ?? 'system'}`,
    );
    // Phase 4+: snapshot draft state for rollback
  }
}
