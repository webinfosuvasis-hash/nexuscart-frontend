import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { StorefrontMenuController } from './storefront-menu.controller';
import { StorefrontMenuService } from './storefront-menu.service';

const STORE_ID = 'store_1';

describe('StorefrontMenuController', () => {
  let controller: StorefrontMenuController;
  let service: jest.Mocked<StorefrontMenuService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorefrontMenuController],
      providers: [
        { provide: StorefrontMenuService, useValue: { getDefaultMenu: jest.fn(), getMenuByHandle: jest.fn() } },
      ],
    }).compile();

    controller = module.get(StorefrontMenuController);
    service = module.get(StorefrontMenuService);
  });

  afterEach(() => jest.clearAllMocks());

  it('getDefaultMenu() delegates with the header-resolved storeId', async () => {
    const menu = { id: 'm1', handle: 'main-menu', name: 'Main', items: [] };
    service.getDefaultMenu.mockResolvedValue(menu);

    const result = await controller.getDefaultMenu(STORE_ID);

    expect(service.getDefaultMenu).toHaveBeenCalledWith(STORE_ID);
    expect(result).toBe(menu);
  });

  it('getMenuByHandle() delegates with the storeId and handle param', async () => {
    const menu = { id: 'm2', handle: 'footer-menu', name: 'Footer', items: [] };
    service.getMenuByHandle.mockResolvedValue(menu);

    const result = await controller.getMenuByHandle(STORE_ID, 'footer-menu');

    expect(service.getMenuByHandle).toHaveBeenCalledWith(STORE_ID, 'footer-menu');
    expect(result).toBe(menu);
  });

  it('returns null (not an error) when no menu/config exists — both routes pass it straight through', async () => {
    service.getDefaultMenu.mockResolvedValue(null);
    service.getMenuByHandle.mockResolvedValue(null);

    expect(await controller.getDefaultMenu(STORE_ID)).toBeNull();
    expect(await controller.getMenuByHandle(STORE_ID, 'missing')).toBeNull();
  });

  describe('security wiring', () => {
    it('is marked @Public() at the class level — store isolation comes from X-Store-Id, not a merchant/customer session', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, StorefrontMenuController)).toBe(true);
    });
  });
});
