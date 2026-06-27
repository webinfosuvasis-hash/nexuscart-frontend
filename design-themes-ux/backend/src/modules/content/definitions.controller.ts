import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard }  from '@/common/guards/jwt-auth.guard';
import { ComponentKind } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('content/definitions')
export class DefinitionsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /content/definitions/components
   * Returns ComponentDefinition catalogue for the Insert panel.
   * Replaces GET /theme-engine/definitions/sections for primitive types.
   * Includes both built-in platform primitives (storeId=null) and any
   * store-custom primitives.
   */
  @Get('components')
  async listComponents(
    @Query('storeId') storeId?: string,
    @Query('kind')    kind?:    string,
  ) {
    const where: any = {
      isActive: true,
      OR: [
        { storeId: null },               // built-in platform primitives
        ...(storeId ? [{ storeId }] : []), // store-custom primitives
      ],
    };

    if (kind && Object.values(ComponentKind).includes(kind as ComponentKind)) {
      where.kind = kind as ComponentKind;
    }

    const defs = await this.prisma.componentDefinition.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id:              true,
        kind:            true,
        name:            true,
        icon:            true,
        category:        true,
        description:     true,
        settingsSchema:  true,
        acceptsChildren: true,
        allowedChildren: true,
        providesContext: true,
        interactive:     true,
        schemaVersion:   true,
        isBuiltIn:       true,
        storeId:         true,
      },
    });

    // Group by category for the Insert panel
    const grouped: Record<string, typeof defs> = {};
    for (const def of defs) {
      const cat = def.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(def);
    }

    return { definitions: defs, grouped };
  }
}
