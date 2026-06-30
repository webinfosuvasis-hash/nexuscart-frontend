import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UI } from '@/themes/aurus/constants';
import FilterGroup from './FilterGroup';
import FilterPrice from './FilterPrice';
import FilterColor from './FilterColor';
import FilterSize from './FilterSize';
import type { ProductFacets, FacetOption, PriceFacet } from '@/lib/storefrontApi';
import type { UseFiltersResult } from '@/hooks/useFilters';

const KNOWN_KEYS = new Set(['category', 'brand', 'collection', 'price', 'color', 'size', 'badge', 'rating', 'availability', 'discount']);

function attributeGroups(facets: ProductFacets): { slug: string; label: string; options: FacetOption[] }[] {
  return Object.entries(facets)
    .filter(([key]) => !KNOWN_KEYS.has(key))
    .map(([slug, options]) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      options: options as FacetOption[],
    }))
    .filter((g) => g.options.length > 0);
}

interface FilterSidebarProps {
  facets: ProductFacets | undefined;
  filterState: UseFiltersResult;
  /** When true, hides the Category facet (e.g. while already viewing a single category page). */
  hideCategory?: boolean;
}

/** Composes all FilterGroup/FilterCheckbox/FilterPrice/FilterColor/FilterSize blocks into the left filter panel. */
const FilterSidebar: React.FC<FilterSidebarProps> = ({ facets, filterState, hideCategory }) => {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: true, brand: true, price: true, color: true, size: false,
  });
  const toggleOpen = (key: string) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (!facets) {
    return (
      <div style={{ paddingTop: 28 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ height: 18, background: '#F3F3F3', borderRadius: 4, marginBottom: 14, width: `${60 + (i % 3) * 10}%` }} />
        ))}
      </div>
    );
  }

  const attrGroups = attributeGroups(facets);

  return (
    <div className="filter-scroll max-h-[calc(100vh-160px)] overflow-y-auto">
      {!hideCategory && (
        <FilterGroup
          label="Category" options={facets.category}
          onToggle={(v) => navigate(`/category/${v}`)}
          open={!!openSections.category} onToggleOpen={() => toggleOpen('category')}
        />
      )}

      <FilterGroup
        label="Brand" options={facets.brand}
        onToggle={(v) => filterState.setBrand(filterState.filters.brandSlug === v ? undefined : v)}
        open={!!openSections.brand} onToggleOpen={() => toggleOpen('brand')} searchable
      />

      <FilterGroup
        label="Collection" options={facets.collection}
        onToggle={(v) => filterState.setCollection(filterState.filters.collectionSlug === v ? undefined : v)}
        open={!!openSections.collection} onToggleOpen={() => toggleOpen('collection')} searchable
      />

      <div style={{ borderBottom: '1px solid #F0F0F0' }}>
        <button
          onClick={() => toggleOpen('price')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 0', background: 'none', border: 'none', cursor: 'pointer', ...UI }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#222222', letterSpacing: '0.01em', ...UI }}>Price</span>
        </button>
        {openSections.price && <FilterPrice facet={facets.price} onApply={filterState.setPriceRange} />}
      </div>

      {facets.color.length > 0 && (
        <div style={{ borderBottom: '1px solid #F0F0F0' }}>
          <button
            onClick={() => toggleOpen('color')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 0', background: 'none', border: 'none', cursor: 'pointer', ...UI }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#222222', letterSpacing: '0.01em', ...UI }}>Color</span>
          </button>
          {openSections.color && <FilterColor options={facets.color} onToggle={(v) => filterState.toggleMulti('color', v)} />}
        </div>
      )}

      {facets.size.length > 0 && (
        <div style={{ borderBottom: '1px solid #F0F0F0' }}>
          <button
            onClick={() => toggleOpen('size')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 0', background: 'none', border: 'none', cursor: 'pointer', ...UI }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#222222', letterSpacing: '0.01em', ...UI }}>Size</span>
          </button>
          {openSections.size && <FilterSize options={facets.size} onToggle={(v) => filterState.toggleMulti('size', v)} />}
        </div>
      )}

      {attrGroups.map((g) => (
        <FilterGroup
          key={g.slug} label={g.label} options={g.options}
          onToggle={(v) => filterState.toggleAttr(g.slug, v)}
          open={!!openSections[g.slug]} onToggleOpen={() => toggleOpen(g.slug)}
        />
      ))}

      <FilterGroup
        label="Badges" options={facets.badge} onToggle={(v) => filterState.toggleMulti('badge', v)}
        open={!!openSections.badge} onToggleOpen={() => toggleOpen('badge')}
      />

      <FilterGroup
        label="Customer Rating" options={facets.rating}
        onToggle={(v) => filterState.setRating(filterState.filters.rating === Number(v) ? undefined : Number(v))}
        open={!!openSections.rating} onToggleOpen={() => toggleOpen('rating')}
      />

      <FilterGroup
        label="Availability" options={facets.availability}
        onToggle={() => filterState.setInStock(!filterState.filters.inStock)}
        open={!!openSections.availability} onToggleOpen={() => toggleOpen('availability')}
      />

      <FilterGroup
        label="Discount" options={facets.discount}
        onToggle={(v) => filterState.setDiscountMin(filterState.filters.discountMin === Number(v) ? undefined : Number(v))}
        open={!!openSections.discount} onToggleOpen={() => toggleOpen('discount')}
      />
    </div>
  );
};

export default FilterSidebar;
