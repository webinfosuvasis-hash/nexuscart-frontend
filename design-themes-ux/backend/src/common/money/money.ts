import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class Money {
  private readonly amount: Decimal;
  readonly currency: string;

  constructor(amount: Decimal | number | string, currency: string) {
    this.amount = new Decimal(amount);
    this.currency = currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  multiplyBy(factor: Decimal | number | string): Money {
    return new Money(this.amount.times(new Decimal(factor)), this.currency);
  }

  percentage(pct: Decimal | number | string): Money {
    return new Money(this.amount.times(new Decimal(pct)).dividedBy(100), this.currency);
  }

  round(dp: 0 | 2 | 4 = 2): Money {
    return new Money(this.amount.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP), this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThan(other.amount);
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.lessThan(other.amount);
  }

  equals(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.equals(other.amount);
  }

  max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.greaterThan(other) ? this : other;
  }

  min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.lessThan(other) ? this : other;
  }

  /**
   * Distribute this amount proportionally across recipients using the
   * Largest Remainder Method. Result always sums to exactly this.amount.
   * Precision is 2 decimal places (paise/cents).
   */
  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) return [];
    const ratioSum = ratios.reduce((a, b) => a + b, 0);
    if (ratioSum === 0) return ratios.map(() => Money.ZERO(this.currency));

    const PRECISION = 2;
    const factor = new Decimal(10).pow(PRECISION);
    const totalUnits = this.amount.times(factor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    const exactShares = ratios.map(r =>
      this.amount.times(r).dividedBy(ratioSum),
    );

    const flooredUnits = exactShares.map(s =>
      s.times(factor).toDecimalPlaces(0, Decimal.ROUND_FLOOR),
    );

    const fractionals = exactShares.map((s, i) =>
      s.times(factor).minus(flooredUnits[i]!),
    );

    const distributed = flooredUnits.reduce((acc, u) => acc.plus(u), new Decimal(0));
    let remaining = totalUnits.minus(distributed).toNumber();

    const ranked = fractionals
      .map((f, i) => ({ i, f }))
      .sort((a, b) => b.f.comparedTo(a.f));

    const finalUnits = flooredUnits.map(u => new Decimal(u));
    for (const { i } of ranked) {
      if (remaining <= 0) break;
      finalUnits[i] = finalUnits[i]!.plus(1);
      remaining--;
    }

    return finalUnits.map(u => new Money(u.dividedBy(factor), this.currency));
  }

  toApiNumber(): number {
    return this.round(2).amount.toNumber();
  }

  toFixed(dp = 2): string {
    return this.amount.toDecimalPlaces(dp).toFixed(dp);
  }

  toString(): string {
    return this.amount.toFixed(4);
  }

  toDecimal(): Decimal {
    return this.amount;
  }

  static ZERO(currency: string): Money {
    return new Money(0, currency);
  }

  static sum(items: Money[], currency: string): Money {
    return items.reduce((acc, m) => acc.add(m), Money.ZERO(currency));
  }

  static fromDecimal(d: Decimal, currency: string): Money {
    return new Money(d, currency);
  }

  static fromApiNumber(n: number, currency: string): Money {
    return new Money(n, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
