declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      cartSessionId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolvedCart?: any;
      traceId?: string;
      spanId?: string;
      correlationId?: string;
      requestId?: string;
    }
  }
}

export {};
