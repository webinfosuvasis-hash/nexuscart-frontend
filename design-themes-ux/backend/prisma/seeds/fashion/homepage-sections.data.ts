import { img } from './constants';

/**
 * Config JSON for all 17 Aurus Homepage Builder sections.
 *
 * Shapes were extracted directly from the frontend section components under
 * design-themes-ux/src/themes/aurus/sections/*\/index.tsx (not invented) —
 * unrecognized keys are silently dropped by mergeWithDefaults, so exact field
 * names matter. API-driven sections set `tag` / `categorySlug` so they
 * resolve real seeded products/categories at render time; purely static
 * sections (banners, badges, newsletter, etc.) carry full copy + images here.
 */
export interface HomepageSectionSeed {
  sectionType: string;
  label: string;
  config: Record<string, unknown>;
}

export const HOMEPAGE_SECTIONS: HomepageSectionSeed[] = [
  {
    sectionType: 'hero_banner',
    label: 'Hero Banner Carousel',
    config: {
      slides: [
        {
          id: 'slide-saree-1', type: 'editorial', isEnabled: true,
          backgroundImage: img(0, 1600, 600),
          overlayGradient: { from: '#5B1A1A', fromAlpha: 80, to: '#8B3A3A', toAlpha: 10 },
          eyebrowText: 'New Season', brandName: 'NexusCart Fashion',
          headlineL1: 'Banarasi Silk Sarees', headlineL2: 'Starting ₹2,799', headlineL2Color: '#FEF08A',
          disclaimer: 'Handpicked wedding & festive sarees with free shipping',
          ctaText: 'Shop Sarees', ctaUrl: '/category/sarees',
        },
        {
          id: 'slide-lehenga-2', type: 'editorial', isEnabled: true,
          backgroundImage: img(20, 1600, 600),
          overlayGradient: { from: '#3B0764', fromAlpha: 85, to: '#6D28D9', toAlpha: 10 },
          eyebrowText: 'Bridal Edit', brandName: '',
          headlineL1: 'Wedding Lehengas', headlineL2: 'Up to 30% Off', headlineL2Color: '#FEF08A',
          disclaimer: 'Heavy embroidery, premium silk and velvet — crafted for your big day',
          ctaText: 'Shop Lehengas', ctaUrl: '/category/lehengas',
        },
        {
          id: 'slide-kurti-3', type: 'banner', isEnabled: true,
          src: img(40, 1600, 600), alt: 'Everyday kurtis collection', linkUrl: '/category/kurtis',
        },
        {
          id: 'slide-festive-4', type: 'editorial', isEnabled: true,
          backgroundImage: img(60, 1600, 600),
          overlayGradient: { from: '#0B2118', fromAlpha: 88, to: '#1B4D3E', toAlpha: 10 },
          eyebrowText: 'Festive Special', brandName: '',
          headlineL1: 'Festive Collection', headlineL2: 'New Arrivals Daily', headlineL2Color: '#FEF08A',
          disclaimer: 'Co-ord sets, dupattas and ethnic dresses for every celebration',
          ctaText: 'Explore Now', ctaUrl: '/collection/festive-collection',
        },
      ],
      autoRotate: true, autoRotateSpeed: 4.5, indicatorStyle: 'pill-counter',
      cornerRadius: 16, sideMargin: 24, height: 500, mobileHeight: 300,
    },
  },
  {
    sectionType: 'featured_products',
    label: 'Featured Products',
    config: {
      leftPanel: { image: img(80, 700, 900), overlayOpacity: 30, linkUrl: '/collection/best-sellers' },
      rightPanel: {
        backgroundColor: '#FFF7ED', productSource: 'tag', productIds: [], tag: 'Bestseller', categorySlug: '',
        maxProducts: 12, arrowColor: '#7C2D12', ctaText: 'Shop Bestsellers', ctaUrl: '/collection/best-sellers',
      },
    },
  },
  {
    sectionType: 'campaign_grid',
    label: 'Campaign Grid',
    config: {
      leftPanel: {
        backgroundColor: '#FDF2F8', brandLabel1: 'HANDLOOM', brandLabel2: 'EDIT',
        craftNote: 'Woven by master artisans across India',
        saleHeadline: 'Silk Saree Sale', offerText: 'Flat 25% Off', offerSubtitle: 'On Kanjivaram & Banarasi silk',
        disclaimer: '*Valid on select styles, while stocks last',
      },
      topRight: {
        gradientFrom: '#7C2D12', gradientTo: '#C2410C', brandLabel: 'BRIDAL EDIT',
        headline: 'Wedding Season', headlineSuperscript: '2026',
        subtitle: 'Lehengas crafted for every ceremony', bodyNote: 'Heavy embroidery, mirror & zardozi work',
        disclaimer: 'Shop the full bridal collection', modelImage: img(85, 700, 500),
      },
      bottomRight: {
        backgroundColor: '#ECFDF5', subLabel: 'NEW THIS WEEK',
        headlinePart1: 'Office Wear', headlinePart2: 'Co-ord Sets', ctaText: 'Shop Now', ctaUrl: '/category/office-wear',
      },
    },
  },
  {
    sectionType: 'category_discovery',
    label: 'Category Discovery',
    config: {
      backgroundColor: '#FFFFFF', borderColor: '#F1F5F9', giftIcon: 'gift', giftLabel: 'Gift a Saree',
      items: [
        { label: 'Sarees',           linkUrl: '/category/sarees',            customImage: img(20, 400, 400) },
        { label: 'Kurtis',           linkUrl: '/category/kurtis',            customImage: img(21, 400, 400) },
        { label: 'Lehengas',         linkUrl: '/category/lehengas',          customImage: img(22, 400, 400) },
        { label: 'Co-ord Sets',      linkUrl: '/category/co-ord-sets',       customImage: img(26, 400, 400) },
        { label: 'Wedding Edit',     linkUrl: '/collection/wedding-collection', customImage: img(32, 400, 400) },
        { label: 'Summer Edit',      linkUrl: '/collection/summer-collection',  customImage: img(34, 400, 400) },
      ],
    },
  },
  {
    sectionType: 'category_icons',
    label: 'Category Icons',
    config: {
      items: [
        { name: 'Sarees',            linkUrl: '/category/sarees',            customImage: img(20, 200, 200) },
        { name: 'Kurtis',            linkUrl: '/category/kurtis',            customImage: img(21, 200, 200) },
        { name: 'Lehengas',          linkUrl: '/category/lehengas',          customImage: img(22, 200, 200) },
        { name: 'Shirts',            linkUrl: '/category/shirts',            customImage: img(23, 200, 200) },
        { name: 'Dupattas',          linkUrl: '/category/dupattas',          customImage: img(24, 200, 200) },
        { name: 'Blouses',           linkUrl: '/category/blouses',           customImage: img(25, 200, 200) },
        { name: 'Co-ord Sets',       linkUrl: '/category/co-ord-sets',       customImage: img(26, 200, 200) },
        { name: 'Ethnic Dresses',    linkUrl: '/category/ethnic-dresses',    customImage: img(27, 200, 200) },
        { name: 'Office Wear',       linkUrl: '/category/office-wear',       customImage: img(28, 200, 200) },
        { name: 'Party Wear',        linkUrl: '/category/party-wear',        customImage: img(33, 200, 200) },
      ],
    },
  },
  {
    sectionType: 'trust_badges',
    label: 'Trust Badges',
    config: {
      backgroundColor: '#FAFAF9', borderColor: '#E7E5E4',
      badges: [
        { icon: 'shield',     title: '100% Authentic',     subtitle: 'Certified handloom & designer wear' },
        { icon: 'rotate-ccw', title: '7-Day Easy Returns',  subtitle: 'No questions asked exchange' },
        { icon: 'star',       title: 'Rated 4.6/5',         subtitle: 'By 50,000+ happy customers' },
        { icon: 'phone',      title: '24/7 Support',        subtitle: 'Call, chat or WhatsApp us' },
      ],
    },
  },
  {
    sectionType: 'collections',
    label: 'Shop by Collection',
    config: {
      backgroundColor: '#FFFFFF', heading: 'Shop by Collection', ctaText: 'View All Collections', ctaUrl: '/collections',
      ctaButtonColor: '#7C2D12',
      slots: [
        { id: 'slot-1', customName: 'New Arrivals',       customSubLabel: 'Just In',      customImage: img(50, 700, 900), linkUrl: '/collection/new-arrivals' },
        { id: 'slot-2', customName: 'Wedding Collection',  customSubLabel: 'Bridal Edit',  customImage: img(52, 700, 900), linkUrl: '/collection/wedding-collection' },
        { id: 'slot-3', customName: 'Silk Collection',     customSubLabel: 'Pure Silk',    customImage: img(56, 700, 900), linkUrl: '/collection/silk-collection' },
        { id: 'slot-4', customName: 'Summer Collection',   customSubLabel: 'Stay Cool',    customImage: img(54, 700, 900), linkUrl: '/collection/summer-collection' },
        { id: 'slot-5', customName: 'Festive Collection',  customSubLabel: 'Celebrate',    customImage: img(58, 700, 900), linkUrl: '/collection/festive-collection' },
      ],
    },
  },
  {
    sectionType: 'bridal_section',
    label: 'Bridal Edit',
    config: {
      leftPanel: {
        backgroundImage: img(90, 800, 1000), backgroundColor: '#2D0A0A',
        overlayGradient: { from: '#2D0A0A', fromAlpha: 75, to: '#7C2D12', toAlpha: 15 },
        headlineL1: 'The Bridal Edit', headlineL2: 'Lehengas for your big day',
        ctaText: 'Shop Bridal Lehengas', ctaUrl: '/category/lehengas',
      },
      rightPanel: {
        backgroundColor: '#FFF1F2', arrowColor: '#7C2D12', ctaText: 'View All', ctaUrl: '/category/lehengas',
        productSource: 'category', tag: 'Bridal', categorySlug: 'lehengas', productIds: [], maxProducts: 8,
      },
    },
  },
  {
    sectionType: 'editorial_banners',
    label: 'Editorial Banners',
    config: {
      pages: [
        [
          { backgroundColor: '#FDF2F8', gradientFrom: '#FDF2F8', gradientTo: '#FCE7F3', useGradient: true, headline: 'Festive Glam', headlineStyle: 'serif', subtitle: 'Sequins, sheen and statement colour', ctaText: 'Shop Party Wear', ctaUrl: '/category/party-wear', ctaStyle: 'dark', productImageSlots: [0] },
          { backgroundColor: '#ECFDF5', gradientFrom: '#ECFDF5', gradientTo: '#D1FAE5', useGradient: true, headline: 'Office Edit', headlineStyle: 'sans', subtitle: 'Polished pieces for the workday', ctaText: 'Shop Office Wear', ctaUrl: '/category/office-wear', ctaStyle: 'rounded-dark', productImageSlots: [1] },
          { backgroundColor: '#FFFBEB', gradientFrom: '#FFFBEB', gradientTo: '#FEF3C7', useGradient: true, headline: 'Everyday Cotton', headlineStyle: 'sans', subtitle: 'Breathable fabrics for daily wear', ctaText: 'Shop Cotton', ctaUrl: '/collection/cotton-collection', ctaStyle: 'link', productImageSlots: [2] },
        ],
        [
          { backgroundColor: '#EFF6FF', gradientFrom: '#EFF6FF', gradientTo: '#DBEAFE', useGradient: true, headline: 'Summer Lightweight', headlineStyle: 'sans', subtitle: 'Linen and chiffon for warm days', ctaText: 'Shop Summer', ctaUrl: '/collection/summer-collection', ctaStyle: 'dark', productImageSlots: [3] },
          { backgroundColor: '#FEF2F2', gradientFrom: '#FEF2F2', gradientTo: '#FEE2E2', useGradient: true, headline: 'Wedding Season', headlineStyle: 'serif', subtitle: 'Lehengas and sarees for every ceremony', ctaText: 'Shop Wedding', ctaUrl: '/collection/wedding-collection', ctaStyle: 'rounded-dark', productImageSlots: [4] },
          { backgroundColor: '#F5F3FF', gradientFrom: '#F5F3FF', gradientTo: '#EDE9FE', useGradient: true, headline: 'Casual Comfort', headlineStyle: 'sans', subtitle: 'Easy fits for everyday errands', ctaText: 'Shop Casual', ctaUrl: '/category/casual-wear', ctaStyle: 'link', productImageSlots: [5] },
        ],
      ],
    },
  },
  {
    sectionType: 'store_locator',
    label: 'Store Locator',
    config: {
      backgroundImage: img(95, 1600, 500), headline: 'Find a Store Near You', headlineColor: '#FFFFFF',
      panelBackgroundColor: '#FFFFFF', inputPlaceholder: 'Enter your city or pincode',
      ctaText: 'Locate Store', ctaColor: '#7C2D12',
    },
  },
  {
    sectionType: 'try_at_home',
    label: 'Try At Home & Video Call',
    config: {
      tryAtHome: {
        backgroundImage: img(96, 700, 500), overlayStyle: 'dark',
        headline: 'Try At Home', subheadline: 'Order, try, and pay only for what you keep',
        ctaText: 'Book a Slot', ctaUrl: '/services/try-at-home',
      },
      videoCall: {
        backgroundImage: img(97, 700, 500), overlayStyle: 'purple',
        headline: 'Shop via Video Call', subheadline: 'Get styled live by our fashion experts',
        ctaText: 'Schedule a Call', ctaUrl: '/services/video-call',
      },
    },
  },
  {
    sectionType: 'video_call',
    label: 'Video Call (managed via Try At Home)',
    config: { enabled: true },
  },
  {
    sectionType: 'gift_registry',
    label: 'Gift Registry',
    config: {
      subLabel: 'GIFTING MADE EASY', headline: 'Build a Wedding Gift Registry',
      bodyCopy: 'Create a personalised registry of sarees, lehengas and accessories for your special day. Friends and family can shop directly from your list.',
      occasions: [
        { label: 'Wedding', emoji: '💍' }, { label: 'Engagement', emoji: '💐' },
        { label: 'Baby Shower', emoji: '👶' }, { label: 'Housewarming', emoji: '🏠' },
      ],
      ctaText: 'Create Your Registry', ctaUrl: '/gift-registry',
      socialProof: 'Loved by 10,000+ couples across India',
      steps: [
        { icon: 'list', label: 'Create your list', subtitle: 'Pick your favourite pieces' },
        { icon: 'share', label: 'Share with loved ones', subtitle: 'Send a link via WhatsApp or email' },
        { icon: 'gift', label: 'Receive your gifts', subtitle: 'We ship directly to your doorstep' },
      ],
    },
  },
  {
    sectionType: 'promotional_cards',
    label: 'Promotional Cards',
    config: {
      pages: [
        [
          { gradientFrom: '#7C2D12', gradientTo: '#C2410C', label: 'LIMITED TIME', headline: 'Flat 25% Off Sarees', ctaText: 'Shop Now', ctaUrl: '/category/sarees', ctaStyle: 'rounded', icon: 'tag' },
          { gradientFrom: '#3B0764', gradientTo: '#6D28D9', label: 'BRIDAL EDIT',  headline: 'Lehengas from ₹6,499', ctaText: 'Explore', ctaUrl: '/category/lehengas', ctaStyle: 'square', icon: 'sparkles' },
          { gradientFrom: '#065F46', gradientTo: '#10B981', label: 'NEW IN',       headline: 'Summer Co-ord Sets', ctaText: 'Shop Now', ctaUrl: '/category/co-ord-sets', ctaStyle: 'rounded', icon: 'sun' },
        ],
        [
          { gradientFrom: '#9D174D', gradientTo: '#EC4899', label: 'TRENDING',     headline: 'Festive Dupattas', ctaText: 'Shop Now', ctaUrl: '/category/dupattas', ctaStyle: 'rounded', icon: 'flame' },
          { gradientFrom: '#1E3A8A', gradientTo: '#3B82F6', label: 'WORKWEEK',     headline: 'Office Wear Edit', ctaText: 'Shop Now', ctaUrl: '/category/office-wear', ctaStyle: 'square', icon: 'briefcase' },
          { gradientFrom: '#92400E', gradientTo: '#D97706', label: 'HANDLOOM',     headline: 'Pure Cotton Sarees', ctaText: 'Shop Now', ctaUrl: '/collection/cotton-collection', ctaStyle: 'rounded', icon: 'leaf' },
        ],
        [
          { gradientFrom: '#581C87', gradientTo: '#9333EA', label: 'PARTY READY', headline: 'Sequin Lehengas', ctaText: 'Shop Now', ctaUrl: '/category/lehengas', ctaStyle: 'square', icon: 'sparkles' },
          { gradientFrom: '#134E4A', gradientTo: '#0D9488', label: 'EVERYDAY',     headline: 'Cotton Kurtis Under ₹1,500', ctaText: 'Shop Now', ctaUrl: '/category/kurtis', ctaStyle: 'rounded', icon: 'tag' },
          { gradientFrom: '#7F1D1D', gradientTo: '#DC2626', label: 'WEDDING SZN',  headline: 'Bridal Sarees', ctaText: 'Shop Now', ctaUrl: '/category/sarees', ctaStyle: 'square', icon: 'heart' },
        ],
        [
          { gradientFrom: '#1E1B4B', gradientTo: '#4338CA', label: 'CLASSIC',      headline: 'Formal Shirts for Women', ctaText: 'Shop Now', ctaUrl: '/category/shirts', ctaStyle: 'rounded', icon: 'shirt' },
          { gradientFrom: '#831843', gradientTo: '#DB2777', label: 'GIFT IT',      headline: 'Gift Cards Available', ctaText: 'Buy Now', ctaUrl: '/gift-cards', ctaStyle: 'square', icon: 'gift' },
          { gradientFrom: '#14532D', gradientTo: '#16A34A', label: 'SUSTAINABLE',  headline: 'Handloom Weaves', ctaText: 'Explore', ctaUrl: '/collection/cotton-collection', ctaStyle: 'rounded', icon: 'leaf' },
        ],
      ],
    },
  },
  {
    sectionType: 'expert_help',
    label: 'Expert Help',
    config: {
      backgroundColor: '#FFF7ED',
      storeLocator: {
        storeImage: img(98, 800, 600), overlayOpacity: 35, storeCountText: '120+ stores across India',
        headlineL1: 'Visit a Store', headlineL2: 'Near You', ctaText: 'Find a Store', ctaUrl: '/stores',
      },
      expertCard: {
        backgroundColor: '#FDF2F8', label: 'STYLE ADVICE', headline: 'Talk to a Fashion Expert',
        ctaText: 'Chat Now', ctaUrl: '/services/expert-help',
      },
      videoCard: {
        backgroundColor: '#EFF6FF', label: 'VIRTUAL TRY-ON', headline: 'Shop via Video Call',
        ctaText: 'Schedule a Call', ctaUrl: '/services/video-call',
      },
    },
  },
  {
    sectionType: 'social_ugc',
    label: 'Social UGC',
    config: {
      backgroundColor: '#FFFFFF', label: '#NexusCartStyle', headlineL1: 'Tag Us For a Chance to Win',
      prizeText: 'Win a ₹5,000 Gift Card', subText: 'Share your festive look with our community',
      mosaicImages: [
        { slot: 1, image: img(100, 500, 500), alt: 'Customer wearing a festive saree', linkUrl: '/category/sarees' },
        { slot: 2, image: img(101, 500, 500), alt: 'Customer wearing a wedding lehenga', linkUrl: '/category/lehengas' },
        { slot: 3, image: img(102, 500, 500), alt: 'Customer wearing a printed kurti', linkUrl: '/category/kurtis' },
        { slot: 4, image: img(103, 500, 500), alt: 'Customer styling a dupatta', linkUrl: '/category/dupattas' },
        { slot: 5, image: img(104, 500, 500), alt: 'Customer wearing an office co-ord set', linkUrl: '/category/co-ord-sets' },
        { slot: 6, image: img(105, 500, 500), alt: 'Customer wearing a party saree', linkUrl: '/category/party-wear' },
        { slot: 7, image: img(106, 500, 500), alt: 'Customer wearing a summer kurti', linkUrl: '/collection/summer-collection' },
      ],
      hashtagText: 'Share with', handle: '@NexusCartFashion', textColor: '#1C1917',
    },
  },
  {
    sectionType: 'newsletter',
    label: 'Newsletter',
    config: {
      gradientFrom: '#7C2D12', gradientTo: '#9A3412', label: 'STAY IN STYLE',
      headline: 'Get 10% Off Your First Order', bodyCopy: 'Subscribe for early access to new arrivals, festive sales and styling tips.',
      inputPlaceholder: 'Enter your email address', ctaText: 'Subscribe', ctaButtonColor: '#FEF08A', ctaTextColor: '#7C2D12',
      privacyText: 'By subscribing you agree to our Privacy Policy', privacyUrl: '/privacy-policy',
    },
  },
];
