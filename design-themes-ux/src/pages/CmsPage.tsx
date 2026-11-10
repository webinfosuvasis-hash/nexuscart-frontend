import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AurusHeader from '@/themes/aurus/AurusHeader';
import AurusFooter from '@/themes/aurus/AurusFooter';
import { UI, SERIF } from '@/themes/aurus/constants';
import { AppProvider } from '@/contexts/AppContext';
import { fetchCmsPage, ApiError, type CmsPage as CmsPageData, type CmsPageSection } from '@/lib/storefrontCmsApi';
import { getDefaultCmsPage } from '@/data/defaultCmsPages';
import { absoluteUrl } from '@/lib/seo';

/**
 * CmsPage — `/pages/:slug` (About Us, Contact, policies…).
 *
 * Renders the merchant's PUBLISHED CMS page. When none exists (404), falls
 * back to the built-in content for standard pages so a fresh store never
 * 404s on its footer links; any other slug shows an in-theme not-found state.
 */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Only same-site paths and http(s) URLs — never `javascript:` etc. from free-form CMS JSON. */
const safeHref = (v: unknown): string | null => {
  const s = str(v);
  return s.startsWith('/') && !s.startsWith('//') ? s : /^https?:\/\//i.test(s) ? s : null;
};

/** Plain-text paragraphs (blank-line separated). CMS text is never injected as HTML. */
const Paragraphs: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/\n\s*\n/).map((p, i) => (
      <p key={i} className="text-[14px] leading-relaxed text-gray-600 mb-3 whitespace-pre-line">{p.trim()}</p>
    ))}
  </>
);

interface ListItem { question?: unknown; answer?: unknown; title?: unknown; description?: unknown; desc?: unknown; text?: unknown }

export const CmsSection: React.FC<{ section: CmsPageSection }> = ({ section }) => {
  const s = section.settings ?? {};
  const heading = str(s.heading) || str(s.title);
  const subtitle = str(s.subtitle);
  const body = str(s.content) || str(s.body) || str(s.text) || str(s.description);
  const image = safeHref(s.image) ?? safeHref(s.imageUrl);
  const ctaLabel = str(s.cta) || str(s.buttonText);
  const ctaHref = safeHref(s.ctaLink) ?? safeHref(s.buttonLink) ?? safeHref(s.link);
  const items = (Array.isArray(s.items) ? s.items : []) as ListItem[];

  if (!heading && !subtitle && !body && !image && !items.length && !(ctaLabel && ctaHref)) return null;

  return (
    <section className="mb-10" data-section-type={section.type}>
      {heading && <h2 className="text-[22px] font-semibold text-gray-900 mb-2" style={SERIF}>{heading}</h2>}
      {subtitle && <p className="text-[13px] text-gray-500 mb-4">{subtitle}</p>}
      {image && <img src={image} alt={heading || section.name} className="w-full rounded-xl mb-5 object-cover max-h-[420px]" loading="lazy" />}
      {body && <Paragraphs text={body} />}
      {items.length > 0 && (
        <div className="divide-y divide-gray-100 border-y border-gray-100">
          {items.map((it, i) => {
            const q = str(it.question) || str(it.title);
            const a = str(it.answer) || str(it.description) || str(it.desc) || str(it.text);
            if (!q && !a) return null;
            return (
              <details key={i} className="group py-3">
                <summary className="cursor-pointer list-none flex justify-between items-center text-[14px] font-medium text-gray-900">
                  {q}<span className="text-purple-700 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                {a && <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{a}</p>}
              </details>
            );
          })}
        </div>
      )}
      {ctaLabel && ctaHref && (
        ctaHref.startsWith('/')
          ? <Link to={ctaHref} className="inline-block mt-2 bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg">{ctaLabel}</Link>
          : <a href={ctaHref} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg">{ctaLabel}</a>
      )}
    </section>
  );
};

const CmsPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [search, setSearch] = useState('');

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['storefront', 'cms-page', slug],
    queryFn: () => fetchCmsPage(slug),
    enabled: !!slug,
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  const fallback = getDefaultCmsPage(slug);
  const isNotFound = error instanceof ApiError && error.status === 404;
  // A real CMS page always wins; built-in content covers "not published yet" and API outages.
  const page: CmsPageData | null = data ?? (error ? fallback : null);

  let content: React.ReactNode;
  if (isLoading && slug) {
    content = <div className="py-24 text-center text-[13px] text-gray-400" aria-busy="true">Loading…</div>;
  } else if (page) {
    content = (
      <>
        <h1 className="text-[34px] font-semibold text-gray-900 mb-8" style={SERIF}>{page.title}</h1>
        {page.sections.map((s) => <CmsSection key={s.id} section={s} />)}
      </>
    );
  } else if (isNotFound || !slug) {
    content = (
      <div className="py-20 text-center">
        <p className="text-[48px] font-semibold text-purple-700" style={SERIF}>404</p>
        <h1 className="text-[20px] font-semibold text-gray-900 mt-2">Page not found</h1>
        <p className="text-[13px] text-gray-500 mt-2">The page you're looking for doesn't exist or is no longer available.</p>
        <Link to="/" className="inline-block mt-6 bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg">Back to Home</Link>
      </div>
    );
  } else {
    content = (
      <div className="py-20 text-center">
        <h1 className="text-[20px] font-semibold text-gray-900">We couldn't load this page</h1>
        <p className="text-[13px] text-gray-500 mt-2">Please check your connection and try again.</p>
        <button onClick={() => refetch()} className="mt-6 bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg">Try again</button>
      </div>
    );
  }

  const title = page ? `${page.seoTitle || page.title} | Aurus` : 'Page not found | Aurus';

  return (
    <AppProvider>
      <Helmet>
        <title>{title}</title>
        {page?.seoDesc && <meta name="description" content={page.seoDesc} />}
        {page && <link rel="canonical" href={absoluteUrl(`/pages/${page.slug}`)} />}
        {!page && !isLoading && <meta name="robots" content="noindex" />}
      </Helmet>
      <div className="min-h-screen bg-white flex flex-col" style={UI}>
        <AurusHeader searchQuery={search} onSearchChange={setSearch} />
        <main className="flex-1 w-full max-w-[860px] mx-auto px-4 sm:px-6 py-10">{content}</main>
        <AurusFooter />
      </div>
    </AppProvider>
  );
};

export default CmsPage;
