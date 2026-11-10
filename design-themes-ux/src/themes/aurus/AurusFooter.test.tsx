import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import AurusFooter from './AurusFooter';
import { mockFetch, ok, fail, route, renderWithProviders } from '@/test/utils';

describe('AurusFooter', () => {
  it('builds Shop/Collections from the live catalog and always shows Help/Company', async () => {
    mockFetch(
      route('/storefront/menus/footer-menu', () => ok(null)),
      route('/storefront/categories', () => ok({ categories: [{ id: '1', name: 'Sarees', slug: 'sarees', img: '' }] })),
      route('/storefront/collections', () => ok({ collections: [{ id: '2', name: 'Wedding', slug: 'wedding-collection', image: null, isFeatured: true }] })),
    );

    renderWithProviders(<AurusFooter />);

    expect(await screen.findByRole('link', { name: 'Sarees' })).toHaveAttribute('href', '/category/sarees');
    expect(await screen.findByRole('link', { name: 'Wedding' })).toHaveAttribute('href', '/collection/wedding-collection');
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/pages/about-us');
    expect(screen.getByRole('link', { name: 'Track Order' })).toHaveAttribute('href', '/account/orders');
  });

  it('never renders dead "#" links', async () => {
    mockFetch(() => fail(500));
    const { container } = renderWithProviders(<AurusFooter />);
    await screen.findByRole('link', { name: 'Contact Us' });
    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it('still renders Help/Company when the catalog API fails', async () => {
    mockFetch(() => fail(500));
    renderWithProviders(<AurusFooter />);
    const help = await screen.findByRole('navigation', { name: 'Help' });
    expect(within(help).getAllByRole('link').length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: 'Shop' })).not.toBeInTheDocument();
  });

  it('a merchant "footer-menu" replaces the default columns', async () => {
    mockFetch(
      route('/storefront/menus/footer-menu', () => ok({
        id: 'm', handle: 'footer-menu', name: 'Footer', items: [
          { id: 'a', label: 'Customer Care', url: '', linkType: 'EXTERNAL_URL', megaMenu: null, children: [
            { id: 'b', label: 'Size Guide', url: '/pages/size-guide', linkType: 'CMS_PAGE', megaMenu: null, children: [] },
            { id: 'c', label: 'Instagram', url: 'https://instagram.com/x', linkType: 'EXTERNAL_URL', megaMenu: null, children: [] },
          ] },
        ],
      })),
      route('/storefront/categories', () => ok({ categories: [] })),
      route('/storefront/collections', () => ok({ collections: [] })),
    );

    renderWithProviders(<AurusFooter />);

    expect(await screen.findByRole('navigation', { name: 'Customer Care' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Size Guide' })).toHaveAttribute('href', '/pages/size-guide');
    const ig = screen.getByRole('link', { name: 'Instagram' });
    expect(ig).toHaveAttribute('target', '_blank');
    expect(ig).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument();
  });
});
