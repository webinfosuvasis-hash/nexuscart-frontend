import { NotFoundException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { StorefrontCmsService } from './storefront-cms.service';
import { StorefrontCmsController } from './storefront-cms.controller';

const STORE_ID = 'store_1';

describe('StorefrontCmsService', () => {
  const prisma = { cmsPage: { findFirst: jest.fn() } };
  const service = new StorefrontCmsService(prisma as any);

  afterEach(() => jest.clearAllMocks());

  it('returns the published page scoped to the store and slug, sections ordered', async () => {
    const page = { id: 'p1', title: 'About Us', slug: 'about-us', sections: [] };
    prisma.cmsPage.findFirst.mockResolvedValue(page);

    await expect(service.getPublishedPage(STORE_ID, 'about-us')).resolves.toBe(page);

    const args = prisma.cmsPage.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ storeId: STORE_ID, slug: 'about-us', status: 'PUBLISHED' });
    expect(args.select.sections.orderBy).toEqual({ order: 'asc' });
  });

  it('throws 404 when the page is missing or not published (draft never leaks)', async () => {
    prisma.cmsPage.findFirst.mockResolvedValue(null);
    await expect(service.getPublishedPage(STORE_ID, 'draft-page')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StorefrontCmsController', () => {
  it('delegates with the header-resolved storeId and slug', async () => {
    const cms = { getPublishedPage: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const controller = new StorefrontCmsController(cms as any);

    await expect(controller.getPage(STORE_ID, 'about-us')).resolves.toEqual({ id: 'p1' });
    expect(cms.getPublishedPage).toHaveBeenCalledWith(STORE_ID, 'about-us');
  });

  it('is @Public() — no merchant/customer session required', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, StorefrontCmsController)).toBe(true);
  });
});
