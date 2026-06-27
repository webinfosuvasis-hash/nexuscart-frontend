/**
 * Kaveri — Suta-inspired Fashion Starter Theme
 *
 * Category:  Fashion / Saree / Women's Apparel
 * Aesthetic: Editorial · Artisan · Warm-minimal
 * Device:    Mobile-first
 *
 * Homepage sections (13):
 *   01 announcement_bar   — Shipping offer / seasonal message
 *   02 hero               — Full-bleed editorial hero
 *   03 collection_circles — Category navigation (6 circles)
 *   04 featured_collection — New Arrivals (4 products, 3/4 ratio)
 *   05 editorial_banner   — "The Craft Collection" script divider
 *   06 featured_collection — Bestseller Sarees (8 products)
 *   07 product_mosaic     — Curated category showcase
 *   08 featured_collection — Sale Items (4 products)
 *   09 brand_story        — Brand heritage / artisan narrative
 *   10 trust_badges_bar   — 4 trust signals
 *   11 newsletter         — "Stories from the Loom" signup
 *
 * Note: Header and Footer are system sections — they are installed via
 *       HeaderBuilder / FooterBuilder and are NOT included in page sections.
 *
 * All collection bindings are empty (null) — merchant binds via Inspector.
 * All hero/mosaic images are empty — merchant uploads via Inspector.
 * All text is pre-filled with brand voice copy that merchants can edit.
 */

import type { ThemeDefinition } from '../types';

export const kaveri: ThemeDefinition = {

  // ── Metadata ────────────────────────────────────────────────────────────────

  meta: {
    id:           'kaveri',
    name:         'Kaveri',
    version:      '1.0.0',
    category:     'fashion',
    description:  'Elegant editorial theme for sarees, handlooms, and artisan fashion. Mobile-first with rich storytelling sections.',
    previewImage: '/theme-previews/kaveri.jpg',
    tags:         ['mobile-first', 'editorial', 'artisan', 'handloom', 'sarees', 'warm'],
    vertical:     'Saree & Fashion',
    author:       'NexusCart',
    createdAt:    '2026-06-24',
  },

  // ── Color system ─────────────────────────────────────────────────────────────

  colors: {
    primary:    '#2C2420',   // espresso brown
    secondary:  '#F5F0E8',   // warm cream
    accent:     '#D4956A',   // terracotta
    background: '#FEFCF9',   // off-white
    surface:    '#FAF7F2',   // sand
    text:       '#1A1A1A',
    muted:      '#6B6B6B',
  },

  // ── Typography ───────────────────────────────────────────────────────────────

  typography: {
    headingFont: 'Plus Jakarta Sans',
    bodyFont:    'Inter',
    baseSizeRem: 1.0,
    lineHeight:  1.6,
  },

  // ── Pages ────────────────────────────────────────────────────────────────────

  pages: {

    home: {
      pageId:   'home',
      title:    'Home page',
      sections: [

        // ── 01 · Announcement Bar ─────────────────────────────────────────────

        {
          key:   'announcement',
          type:  'announcement_bar',
          label: 'Announcement bar',
          settings: {
            background:      '#2C2420',
            textColor:       '#F5F0E8',
            paddingVertical: 8,
            showOnMobile:    true,
          },
          blocks: [
            {
              type:     'announcement',
              settings: {
                text:          'Free shipping on orders above ₹1,500 · New arrivals every Friday',
                font:          'subheading',
                fontSize:      12,
                textColor:     '#F5F0E8',
                letterSpacing: 'loose',
                textCase:      'uppercase',
              },
            },
          ],
        },

        // ── 02 · Hero Banner ──────────────────────────────────────────────────

        {
          key:   'hero',
          type:  'hero',
          label: 'Hero Banner',
          settings: {
            height:           'lg',
            backgroundColor:  '#2C2420',
            overlayOpacity:   30,
            overlayColor:     '#1A0F0A',
            contentAlignment: 'left',
            contentWidth:     'narrow',
            'spacing.top':    0,
            'spacing.bottom': 0,
          },
          blocks: [
            {
              type:     'heading',
              settings: {
                text:             'Wear the Story',
                typographyPreset: 'h1',
                textColor:        '#F5F0E8',
                width:            'fit',
                maxWidth:         'normal',
              },
            },
            {
              type:     'paragraph',
              settings: {
                text:      'Handcrafted sarees rooted in tradition, worn for today.',
                textColor: '#DDD5CC',
                textSize:  'md',
              },
            },
            {
              type:     'button',
              settings: {
                label:        'Explore Collection',
                link:         '/collections/all',
                style:        'outline',
                size:         'lg',
                borderRadius: 'pill',
                openNewTab:   false,
              },
            },
          ],
        },

        // ── 03 · Category Navigation ──────────────────────────────────────────

        {
          key:   'circles',
          type:  'collection_circles',
          label: 'Category Navigation',
          settings: {
            title:         'Shop by Category',
            circleSize:    96,
            bg:            '#FAF7F2',
            paddingTop:    48,
            paddingBottom: 48,
            items:         [
              { label: 'Sarees',      image: '', link: '/collections/sarees',      color: '#F3E8FF' },
              { label: 'Dupattas',    image: '', link: '/collections/dupattas',    color: '#FEF3C7' },
              { label: 'Fabrics',     image: '', link: '/collections/fabrics',     color: '#DBEAFE' },
              { label: 'Kurta Sets',  image: '', link: '/collections/kurta-sets',  color: '#DCFCE7' },
              { label: 'Gift Sets',   image: '', link: '/collections/gift-sets',   color: '#FDF2F8' },
              { label: 'New Season',  image: '', link: '/collections/new-arrivals',color: '#FFFBEB' },
            ],
          },
          blocks: [],
        },

        // ── 04 · Featured Collection: New Arrivals ────────────────────────────

        {
          key:   'new-arrivals',
          type:  'featured_collection',
          label: 'New Arrivals',
          settings: {
            // collection: null — merchant binds via Inspector (collection_picker)
            productsToShow:  4,
            columnsDesktop:  '4',
            columnsMobile:   '2',
            showViewAll:     true,
            colorScheme:     'scheme-1',
            'spacing.top':   48,
            'spacing.bottom':48,
          },
          blocks: [
            {
              type:     'collection_title',
              settings: {
                text:      'New Arrivals',
                alignment: 'left',
                textColor: '#2C2420',
              },
            },
            {
              type:     'view_all_button',
              settings: {
                label: 'View all new arrivals →',
                style: 'link',
              },
            },
            {
              type:     'product_card',
              settings: {
                showVendor:   false,
                showRating:   true,
                showQuickAdd: true,
                imageRatio:   '3/4',
                hoverEffect:  'zoom',
              },
            },
          ],
        },

        // ── 05 · Editorial Banner ─────────────────────────────────────────────

        {
          key:   'editorial-1',
          type:  'editorial_banner',
          label: 'The Craft Collection',
          settings: {
            scriptText:    'The Craft Collection',
            subtitle:      'Handwoven for generations',
            bg:            '#FDF8F3',
            accentColor:   '#D4956A',
            paddingTop:    32,
            paddingBottom: 32,
          },
          blocks: [],
        },

        // ── 06 · Featured Collection: Best Sellers ────────────────────────────

        {
          key:   'bestsellers',
          type:  'featured_collection',
          label: 'Bestseller Sarees',
          settings: {
            productsToShow:  8,
            columnsDesktop:  '4',
            columnsMobile:   '2',
            showViewAll:     true,
            colorScheme:     'scheme-1',
            'spacing.top':   0,
            'spacing.bottom':48,
          },
          blocks: [
            {
              type:     'collection_title',
              settings: {
                text:      'Bestseller Sarees',
                alignment: 'left',
                textColor: '#2C2420',
              },
            },
            {
              type:     'view_all_button',
              settings: {
                label: 'Shop all bestsellers →',
                style: 'link',
              },
            },
            {
              type:     'product_card',
              settings: {
                showVendor:   false,
                showRating:   true,
                showQuickAdd: true,
                imageRatio:   '3/4',
                hoverEffect:  'swap',
              },
            },
          ],
        },

        // ── 07 · Product Showcase (Mosaic) ────────────────────────────────────

        {
          key:   'mosaic',
          type:  'product_mosaic',
          label: 'Product Showcase',
          settings: {
            bg:            '#FFFFFF',
            paddingTop:    24,
            paddingBottom: 48,
            items: [
              { label: 'The Wedding Edit', image: '', link: '/collections/wedding',  featured: true,  color: '#F3E8FF' },
              { label: 'Banarasi Silks',   image: '', link: '/collections/banarasi', featured: false, color: '#FEF3C7' },
              { label: 'Kanjivaram',       image: '', link: '/collections/kanjivaram',featured: false,color: '#DBEAFE' },
              { label: 'Linen Sarees',     image: '', link: '/collections/linen',    featured: false, color: '#DCFCE7' },
              { label: 'Handloom',         image: '', link: '/collections/handloom', featured: false, color: '#FDF2F8' },
              { label: 'Printed Sarees',   image: '', link: '/collections/printed',  featured: false, color: '#FFF7ED' },
              { label: 'Cotton Sarees',    image: '', link: '/collections/cotton',   featured: false, color: '#F0FDF4' },
            ],
          },
          blocks: [],
        },

        // ── 08 · Featured Collection: Sale ────────────────────────────────────

        {
          key:   'sale',
          type:  'featured_collection',
          label: 'Sale Items',
          settings: {
            productsToShow:  4,
            columnsDesktop:  '4',
            columnsMobile:   '2',
            showViewAll:     true,
            colorScheme:     'scheme-2',
            'spacing.top':   48,
            'spacing.bottom':48,
          },
          blocks: [
            {
              type:     'collection_title',
              settings: {
                text:      'Sale · Up to 40% Off',
                alignment: 'left',
                textColor: '#CC3300',
              },
            },
            {
              type:     'view_all_button',
              settings: {
                label: 'View all sale items →',
                style: 'link',
              },
            },
            {
              type:     'product_card',
              settings: {
                showVendor:   false,
                showRating:   true,
                showQuickAdd: true,
                imageRatio:   '3/4',
                hoverEffect:  'zoom',
              },
            },
          ],
        },

        // ── 09 · Brand Story ──────────────────────────────────────────────────

        {
          key:   'brand-story',
          type:  'brand_story',
          label: 'Our Story',
          settings: {
            title:         'Made with Hands. Worn with Love.',
            body:          'We work with master weavers across India to bring you textiles that carry the weight of generations. Each saree is unique — a conversation between the weaver\'s hands and centuries of tradition. When you wear Kaveri, you become part of that story.',
            bg:            '#F5F0E8',
            paddingTop:    72,
            paddingBottom: 72,
          },
          blocks: [],
        },

        // ── 10 · Trust Badges ─────────────────────────────────────────────────

        {
          key:   'trust',
          type:  'trust_badges_bar',
          label: 'Trust Badges',
          settings: {
            bg:            '#FFFFFF',
            borderColor:   '#E5E7EB',
            paddingTop:    28,
            paddingBottom: 28,
            badges: [
              { icon: '🔒', title: '100% Authentic',       description: 'Directly from master weavers' },
              { icon: '↩️', title: 'Easy 14-Day Returns',  description: 'Hassle-free return policy'    },
              { icon: '🚚', title: 'Free Shipping',         description: 'On orders above ₹1,500'      },
              { icon: '🎧', title: 'Weaving Stories',       description: 'Call +91 80000 00000'         },
            ],
          },
          blocks: [],
        },

        // ── 11 · Newsletter Signup ────────────────────────────────────────────

        {
          key:   'newsletter',
          type:  'newsletter',
          label: 'Newsletter Signup',
          settings: {
            placeholder:     'Your email address',
            buttonLabel:     'Subscribe',
            colorScheme:     'scheme-2',
            'spacing.top':   64,
            'spacing.bottom':64,
          },
          blocks: [
            {
              type:     'heading',
              settings: {
                text:             'Stories from the Loom.',
                typographyPreset: 'h2',
                textColor:        '#2C2420',
              },
            },
            {
              type:     'paragraph',
              settings: {
                text:      'New arrivals, weaving diaries, and 10% off your first order.',
                textColor: '#6B6B6B',
                textSize:  'md',
              },
            },
          ],
        },

      ], // end sections
    },   // end home page

  }, // end pages
};
