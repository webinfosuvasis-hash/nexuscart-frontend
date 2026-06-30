/**
 * HeroSkeleton — loading placeholder for the Aurus Hero Banner Carousel.
 *
 * Matches the EXACT dimensions and margins of HeroSection so the page
 * layout does not shift when the real hero replaces it:
 *   - height: 500px  (same as config.height default)
 *   - mx-6 sm:mx-8 mt-4 rounded-2xl  (identical to hero section classnames)
 *
 * The slide indicator placeholder below also matches the 32px height of
 * the pill/dot indicator bar, preventing cumulative layout shift.
 */

import React from 'react';

const HeroSkeleton: React.FC = () => (
  <>
    {/* Hero container — identical dimensions to HeroSection */}
    <div
      className="relative overflow-hidden bg-gray-200 dark:bg-slate-800 mx-6 sm:mx-8 mt-4 rounded-2xl animate-pulse"
      style={{ height: '500px' }}
      role="progressbar"
      aria-label="Loading hero banner"
      aria-busy="true"
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
    </div>

    {/* Slide indicator placeholder — matches the indicator bar height */}
    <div className="bg-white py-2 flex items-center justify-center gap-2.5" style={{ height: '32px' }}>
      <div className="bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" style={{ width: '28px', height: '20px' }} />
      {[0, 1].map(i => (
        <div key={i} className="w-[9px] h-[9px] rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
      ))}
    </div>
  </>
);

export default HeroSkeleton;
