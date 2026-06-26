import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { useRegistry, OCCASIONS, OccasionKey } from '@/context/RegistryContext';
import { PRODUCTS, THEME_META } from '@/data/products';
import {
  ChevronDown, X, Star, SlidersHorizontal, Gift,
  Heart, ShoppingBag, Search, Store, User,
} from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';
// import ThemeSwitcher from '@/components/ThemeSwitcher';
import AurusHeader from './aurus/AurusHeader';
import { UI, SERIF } from './aurus/constants';

/* â”€â”€â”€ Filter data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const FILTER_SECTIONS = [
  {
    id: 'ringSize', label: 'Ring size', type: 'check',
    options: [
      { v:'5',  l:'5',  c:7   }, { v:'6',  l:'6',  c:6   }, { v:'7',  l:'7',  c:76  },
      { v:'8',  l:'8',  c:29  }, { v:'9',  l:'9',  c:68  }, { v:'10', l:'10', c:95  },
      { v:'11', l:'11', c:105 }, { v:'12', l:'12', c:117 }, { v:'13', l:'13', c:94  },
      { v:'14', l:'14', c:73  }, { v:'15', l:'15', c:43  }, { v:'16', l:'16', c:3   },
      { v:'17', l:'17', c:1   }, { v:'18', l:'18', c:1   }, { v:'19', l:'19', c:1   },
      { v:'20', l:'20', c:1   }, { v:'21', l:'21', c:2   },
    ],
  },
  {
    id: 'price', label: 'Price', type: 'check',
    options: [
      { v:'5001-10000',  l:'â‚¹5,001 â€“ â‚¹10,000',  c:9  },
      { v:'10001-15000', l:'â‚¹10,001 â€“ â‚¹15,000', c:95 },
      { v:'15001-20000', l:'â‚¹15,001 â€“ â‚¹20,000', c:8  },
      { v:'20001-30000', l:'â‚¹20,001 â€“ â‚¹30,000', c:4  },
      { v:'30001-40000', l:'â‚¹30,001 â€“ â‚¹40,000', c:3  },
      { v:'40001-50000', l:'â‚¹40,001 â€“ â‚¹50,000', c:1  },
    ],
  },
  {
    id: 'discounts', label: 'Discounts', type: 'check',
    options: [{ v:'flat100', l:'Flat 100% off on Making Charges', c:119 }],
  },
  {
    id: 'productType', label: 'Product Type', type: 'check',
    options: [
      { v:'rings',     l:'Rings',     c:120 },
      { v:'earrings',  l:'Earrings',  c:64  },
      { v:'necklaces', l:'Necklaces', c:9   },
      { v:'pendants',  l:'Pendants',  c:19  },
      { v:'bracelets', l:'Bracelets', c:13  },
      { v:'nosepins',  l:'Nose Pins', c:2   },
    ],
  },
  {
    id: 'weight', label: 'Weight Ranges', type: 'check',
    options: [
      { v:'0-2g',   l:'0 â€“ 2 g',  c:119 },
      { v:'2-5g',   l:'2 â€“ 5 g',  c:45  },
      { v:'5-10g',  l:'5 â€“ 10 g', c:12  },
      { v:'10-20g', l:'10 â€“ 20 g',c:5   },
    ],
  },
  {
    id: 'material', label: 'Material', type: 'check',
    options: [
      { v:'diamond',  l:'Diamond',  c:119 },
      { v:'gold',     l:'Gold',     c:1   },
      { v:'gemstone', l:'Gemstone', c:100 },
      { v:'platinum', l:'Platinum', c:12  },
      { v:'silver',   l:'Silver',   c:45  },
    ],
  },
  {
    id: 'metal', label: 'Metal', type: 'check',
    options: [
      { v:'18kt-y', l:'18 KT Yellow Gold', c:95 },
      { v:'18kt-r', l:'18 KT Rose Gold',   c:23 },
      { v:'18kt-w', l:'18 KT White Gold',  c:18 },
      { v:'22kt',   l:'22 KT Yellow Gold', c:8  },
      { v:'9kt',    l:'9 KT Yellow Gold',  c:34 },
    ],
  },
];

const SORT_OPTIONS = ['Featured','Latest','Discount','Price: Low to High','Price: High to Low','Customer Rating'];
const CHIPS = ['All','Fast Delivery','Latest Designs','Store Pickup','Try at Home'];

const PINK = '#E91E8C';
const PURPLE_COUNT = '#7B59C0';

/* â”€â”€â”€ Mini star rating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const MiniStars: React.FC<{ r: number }> = ({ r }) => (
  <span className="inline-flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} className={`w-2.5 h-2.5 ${i<=Math.round(r)?'fill-[#F5A623] text-[#F5A623]':'text-gray-300'}`}/>
    ))}
  </span>
);

/* â”€â”€â”€ Filter Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const FilterSection: React.FC<{
  section: typeof FILTER_SECTIONS[0];
  selected: string[];
  onToggle: (v: string) => void;
  open: boolean;
  onToggleOpen: () => void;
}> = ({ section, selected, onToggle, open, onToggleOpen }) => {
  const [showAll, setShowAll] = useState(false);
  const opts    = section.options as {v:string;l:string;c:number}[];
  const visible = showAll ? opts : opts.slice(0, 4);
  const remaining = opts.length - 4;

  return (
    <div style={{ borderBottom: '1px solid #F0F0F0', paddingTop: 2 }}>

      {/* Section header */}
      <button
        onClick={onToggleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          /* More breathing room between sections */
          padding: '16px 0 14px', background: 'none', border: 'none', cursor: 'pointer',
          ...UI,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#222222', letterSpacing: '0.01em', ...UI }}>
          {section.label}
        </span>
        {!open && (
          <ChevronDown style={{ width: 15, height: 15, color: '#999999', flexShrink: 0 }}/>
        )}
      </button>

      {/* Expanded option list */}
      {open && (
        <div style={{ paddingBottom: 16 }}>
          {visible.map(o => {
            const isSel = selected.includes(o.v);
            return (
              <div
                key={o.v}
                onClick={() => onToggle(o.v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  /* Increased vertical padding for breathing room */
                  padding: '10px 0', cursor: 'pointer',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18, height: 18, flexShrink: 0,
                  border: isSel ? '2px solid #7C3AED' : '1.5px solid #CCCCCC',
                  borderRadius: 3,
                  background: isSel ? '#7C3AED' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {isSel && (
                    <svg width="10" height="7" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* Label â€” lighter weight */}
                <span style={{ fontSize: 13, color: '#444444', flex: 1, lineHeight: 1.5, ...UI }}>
                  {o.l}
                </span>

                {/* Count */}
                <span style={{ fontSize: 11, color: PURPLE_COUNT, flexShrink: 0, ...UI }}>
                  ({o.c})
                </span>
              </div>
            );
          })}

          {remaining > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                marginTop: 6, fontSize: 12, color: PINK, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center', gap: 4, ...UI,
              }}
            >
              <span style={{ fontSize: 13 }}>â†“</span> {remaining} More
            </button>
          )}
          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              style={{
                marginTop: 6, fontSize: 12, color: PINK, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center', gap: 4, ...UI,
              }}
            >
              <span style={{ fontSize: 13 }}>â†‘</span> Show Less
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* â”€â”€â”€ Promotional Tiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PromoTile: React.FC<{ variant: 'latest' | 'try-home' }> = ({ variant }) => {
  if (variant === 'latest') {
    return (
      <div
        className="col-span-2 relative overflow-hidden flex flex-col items-center justify-center text-center px-10"
        style={{
          background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 60%, #7C3AED 100%)',
          minHeight: 300,
        }}
      >
        {/* Subtle decorative ring */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full border border-white/10" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full border border-white/10" />

        <p className="text-purple-300 text-[10px] tracking-[0.35em] uppercase mb-3 relative z-10" style={UI}>
          New Arrivals
        </p>
        <h3
          className="text-white text-[2rem] font-light leading-tight mb-4 relative z-10"
          style={SERIF}
        >
          Latest<br/>Designs
        </h3>
        <p className="text-purple-200 text-[12px] mb-7 max-w-[200px] leading-relaxed relative z-10" style={UI}>
          Handcrafted pieces for moments that matter
        </p>
        <button
          className="relative z-10 border border-white/60 text-white text-[11px] tracking-[0.2em] uppercase px-7 py-2.5 hover:bg-white hover:text-purple-900 transition-all duration-200"
          style={UI}
        >
          Explore Now
        </button>
      </div>
    );
  }

  return (
    <div
      className="col-span-2 flex flex-col items-center justify-center text-center px-10"
      style={{ background: '#F5F0FF', minHeight: 300 }}
    >
      <p className="text-purple-500 text-[10px] tracking-[0.35em] uppercase mb-3" style={UI}>
        Try Before You Buy
      </p>
      <h3
        className="text-gray-900 text-[2rem] font-light leading-tight mb-4"
        style={SERIF}
      >
        Try at<br/>Home
      </h3>
      <p className="text-gray-500 text-[12px] mb-7 max-w-[220px] leading-relaxed" style={UI}>
        Order up to 4 pieces, try at home for free, keep what you love
      </p>
      <button
        className="bg-purple-700 text-white text-[11px] tracking-[0.2em] uppercase px-7 py-2.5 hover:bg-purple-800 transition-all duration-200"
        style={UI}
      >
        Know More
      </button>
    </div>
  );
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const AurusListing: React.FC = () => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const { addToRegistry, isInRegistry } = useRegistry();
  const { category = 'rings' } = useParams<{ category: string }>();
  const products = PRODUCTS.aurus;
  const meta = THEME_META.aurus;

  /* â”€â”€ Search + Filter / sort state â”€â”€ */
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy]         = useState('Featured');
  const [activeChip, setActiveChip] = useState('All');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [openSections, setOpenSections] = useState<Record<string,boolean>>({
    ringSize:true, price:true, discounts:true, productType:false,
    weight:false, material:false, metal:false,
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [registryOpen, setRegistryOpen]           = useState<string | null>(null);

  const toggleFilter = (sectionId: string, v: string) => {
    setSelectedFilters(prev => {
      const curr = prev[sectionId] || [];
      return { ...prev, [sectionId]: curr.includes(v) ? curr.filter(x => x !== v) : [...curr, v] };
    });
  };
  const totalActiveFilters = Object.values(selectedFilters).reduce((s,a) => s + a.length, 0);
  const clearAll = () => setSelectedFilters({});

  /* â”€â”€ Build product list â”€â”€ */
  const allProducts = useMemo(() => {
    const arr: typeof products = [];
    for (let i = 0; i < 5; i++) products.forEach(p => arr.push({ ...p }));
    return arr.slice(0, 40);
  }, [products]);

  const displayProducts = useMemo(() => {
    let arr = [...allProducts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q)
      );
    }
    if (activeChip === 'Try at Home') arr = arr.filter(p => p.tryAtHome);
    if (sortBy === 'Price: Low to High') arr.sort((a,b) => a.price - b.price);
    else if (sortBy === 'Price: High to Low') arr.sort((a,b) => b.price - a.price);
    else if (sortBy === 'Customer Rating') arr.sort((a,b) => b.rating - a.rating);
    return arr;
  }, [allProducts, sortBy, activeChip, searchQuery]);

  /* â”€â”€ Inject promo tiles into the flat item list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     4-column grid layout:
       Row 1: P1  P2  P3  P4
       Row 2: [PromoTile-latest col-span-2]  P5  P6
       Row 3: P7  P8  P9  P10
       Row 4: P11 P12 P13 P14
       Row 5: [PromoTile-try-home col-span-2]  P15  P16
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  type GridItem =
    | { kind: 'product'; p: typeof displayProducts[0]; idx: number }
    | { kind: 'promo';   variant: 'latest' | 'try-home'; id: string };

  const gridItems = useMemo<GridItem[]>(() => {
    const result: GridItem[] = [];
    displayProducts.forEach((p, i) => {
      result.push({ kind: 'product', p, idx: i });
      /* Inject after 4th product â†’ promo spans cols 1-2, P5+P6 fill cols 3-4 in row 2
         Inject after 14th product â†’ same pattern in row 5 */
      if (i === 3)  result.push({ kind: 'promo', variant: 'latest',   id: 'promo-latest'   });
      if (i === 13) result.push({ kind: 'promo', variant: 'try-home', id: 'promo-try-home'  });
    });
    return result;
  }, [displayProducts]);

  const categoryTitle = category.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-white" style={UI}>

      <AurusHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={q => setSearchQuery(q)}
      />

      {/* â”€â”€ OLD HEADER (replaced by AurusHeader) â”€â”€ */}
      {false && <header className="sticky top-0 z-50 relative" style={{ boxShadow:'0 2px 8px rgba(0,0,0,0.10)' }}>
        {/* Row 1 */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[1400px] mx-auto px-4 h-[50px] flex items-center gap-3">
            <Link to="/" className="flex-shrink-0 flex flex-col leading-none mr-1 group">
              <span className="text-[19px] font-bold tracking-[0.14em] text-gray-900 group-hover:text-purple-700 transition-colors" style={SERIF}>
                {meta.brand.toUpperCase()}
              </span>
              <span className="text-[8px] text-gray-400 tracking-[0.22em] uppercase mt-px" style={UI}>Fine Jewellery</span>
            </Link>
            <div className="flex-1 max-w-[600px] flex h-[34px]">
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="flex-1 h-full pl-4 pr-3 text-[14px] border border-gray-300 border-r-0 outline-none focus:border-purple-500 bg-white transition-colors"
                style={UI}
              />
              <button className="h-full px-4 bg-purple-700 hover:bg-purple-800 flex items-center justify-center flex-shrink-0 transition-colors">
                <Search className="w-[18px] h-[18px] text-white"/>
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <button className="relative flex items-center gap-1.5 border border-pink-500 text-pink-600 rounded-full px-3 h-[30px] text-[11px] font-semibold hover:bg-pink-50 transition-colors whitespace-nowrap">
                <span className="absolute -top-[10px] left-2.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-px rounded-sm uppercase">NEW</span>
                ðŸŽ Treasure Chest
              </button>
              <button className="flex items-center gap-1.5 border border-gray-400 text-gray-700 rounded-full px-3 h-[30px] text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                <Store className="w-3.5 h-3.5"/> Stores
              </button>
            </div>
            <div className="hidden xl:flex flex-col items-end flex-shrink-0 border-l border-gray-200 pl-3">
              <p className="text-[10px] text-gray-500 leading-none">Delivery &amp; Stores</p>
              <button className="text-[11px] text-purple-700 font-semibold hover:underline leading-tight mt-0.5" style={UI}>Enter Pincode</button>
            </div>
            <button className="flex-shrink-0 text-gray-600 hover:text-purple-700 transition-colors"><User className="w-[19px] h-[19px]"/></button>
            <button className="flex-shrink-0 relative text-gray-600 hover:text-purple-700 transition-colors">
              <Heart className="w-[19px] h-[19px]"/>
              {wishlist.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">{wishlist.length}</span>}
            </button>
            <button onClick={() => setCartOpen(true)} className="flex-shrink-0 relative text-gray-600 hover:text-purple-700 transition-colors">
              <ShoppingBag className="w-[19px] h-[19px]"/>
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Row 2 â€” purple nav */}
        <div className="bg-[#6B21A8]">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center h-[43px] overflow-x-auto">
            {NAV_ITEMS.map(n => (
              <Link
                key={n}
                to={NAV_LINKS[n] ?? '/jewellery'}
                onMouseEnter={() => openMegaMenu(n)}
                onMouseLeave={scheduleMegaMenuClose}
                onClick={() => setActiveNav(n)}
                className={`flex-shrink-0 px-3.5 h-[43px] flex items-center text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeNav === n ? 'text-white border-b-[3px] border-white' : 'text-white/85 hover:text-white hover:bg-purple-700'
                }`}
                style={UI}
              >
                {n}
              </Link>
            ))}
            <div className="ml-auto flex-shrink-0 pl-2">
              <button className="flex items-center gap-1 border border-white/50 text-white text-[12px] font-medium px-4 h-8 hover:bg-purple-700 transition-colors rounded-sm" style={UI}>
                Services <ChevronDown className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>
      </header>}

      {/* â”€â”€ Breadcrumb â”€â”€ */}
      <div className="bg-[#F5F3F8] border-b border-gray-200 py-6">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[17px] font-bold text-gray-900" style={UI}>{categoryTitle}</h1>
            <span className="text-[14px] text-gray-500 font-normal" style={UI}>{displayProducts.length} Designs</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400 tracking-[0.08em] uppercase" style={UI}>
            <Link to="/" className="hover:text-purple-700 transition-colors">Home</Link>
            <span className="text-gray-300">&gt;</span>
            <span>Jewellery</span>
            {categoryTitle.toLowerCase() !== 'jewellery' && (
              <>
                <span className="text-gray-300">&gt;</span>
                <span>{categoryTitle}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Quick-filter chip strip â”€â”€ */}
      <div className="bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 pt-8 pb-5 flex items-center gap-3 overflow-x-auto">
          {CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => setActiveChip(chip)}
              className={`flex-shrink-0 px-6 py-[10px] rounded-xl text-[15px] font-normal border transition-all duration-150 ${
                activeChip === chip
                  ? 'bg-[#EDE9FE] text-[#6D28D9] border-[#C4B5FD]'
                  : 'bg-white text-[#555555] border-[#D1D5DB] hover:border-purple-400 hover:text-purple-700'
              }`}
              style={UI}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* â”€â”€ Main layout: sidebar + content â”€â”€ */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 pb-16 flex gap-7">

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            LEFT SIDEBAR â€” Filter Panel
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <aside className="hidden lg:block w-[240px] flex-shrink-0">
          <div className="sticky top-[93px] pt-7">
            {/* Filters header â€” no border line above, only below each section */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingBottom: 16, paddingTop: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#111111',
                  textTransform: 'uppercase', letterSpacing: '0.06em', ...UI,
                }}>
                  FILTERS
                </span>
                {totalActiveFilters > 0 && (
                  <span style={{
                    background: '#EEEEEE', color: '#333333',
                    fontSize: 11, fontWeight: 600,
                    borderRadius: 3, padding: '1px 6px', ...UI,
                  }}>
                    {totalActiveFilters}
                  </span>
                )}
              </div>
              {totalActiveFilters > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    fontSize: 11, color: PINK, background: 'none', border: 'none',
                    cursor: 'pointer', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.04em', ...UI,
                  }}
                >
                  CLEAR ALL
                </button>
              )}
            </div>

            {/* Filter sections â€” scrollbar hidden to match CaratLane */}
            <div className="filter-scroll max-h-[calc(100vh-160px)] overflow-y-auto">
              {FILTER_SECTIONS.map(sec => (
                <FilterSection
                  key={sec.id}
                  section={sec}
                  selected={selectedFilters[sec.id] || []}
                  onToggle={(v) => toggleFilter(sec.id, v)}
                  open={!!openSections[sec.id]}
                  onToggleOpen={() => setOpenSections(p => ({ ...p, [sec.id]: !p[sec.id] }))}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            RIGHT CONTENT â€” Products
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <div className="flex-1 min-w-0 pt-5">

          {/* â”€â”€ Applied filter chips + Sort â”€â”€ */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap min-h-[36px]">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden flex items-center gap-1.5 border border-gray-400 text-gray-700 text-[12px] font-medium px-3 py-1.5 rounded-full hover:border-gray-600 transition-colors"
                style={UI}
              >
                <SlidersHorizontal className="w-3.5 h-3.5"/>
                FILTER {totalActiveFilters > 0 && `(${totalActiveFilters})`}
              </button>

              {Object.entries(selectedFilters).map(([sec, vals]) =>
                vals.map(v => {
                  const section = FILTER_SECTIONS.find(s => s.id === sec);
                  const opt = section?.options.find((o) => (o as {v:string;l:string;c:number}).v === v) as {v:string;l:string;c:number} | undefined;
                  const label = opt ? opt.l : v;
                  const display = label.charAt(0).toUpperCase() + label.slice(1);
                  return (
                    <span
                      key={`${sec}-${v}`}
                      className="flex items-center gap-1.5 bg-white border border-gray-500 text-[13px] text-gray-800 rounded-full px-3.5 py-[6px] cursor-default select-none"
                      style={UI}
                    >
                      {display}
                      <button
                        onClick={() => toggleFilter(sec, v)}
                        className="text-gray-500 hover:text-gray-900 transition-colors leading-none ml-0.5 text-[15px] font-light"
                        aria-label={`Remove ${display} filter`}
                      >
                        Ã—
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            <div className="relative flex-shrink-0">
              <div className="flex items-center gap-1 text-[13px] font-medium text-purple-700 cursor-pointer select-none" style={UI}>
                Sort By: <span className="font-semibold">{sortBy}</span>
                <ChevronDown className="w-4 h-4 text-purple-700"/>
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                style={UI}
              >
                {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              Product grid â€” 4 columns, rounded cards, promo tiles
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
            {gridItems.map((item) => {

              /* â”€â”€ Promotional tile â”€â”€ */
              if (item.kind === 'promo') {
                return <PromoTile key={item.id} variant={item.variant} />;
              }

              /* â”€â”€ Product card â”€â”€ */
              const { p, idx } = item;
              const wished = wishlist.includes(p.id);
              const disc   = Math.round(((p.mrp - p.price) / p.mrp) * 100);

              return (
                <div
                  key={`${p.id}-${idx}`}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-100"
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-[#f8f6f8] overflow-hidden">
                    {p.badge === 'New' && (
                      <span className="absolute top-2.5 left-2.5 z-10 bg-purple-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                        Latest
                      </span>
                    )}
                    {p.badge === 'Bestseller' && (
                      <span className="absolute top-2.5 left-2.5 z-10 bg-[#B01F24] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                        Bestseller
                      </span>
                    )}
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      className="absolute top-2.5 right-2.5 z-10 bg-white/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Heart className={`w-3.5 h-3.5 ${wished?'fill-purple-700 text-purple-700':'text-gray-500'}`}/>
                    </button>

                    {/* Registry button */}
                    <button
                      onClick={e => { e.preventDefault(); setRegistryOpen(registryOpen === p.id ? null : p.id); }}
                      className="absolute bottom-2.5 right-2.5 z-10 bg-white/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      title="Add to Registry"
                    >
                      <Gift className={`w-3.5 h-3.5 ${isInRegistry(p.id) ? 'fill-pink-500 text-pink-500' : 'text-gray-500'}`}/>
                    </button>

                    {/* Occasion picker overlay */}
                    {registryOpen === p.id && (
                      <div className="absolute inset-0 z-20 bg-white/97 flex flex-col items-center justify-center p-3 gap-2.5" style={{ backdropFilter: 'blur(4px)' }}>
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.12em]">Add to Registry</p>
                        <div className="grid grid-cols-3 gap-1.5 w-full">
                          {(Object.keys(OCCASIONS) as OccasionKey[]).map(occ => {
                            const o   = OCCASIONS[occ];
                            const inR = isInRegistry(p.id, occ);
                            return (
                              <button
                                key={occ}
                                onClick={() => { addToRegistry(p, occ); setRegistryOpen(null); }}
                                className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all border"
                                style={{
                                  background: inR ? o.bg : '#fff',
                                  borderColor: inR ? o.border : '#E5E7EB',
                                  color: o.color,
                                }}
                              >
                                <span className="text-[16px]">{inR ? 'âœ“' : o.icon}</span>
                                <span className="text-[8.5px] font-semibold">{o.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setRegistryOpen(null)}
                          className="text-[9px] text-gray-400 hover:text-gray-600 mt-0.5"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <Link to={`/products/${p.id}`}>
                      <img
                        src={p.image} alt={p.name}
                        loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                  </div>

                  {/* Service badges â€” text only, no colored background chips */}
                  <div className="flex flex-wrap gap-3 px-3 pt-3">
                    {p.tryAtHome && (
                      <span className="text-[10px] font-medium text-[#00796B] tracking-wide" style={UI}>
                        Try at Home
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-purple-600 tracking-wide" style={UI}>
                      Video Call
                    </span>
                  </div>

                  {/* Info */}
                  <div className="px-3 pt-2 pb-2">
                    <Link to={`/products/${p.id}`}>
                      <p className="text-[13px] text-gray-800 leading-snug hover:text-purple-700 transition-colors line-clamp-2" style={UI}>
                        {p.name}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 mt-1.5">
                      <MiniStars r={p.rating}/>
                      <span className="text-[10px] text-gray-400">({p.reviews})</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[14px] font-bold text-gray-900" style={UI}>{inr(p.price)}</span>
                      <span className="text-[11px] text-gray-400 line-through">{inr(p.mrp)}</span>
                      <span className="text-[10px] font-semibold text-emerald-700">{disc}% off</span>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex border-t border-gray-100 mt-3">
                    <Link
                      to={`/products/${p.id}`}
                      className="flex-1 text-center py-2.5 text-[11px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                      style={UI}
                    >
                      View Similar
                    </Link>
                    <div className="w-px bg-gray-100"/>
                    <button
                      className="flex-1 py-2.5 text-[11px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                      style={UI}
                      onClick={() => addToCart(p)}
                    >
                      Add to Bag
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          <div className="text-center mt-14">
            <button
              className="border-2 border-purple-700 text-purple-700 hover:bg-purple-700 hover:text-white px-14 py-3 text-[13px] font-bold tracking-wide transition-all duration-200 rounded-sm"
              style={UI}
            >
              VIEW MORE DESIGNS
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€ Mobile filter drawer â”€â”€ */}
      {mobileSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[110]" onClick={() => setMobileSidebarOpen(false)}/>
          <div className="fixed inset-y-0 left-0 w-[300px] bg-white z-[120] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <span className="text-[15px] font-bold text-gray-800" style={UI}>FILTERS {totalActiveFilters > 0 && `(${totalActiveFilters})`}</span>
              <div className="flex items-center gap-3">
                {totalActiveFilters > 0 && (
                  <button onClick={clearAll} className="text-[12px] text-purple-700 font-semibold" style={UI}>CLEAR ALL</button>
                )}
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X className="w-5 h-5 text-gray-500"/>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {FILTER_SECTIONS.map(sec => (
                <FilterSection
                  key={sec.id}
                  section={sec}
                  selected={selectedFilters[sec.id] || []}
                  onToggle={(v) => toggleFilter(sec.id, v)}
                  open={!!openSections[sec.id]}
                  onToggleOpen={() => setOpenSections(p => ({ ...p, [sec.id]: !p[sec.id] }))}
                />
              ))}
            </div>
            <div className="px-4 py-4 border-t border-gray-200">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 text-[13px] font-bold tracking-wide transition-colors rounded-sm"
                style={UI}
              >
                APPLY FILTERS
              </button>
            </div>
          </div>
        </>
      )}

      <CartDrawer accentClass="bg-purple-800" fontClass="font-sans"/>
      {/* <ThemeSwitcher/> */}
    </div>
  );
};

export default AurusListing;

