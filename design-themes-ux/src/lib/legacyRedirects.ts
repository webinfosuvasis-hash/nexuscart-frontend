/**
 * Legacy / conventional URLs that Page Builder sections, menus or old links
 * may still point at (some are saved in the DB). Redirected to the real
 * route instead of 404ing.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/collections':          '/jewellery',
  '/products':             '/jewellery',
  '/shop':                 '/jewellery',
  '/gift-registry':        '/registry',
  '/about-us':             '/pages/about-us',
  '/contact-us':           '/pages/contact-us',
  '/faq':                  '/pages/faq',
  '/privacy-policy':       '/pages/privacy-policy',
  '/terms-and-conditions': '/pages/terms-and-conditions',
  '/shipping-policy':      '/pages/shipping-policy',
  '/return-policy':        '/pages/return-policy',
  // Store-visit / consultation CTAs have no dedicated pages yet — send to Contact Us.
  '/stores':               '/pages/contact-us',
  '/store-locator':        '/pages/contact-us',
  '/try-at-home':          '/pages/contact-us',
  '/services/*':           '/pages/contact-us',
};
