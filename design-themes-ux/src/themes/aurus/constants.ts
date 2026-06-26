export const NAV_ITEMS = [
  'Sarees', 'Kurtas & Sets', 'Blouses', 'Lehenga', 'Dupattas',
  'Co-ord Sets', 'Festive Edit', 'Collections', 'New Arrivals', 'Gifting', 'Trending',
];

export const NAV_LINKS: Record<string, string> = {
  'Sarees':        '/jewellery/sarees',
  'Kurtas & Sets': '/jewellery/kurtas',
  'Blouses':       '/jewellery/blouses',
  'Lehenga':       '/jewellery/lehenga',
  'Dupattas':      '/jewellery/dupattas',
  'Co-ord Sets':   '/jewellery/coord-sets',
  'Festive Edit':  '/jewellery/festive',
  'Collections':   '/jewellery/collections',
  'New Arrivals':  '/jewellery/new-arrivals',
  'Gifting':       '/jewellery/gifting',
  'Trending':      '/jewellery/trending',
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
