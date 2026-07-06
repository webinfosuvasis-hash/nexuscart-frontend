import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Mock Node built-ins BEFORE the service is imported so the service receives
// the mocked versions of https / http.
// ---------------------------------------------------------------------------
jest.mock('https', () => ({ request: jest.fn() }));
jest.mock('http',  () => ({ request: jest.fn() }));

import * as https from 'https';
import * as http  from 'http';
import { CancellationEventListenerService } from '../order-cancellation.event-listeners.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAYLOAD: Record<string, unknown> = {
  orderId:              'order-1',
  storeId:              'store-1',
  paymentTransactionId: 'tx-1',
  refundId:             'refund-1',
  reason:               'gateway timeout',
};

function makeClientRequest(overrides: Partial<{
  statusCode: number;
  onError:    boolean;
  onTimeout:  boolean;
}> = {}) {
  const { statusCode = 200, onError = false, onTimeout = false } = overrides;

  const mockRes = { statusCode, resume: jest.fn() };

  const mockReq = {
    write:      jest.fn(),
    end:        jest.fn(),
    destroy:    jest.fn(),
    setTimeout: jest.fn().mockImplementation((ms: number, cb: () => void) => {
      if (onTimeout) cb();          // fire timeout immediately in test
    }),
    on: jest.fn().mockImplementation((event: string, cb: (e: Error) => void) => {
      if (event === 'error' && onError) cb(new Error('ECONNREFUSED'));
      return mockReq;
    }),
  };

  (https.request as jest.Mock).mockImplementation((_opts: unknown, cb: (res: typeof mockRes) => void) => {
    if (!onTimeout && !onError) cb(mockRes);
    return mockReq;
  });

  return { mockReq, mockRes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CancellationEventListenerService — P1 regression tests', () => {
  let service: CancellationEventListenerService;
  let config:  jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationEventListenerService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(CancellationEventListenerService);
    config  = module.get(ConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── handleRefundFailed ───────────────────────────────────────────────────

  describe('handleRefundFailed', () => {
    it('TEST-P1-1a: logs error with [OPERATIONAL ALERT] prefix', async () => {
      config.get.mockReturnValue(undefined);
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.handleRefundFailed(PAYLOAD);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OPERATIONAL ALERT]'),
      );
    });

    it('TEST-P1-1b: logs message containing orderId and storeId', async () => {
      config.get.mockReturnValue(undefined);
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.handleRefundFailed(PAYLOAD);

      const call = (errorSpy.mock.calls[0][0] as string);
      expect(call).toContain('order-1');
      expect(call).toContain('store-1');
    });

    it('TEST-P1-1c: delegates to sendOpsAlert with the composed message and payload', async () => {
      config.get.mockReturnValue(undefined);
      const alertSpy = jest
        .spyOn(service as any, 'sendOpsAlert')
        .mockResolvedValue(undefined);

      await service.handleRefundFailed(PAYLOAD);

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('REFUND_FAILED'),
        PAYLOAD,
      );
    });
  });

  // ── sendOpsAlert — no URL configured ────────────────────────────────────

  describe('sendOpsAlert — OPS_ALERT_WEBHOOK_URL not set', () => {
    it('TEST-P1-1d: logs a warn mentioning OPS_ALERT_WEBHOOK_URL', async () => {
      config.get.mockReturnValue(undefined);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await (service as any).sendOpsAlert('test-message', PAYLOAD);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OPS_ALERT_WEBHOOK_URL'),
      );
    });

    it('TEST-P1-1e: does NOT call https.request when URL is not set', async () => {
      config.get.mockReturnValue(undefined);

      await (service as any).sendOpsAlert('test-message', PAYLOAD);

      expect(https.request).not.toHaveBeenCalled();
      expect(http.request).not.toHaveBeenCalled();
    });
  });

  // ── sendOpsAlert — URL configured, happy path ───────────────────────────

  describe('sendOpsAlert — OPS_ALERT_WEBHOOK_URL set', () => {
    it('TEST-P1-1f: calls https.request with POST method for an https URL', async () => {
      config.get.mockReturnValue('https://hooks.slack.com/services/T/B/key');
      const { mockReq } = makeClientRequest();

      await (service as any).sendOpsAlert('msg', PAYLOAD);

      expect(https.request).toHaveBeenCalledTimes(1);
      const opts = (https.request as jest.Mock).mock.calls[0][0];
      expect(opts.method).toBe('POST');
      expect(opts.hostname).toBe('hooks.slack.com');
      expect(mockReq.end).toHaveBeenCalledTimes(1);
    });

    it('TEST-P1-1g: serialises body with severity=CRITICAL and timestamp', async () => {
      config.get.mockReturnValue('https://hooks.slack.com/services/T/B/key');
      const { mockReq } = makeClientRequest();

      await (service as any).sendOpsAlert('alert-message', PAYLOAD);

      const writtenBody = (mockReq.write.mock.calls[0][0] as string);
      const parsed = JSON.parse(writtenBody);
      expect(parsed.severity).toBe('CRITICAL');
      expect(parsed.text).toBe('alert-message');
      expect(parsed.payload).toEqual(PAYLOAD);
      expect(typeof parsed.timestamp).toBe('string');
    });

    it('TEST-P1-1h: resolves without throwing on HTTP 4xx response', async () => {
      config.get.mockReturnValue('https://hooks.slack.com/services/T/B/key');
      makeClientRequest({ statusCode: 500 });
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        (service as any).sendOpsAlert('msg', PAYLOAD),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 500'),
      );
    });

    it('TEST-P1-1i: resolves without throwing on network error (ECONNREFUSED)', async () => {
      config.get.mockReturnValue('https://hooks.slack.com/services/T/B/key');
      makeClientRequest({ onError: true });

      await expect(
        (service as any).sendOpsAlert('msg', PAYLOAD),
      ).resolves.toBeUndefined();
    });
  });

  // ── handleOrderCancelled / handleInventoryReleased unchanged ─────────────

  describe('INT-1 / INT-2 listeners — no regression', () => {
    it('TEST-P1-2a: handleOrderCancelled does not call sendOpsAlert', async () => {
      const alertSpy = jest
        .spyOn(service as any, 'sendOpsAlert')
        .mockResolvedValue(undefined);

      await service.handleOrderCancelled({
        orderId: 'order-1',
        storeId: 'store-1',
        paymentAction: 'CANCELLED',
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('TEST-P1-2b: handleInventoryReleased does not call sendOpsAlert', async () => {
      const alertSpy = jest
        .spyOn(service as any, 'sendOpsAlert')
        .mockResolvedValue(undefined);

      await service.handleInventoryReleased({
        reservationId: 'res-1',
        orderId:       'order-1',
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
