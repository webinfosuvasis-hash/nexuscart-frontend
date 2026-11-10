import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import CmsPage from './CmsPage';
import { mockFetch, ok, fail, route, renderWithProviders } from '@/test/utils';

// The header needs the full cart/auth/store provider stack — not what's under test here.
vi.mock('@/themes/aurus/AurusHeader', () => ({ default: () => <header data-testid="header" /> }));

const footerApis = [
  route('/storefront/menus/footer-menu', () => ok(null)),
  route('/storefront/categories', () => ok({ categories: [] })),
  route('/storefront/collections', () => ok({ collections: [] })),
];

const renderAt = (path: string) => renderWithProviders(<CmsPage />, { path, routePath: '/pages/:slug' });

describe('CmsPage (/pages/:slug)', () => {
  it('renders a published CMS page with its sections in order', async () => {
    mockFetch(
      route('/storefront/pages/about-us', () => ok({
        id: 'p1', title: 'About Our House', slug: 'about-us', seoTitle: null, seoDesc: 'desc', ogImage: null, publishedAt: null,
        sections: [
          { id: 's1', type: 'rich_text', name: 'Intro', order: 0, settings: { heading: 'Since 1998', content: 'Para one.\n\nPara two.' } },
          { id: 's2', type: 'faq', name: 'FAQ', order: 1, settings: { title: 'Questions', items: [{ question: 'Q1?', answer: 'A1.' }] } },
        ],
      })),
      ...footerApis,
    );

    renderAt('/pages/about-us');

    expect(await screen.findByRole('heading', { level: 1, name: 'About Our House' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Since 1998' })).toBeInTheDocument();
    expect(screen.getByText('Para one.')).toBeInTheDocument();
    expect(screen.getByText('Para two.')).toBeInTheDocument();
    expect(screen.getByText('Q1?')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('REGRESSION: /pages/about-us shows built-in About Us content when the store has not published one (was a 404)', async () => {
    mockFetch(route('/storefront/pages/about-us', () => fail(404)), ...footerApis);

    renderAt('/pages/about-us');

    expect(await screen.findByRole('heading', { level: 1, name: 'About Us' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our Story' })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('resolves common slug aliases (e.g. /pages/about) to the built-in page', async () => {
    mockFetch(route('/storefront/pages/about', () => fail(404)), ...footerApis);
    renderAt('/pages/about');
    expect(await screen.findByRole('heading', { level: 1, name: 'About Us' })).toBeInTheDocument();
  });

  it('shows an in-theme 404 (with header + footer) for an unknown slug', async () => {
    mockFetch(route('/storefront/pages/no-such-page', () => fail(404)), ...footerApis);
    renderAt('/pages/no-such-page');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  // 5xx is retried once (~1s) before falling back — hence the longer waits below.
  it('falls back to built-in content when the API is down for a standard page', async () => {
    mockFetch(route('/storefront/pages/privacy-policy', () => fail(500)), ...footerApis);
    renderAt('/pages/privacy-policy');
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('shows a retry state (not a 404) when the API is down for a custom page', async () => {
    mockFetch(route('/storefront/pages/lookbook', () => fail(500)), ...footerApis);
    renderAt('/pages/lookbook');
    expect(await screen.findByRole('button', { name: 'Try again' }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('never renders CMS text as HTML and drops javascript: links (XSS-safe)', async () => {
    mockFetch(
      route('/storefront/pages/x', () => ok({
        id: 'p', title: 'X', slug: 'x', seoTitle: null, seoDesc: null, ogImage: null, publishedAt: null,
        sections: [
          { id: 's1', type: 'rich_text', name: 'n', order: 0, settings: { heading: 'H', content: '<img src=x onerror=alert(1)>', cta: 'Evil', ctaLink: 'javascript:alert(1)' } },
          { id: 's2', type: 'hero', name: 'n', order: 1, settings: { title: 'Hero', cta: 'Shop', ctaLink: '/category/sarees' } },
        ],
      })),
      ...footerApis,
    );

    const { container } = renderAt('/pages/x');

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(screen.queryByText('Evil')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/category/sarees');
  });

  it('skips sections with no renderable content instead of leaving empty blocks', async () => {
    mockFetch(
      route('/storefront/pages/y', () => ok({
        id: 'p', title: 'Y', slug: 'y', seoTitle: null, seoDesc: null, ogImage: null, publishedAt: null,
        sections: [{ id: 's1', type: 'product_grid', name: 'Grid', order: 0, settings: { limit: 8 } }, { id: 's2', type: 'x', name: 'n', order: 1, settings: null }],
      })),
      ...footerApis,
    );
    const { container } = renderAt('/pages/y');
    await screen.findByRole('heading', { level: 1, name: 'Y' });
    expect(container.querySelectorAll('main section')).toHaveLength(0);
  });
});
