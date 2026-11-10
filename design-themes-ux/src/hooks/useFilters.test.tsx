import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React from 'react';
import { useFilters } from './useFilters';

function setup(url: string, categorySlug?: string) {
  let location!: ReturnType<typeof useLocation>;
  const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  const hook = renderHook(() => {
    location = useLocation();
    return useFilters(categorySlug);
  }, { wrapper });
  return { hook, search: () => new URLSearchParams(location.search) };
}

describe('useFilters — URL ⇄ filter state', () => {
  it('parses every supported param from a shared URL', () => {
    const { hook } = setup('/category/sarees?color=Red,Blue&size=M&brand=biba&q=silk&priceMin=500&priceMax=2000&attr_fabric=Silk,Cotton&inStock=true&rating=4&discountMin=20&sortBy=price_asc&page=3', 'sarees');
    expect(hook.result.current.filters).toMatchObject({
      categorySlug: 'sarees', color: ['Red', 'Blue'], size: ['M'], brandSlug: 'biba', q: 'silk',
      priceMin: 500, priceMax: 2000, attr: { fabric: ['Silk', 'Cotton'] }, inStock: true,
      rating: 4, discountMin: 20, sortBy: 'price_asc', page: 3,
    });
  });

  it('ignores malformed numbers and unknown sort values instead of sending NaN to the API', () => {
    const { hook } = setup('/jewellery?page=abc&priceMin=xyz&priceMax=-5&rating=&sortBy=hacker');
    const f = hook.result.current.filters;
    expect(f.page).toBe(1);
    expect(f.priceMin).toBeUndefined();
    expect(f.priceMax).toBeUndefined();
    expect(f.rating).toBeUndefined();
    expect(f.sortBy).toBeUndefined();
  });

  it('clamps page to a positive integer', () => {
    expect(setup('/jewellery?page=0').hook.result.current.filters.page).toBe(1);
    expect(setup('/jewellery?page=2.7').hook.result.current.filters.page).toBe(2);
  });

  it('toggling a filter adds/removes it and resets to page 1', () => {
    const { hook, search } = setup('/jewellery?page=4');
    act(() => hook.result.current.toggleMulti('color', 'Red'));
    expect(search().get('color')).toBe('Red');
    expect(search().get('page')).toBeNull();
    act(() => hook.result.current.toggleMulti('color', 'Blue'));
    expect(search().get('color')).toBe('Red,Blue');
    act(() => hook.result.current.toggleMulti('color', 'Red'));
    expect(search().get('color')).toBe('Blue');
    act(() => hook.result.current.toggleMulti('color', 'Blue'));
    expect(search().has('color')).toBe(false);
  });

  it('setPage keeps filters and omits page=1 from the URL', () => {
    const { hook, search } = setup('/jewellery?color=Red');
    act(() => hook.result.current.setPage(2));
    expect(search().get('page')).toBe('2');
    expect(search().get('color')).toBe('Red');
    act(() => hook.result.current.setPage(1));
    expect(search().has('page')).toBe(false);
  });

  it('builds removable chips for every active filter', () => {
    const { hook, search } = setup('/jewellery?color=Red&attr_fabric=Silk&priceMin=100&inStock=true&rating=4');
    const labels = hook.result.current.activeChips.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['Red', 'Silk', 'In Stock', '4★ & above', '₹100 – ₹∞']));
    expect(hook.result.current.totalActive).toBe(5);

    const price = hook.result.current.activeChips.find((c) => c.paramKey === 'price')!;
    act(() => hook.result.current.removeChip(price));
    expect(search().has('priceMin')).toBe(false);

    const silk = hook.result.current.activeChips.find((c) => c.value === 'Silk')!;
    act(() => hook.result.current.removeChip(silk));
    expect(search().has('attr_fabric')).toBe(false);
  });

  it('clearAll drops filters but keeps the keyword search', () => {
    const { hook, search } = setup('/search?q=saree&color=Red&size=M&page=2');
    act(() => hook.result.current.clearAll());
    expect([...search().keys()]).toEqual(['q']);
    expect(search().get('q')).toBe('saree');
  });

  it('setSearch trims and removes empty queries', () => {
    const { hook, search } = setup('/search?q=old');
    act(() => hook.result.current.setSearch('  kurti  '));
    expect(search().get('q')).toBe('kurti');
    act(() => hook.result.current.setSearch('   '));
    expect(search().has('q')).toBe(false);
  });
});
