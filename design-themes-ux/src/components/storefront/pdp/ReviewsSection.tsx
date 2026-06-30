import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { UI, SERIF } from '@/themes/aurus/constants';
import { useProductReviews } from '@/hooks/useProductReviews';
import StarRow from './StarRow';

interface ReviewsSectionProps {
  productId:   string;
  rating:      number;
  reviewCount: number;
}

const RATING_ROWS = [5, 4, 3, 2, 1] as const;

const ReviewsSection: React.FC<ReviewsSectionProps> = ({ productId, rating, reviewCount }) => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProductReviews(productId, { page, limit: 6 });

  const reviews = data?.reviews ?? [];
  const pagination = data?.pagination;
  const breakdown = data?.ratingBreakdown;

  return (
    <section className="bg-[#FAFAF8] border-t border-gray-200 py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5">
        <div className="flex items-center justify-between mb-7 flex-wrap gap-4">
          <h2 className="text-[22px] font-semibold text-gray-900" style={UI}>Customer Reviews</h2>
          <button
            disabled
            title="Sign in to write a review"
            className="border border-gray-300 text-gray-400 px-5 py-2.5 text-[12px] font-bold tracking-wide rounded-sm cursor-not-allowed"
            style={UI}
          >
            WRITE A REVIEW
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 mb-8 pb-7 border-b border-gray-200">
          <div className="text-center flex-shrink-0">
            <p className="text-[52px] font-light text-gray-900 leading-none" style={SERIF}>{rating || '—'}</p>
            <StarRow r={rating} size={16} />
            <p className="text-[12px] text-gray-500 mt-1" style={UI}>{reviewCount} Reviews</p>
          </div>

          {reviewCount > 0 && breakdown && (
            <div className="flex-1 space-y-2" style={UI}>
              {RATING_ROWS.map((star) => {
                const pct = breakdown[String(star) as '5' | '4' | '3' | '2' | '1'];
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-[12px] text-gray-600 w-4 text-right">{star}</span>
                    <Star className="w-3 h-3 fill-[#F5A623] text-[#F5A623] flex-shrink-0" />
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-[#F5A623] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400 w-8">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {reviewCount === 0 ? (
          <p className="text-[13px] text-gray-500 py-6" style={UI}>No reviews yet for this product.</p>
        ) : isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-white border border-gray-200 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-[12px] text-gray-500 mb-5" style={UI}>
              Showing {reviews.length ? (pagination!.page - 1) * pagination!.limit + 1 : 0}–{(pagination!.page - 1) * pagination!.limit + reviews.length} of{' '}
              <span className="font-semibold text-gray-700">{pagination?.total}</span> reviews
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {reviews.map((rv) => (
                <div key={rv.id} className="bg-white border border-gray-200 rounded-sm p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[13px] font-bold text-purple-700">{rv.author[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div>
                          <span className="text-[13px] font-semibold text-gray-800" style={UI}>{rv.author}</span>
                          {rv.isVerified && (
                            <span className="ml-2 text-[10px] bg-[#E8F5E9] text-[#1B5E20] font-semibold px-2 py-0.5 rounded-full" style={UI}>
                              Verified Buyer
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400" style={UI}>
                          {new Date(rv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StarRow r={rv.rating} size={12} />
                      </div>
                    </div>
                  </div>
                  {rv.title && <p className="text-[13px] font-semibold text-gray-800 mt-3 mb-1" style={UI}>{rv.title}</p>}
                  {rv.body && <p className="text-[12px] text-gray-600 leading-relaxed" style={UI}>{rv.body}</p>}
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8" style={UI}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center text-[13px] rounded-sm transition-all border ${
                      p === pagination.page ? 'bg-purple-700 text-white border-purple-700' : 'text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default ReviewsSection;
