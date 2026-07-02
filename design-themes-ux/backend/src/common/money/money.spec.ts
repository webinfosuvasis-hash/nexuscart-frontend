import { Money } from './money';

describe('Money', () => {
  describe('arithmetic', () => {
    it('adds same-currency amounts', () => {
      expect(new Money(100, 'INR').add(new Money(50, 'INR')).toApiNumber()).toBe(150);
    });

    it('subtracts same-currency amounts', () => {
      expect(new Money(100, 'INR').subtract(new Money(30.5, 'INR')).toApiNumber()).toBe(69.5);
    });

    it('multiplies by scalar', () => {
      expect(new Money(99.99, 'INR').multiplyBy(3).toApiNumber()).toBe(299.97);
    });

    it('computes percentage', () => {
      expect(new Money(1000, 'INR').percentage(18).toApiNumber()).toBe(180);
    });

    it('throws on currency mismatch in add', () => {
      expect(() => new Money(100, 'INR').add(new Money(50, 'USD'))).toThrow('Currency mismatch');
    });

    it('throws on currency mismatch in subtract', () => {
      expect(() => new Money(100, 'INR').subtract(new Money(50, 'USD'))).toThrow('Currency mismatch');
    });
  });

  describe('comparisons', () => {
    it('greaterThan', () => {
      expect(new Money(100, 'INR').greaterThan(new Money(50, 'INR'))).toBe(true);
      expect(new Money(50, 'INR').greaterThan(new Money(100, 'INR'))).toBe(false);
    });

    it('lessThan', () => {
      expect(new Money(50, 'INR').lessThan(new Money(100, 'INR'))).toBe(true);
    });

    it('equals', () => {
      expect(new Money(100, 'INR').equals(new Money(100, 'INR'))).toBe(true);
      expect(new Money(100, 'INR').equals(new Money(100.001, 'INR'))).toBe(false);
    });

    it('isZero', () => {
      expect(Money.ZERO('INR').isZero()).toBe(true);
      expect(new Money(0.001, 'INR').isZero()).toBe(false);
    });

    it('max returns the larger', () => {
      const a = new Money(200, 'INR');
      const b = new Money(150, 'INR');
      expect(a.max(b).toApiNumber()).toBe(200);
    });

    it('min returns the smaller', () => {
      expect(new Money(200, 'INR').min(new Money(150, 'INR')).toApiNumber()).toBe(150);
    });
  });

  describe('static helpers', () => {
    it('ZERO creates zero money', () => {
      const z = Money.ZERO('INR');
      expect(z.isZero()).toBe(true);
      expect(z.currency).toBe('INR');
    });

    it('sum of empty array is zero', () => {
      expect(Money.sum([], 'INR').isZero()).toBe(true);
    });

    it('sum of multiple amounts', () => {
      const items = [new Money(100, 'INR'), new Money(200, 'INR'), new Money(50.5, 'INR')];
      expect(Money.sum(items, 'INR').toApiNumber()).toBe(350.5);
    });
  });

  describe('allocate (Largest Remainder Method)', () => {
    it('distributes evenly when divisible', () => {
      const result = new Money(150, 'INR').allocate([500, 300, 200]);
      expect(result.map(m => m.toApiNumber())).toEqual([75, 45, 30]);
      const total = result.reduce((a, b) => a.add(b), Money.ZERO('INR'));
      expect(total.toApiNumber()).toBe(150);
    });

    it('distributes with remainder assigned to largest fractional', () => {
      // 100 / 3 = 33.333... each; remainder 1 paise goes to first
      const result = new Money(100, 'INR').allocate([1, 1, 1]);
      const nums = result.map(m => m.toApiNumber());
      const total = nums.reduce((a, b) => a + b, 0);
      expect(Math.round(total * 100)).toBe(10000); // exactly 100.00
      expect(nums.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
      // One element gets the extra penny
      expect(nums.filter(n => n === 33.34)).toHaveLength(1);
      expect(nums.filter(n => n === 33.33)).toHaveLength(2);
    });

    it('handles unequal ratios with remainder', () => {
      // 10 across [3, 3, 3] = 3.333... each
      const result = new Money(10, 'INR').allocate([3, 3, 3]);
      const total = result.reduce((a, b) => a.add(b), Money.ZERO('INR'));
      expect(total.toApiNumber()).toBe(10);
    });

    it('returns array of zeros when all ratios are zero', () => {
      const result = new Money(100, 'INR').allocate([0, 0, 0]);
      expect(result.every(m => m.isZero())).toBe(true);
    });

    it('returns empty array for empty ratios', () => {
      expect(new Money(100, 'INR').allocate([])).toHaveLength(0);
    });

    it('single recipient gets full amount', () => {
      const result = new Money(99.99, 'INR').allocate([1]);
      expect(result[0]!.toApiNumber()).toBe(99.99);
    });

    it('real-world discount distribution — 150 across 4 items', () => {
      // Items: 500, 300, 200, 100 → total 1100
      const result = new Money(150, 'INR').allocate([500, 300, 200, 100]);
      const total = result.reduce((a, b) => a.add(b), Money.ZERO('INR'));
      expect(total.toApiNumber()).toBe(150);
    });

    it('each result has the same currency as source', () => {
      const result = new Money(100, 'USD').allocate([1, 2, 3]);
      expect(result.every(m => m.currency === 'USD')).toBe(true);
    });
  });

  describe('serialization', () => {
    it('toApiNumber rounds to 2 decimal places', () => {
      expect(new Money(99.9950001, 'INR').toApiNumber()).toBe(100);
      expect(new Money(99.994, 'INR').toApiNumber()).toBe(99.99);
    });

    it('toString returns 4dp string', () => {
      expect(new Money(100, 'INR').toString()).toBe('100.0000');
    });

    it('toFixed returns specified dp', () => {
      expect(new Money(100.12345, 'INR').toFixed(4)).toBe('100.1235');
    });
  });
});
