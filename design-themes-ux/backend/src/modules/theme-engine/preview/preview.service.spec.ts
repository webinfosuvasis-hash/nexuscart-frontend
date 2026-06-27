import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PreviewService, PreviewToken } from './preview.service';

const STORE_ID = 'store_abc';
const THEME_ID = 'fresh';
const PAGE_ID  = 'home';

const mockJwt = {
  sign:   jest.fn(),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: any) => {
    if (key === 'PREVIEW_JWT_SECRET')   return 'preview-secret-xxx';
    if (key === 'STOREFRONT_BASE_URL')  return 'http://localhost:8080';
    return fallback;
  }),
};

describe('PreviewService — Sprint 4.5 (themeId in JWT)', () => {
  let service: PreviewService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewService,
        { provide: JwtService,    useValue: mockJwt    },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PreviewService>(PreviewService);
  });

  // ── generatePreviewLink ───────────────────────────────────────────────────

  describe('generatePreviewLink', () => {
    it('includes themeId in the JWT payload', async () => {
      mockJwt.sign.mockReturnValue('signed-token-xyz');
      await service.generatePreviewLink(STORE_ID, THEME_ID, PAGE_ID);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE_ID, themeId: THEME_ID, pageId: PAGE_ID, purpose: 'preview' }),
        expect.any(Object),
      );
    });

    it('returns url pointing to STOREFRONT_BASE_URL', async () => {
      mockJwt.sign.mockReturnValue('tok');
      const result = await service.generatePreviewLink(STORE_ID, THEME_ID, PAGE_ID);
      expect(result.url).toContain('http://localhost:8080');
      expect(result.url).toContain(`/preview/${STORE_ID}/${PAGE_ID}`);
      expect(result.url).toContain('token=tok');
    });

    it('returns themeId in the result', async () => {
      mockJwt.sign.mockReturnValue('tok');
      const result = await service.generatePreviewLink(STORE_ID, THEME_ID, PAGE_ID);
      expect(result.themeId).toBe(THEME_ID);
    });

    it('sets expiresAt 24 hours from now', async () => {
      mockJwt.sign.mockReturnValue('tok');
      const before = Date.now();
      const result = await service.generatePreviewLink(STORE_ID, THEME_ID, PAGE_ID);
      const after  = Date.now();
      const exp    = new Date(result.expiresAt).getTime();
      expect(exp).toBeGreaterThanOrEqual(before + 86400 * 1000 - 100);
      expect(exp).toBeLessThanOrEqual(after  + 86400 * 1000 + 100);
    });

    it('uses PREVIEW_JWT_SECRET not JWT_SECRET', async () => {
      mockJwt.sign.mockReturnValue('tok');
      await service.generatePreviewLink(STORE_ID, THEME_ID, PAGE_ID);
      const signCall = mockJwt.sign.mock.calls[0];
      expect(signCall[1].secret).toBe('preview-secret-xxx');
    });
  });

  // ── verifyToken ───────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    const VALID_TOKEN: PreviewToken = {
      storeId: STORE_ID, themeId: THEME_ID, pageId: PAGE_ID, purpose: 'preview', exp: 9999999999,
    };

    it('returns token payload on valid token', () => {
      mockJwt.verify.mockReturnValue(VALID_TOKEN);
      const result = service.verifyToken('valid-token', STORE_ID);
      expect(result.storeId).toBe(STORE_ID);
      expect(result.themeId).toBe(THEME_ID);
    });

    it('throws UnauthorizedException on invalid token', () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      expect(() => service.verifyToken('bad-token')).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on expired token', () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      expect(() => service.verifyToken('expired-token')).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when purpose is not preview', () => {
      mockJwt.verify.mockReturnValue({ ...VALID_TOKEN, purpose: 'auth' });
      expect(() => service.verifyToken('admin-token')).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when storeId does not match expectedStoreId', () => {
      mockJwt.verify.mockReturnValue(VALID_TOKEN);
      expect(() => service.verifyToken('token', 'different_store')).toThrow(UnauthorizedException);
    });

    it('accepts token without themeId (backward compat — pre-Sprint 4.5 tokens)', () => {
      const legacyToken = { storeId: STORE_ID, pageId: PAGE_ID, purpose: 'preview', exp: 9999999999 };
      mockJwt.verify.mockReturnValue(legacyToken);
      const result = service.verifyToken('legacy-token', STORE_ID);
      expect(result.storeId).toBe(STORE_ID);
      expect(result.themeId).toBeUndefined(); // not present — caller falls back to active theme
    });
  });
});
