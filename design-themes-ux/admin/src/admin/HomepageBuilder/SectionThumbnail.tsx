/**
 * SectionThumbnail.tsx
 *
 * Mini CSS-layout previews for every Aurus homepage section type.
 * Each thumbnail is 88×58 px, uses the section's actual brand colours,
 * and represents the visual structure of the section without images or data.
 *
 * Phase 2: replace these static CSS previews with live server-side snapshots.
 */

import React from 'react';
import { SECTION_TYPE, type SectionType } from './SectionRegistry';

interface Props {
  sectionType: SectionType | string;
  /** Reduce opacity for locked / disabled sections */
  muted?: boolean;
}

// ─── Shared wrapper ──────────────────────────────────────────────────────────

const Wrap: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children, className = '', style,
}) => (
  <div
    className={`w-[88px] h-[58px] rounded-lg overflow-hidden flex-shrink-0 border border-black/[0.06] shadow-sm ${className}`}
    style={style}
  >
    {children}
  </div>
);

// ─── Individual thumbnails ───────────────────────────────────────────────────

const HeroBanner = () => (
  <Wrap style={{ background: 'linear-gradient(120deg, #3B0764 0%, #6D28D9 55%, #A78BFA 100%)' }}>
    <div className="relative w-full h-full">
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(30,0,60,0.85) 0%, rgba(30,0,60,0.3) 60%, transparent 100%)' }} />
      {/* Text lines */}
      <div className="absolute top-3 left-3 space-y-[3px]">
        <div className="h-[2px] w-7 rounded-full bg-white/40" />
        <div className="h-[3px] w-14 rounded-full bg-white/85" />
        <div className="h-[3px] w-10 rounded-full bg-yellow-300/80" />
      </div>
      {/* CTA */}
      <div className="absolute bottom-3 left-3 h-[6px] w-10 rounded-sm bg-white/20 border border-white/40" />
      {/* Slide dots */}
      <div className="absolute bottom-2.5 right-3 flex items-center gap-1">
        <div className="w-3 h-[5px] rounded-full bg-white" />
        <div className="w-1 h-1 rounded-full bg-white/40" />
        <div className="w-1 h-1 rounded-full bg-white/40" />
      </div>
    </div>
  </Wrap>
);

const FeaturedProducts = () => (
  <Wrap className="flex">
    {/* Left dark panel */}
    <div className="w-[35px] flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg, #0A0714 0%, #1B0A3B 100%)' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to br, rgba(109,40,217,0.3), transparent)' }} />
    </div>
    {/* Right lavender panel */}
    <div className="flex-1 p-1.5 flex flex-col justify-between" style={{ background: '#EDE9FE' }}>
      {/* 4 product cards */}
      <div className="flex gap-1 flex-1 mb-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 rounded-[3px] bg-white shadow-sm border border-purple-100" />
        ))}
      </div>
      {/* Shop Now pill */}
      <div className="self-end h-[5px] w-12 rounded-full" style={{ background: '#3D0F6E' }} />
    </div>
  </Wrap>
);

const CampaignGrid = () => (
  <Wrap className="bg-white p-[3px]">
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-[2px]">
      {/* Left full-height — pink */}
      <div className="row-span-2 rounded-[3px] relative overflow-hidden" style={{ background: '#F2899D' }}>
        {/* 2×2 product grid */}
        <div className="absolute inset-[4px] grid grid-cols-2 gap-[2px]">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-white/30 rounded-[2px]" />
          ))}
        </div>
        {/* Sale text hint */}
        <div className="absolute bottom-1.5 left-1.5 space-y-[2px]">
          <div className="w-6 h-[2px] bg-gray-800/70 rounded-full" />
          <div className="w-8 h-[2px] bg-gray-800/50 rounded-full" />
        </div>
      </div>
      {/* Top right — teal */}
      <div className="rounded-[3px]" style={{ background: 'linear-gradient(135deg, #6DC5B0 0%, #2D8B7A 100%)' }} />
      {/* Bottom right — cream */}
      <div className="rounded-[3px] flex items-end p-1" style={{ background: '#F0E6D4' }}>
        <div className="space-y-[2px]">
          <div className="w-6 h-[2px] bg-gray-700/60 rounded-full" />
          <div className="w-4 h-[2px] bg-gray-500/50 rounded-full" />
        </div>
      </div>
    </div>
  </Wrap>
);

const CategoryDiscovery = () => (
  <Wrap className="flex items-center gap-1.5 px-2" style={{ background: '#F5EEFF', border: '1px solid #DDD0F5' }}>
    {/* Gift icon block */}
    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 text-[12px]"
      style={{ background: 'linear-gradient(135deg, #C084FC 0%, #7C3AED 100%)' }}>
      🎁
    </div>
    {/* Category cards row */}
    <div className="flex gap-[3px] flex-1">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex-1 h-8 rounded-[4px] bg-white shadow-sm border border-purple-100/80" />
      ))}
    </div>
  </Wrap>
);

const CategoryIcons = () => (
  <Wrap className="flex items-center justify-center gap-2 px-2 bg-white">
    {[0, 1, 2, 3, 4].map(i => (
      <div key={i} className="flex flex-col items-center gap-1">
        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-slate-200 bg-purple-50" />
        <div className="w-[14px] h-[2px] rounded-full bg-slate-200" />
      </div>
    ))}
  </Wrap>
);

const TrustBadges = () => (
  <Wrap className="flex items-center justify-around px-2" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
    {['🛡️', '🔄', '⭐', '📞'].map((icon, i) => (
      <div key={i} className="flex flex-col items-center gap-1">
        <span className="text-[10px] leading-none">{icon}</span>
        <div className="w-8 h-[2px] rounded-full bg-slate-300/70" />
        <div className="w-6 h-[2px] rounded-full bg-slate-200/70" />
      </div>
    ))}
  </Wrap>
);

const Collections = () => (
  <Wrap className="flex gap-[2px] p-[3px]" style={{ background: '#EDE9FE' }}>
    {['#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9'].map((bg, i) => (
      <div key={i} className="flex-1 rounded-[3px] relative overflow-hidden" style={{ background: bg }}>
        {/* Name hint at bottom */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div className="w-3 h-[2px] rounded-full bg-white/60" />
        </div>
      </div>
    ))}
  </Wrap>
);

const BridalSection = () => (
  <Wrap className="flex">
    {/* Left editorial */}
    <div className="w-[40px] flex-shrink-0 relative" style={{ background: 'linear-gradient(145deg, #F9E4D4 0%, #E8C5A0 100%)' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)' }} />
      <div className="absolute bottom-1.5 left-1.5 space-y-[2px]">
        <div className="w-7 h-[2px] rounded-full bg-white/80" />
        <div className="w-5 h-[2px] rounded-full bg-white/60" />
      </div>
    </div>
    {/* Right product carousel */}
    <div className="flex-1 p-1.5 flex flex-col justify-between" style={{ background: '#EDE0FF' }}>
      <div className="flex gap-[3px] flex-1 mb-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 rounded-[3px] bg-white/80 border border-purple-100" />
        ))}
      </div>
      <div className="self-end h-[5px] w-10 rounded-full" style={{ background: '#6D28D9' }} />
    </div>
  </Wrap>
);

const EditorialBanners = () => (
  <Wrap className="flex gap-[2px] p-[3px] bg-white">
    {/* Lavender card — 9KT Gold */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-end p-1" style={{ background: '#EEE6FF' }}>
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full bg-slate-400/60" />
        <div className="w-2/3 h-[2px] rounded-full bg-slate-400/40" />
        <div className="mt-0.5 w-7 h-[4px] rounded-sm bg-gray-800/50" />
      </div>
    </div>
    {/* Terracotta card */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-end p-1"
      style={{ background: 'linear-gradient(145deg, #D4836A 0%, #B85A3F 100%)' }}>
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full bg-white/60" />
        <div className="w-2/3 h-[2px] rounded-full bg-white/40" />
        <div className="mt-0.5 w-7 h-[4px] rounded-full bg-gray-900/40" />
      </div>
    </div>
    {/* Cream card */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-end p-1" style={{ background: '#F5EAE0' }}>
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full bg-slate-400/60" />
        <div className="w-1/2 h-[2px] rounded-full bg-slate-400/40" />
      </div>
    </div>
  </Wrap>
);

const StoreLocator = () => (
  <Wrap className="flex">
    {/* Left — video/image */}
    <div className="w-[40px] flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg, #374151 0%, #1F2937 100%)' }}>
      <div className="absolute inset-0 bg-black/30" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-white/25 border border-white/40 flex items-center justify-center">
          <div className="w-0 h-0 ml-[2px]"
            style={{ borderTop: '3px solid transparent', borderBottom: '3px solid transparent', borderLeft: '5px solid white' }} />
        </div>
      </div>
    </div>
    {/* Right — form */}
    <div className="flex-1 flex flex-col justify-center gap-1.5 px-2" style={{ background: '#FDEAE0' }}>
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full" style={{ background: '#2D1B6E', opacity: 0.4 }} />
        <div className="w-3/4 h-[2px] rounded-full" style={{ background: '#2D1B6E', opacity: 0.3 }} />
      </div>
      {/* Pincode input */}
      <div className="w-full h-3 rounded-md bg-white border border-gray-200" />
    </div>
  </Wrap>
);

const TryAtHome = () => (
  <Wrap style={{ background: 'linear-gradient(135deg, #475569 0%, #1E293B 100%)' }}>
    <div className="relative w-full h-full">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.08) 100%)' }} />
      <div className="absolute bottom-2.5 left-2.5 space-y-[3px]">
        <div className="w-12 h-[2px] rounded-full bg-white/80" />
        <div className="w-10 h-[2px] rounded-full bg-white/70" />
        <div className="mt-1 w-12 h-[5px] rounded-sm bg-white/15 border border-white/30" />
      </div>
    </div>
  </Wrap>
);

const VideoCall = () => (
  <Wrap style={{ background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 100%)' }}>
    <div className="relative w-full h-full">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(88,28,135,0.88) 0%, rgba(109,40,217,0.35) 55%, rgba(109,40,217,0.12) 100%)' }} />
      <div className="absolute bottom-2.5 left-2.5 space-y-[3px]">
        <div className="w-12 h-[2px] rounded-full bg-white/80" />
        <div className="w-10 h-[2px] rounded-full bg-white/70" />
        <div className="mt-1 w-12 h-[5px] rounded-sm bg-white/15 border border-white/30" />
      </div>
    </div>
  </Wrap>
);

const GiftRegistry = () => (
  <Wrap className="flex gap-[2px] p-[3px]"
    style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 55%, #FAF0FF 100%)' }}>
    {/* Left col */}
    <div className="flex-1 flex flex-col justify-between py-1 px-1.5">
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full bg-purple-300" />
        <div className="w-2/3 h-[2px] rounded-full bg-purple-400" />
      </div>
      <div className="w-8 h-[5px] rounded-full bg-purple-600" />
    </div>
    {/* Center — gift */}
    <div className="w-[16px] flex items-center justify-center text-[12px]">🎁</div>
    {/* Right col — steps */}
    <div className="flex-1 py-1.5 space-y-[4px]">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-1">
          <div className="w-[6px] h-[6px] rounded-full bg-white border border-purple-200 flex-shrink-0" />
          <div className="flex-1 h-[2px] rounded-full bg-purple-200" />
        </div>
      ))}
    </div>
  </Wrap>
);

const PromotionalCards = () => (
  <Wrap className="flex gap-[2px] p-[3px] bg-white">
    {/* Deep purple */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-between p-1"
      style={{ background: 'linear-gradient(135deg, #2D0A52 0%, #5B21B6 100%)' }}>
      <span className="text-[9px] leading-none">💎</span>
      <div className="space-y-[2px]">
        <div className="w-full h-[2px] rounded-full bg-white/60" />
        <div className="w-7 h-[4px] rounded-sm bg-white/75" />
      </div>
    </div>
    {/* Teal */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-between p-1"
      style={{ background: 'linear-gradient(135deg, #00BFA5 0%, #00897B 100%)' }}>
      <span className="text-[9px] leading-none">🥈</span>
      <div className="w-7 h-[4px] rounded-full bg-white/75" />
    </div>
    {/* Gold */}
    <div className="flex-1 rounded-[3px] flex flex-col justify-between p-1"
      style={{ background: 'linear-gradient(135deg, #9A6B00 0%, #D4A017 100%)' }}>
      <span className="text-[9px] leading-none">🪙</span>
      <div className="w-7 h-[4px] rounded-sm bg-white/75" />
    </div>
  </Wrap>
);

const ExpertHelp = () => (
  <Wrap className="flex gap-[2px] p-[3px]" style={{ background: '#FAFAF8', border: '1px solid #E5E7EB' }}>
    {/* Left — store locator */}
    <div className="w-[44px] flex-shrink-0 rounded-[3px] relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a1230 0%, #2D1B6E 100%)' }}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute bottom-1.5 left-1 space-y-[2px]">
        <div className="w-6 h-[2px] rounded-full bg-white/50" />
        <div className="w-4 h-[2px] rounded-full bg-white/40" />
      </div>
    </div>
    {/* Right — two stacked cards */}
    <div className="flex-1 flex flex-col gap-[2px]">
      <div className="flex-1 rounded-[3px]" style={{ background: '#4A1D96' }} />
      <div className="flex-1 rounded-[3px]" style={{ background: '#1B4D3E' }} />
    </div>
  </Wrap>
);

const SocialUGC = () => (
  <Wrap style={{ background: '#0F0A14' }}>
    <div className="w-full h-full p-1.5">
      <div className="grid gap-[2px] h-full" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        <div className="row-span-2 rounded-[3px] bg-gray-600/60" />
        <div className="rounded-[3px] bg-gray-500/55" />
        <div className="rounded-[3px] bg-gray-600/50" />
        <div className="rounded-[3px] bg-gray-500/45" />
        <div className="rounded-[3px] bg-gray-600/55" />
        <div className="rounded-[3px] bg-gray-500/50" />
        <div className="rounded-[3px] bg-gray-600/45" />
      </div>
    </div>
  </Wrap>
);

const Newsletter = () => (
  <Wrap className="flex flex-col items-center justify-center gap-1.5 p-2.5"
    style={{ background: 'linear-gradient(135deg, #581C87 0%, #7C3AED 60%, #6D28D9 100%)' }}>
    <div className="w-12 h-[2px] rounded-full bg-white/50" />
    <div className="w-16 h-[3px] rounded-full bg-white/80" />
    {/* Email input row */}
    <div className="flex w-full gap-1 mt-0.5">
      <div className="flex-1 h-3.5 rounded-sm bg-white/15 border border-white/20" />
      <div className="w-8 h-3.5 rounded-sm bg-white/70" />
    </div>
  </Wrap>
);

// ─── Fallback ────────────────────────────────────────────────────────────────

const Fallback: React.FC<{ color: string }> = ({ color }) => (
  <Wrap className={`flex items-center justify-center ${color}`}>
    <div className="w-6 h-6 rounded-full bg-current opacity-20" />
  </Wrap>
);

// ─── Main component ──────────────────────────────────────────────────────────

const THUMBNAIL_MAP: Record<string, React.FC> = {
  [SECTION_TYPE.HERO_BANNER]:        HeroBanner,
  [SECTION_TYPE.FEATURED_PRODUCTS]:  FeaturedProducts,
  [SECTION_TYPE.CAMPAIGN_GRID]:      CampaignGrid,
  [SECTION_TYPE.CATEGORY_DISCOVERY]: CategoryDiscovery,
  [SECTION_TYPE.CATEGORY_ICONS]:     CategoryIcons,
  [SECTION_TYPE.TRUST_BADGES]:       TrustBadges,
  [SECTION_TYPE.COLLECTIONS]:        Collections,
  [SECTION_TYPE.BRIDAL_SECTION]:     BridalSection,
  [SECTION_TYPE.EDITORIAL_BANNERS]:  EditorialBanners,
  [SECTION_TYPE.STORE_LOCATOR]:      StoreLocator,
  [SECTION_TYPE.TRY_AT_HOME]:        TryAtHome,
  [SECTION_TYPE.VIDEO_CALL]:         VideoCall,
  [SECTION_TYPE.GIFT_REGISTRY]:      GiftRegistry,
  [SECTION_TYPE.PROMOTIONAL_CARDS]:  PromotionalCards,
  [SECTION_TYPE.EXPERT_HELP]:        ExpertHelp,
  [SECTION_TYPE.SOCIAL_UGC]:         SocialUGC,
  [SECTION_TYPE.NEWSLETTER]:         Newsletter,
};

const SectionThumbnail: React.FC<Props> = ({ sectionType, muted = false }) => {
  const ThumbnailComponent = THUMBNAIL_MAP[sectionType];

  return (
    <div className={muted ? 'opacity-45 grayscale-[40%]' : ''}>
      {ThumbnailComponent
        ? <ThumbnailComponent />
        : <Fallback color="bg-slate-100" />
      }
    </div>
  );
};

export default SectionThumbnail;
