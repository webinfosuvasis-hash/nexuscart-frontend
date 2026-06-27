import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Pages ───────────────────────────────────────────────────────────────────

  async listPages(storeId: string, query: any) {
    const { page = 1, limit = 20, status } = query;
    const where: any = { storeId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.cmsPage.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { sections: true } } },
      }),
      this.prisma.cmsPage.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPage(storeId: string, id: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { id, storeId },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async createPage(storeId: string, dto: any) {
    const slug = dto.slug || slugify(dto.title, { lower: true, strict: true });
    const { sections, ...pageData } = dto;

    return this.prisma.cmsPage.create({
      data: {
        ...pageData,
        slug,
        storeId,
        sections: sections?.length ? { create: sections } : undefined,
      },
      include: { sections: true },
    });
  }

  async updatePage(storeId: string, id: string, dto: any) {
    await this.getPage(storeId, id);
    const { sections, ...pageData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (sections) {
        await tx.pageSection.deleteMany({ where: { pageId: id } });
        await tx.pageSection.createMany({
          data: sections.map((s: any, i: number) => ({ ...s, pageId: id, order: i })),
        });
      }
      return tx.cmsPage.update({
        where: { id },
        data: { ...pageData, updatedAt: new Date() },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async publishPage(storeId: string, id: string) {
    await this.getPage(storeId, id);
    return this.prisma.cmsPage.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async removePage(storeId: string, id: string) {
    await this.getPage(storeId, id);
    await this.prisma.cmsPage.delete({ where: { id } });
    return { message: 'Page deleted' };
  }

  // ─── Menus ───────────────────────────────────────────────────────────────────

  async listMenus(storeId: string) {
    return this.prisma.menu.findMany({
      where: { storeId },
      include: { items: { orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' } } } } },
    });
  }

  async createMenu(storeId: string, dto: any) {
    const { items, ...menuData } = dto;
    return this.prisma.menu.create({
      data: {
        ...menuData,
        storeId,
        items: items?.length ? { create: items } : undefined,
      },
      include: { items: true },
    });
  }

  async updateMenu(storeId: string, id: string, dto: any) {
    const menu = await this.prisma.menu.findFirst({ where: { id, storeId } });
    if (!menu) throw new NotFoundException('Menu not found');
    const { items, ...menuData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.menuItem.deleteMany({ where: { menuId: id, parentId: null } });
        for (const item of items) {
          await tx.menuItem.create({ data: { ...item, menuId: id } });
        }
      }
      return tx.menu.update({ where: { id }, data: menuData, include: { items: true } });
    });
  }

  async removeMenu(storeId: string, id: string) {
    const menu = await this.prisma.menu.findFirst({ where: { id, storeId } });
    if (!menu) throw new NotFoundException('Menu not found');
    await this.prisma.menu.delete({ where: { id } });
    return { message: 'Menu deleted' };
  }

  // ─── Blog Posts ──────────────────────────────────────────────────────────────

  async listBlogPosts(storeId: string, query: any) {
    const { page = 1, limit = 20, status, tag } = query;
    const where: any = { storeId };
    if (status) where.status = status;
    if (tag) where.tags = { has: tag };

    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true, thumbnail: true,
          publishedAt: true, tags: true, author: { select: { name: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getBlogPost(storeId: string, id: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { id, storeId },
      include: { author: { select: { name: true, email: true } } },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async createBlogPost(storeId: string, dto: any, authorId: string) {
    const slug = dto.slug || slugify(dto.title, { lower: true, strict: true });
    return this.prisma.blogPost.create({
      data: { ...dto, slug, storeId, authorId },
    });
  }

  async updateBlogPost(storeId: string, id: string, dto: any) {
    await this.getBlogPost(storeId, id);
    return this.prisma.blogPost.update({ where: { id }, data: dto });
  }

  async publishBlogPost(storeId: string, id: string) {
    await this.getBlogPost(storeId, id);
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async removeBlogPost(storeId: string, id: string) {
    await this.getBlogPost(storeId, id);
    await this.prisma.blogPost.delete({ where: { id } });
    return { message: 'Blog post deleted' };
  }
}
