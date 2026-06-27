import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { toPlainText } from '@/utils/richText';
import {
  ShoppingBag, Search, ShoppingCart, User, Star, Heart,
  Plus, ArrowRight, Mail, Check,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Copy, Trash2, Eye, EyeOff, Package, GripVertical,
} from 'lucide-react';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditor } from '../EditorContext';
import { resolveSettings } from '../resolveSettings';
import {
  useCanvasProducts,
  formatCanvasPrice,
  type CanvasProduct,
} from '@/hooks/useCanvasProducts';
import { useCanvasProduct }       from '@/hooks/useCanvasProduct';
import { ProductPageProvider }    from '@/contexts/ProductPageContext';
import ProductGallery             from '@/components/node-renderer/primitives/ProductGallery';
import ProductTitle               from '@/components/node-renderer/primitives/ProductTitle';
import ProductPrice               from '@/components/node-renderer/primitives/ProductPrice';
import VariantSelector            from '@/components/node-renderer/primitives/VariantSelector';
import QuantitySelector           from '@/components/node-renderer/primitives/QuantitySelector';
import AddToCartBtn               from '@/components/node-renderer/primitives/AddToCart';
import BuyNowBtn                  from '@/components/node-renderer/primitives/BuyNow';
import ProductDescription         from '@/components/node-renderer/primitives/ProductDescription';
import ProductSpecifications      from '@/components/node-renderer/primitives/ProductSpecifications';
import BreadcrumbPrimitive        from '@/components/node-renderer/primitives/Breadcrumb';
import TrustBadgesPrimitive       from '@/components/node-renderer/primitives/TrustBadges';
import type { Product }           from '@/types';
import {
  ContainerPrimitive,
  StackPrimitive,
  GridPrimitive,
  ColumnsPrimitive,
  SpacerPrimitive,
  DividerPrimitive,
} from '@/components/storefront/primitives';
import CollectionCirclesSectionCanvas from '@/components/storefront/sections/CollectionCirclesSection';
import ProductMosaicSectionCanvas     from '@/components/storefront/sections/ProductMosaicSection';
import EditorialBannerSectionCanvas   from '@/components/storefront/sections/EditorialBannerSection';
import TrustBadgesBarSectionCanvas    from '@/components/storefront/sections/TrustBadgesBarSection';
import BrandStorySectionCanvas        from '@/components/storefront/sections/BrandStorySection';
import type { SectionDoc, BlockDoc } from '../types';
// Phase 2: node-mode canvas — renders when nodeMode is active
import NodeCanvas from './NodeCanvas';

// ─── Selection Overlay ────────────────────────────────────────────────────────

const SelectionChip: React.FC<{ label: string; onRemove?: () => void }> = ({ label }) => (
  <div
    className="absolute -top-8 left-0 z-20 flex items-center gap-1.5 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-lg pointer-events-none select-none"
    style={{ background: 'var(--nx-violet-600)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
  >
    <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
    {label}
  </div>
);

// ─── Canvas action toolbar (floating above selected section) ─────────────────

const CanvasToolbar: React.FC<{
  section:        SectionDoc;
  allIds:         string[];
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}> = ({ section, allIds, dragListeners, dragAttributes }) => {
  const { dispatch } = useEditor();
  const idx       = allIds.indexOf(section.id);
  const canMoveUp = idx > 0;
  const canMoveDn = idx < allIds.length - 1;

  const moveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...allIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    dispatch({ type: 'REORDER_SECTIONS', orderedIds: next });
  }, [dispatch, allIds, idx]);

  const moveDn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...allIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    dispatch({ type: 'REORDER_SECTIONS', orderedIds: next });
  }, [dispatch, allIds, idx]);

  const duplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const { nanoid: _n } = require('nanoid');
    // Copy section with new id and insert after
    const clone = {
      ...section,
      id:     `sec-${Math.random().toString(36).slice(2, 10)}`,
      label:  `${section.label} (copy)`,
      blocks: section.blocks.map((b) => ({
        ...b, id: `blk-${Math.random().toString(36).slice(2, 10)}`,
      })),
    };
    dispatch({ type: 'ADD_SECTION', section: clone, insertAfter: section.id });
  }, [dispatch, section]);

  const remove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_SECTION', sectionId: section.id });
  }, [dispatch, section.id]);

  const toggleVis = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_SECTION_VISIBILITY', sectionId: section.id });
  }, [dispatch, section.id]);

  const ToolBtn: React.FC<{
    onClick: (e: React.MouseEvent) => void;
    title:   string;
    danger?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
  }> = ({ onClick, title, danger, disabled, children }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
      style={{ color: danger ? 'var(--nx-error)' : 'rgba(255,255,255,0.85)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 px-1 py-1 rounded-lg shadow-xl"
      style={{
        top: -36, right: 8,
        background: 'rgba(15,15,20,0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag grip — always accessible when toolbar is visible */}
      {!section.isSystem && dragListeners && (
        <button
          {...(dragAttributes as any)}
          {...(dragListeners as any)}
          className="w-7 h-7 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.95)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        >
          <GripVertical size={13} />
        </button>
      )}

      {/* Section label */}
      <span className="px-2 text-[10px] font-semibold" style={{ color: 'var(--nx-violet-400)' }}>
        {section.label}
      </span>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

      <ToolBtn onClick={moveUp}    title="Move up"   disabled={!canMoveUp}><ChevronUp size={13}  /></ToolBtn>
      <ToolBtn onClick={moveDn}    title="Move down" disabled={!canMoveDn}><ChevronDown size={13}/></ToolBtn>
      <ToolBtn onClick={duplicate} title="Duplicate">                       <Copy size={12}      /></ToolBtn>
      <ToolBtn onClick={toggleVis} title={section.isVisible ? 'Hide' : 'Show'}>
        {section.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
      </ToolBtn>

      {!section.isSystem && (
        <>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
          <ToolBtn onClick={remove} title="Delete" danger><Trash2 size={12} /></ToolBtn>
        </>
      )}
    </div>
  );
};

// ─── Section wrapper with selection overlay ───────────────────────────────────

const SectionWrapper: React.FC<{
  section:  SectionDoc;
  label:    string;
  allIds:   string[];
  children: React.ReactNode;
}> = ({ section, label, allIds, children }) => {
  const { state, dispatch, selectSection } = useEditor();

  const isSelected    = state.selection.sectionId === section.id && state.selection.blockId === null;
  const isHovered     = state.hoverSectionId === section.id;
  const isAnySelected = state.selection.type !== 'none';
  const isSystem      = section.isSystem ?? false;

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: `canvas:${section.id}`, disabled: isSystem });

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectSection(section.id, section.groupHandle);
  }, [selectSection, section.id, section.groupHandle]);

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onMouseEnter={() => dispatch({ type: 'HOVER_SECTION', sectionId: section.id })}
      onMouseLeave={() => dispatch({ type: 'HOVER_SECTION', sectionId: null })}
      className="relative"
      style={{
        transform:     CSS.Transform.toString(transform),
        transition:    transition ?? 'all 150ms ease',
        opacity:       isDragging ? 0.4 : (!section.isVisible ? 0.4 : 1),
        outline:       isSelected                    ? '2px solid var(--nx-violet-500)'
                     : isHovered && !isAnySelected   ? '1px dashed rgba(139,92,246,0.5)'
                     : 'none',
        outlineOffset: '-1px',
        zIndex:        isDragging ? 20 : undefined,
      }}
    >
      {/* Floating action toolbar — visible when selected; receives drag listeners so grip is always reachable */}
      {isSelected && (
        <CanvasToolbar
          section={section}
          allIds={allIds}
          dragListeners={listeners as Record<string, unknown>}
          dragAttributes={attributes as Record<string, unknown>}
        />
      )}

      {/* Canvas drag handle — shown on hover (nothing selected) only; when selected, grip lives in CanvasToolbar */}
      {isHovered && !isAnySelected && !isSystem && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 z-30 flex items-center justify-center rounded cursor-grab active:cursor-grabbing"
          style={{
            left: 8, width: 22, height: 22,
            background: 'rgba(15,15,20,0.78)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.85)',
          }}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical size={12} />
        </button>
      )}

      {/* Label chip on hover (offset right of drag handle, when nothing selected) */}
      {isHovered && !isAnySelected && (
        <div className="absolute top-0 z-20 pointer-events-none" style={{ left: isSystem ? 0 : 34 }}>
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white shadow-md"
            style={{ background: 'rgba(80,80,100,0.9)', borderBottomRightRadius: 4,
              fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {label}
          </div>
        </div>
      )}

      {/* Insert "+" above section on hover (nothing selected) */}
      {isHovered && !isAnySelected && !isSystem && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: section.id });
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors"
            style={{ background: 'var(--nx-violet-600)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-violet-500)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--nx-violet-600)')}
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>
      )}

      {children}
    </div>
  );
};

// ─── Block wrapper ────────────────────────────────────────────────────────────

const BlockWrapper: React.FC<{
  block:    BlockDoc;
  section:  SectionDoc;
  children: React.ReactNode;
  inline?:  boolean;
}> = ({ block, section, children, inline }) => {
  const { state, dispatch, selectBlock } = useEditor();

  const isSelected = state.selection.blockId === block.id;
  const isHovered  = state.hoverBlockId === block.id;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectBlock(section.id, block.id, section.groupHandle);
  }, [selectBlock, section.id, block.id, section.groupHandle]);

  if (!block.isVisible) return null;

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => dispatch({ type: 'HOVER_BLOCK', blockId: block.id })}
      onMouseLeave={() => dispatch({ type: 'HOVER_BLOCK', blockId: null })}
      className={`relative transition-all duration-100 ${inline ? 'inline-block' : 'block'}`}
      style={{
        outline: isSelected
          ? '2px solid var(--nx-violet-500)'
          : isHovered
          ? '1px dashed rgba(139,92,246,0.5)'
          : 'none',
        outlineOffset: '1px',
      }}
    >
      {isSelected && (
        <SelectionChip label={block.type.replace(/_/g, ' ')} />
      )}
      {children}
    </div>
  );
};

// ─── Announcement Bar ─────────────────────────────────────────────────────────

const AnnouncementBarSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { s } = { s: section.settings };
  const bg = section.settings.background ?? '#4f46e5';
  const textColor = section.settings.textColor ?? '#ffffff';
  const padding = section.settings.paddingVertical ?? 8;

  return (
    <SectionWrapper section={section} label="Announcement bar" allIds={_allPageSectionIds}>
      <div style={{ background: bg, paddingTop: padding, paddingBottom: padding }} className="text-center">
        {section.blocks.map((block) => (
          <BlockWrapper key={block.id} block={block} section={section} inline>
            <span style={{ color: textColor, fontSize: block.settings.fontSize ?? 12 }}
              className="font-medium px-4">
              {toPlainText(block.settings.text) || 'Welcome to our store'}
            </span>
          </BlockWrapper>
        ))}
      </div>
    </SectionWrapper>
  );
};

// ─── Header ───────────────────────────────────────────────────────────────────

const HeaderSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const logoBlock = section.blocks.find((b) => b.type === 'logo');
  const menuBlock = section.blocks.find((b) => b.type === 'menu');
  const logoWidth = logoBlock?.settings.width ?? 120;

  return (
    <SectionWrapper section={section} label="Header" allIds={_allPageSectionIds}>
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center gap-6">
          {/* Logo */}
          {logoBlock && (
            <BlockWrapper block={logoBlock} section={section} inline>
              <div className="flex items-center gap-2" style={{ minWidth: logoWidth }}>
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                  <ShoppingBag size={15} className="text-white" />
                </div>
                <span className="font-bold text-slate-900 text-sm">My Store 2</span>
              </div>
            </BlockWrapper>
          )}

          {/* Nav */}
          {menuBlock && (
            <BlockWrapper block={menuBlock} section={section} inline>
              <nav className="flex items-center gap-5 text-[13px] text-slate-700 font-medium">
                {['Home', 'Catalog', 'Contact'].map((item) => (
                  <span key={item} className="hover:text-indigo-600 cursor-pointer transition-colors">{item}</span>
                ))}
              </nav>
            </BlockWrapper>
          )}

          {/* Icons */}
          <div className="ml-auto flex items-center gap-3 text-slate-600">
            <Search size={18} className="cursor-pointer hover:text-slate-900 transition-colors" />
            <User size={18} className="cursor-pointer hover:text-slate-900 transition-colors" />
            <div className="relative">
              <ShoppingCart size={18} className="cursor-pointer hover:text-slate-900 transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { state } = useEditor();
  const resolved = resolveSettings(section.settings, state.previewMode);
  const {
    backgroundImage, backgroundColor = '#1a1a2e',
    overlayOpacity = 40, overlayColor = '#000000',
    height = 'md', contentAlignment = 'center',
  } = resolved;

  const heightMap: Record<string, string> = {
    auto: 'auto', sm: '400px', md: '520px', lg: '680px', full: '100vh',
  };
  const alignMap: Record<string, string> = {
    left: 'items-start text-left', center: 'items-center text-center', right: 'items-end text-right',
  };

  const headingBlock = section.blocks.find((b) => b.type === 'heading');
  const paragraphBlock = section.blocks.find((b) => b.type === 'paragraph');
  const buttonBlocks  = section.blocks.filter((b) => b.type === 'button');

  return (
    <SectionWrapper section={section} label="Hero" allIds={_allPageSectionIds}>
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: heightMap[height] ?? '520px', background: backgroundColor }}
      >
        {/* Background image */}
        {backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}

        {/* Gradient overlay (always present for readability) */}
        <div
          className="absolute inset-0"
          style={{ background: backgroundImage
            ? `${overlayColor}${Math.round(overlayOpacity * 2.55).toString(16).padStart(2,'0')}`
            : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
        />

        {/* Content */}
        <div className={`relative z-10 flex flex-col gap-4 px-8 max-w-2xl ${alignMap[contentAlignment] ?? alignMap.center}`}>
          {headingBlock && (
            <BlockWrapper block={headingBlock} section={section}>
              <h1
                className="font-bold leading-tight"
                style={{
                  color: headingBlock.settings.textColor ?? '#ffffff',
                  fontSize: headingBlock.settings.typographyPreset === 'h1' ? '2.75rem'
                    : headingBlock.settings.typographyPreset === 'h2' ? '2rem' : '1.5rem',
                }}
              >
                {toPlainText(headingBlock.settings.text) || 'Your headline here'}
              </h1>
            </BlockWrapper>
          )}
          {paragraphBlock && (
            <BlockWrapper block={paragraphBlock} section={section}>
              <p className="text-white/80 text-lg leading-relaxed">
                {toPlainText(paragraphBlock.settings.text)}
              </p>
            </BlockWrapper>
          )}
          <div className="flex gap-3 flex-wrap">
            {buttonBlocks.map((block) => (
              <BlockWrapper key={block.id} block={block} section={section} inline>
                <button
                  className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                    block.settings.style === 'outline'
                      ? 'border-2 border-white text-white hover:bg-white hover:text-slate-900'
                      : block.settings.style === 'secondary'
                      ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {block.settings.label || 'Shop all'}
                </button>
              </BlockWrapper>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

// ─── Product card (real data) ─────────────────────────────────────────────────

const ProductCard: React.FC<{
  product:      CanvasProduct;
  cardSettings: Record<string, any>;
}> = ({ product, cardSettings }) => {
  const showRating   = cardSettings.showRating   !== false;
  const showQuickAdd = cardSettings.showQuickAdd !== false;
  const imageRatio   = cardSettings.imageRatio === '3/4' ? '3/4' : '1/1';

  const rating = Math.round(product.rating ?? 4);

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-slate-100 hover:shadow-lg transition-all duration-300">
      {/* Product image */}
      <div className="relative bg-slate-100 overflow-hidden flex items-center justify-center"
        style={{ aspectRatio: imageRatio }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          // No-image placeholder — never shows emoji/mock data
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Package size={28} />
            <span className="text-[11px] font-medium">No image</span>
          </div>
        )}
        {showQuickAdd && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 text-white text-[11px] font-semibold py-2 text-center translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex items-center justify-center gap-1.5">
            <Plus size={12} /> Quick add
          </div>
        )}
        <button className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart size={13} className="text-slate-500" />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[13px] font-semibold text-slate-900 mb-0.5 truncate">
          {product.name}
        </p>
        {showRating && (
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={10}
                className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
              />
            ))}
            {product.reviewCount != null && (
              <span className="text-[10px] text-slate-400 ml-0.5">({product.reviewCount})</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-bold text-slate-900">
            {formatCanvasPrice(product.price)}
          </p>
          {product.comparePrice != null && product.comparePrice > product.price && (
            <p className="text-[12px] text-slate-400 line-through">
              {formatCanvasPrice(product.comparePrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── PDP canvas: renders when activePage==='product' with no sections ────────

/** Build a minimal NodeProps for use with PDP node-renderer primitives in canvas */
function makePdpNodeProps(
  type:     string,
  settings: Record<string, unknown> = {},
  bp:       'desktop' | 'tablet' | 'mobile' = 'desktop',
) {
  return {
    node: { id: `pdp-${type}`, type, settings, children: [] },
    ctx:  {
      breakpoint:  bp,
      themeTokens: {},
      storeId:     '',
      pageContext:  {},
      symbols:      new Map(),
      isPreview:   true,
    },
    style:    {},
    children: undefined as any,
  };
}

const ProductPageCanvas: React.FC<{ product: Product; previewMode: 'desktop' | 'tablet' | 'mobile' }> = ({ product, previewMode }) => {
  const bp = previewMode;
  const isNarrow = bp === 'mobile';

  return (
    <ProductPageProvider product={product}>
      <div style={{ background: '#fff', padding: '24px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16 }}>
          <BreadcrumbPrimitive {...makePdpNodeProps('breadcrumb', {}, bp)} />
        </div>

        {/* Main 2-col layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
          gap: 40,
          marginBottom: 48,
        }}>
          {/* Left: gallery */}
          <ProductGallery {...makePdpNodeProps('product_gallery', {
            showZoom: true,
            thumbPosition: 'bottom',
            imageRatio: '1/1',
          }, bp)} />

          {/* Right: details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ProductTitle {...makePdpNodeProps('product_title', { level: 'h1' }, bp)} />
            <ProductPrice {...makePdpNodeProps('product_price', { showDiscountBadge: true }, bp)} />

            <div style={{ width: '100%', height: 1, background: '#f3f4f6' }} />

            {(product.variants?.length ?? 0) > 0 && (
              <VariantSelector {...makePdpNodeProps('variant_selector', { swatchType: 'pill' }, bp)} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <QuantitySelector {...makePdpNodeProps('quantity_selector', {}, bp)} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <AddToCartBtn {...makePdpNodeProps('add_to_cart', { label: 'Add to Cart', variant: 'filled' }, bp)} />
              <BuyNowBtn    {...makePdpNodeProps('buy_now',     { label: 'Buy Now' }, bp)} />
            </div>

            <TrustBadgesPrimitive {...makePdpNodeProps('trust_badges', { columns: 2 }, bp)} />
          </div>
        </div>

        {/* Below the fold */}
        <ProductDescription {...makePdpNodeProps('product_description', { collapsible: false }, bp)} />

        {(product.attributes?.length ?? 0) > 0 && (
          <div style={{ marginTop: 24 }}>
            <ProductSpecifications {...makePdpNodeProps('product_specifications', { layout: 'table', label: 'Specifications' }, bp)} />
          </div>
        )}
      </div>
    </ProductPageProvider>
  );
};

// ─── Product card skeleton (loading state) ────────────────────────────────────

const ProductCardSkeleton: React.FC<{ imageRatio?: string }> = ({ imageRatio = '1/1' }) => (
  <div className="bg-white rounded-xl overflow-hidden border border-slate-100">
    <div className="bg-slate-100 animate-pulse" style={{ aspectRatio: imageRatio }} />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
    </div>
  </div>
);

// ─── Featured Collection ──────────────────────────────────────────────────────

const FeaturedCollectionSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { state } = useEditor();
  const resolved = resolveSettings(section.settings, state.previewMode);
  const { columnsDesktop = '4', productsToShow = 4 } = resolved;
  const cols = parseInt(String(columnsDesktop), 10) || 4;
  const limit = Math.min(Number(productsToShow) || 4, 24);

  const titleBlock   = section.blocks.find((b) => b.type === 'collection_title');
  const viewAllBlock = section.blocks.find((b) => b.type === 'view_all_button');
  const cardBlock    = section.blocks.find((b) => b.type === 'product_card');
  const imageRatio   = cardBlock?.settings.imageRatio as string ?? '1/1';

  const { products, isLoading, isEmpty, isError } = useCanvasProducts({
    collectionId: section.settings.collection,   // collection binding (P3)
    categoryId:   section.settings.category,     // category binding   (P4)
    productId:    section.settings.product,      // product binding    (P4)
    limit,
  });

  return (
    <SectionWrapper section={section} label="Featured collection" allIds={_allPageSectionIds}>
      <div className="px-8 py-12 bg-white">
        <div className="max-w-[1200px] mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            {titleBlock && (
              <BlockWrapper block={titleBlock} section={section} inline>
                <h2 className="text-2xl font-bold text-slate-900"
                  style={{ color: titleBlock.settings.textColor ?? '#111827' }}>
                  {titleBlock.settings.text || 'Products'}
                </h2>
              </BlockWrapper>
            )}
            {viewAllBlock && section.settings.showViewAll !== false && (
              <BlockWrapper block={viewAllBlock} section={section} inline>
                <button className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                  {viewAllBlock.settings.label || 'View all'}
                  <ArrowRight size={14} />
                </button>
              </BlockWrapper>
            )}
          </div>

          {/* Loading: skeleton grid */}
          {isLoading && (
            <div className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: limit }).map((_, i) => (
                <ProductCardSkeleton key={i} imageRatio={imageRatio} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && (isEmpty || isError) && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed border-slate-200">
              <Package size={28} className="text-slate-300" />
              <p className="text-[13px] font-medium text-slate-400">
                {isError ? 'Could not load products' : 'No products found'}
              </p>
              <p className="text-[12px] text-slate-300 text-center max-w-[200px]">
                {isError
                  ? 'Check your connection and try refreshing'
                  : 'Add products to your store or select a collection in the settings panel'}
              </p>
            </div>
          )}

          {/* Loaded: real product grid */}
          {!isLoading && products.length > 0 && (
            <div className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(cols, products.length)}, 1fr)` }}>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cardSettings={cardBlock?.settings ?? {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
};

// ─── Newsletter ───────────────────────────────────────────────────────────────

const NewsletterSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const headingBlock = section.blocks.find((b) => b.type === 'heading');
  const paraBlock    = section.blocks.find((b) => b.type === 'paragraph');

  return (
    <SectionWrapper section={section} label="Newsletter" allIds={_allPageSectionIds}>
      <div className="px-8 py-16 bg-slate-50 dark:bg-slate-800">
        <div className="max-w-xl mx-auto text-center">
          {headingBlock && (
            <BlockWrapper block={headingBlock} section={section}>
              <h2 className="text-2xl font-bold mb-3" style={{ color: headingBlock.settings.textColor ?? '#111827' }}>
                {toPlainText(headingBlock.settings.text) || 'Subscribe to our emails'}
              </h2>
            </BlockWrapper>
          )}
          {paraBlock && (
            <BlockWrapper block={paraBlock} section={section}>
              <p className="text-[14px] mb-6 leading-relaxed" style={{ color: paraBlock.settings.textColor ?? '#374151' }}>
                {toPlainText(paraBlock.settings.text)}
              </p>
            </BlockWrapper>
          )}
          <div className="flex gap-2 max-w-sm mx-auto">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 text-slate-400 text-[13px]">
              <Mail size={14} /> Email address
            </div>
            <button className="px-5 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

// ─── Carousel ────────────────────────────────────────────────────────────────
// Canvas version: each section.block becomes one slide wrapped in BlockWrapper
// so the merchant can click-to-select. Real embla provides scroll/touch/keyboard.

const CarouselSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { state } = useEditor();
  const s  = section.settings;
  const bp = state.previewMode as 'desktop' | 'tablet' | 'mobile';

  // Merge responsive overlay for the active breakpoint
  const overlay  = (s.responsive as any)?.[bp] ?? {};
  const merged   = { ...s, ...overlay };

  const slidesToShow  = Math.max(1, Math.min(6, Number(merged.slidesToShow ?? 1)));
  const gap           = Math.max(0, Number(merged.gap ?? 16));
  const loop          = Boolean(s.loop    ?? false);
  const autoplay      = Boolean(s.autoplay ?? false);
  const autoplaySpeed = Math.max(500, Number(s.autoplaySpeed ?? 3000));
  const showArrows    = s.showArrows !== false;
  const showDots      = Boolean(s.showDots ?? false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop, slidesToScroll: 1, align: 'start' });

  const [canPrev,   setCanPrev]   = useState(false);
  const [canNext,   setCanNext]   = useState(false);
  const [selected,  setSelected]  = useState(0);
  const isPaused = useRef(false);

  useEffect(() => {
    if (!emblaApi) return;
    const upd = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
      setSelected(emblaApi.selectedScrollSnap());
    };
    upd();
    emblaApi.on('select', upd);
    emblaApi.on('reInit', upd);
    return () => { emblaApi.off('select', upd); emblaApi.off('reInit', upd); };
  }, [emblaApi]);

  useEffect(() => {
    if (!autoplay || !emblaApi) return;
    const t = setInterval(() => {
      if (isPaused.current) return;
      emblaApi.canScrollNext() ? emblaApi.scrollNext() : (loop && emblaApi.scrollTo(0));
    }, autoplaySpeed);
    return () => clearInterval(t);
  }, [emblaApi, autoplay, autoplaySpeed, loop]);

  const slideWidth = slidesToShow === 1 ? '100%'
    : `calc(${100 / slidesToShow}% - ${(gap * (slidesToShow - 1)) / slidesToShow}px)`;

  return (
    <SectionWrapper section={section} label="Carousel" allIds={_allPageSectionIds}>
      <div
        className="relative outline-none"
        style={{ background: s.bg as string | undefined, padding: `${s.pt ?? 0}px ${s.pr ?? 0}px ${s.pb ?? 0}px ${s.pl ?? 0}px` }}
        onMouseEnter={() => { isPaused.current = true;  }}
        onMouseLeave={() => { isPaused.current = false; }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft')  { e.preventDefault(); emblaApi?.scrollPrev(); }
          if (e.key === 'ArrowRight') { e.preventDefault(); emblaApi?.scrollNext(); }
        }}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
      >
        {/* Embla viewport */}
        <div ref={emblaRef} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', marginLeft: `-${gap}px` }}>
            {section.blocks.length > 0
              ? section.blocks.map((block) => (
                  <div
                    key={block.id}
                    role="group"
                    aria-roledescription="slide"
                    style={{ flex: `0 0 ${slideWidth}`, minWidth: 0, paddingLeft: `${gap}px` }}
                  >
                    <BlockWrapper block={block} section={section}>
                      <div className="rounded-lg bg-slate-50 p-4 min-h-[120px] flex items-center justify-center text-[13px] text-slate-500 font-medium">
                        {block.type.replace(/_/g, ' ')}
                      </div>
                    </BlockWrapper>
                  </div>
                ))
              : (
                <div style={{ flex: '0 0 100%', paddingLeft: `${gap}px` }}>
                  <div className="rounded-xl border-2 border-dashed border-slate-200 min-h-[120px] flex items-center justify-center text-[13px] text-slate-400 font-medium">
                    Add blocks to create slides
                  </div>
                </div>
              )
            }
          </div>
        </div>

        {/* Arrows */}
        {showArrows && section.blocks.length > 1 && (
          <>
            <button
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!loop && !canPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow border border-black/10 flex items-center justify-center z-10 disabled:opacity-30 hover:scale-105 transition-transform"
            >
              <ChevronLeft size={18} className="text-slate-700" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              disabled={!loop && !canNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow border border-black/10 flex items-center justify-center z-10 disabled:opacity-30 hover:scale-105 transition-transform"
            >
              <ChevronRight size={18} className="text-slate-700" />
            </button>
          </>
        )}

        {/* Dots */}
        {showDots && section.blocks.length > 1 && (
          <div className="flex justify-center gap-2 pt-3">
            {section.blocks.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                style={{ width: i === selected ? 24 : 8, height: 3, borderRadius: 2, border: 'none', padding: 0, cursor: 'pointer', background: i === selected ? '#1a1a1a' : 'rgba(0,0,0,0.2)', transition: 'all 200ms' }}
              />
            ))}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────

const FooterSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { background = '#111827', showBottomBar = true, bottomBarBg = '#0f172a' } = section.settings;

  const copyrightBlock = section.blocks.find((b) => b.type === 'copyright');
  const year = new Date().getFullYear();

  return (
    <SectionWrapper section={section} label="Footer" allIds={_allPageSectionIds}>
      <div style={{ background }}>
        {/* Footer columns */}
        <div className="max-w-[1200px] mx-auto px-8 py-12">
          <div className="grid grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <ShoppingBag size={15} className="text-white" />
                </div>
                <span className="font-bold text-white">My Store 2</span>
              </div>
              <p className="text-slate-400 text-[13px] leading-relaxed mb-4">
                Your premium shopping destination. Quality products, fast shipping.
              </p>
              <div className="flex gap-3">
                {['f', 'in', 'tw', 'yt'].map((s) => (
                  <div key={s} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-[11px] font-bold hover:bg-white/20 transition-colors cursor-pointer">
                    {s[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* Shop links */}
            <div>
              <h3 className="text-white font-semibold text-[13px] mb-3 uppercase tracking-wide">Shop</h3>
              {['All products', 'New arrivals', 'Featured', 'Sale'].map((link) => (
                <p key={link} className="text-slate-400 text-[12px] mb-2 hover:text-white transition-colors cursor-pointer">{link}</p>
              ))}
            </div>

            {/* Help links */}
            <div>
              <h3 className="text-white font-semibold text-[13px] mb-3 uppercase tracking-wide">Help</h3>
              {['Contact us', 'FAQ', 'Shipping', 'Returns'].map((link) => (
                <p key={link} className="text-slate-400 text-[12px] mb-2 hover:text-white transition-colors cursor-pointer">{link}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        {showBottomBar && (
          <div style={{ background: bottomBarBg }} className="border-t border-white/5">
            <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center justify-between">
              {copyrightBlock ? (
                <BlockWrapper block={copyrightBlock} section={section} inline>
                  <p className="text-[12px]" style={{ color: copyrightBlock.settings.textColor ?? '#9ca3af' }}>
                    {copyrightBlock.settings.text
                      ?.replace('{{year}}', String(year))
                      .replace('{{store_name}}', 'My Store 2')
                      ?? `© ${year} My Store 2. All rights reserved.`}
                  </p>
                </BlockWrapper>
              ) : (
                <p className="text-slate-500 text-[12px]">© {year} My Store 2. All rights reserved.</p>
              )}
              <div className="flex gap-2">
                {['V', 'MC', 'PP', 'GP', 'AP'].map((p) => (
                  <div key={p} className="px-2 py-1 bg-white/5 rounded text-[9px] font-bold text-slate-400 border border-white/10">{p}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

// ─── Generic / unknown section fallback ──────────────────────────────────────

const GenericSection: React.FC<{ section: SectionDoc }> = ({ section }) => (
  <SectionWrapper section={section} label={section.label} allIds={_allPageSectionIds}>
    <div className="px-8 py-12 bg-white border-b border-slate-100">
      <div className="max-w-[1200px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-[13px] font-medium">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          {section.label} section
        </div>
      </div>
    </div>
  </SectionWrapper>
);

// ─── Section router ───────────────────────────────────────────────────────────
// allPageSectionIds is populated by SimulatedCanvas before each render pass
// so CanvasToolbar can compute move-up/down without prop-drilling through
// every section component.

let _allPageSectionIds: string[] = [];

function renderSection(section: SectionDoc): React.ReactNode {
  return <React.Fragment key={section.id}>{renderSectionContent(section)}</React.Fragment>;
}

function renderSectionContent(section: SectionDoc): React.ReactNode {
  // Wrap every section in a SectionWrapper that gets the current allIds
  const allIds = _allPageSectionIds;

  const Wrap: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <SectionWrapper section={section} label={label} allIds={allIds}>
      {children}
    </SectionWrapper>
  );

  switch (section.type) {
    // ── Legacy template sections ─────────────────────────────────────────────
    case 'announcement_bar': return <AnnouncementBarSection section={section} />;
    case 'header':           return <HeaderSection           section={section} />;
    case 'hero':             return <HeroSection             section={section} />;
    case 'featured_collection':
    case 'product_grid':     return <FeaturedCollectionSection section={section} />;
    case 'newsletter':       return <NewsletterSection        section={section} />;
    case 'footer':           return <FooterSection            section={section} />;

    // ── eCraftIndia custom sections ───────────────────────────────────────────
    case 'collection_circles': return <CollectionCirclesSectionCanvas section={section} />;
    case 'product_mosaic':     return <ProductMosaicSectionCanvas     section={section} />;
    case 'editorial_banner':   return <EditorialBannerSectionCanvas   section={section} />;
    case 'trust_badges_bar':   return <TrustBadgesBarSectionCanvas    section={section} />;
    case 'brand_story':        return <BrandStorySectionCanvas        section={section} />;
    // ── Sprint 8: layout primitives (ContentNode-compatible) ─────────────────
    case 'carousel':  return <CarouselSection section={section} />;
    case 'container': return <Wrap label="Container"><ContainerPrimitive section={section} /></Wrap>;
    case 'stack':     return <Wrap label="Stack">    <StackPrimitive     section={section} /></Wrap>;
    case 'grid':      return <Wrap label="Grid">     <GridPrimitive      section={section} /></Wrap>;
    case 'columns':   return <Wrap label="Columns">  <ColumnsPrimitive   section={section} /></Wrap>;
    case 'spacer':    return <Wrap label="Spacer">   <SpacerPrimitive    section={section} /></Wrap>;
    case 'divider':   return <Wrap label="Divider">  <DividerPrimitive   section={section} /></Wrap>;

    default: return <GenericSection section={section} />;
  }
}

// ─── Main Canvas ─────────────────────────────────────────────────────────────

const SimulatedCanvas: React.FC = () => {
  const { state, dispatch, deselect, allSections } = useEditor();

  // ── Legacy path: hooks must be called unconditionally (Rules of Hooks) ────
  // These are needed for the legacy SectionDoc path. They are cheap no-ops in
  // node mode because pageDoc is null → arrays are empty.

  // Populate the allPageSectionIds for CanvasToolbar before render
  _allPageSectionIds = useMemo(
    () => (state.pageDoc?.sections ?? []).map((s) => s.id),
    [state.pageDoc?.sections],
  );

  // Only page sections (not system header/footer) are registered as sortable items.
  // DndContext lives in EditorLayout — shared with the Layers panel for cross-panel drag.
  const pageSectionIds = useMemo(
    () => (state.pageDoc?.sections ?? []).map((s) => `canvas:${s.id}`),
    [state.pageDoc?.sections],
  );

  // Product page: fetch a real product to power the PDP canvas
  const isProductPage = state.activePage === 'product';
  const boundProductId = state.pageDoc?.sections?.[0]?.settings?.product as string | undefined;
  const { product: canvasProduct, isLoading: productLoading } = useCanvasProduct(
    isProductPage ? (boundProductId ?? null) : null,
  );

  // ── Phase 2: node mode branch ─────────────────────────────────────────────
  // All hooks above have been called. Now it is safe to branch.
  // When CONTENT_NODE_ENABLED is ON for the store, render via NodeCanvas.
  // CONTENT_NODE_ENABLED defaults to false — the legacy path below is taken
  // for every store until the flag is explicitly enabled.
  if (state.nodeMode && state.nodeTree) {
    return <NodeCanvas />;
  }

  // ── Legacy SectionDoc path (unchanged below this line) ────────────────────

  return (
    <div
      className="bg-white min-h-full"
      onClick={deselect}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Product page: show real PDP when no sections are present yet */}
      {isProductPage && allSections.filter(s => !s.isSystem).length === 0 && (
        productLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Loading product preview…
          </div>
        ) : canvasProduct ? (
          <ProductPageCanvas product={canvasProduct} previewMode={state.previewMode} />
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No products in store yet. Add products to preview the Product Detail Page.
          </div>
        )
      )}

      {/* SortableContext registers canvas sections into the shared DndContext
          provided by EditorLayout — no local DndContext needed here */}
      <SortableContext items={pageSectionIds} strategy={verticalListSortingStrategy}>
        {allSections.map((section) => renderSection(section))}
      </SortableContext>

      {/* Add section button at bottom */}
      {!state.selection.type && (
        <div className="py-8 flex items-center justify-center border-t border-slate-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              state.pageDoc && (() => {})();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-300 text-slate-400 hover:text-blue-500 text-[13px] font-medium transition-all"
          >
            <Plus size={15} />
            Add section
          </button>
        </div>
      )}
    </div>
  );
};

export default SimulatedCanvas;
