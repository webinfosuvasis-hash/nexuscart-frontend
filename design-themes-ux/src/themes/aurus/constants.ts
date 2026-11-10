export const NAV_ITEMS = [
  'Sarees', 'Kurtas & Sets', 'Blouses', 'Lehenga', 'Dupattas',
  'Co-ord Sets', 'Festive Edit', 'Collections', 'New Arrivals', 'Gifting', 'Trending',
];

/**
 * Fallback nav targets — used only when the store has no live menu (or the
 * menu API is down). Keyword search, not hardcoded category slugs: slugs
 * differ per store, and a wrong slug renders "Category not found", whereas a
 * search always resolves (worst case to an empty result set).
 */
export const NAV_LINKS: Record<string, string> = {
  'Sarees':        '/search?q=saree',
  'Kurtas & Sets': '/search?q=kurti',
  'Blouses':       '/search?q=blouse',
  'Lehenga':       '/search?q=lehenga',
  'Dupattas':      '/search?q=dupatta',
  'Co-ord Sets':   '/search?q=co-ord',
  'Festive Edit':  '/search?q=festive',
  'Collections':   '/jewellery',
  'New Arrivals':  '/jewellery?sortBy=newest',
  'Gifting':       '/search?q=gift',
  'Trending':      '/jewellery?sortBy=popularity',
};

export const GARMENT_MENU = {
  featured: ['New Arrivals', 'Bestsellers', 'Festive Picks', 'Sale'],
  byStyle: [
    'All Sarees', 'Wedding Sarees', 'Daily Wear', 'Bridal', 'Printed',
    'Silk Sarees', 'Cotton Sarees', 'Handloom', 'Embroidered', 'Designer',
  ],
  byFabric: [
    ['🟡', 'Pure Silk'],  ['🟤', 'Cotton'],   ['🟠', 'Linen'],
    ['🔵', 'Chiffon'],   ['🌸', 'Georgette'], ['✨', 'Kanjivaram'],
    ['💫', 'Chanderi'],  ['🟣', 'Banarasi'],  ['⬜', 'Organza'],
    ['🌿', 'Mulmul'],
  ] as [string, string][],
  byBudget: [
    'Under ₹999', '₹999 – ₹2,999', '₹3,000 – ₹5,000',
    '₹5,000 – ₹10,000', '₹10,000 & Above',
  ],
};

export const UI   = { fontFamily: 'system-ui, -apple-system, sans-serif' };
export const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };
