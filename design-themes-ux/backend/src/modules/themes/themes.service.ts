import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMarketplaceThemes() {
    return this.prisma.theme.findMany({
      where: { isMarketplace: true },
      orderBy: { name: 'asc' },
    });
  }

  async listInstalledThemes(storeId: string) {
    return this.prisma.storeTheme.findMany({
      where: { storeId },
      include: { theme: true },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getActiveTheme(storeId: string) {
    const activeTheme = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true },
      include: { theme: true },
    });
    return activeTheme;
  }

  async installTheme(storeId: string, themeId: string) {
    const theme = await this.prisma.theme.findUnique({ where: { id: themeId } });
    if (!theme) throw new NotFoundException('Theme not found');

    const existing = await this.prisma.storeTheme.findFirst({
      where: { storeId, themeId },
    });
    if (existing) throw new BadRequestException('Theme already installed');

    return this.prisma.storeTheme.create({
      data: {
        storeId,
        themeId,
        isActive: false,
        settings: theme.defaultSettings ?? {},
        installedAt: new Date(),
      },
      include: { theme: true },
    });
  }

  async activateTheme(storeId: string, storeThemeId: string) {
    const storeTheme = await this.prisma.storeTheme.findFirst({
      where: { id: storeThemeId, storeId },
    });
    if (!storeTheme) throw new NotFoundException('Installed theme not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.storeTheme.updateMany({
        where: { storeId },
        data: { isActive: false },
      });
      return tx.storeTheme.update({
        where: { id: storeThemeId },
        data: { isActive: true, activatedAt: new Date() },
        include: { theme: true },
      });
    });
  }

  async uninstallTheme(storeId: string, storeThemeId: string) {
    const storeTheme = await this.prisma.storeTheme.findFirst({
      where: { id: storeThemeId, storeId },
    });
    if (!storeTheme) throw new NotFoundException('Installed theme not found');
    if (storeTheme.isActive) throw new BadRequestException('Cannot uninstall active theme');

    await this.prisma.storeTheme.delete({ where: { id: storeThemeId } });
    return { message: 'Theme uninstalled' };
  }

  async getThemeSettings(storeId: string) {
    const active = await this.getActiveTheme(storeId);
    return active?.settings ?? {};
  }

  async updateThemeSettings(storeId: string, settings: Record<string, any>) {
    const active = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true },
    });
    if (!active) throw new NotFoundException('No active theme found');

    return this.prisma.storeTheme.update({
      where: { id: active.id },
      data: { settings },
    });
  }
}
