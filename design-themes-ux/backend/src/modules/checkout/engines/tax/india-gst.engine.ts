import { Injectable } from '@nestjs/common';
import {
  ICheckoutTaxEngine,
  CheckoutTaxInput,
  CheckoutTaxResult,
  CheckoutTaxBreakdown,
  TaxComponent,
} from './checkout-tax.interface';

// GST rate map: taxCategory → rate (percent). 0 = exempt.
const GST_RATE_MAP: Record<string, number> = {
  gst_0:   0,
  gst_5:   5,
  gst_12: 12,
  gst_18: 18,
  gst_28: 28,
  exempt:  0,
};

const DEFAULT_GST_RATE = 18;

@Injectable()
export class IndiaGSTEngine implements ICheckoutTaxEngine {
  async compute(_storeId: string, input: CheckoutTaxInput): Promise<CheckoutTaxResult> {
    const isIntraState = (
      input.deliveryState?.toUpperCase().trim() ===
      input.storeState.toUpperCase().trim()
    );
    const taxType = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

    const lineTaxes: Record<string, number> = {};
    const breakdownMap = new Map<string, { type: string; rate: number; amount: number }>();

    let totalTax = 0;

    for (const item of input.items) {
      const rawRate  = item.taxCategory ? (GST_RATE_MAP[item.taxCategory] ?? DEFAULT_GST_RATE) : DEFAULT_GST_RATE;
      const gstRate  = rawRate;
      const taxable  = item.lineTotal;
      const lineTax  = round2(taxable * gstRate / 100);

      lineTaxes[item.itemId] = lineTax;
      totalTax += lineTax;

      if (isIntraState) {
        const half = round2(lineTax / 2);
        accumulate(breakdownMap, 'CGST', gstRate / 2, half);
        accumulate(breakdownMap, 'SGST', gstRate / 2, lineTax - half);
      } else {
        accumulate(breakdownMap, 'IGST', gstRate, lineTax);
      }
    }

    const breakdown: CheckoutTaxBreakdown[] = [];
    for (const [key, entry] of breakdownMap.entries()) {
      breakdown.push({ label: key, type: entry.type as any, rate: entry.rate, amount: round2(entry.amount) });
    }
    breakdown.sort((a, b) => a.label.localeCompare(b.label));

    return { totalTax: round2(totalTax), breakdown, lineTaxes, taxType };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function accumulate(
  map:    Map<string, { type: string; rate: number; amount: number }>,
  type:   string,
  rate:   number,
  amount: number,
): void {
  const key = `${type}_${rate}`;
  const existing = map.get(key);
  if (existing) {
    existing.amount += amount;
  } else {
    map.set(key, { type, rate, amount });
  }
}
