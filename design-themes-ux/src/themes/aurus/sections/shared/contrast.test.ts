import { describe, it, expect } from 'vitest';
import { prefersDarkText, readableTextOn } from './contrast';

describe('readable text on configured section backgrounds', () => {
  it('uses dark text on the pale pink/blue cards configured on the live store', () => {
    expect(readableTextOn('#fdf2f8')).toBe('#1f2937');
    expect(readableTextOn('#EFF6FF')).toBe('#1f2937');
    expect(readableTextOn('rgb(253, 242, 248)')).toBe('#1f2937');
  });

  it('keeps white text on the dark cards the sections were designed for', () => {
    expect(readableTextOn('#1a1230')).toBe('#ffffff');
    expect(readableTextOn('#4c1d95')).toBe('#ffffff');
  });

  it('picks the higher-contrast option on mid tones (#F2899D: dark 6.2:1 vs white 2.4:1)', () => {
    expect(prefersDarkText('#F2899D')).toBe(true);
  });

  it('leaves gradients, images and unknown values on the original light text', () => {
    expect(readableTextOn('linear-gradient(135deg, #fff, #000)')).toBe('#ffffff');
    expect(readableTextOn(undefined)).toBe('#ffffff');
    expect(readableTextOn('purple')).toBe('#ffffff');
  });
});
