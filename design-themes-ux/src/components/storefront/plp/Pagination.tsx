import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';

interface PaginationProps {
  page:       number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Numbered pagination. Structured so a future infinite-scroll mode can swap this out without touching the data layer. */
const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const items: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('ellipsis');
    items.push(p);
    prev = p;
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-14" aria-label="Pagination">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 disabled:opacity-30 hover:border-purple-400 hover:text-purple-700 transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {items.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-[13px]" style={UI}>…</span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={`w-9 h-9 flex items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
              item === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
            }`}
            style={UI}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 disabled:opacity-30 hover:border-purple-400 hover:text-purple-700 transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};

export default Pagination;
