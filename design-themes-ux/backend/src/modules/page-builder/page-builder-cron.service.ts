import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BuilderEventsService } from './page-builder-events.service';

/**
 * PageBuilderCronService — scheduled task runner for the Page Builder.
 *
 * Phase S1A: structure only — no active scheduling.
 * Phase S2: implement @Cron() tasks using @nestjs/schedule.
 *
 * Tasks:
 *   activateScheduled  — promote DRAFT → LIVE when goLiveAt <= NOW()
 *   expireScheduled    — disable LIVE → DISABLED when expireAt <= NOW()
 */
@Injectable()
export class PageBuilderCronService {
  private readonly logger = new Logger(PageBuilderCronService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly events:  BuilderEventsService,
  ) {}

  /**
   * Activate sections whose goLiveAt has passed.
   * Called every 60 seconds in Phase S2.
   *
   * @Cron(CronExpression.EVERY_MINUTE)  ← add in Phase S2
   */
  async activateScheduled(): Promise<void> {
    const now = new Date();

    const toActivate = await this.prisma.builderSection.findMany({
      where: {
        status:    'DRAFT',
        isEnabled: true,
        goLiveAt:  { lte: now },
        expireAt:  null,           // skip if already past expiry
      },
      select: { id: true, storeId: true, pageId: true, sectionType: true },
    });

    if (toActivate.length === 0) return;

    await this.prisma.builderSection.updateMany({
      where: { id: { in: toActivate.map(s => s.id) } },
      data:  { status: 'LIVE' },
    });

    this.logger.log(`Activated ${toActivate.length} scheduled section(s)`);

    // Emit event per section for future cache invalidation
    for (const section of toActivate) {
      this.events.onSectionUpdated({
        storeId:     section.storeId,
        pageId:      section.pageId,
        sectionId:   section.id,
        sectionType: section.sectionType,
        field:       'status',
      });
    }
  }

  /**
   * Expire sections whose expireAt has passed.
   * Called every 60 seconds in Phase S2.
   *
   * @Cron(CronExpression.EVERY_MINUTE)  ← add in Phase S2
   */
  async expireScheduled(): Promise<void> {
    const now = new Date();

    const toExpire = await this.prisma.builderSection.findMany({
      where: {
        status:   'LIVE',
        expireAt: { lte: now },
      },
      select: { id: true, storeId: true, pageId: true, sectionType: true },
    });

    if (toExpire.length === 0) return;

    await this.prisma.builderSection.updateMany({
      where: { id: { in: toExpire.map(s => s.id) } },
      data:  { status: 'DISABLED', isEnabled: false },
    });

    this.logger.log(`Expired ${toExpire.length} section(s)`);

    for (const section of toExpire) {
      this.events.onSectionUpdated({
        storeId:     section.storeId,
        pageId:      section.pageId,
        sectionId:   section.id,
        sectionType: section.sectionType,
        field:       'status',
      });
    }
  }
}
