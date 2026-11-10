import type { CmsPage } from '@/lib/storefrontCmsApi';

/**
 * Built-in content for the standard store pages the footer links to.
 *
 * Used only when the merchant hasn't published a CMS page with that slug yet,
 * so a fresh store never shows a 404 for "About Us" or "Privacy Policy".
 * A published CMS page with the same slug always wins.
 */

const text = (id: string, heading: string, content: string) => ({
  id, type: 'rich_text', name: heading, order: 0, settings: { heading, content },
});

const page = (slug: string, title: string, seoDesc: string, sections: CmsPage['sections']): CmsPage => ({
  id: `default-${slug}`, title, slug, seoTitle: null, seoDesc, ogImage: null, publishedAt: null,
  sections: sections.map((s, i) => ({ ...s, order: i })),
});

export const DEFAULT_CMS_PAGES: Record<string, CmsPage> = {
  'about-us': page('about-us', 'About Us', 'Who we are and what we stand for.', [
    text('about-1', 'Our Story',
      'We started with a simple belief: beautiful, well-made clothing should be easy to find and a joy to wear.\n\n' +
      'Every piece in our store is chosen for its craftsmanship, fabric and fit. We work closely with weavers, artisans and trusted labels to bring you collections that celebrate tradition while fitting the way you live today.'),
    text('about-2', 'What We Promise',
      'Genuine products, sourced directly from the makers.\n\nSecure payments and transparent pricing — the price you see is the price you pay.\n\nFriendly support before and after your purchase, and easy returns if something isn\'t right.'),
  ]),

  'contact-us': page('contact-us', 'Contact Us', 'Get in touch with our customer care team.', [
    text('contact-1', 'We\'re Here to Help',
      'Questions about an order, sizing, or a product? Our customer care team is happy to help.\n\n' +
      'For order-related queries, please keep your order number handy — you can find it in My Account → Orders and in your order confirmation email.'),
    text('contact-2', 'Support Hours', 'Monday to Saturday, 10:00 AM – 7:00 PM IST. We aim to reply to every message within one business day.'),
  ]),

  'shipping-policy': page('shipping-policy', 'Shipping Policy', 'Delivery timelines and shipping charges.', [
    text('ship-1', 'Delivery Timelines',
      'Orders are usually dispatched within 1–2 business days. Delivery typically takes 3–7 business days depending on your location.\n\n' +
      'Once your order ships, you can track it from My Account → Orders.'),
    text('ship-2', 'Shipping Charges', 'Shipping charges, if any, are shown at checkout before you pay.'),
  ]),

  'return-policy': page('return-policy', 'Returns & Refunds', 'How returns, exchanges and refunds work.', [
    text('ret-1', 'Easy Returns',
      'If you are not completely happy with your purchase, you can request a return within 7 days of delivery. Items must be unused, unwashed and in their original packaging with tags attached.\n\n' +
      'You can cancel an order that has not yet shipped from My Account → Orders.'),
    text('ret-2', 'Refunds', 'Once we receive and inspect the returned item, refunds are issued to the original payment method, usually within 5–7 business days.'),
  ]),

  'privacy-policy': page('privacy-policy', 'Privacy Policy', 'How we collect, use and protect your information.', [
    text('priv-1', 'Information We Collect',
      'We collect the information you provide when you create an account, place an order or contact us — such as your name, email, phone number and delivery address.'),
    text('priv-2', 'How We Use It',
      'Your information is used to process and deliver orders, provide customer support and, with your consent, send you updates and offers.\n\n' +
      'We never sell your personal information. Payments are processed by secure, PCI-compliant payment partners; we do not store your card details.'),
  ]),

  'terms-and-conditions': page('terms-and-conditions', 'Terms & Conditions', 'The terms that apply when you use this store.', [
    text('terms-1', 'Using This Store',
      'By using this website and placing an order, you agree to these terms. Prices and availability may change without notice. We make every effort to display products accurately, but colours may vary slightly depending on your screen.'),
    text('terms-2', 'Orders', 'An order is confirmed once payment is successful and you receive a confirmation email. We may cancel an order in rare cases such as stock unavailability, in which case any amount paid is refunded in full.'),
  ]),

  faq: page('faq', 'Frequently Asked Questions', 'Answers to common questions about orders, shipping and returns.', [
    {
      id: 'faq-1', type: 'faq', name: 'FAQ', order: 0, settings: {
        title: 'Frequently Asked Questions',
        items: [
          { question: 'How do I track my order?', answer: 'Sign in and go to My Account → Orders, then choose "Track" on your order.' },
          { question: 'Can I cancel my order?', answer: 'Yes — orders that have not shipped yet can be cancelled from My Account → Orders.' },
          { question: 'What payment methods do you accept?', answer: 'We accept UPI, credit and debit cards, net banking and popular wallets.' },
          { question: 'How do returns work?', answer: 'Request a return within 7 days of delivery. See our Returns & Refunds page for details.' },
        ],
      },
    },
  ]),
};

/** Common alternative slugs merchants and menus use for the same page. */
const ALIASES: Record<string, string> = {
  about: 'about-us', 'our-story': 'about-us',
  contact: 'contact-us',
  shipping: 'shipping-policy',
  returns: 'return-policy', 'returns-policy': 'return-policy', 'refund-policy': 'return-policy',
  privacy: 'privacy-policy',
  terms: 'terms-and-conditions', 'terms-of-service': 'terms-and-conditions',
  faqs: 'faq',
};

export function getDefaultCmsPage(slug: string): CmsPage | null {
  return DEFAULT_CMS_PAGES[slug] ?? DEFAULT_CMS_PAGES[ALIASES[slug]] ?? null;
}
