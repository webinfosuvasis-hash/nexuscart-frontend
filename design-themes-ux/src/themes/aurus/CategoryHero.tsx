import React from 'react';
import { Link } from 'react-router-dom';
import { inr } from '@/context/StoreContext';
import { UI, SERIF } from './constants';
import type { Breadcrumb } from '@/lib/storefrontApi';

interface CategoryHeroProps {
  title: string;
  /** Supporting sentence — prefers real category copy from the API, falls back to a generic editorial line. */
  description?: string;
  breadcrumbs: Breadcrumb[];
  /** Total product count for this listing — omitted while the count isn't known yet. */
  total?: number;
  /** Distinct brand count in the current facet set — omitted when not meaningful (e.g. still loading). */
  brandCount?: number;
  /** Lowest price in the current facet set, for a "from ₹x" stat. */
  priceFrom?: number;
}

/**
 * CategoryHero — restrained editorial banner for the PLP.
 *
 * Deliberately not a smaller Homepage hero: no carousel, no photography, no
 * HeroAtmosphere. It borrows the Homepage's ink/aqua palette and serif
 * display type so the page reads as a continuation of the same brand, while
 * staying a quiet, static, text-first banner appropriate for a listing page.
 */
const CategoryHero: React.FC<CategoryHeroProps> = ({ title, description, breadcrumbs, total, brandCount, priceFrom }) => {
  const stats: { value: string; label: string }[] = [];
  if (typeof total === 'number') stats.push({ value: total.toLocaleString('en-IN'), label: total === 1 ? 'Design' : 'Designs' });
  if (brandCount) stats.push({ value: brandCount.toLocaleString('en-IN'), label: brandCount === 1 ? 'Brand' : 'Brands' });
  if (typeof priceFrom === 'number' && priceFrom > 0) stats.push({ value: inr(priceFrom), label: 'Onwards' });

  return (
    <section className="relative bg-gradient-to-b from-[#EEF8F5] to-[#F8FBFA] border-b border-[#DEEBE6]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 pt-7 pb-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px] text-[#7A9089] tracking-[0.1em] uppercase" style={UI}>
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={bc.url}>
              {i > 0 && <span className="text-[#C3D6CF]">/</span>}
              {i === breadcrumbs.length - 1
                ? <span className="text-[#4B615A]">{bc.label}</span>
                : <Link to={bc.url} className="hover:text-[#0F6E5C] transition-colors">{bc.label}</Link>}
            </React.Fragment>
          ))}
        </div>

        {/* Title */}
        <h1
          className="mt-2.5 text-[30px] sm:text-[38px] font-light leading-[1.1] text-[#0B2118]"
          style={SERIF}
        >
          {title}
        </h1>

        {/* Supporting sentence */}
        {description && (
          <p className="mt-2.5 max-w-[620px] text-[13.5px] leading-relaxed text-[#5B7169]" style={UI}>
            {description}
          </p>
        )}

        {/* Category statistics */}
        {stats.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 mt-5">
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="hidden sm:block w-px h-3 bg-[#CFE3DC]" />}
                <span className="text-[12px]" style={UI}>
                  <span className="font-semibold text-[#0B2118]">{s.value}</span>{' '}
                  <span className="text-[#7A9089] uppercase tracking-[0.08em]">{s.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoryHero;
