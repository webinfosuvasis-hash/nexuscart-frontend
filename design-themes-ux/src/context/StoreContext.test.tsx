import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StoreProvider, useStore } from './StoreContext';

const Probe = () => {
  const { theme, wishlist, toggleWishlist } = useStore();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span data-testid="wish">{wishlist.join(',')}</span>
      <button onClick={() => toggleWishlist('p1')}>toggle</button>
    </>
  );
};

describe('StoreContext', () => {
  it('REGRESSION: ignores a stale persisted demo theme — visitors always land on the live Aurus store', () => {
    localStorage.setItem('mt_theme', 'craft');
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(screen.getByTestId('theme')).toHaveTextContent('aurus');
    expect(localStorage.getItem('mt_theme')).toBeNull();
  });

  it('persists the wishlist and toggles items on/off', () => {
    localStorage.setItem('mt_wish', JSON.stringify(['a']));
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(screen.getByTestId('wish')).toHaveTextContent('a');

    act(() => screen.getByText('toggle').click());
    expect(JSON.parse(localStorage.getItem('mt_wish')!)).toEqual(['a', 'p1']);

    act(() => screen.getByText('toggle').click());
    expect(JSON.parse(localStorage.getItem('mt_wish')!)).toEqual(['a']);
  });

  it('survives a corrupted wishlist in storage', () => {
    localStorage.setItem('mt_wish', '{not json');
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(screen.getByTestId('wish')).toHaveTextContent('');
  });
});
