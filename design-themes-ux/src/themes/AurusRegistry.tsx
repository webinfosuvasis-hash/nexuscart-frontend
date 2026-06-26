import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegistry, OCCASIONS, OccasionKey } from '@/context/RegistryContext';
import { useStore, inr } from '@/context/StoreContext';
import {
  Check, Share2, Copy, Trash2, ShoppingBag, ArrowLeft,
  Edit2, Gift, CheckCircle2, Heart,
} from 'lucide-react';

const UI    = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

const OCCASION_KEYS = Object.keys(OCCASIONS) as OccasionKey[];

/* ─── Occasion pill ─────────────────────────────────────────── */
const OccasionPill: React.FC<{ occasion: OccasionKey; size?: 'sm' | 'md' }> = ({ occasion, size = 'sm' }) => {
  const occ = OCCASIONS[occasion];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-semibold"
      style={{
        background: occ.bg,
        color: occ.color,
        border: `1px solid ${occ.border}`,
        fontSize: size === 'sm' ? 9 : 11,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
      }}
    >
      {occ.icon} {occ.label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   SETUP SCREEN — shown when no registry name set yet
═══════════════════════════════════════════════════════════ */
const SetupScreen: React.FC = () => {
  const { setRegistryName, setOwnerName } = useRegistry();
  const [nameInput,     setNameInput]     = useState('');
  const [registryInput, setRegistryInput] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const handleCreate = () => {
    if (!nameInput.trim() || !registryInput.trim()) return;
    setOwnerName(nameInput.trim());
    setRegistryName(registryInput.trim());
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 50%, #FAF0FF 100%)', ...UI }}
    >
      {/* Back */}
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-[12px] text-gray-500 hover:text-purple-700 transition-colors">
        <ArrowLeft className="w-4 h-4"/> Home
      </Link>

      {/* Hero text */}
      <div className="text-center mb-10 max-w-[480px]">
        <div className="text-[48px] mb-4">🎀</div>
        <h1 className="text-[36px] font-light text-gray-900 leading-tight" style={SERIF}>
          Your Wish Registry
        </h1>
        <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
          Curate your perfect collection for life's most special moments.
          Share with family &amp; friends so they always know exactly what to gift.
        </p>
      </div>

      {/* Step 1 — choose occasion focus */}
      {step === 1 && (
        <div className="w-full max-w-[560px]">
          <p className="text-[13px] font-semibold text-gray-700 text-center mb-5 uppercase tracking-[0.08em]">
            What's your primary occasion?
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {OCCASION_KEYS.map(key => {
              const occ = OCCASIONS[key];
              return (
                <button
                  key={key}
                  onClick={() => {
                    setRegistryInput(`My ${occ.label} Wishlist`);
                    setStep(2);
                  }}
                  className="flex flex-col items-center gap-2 py-5 px-2 rounded-2xl border-2 border-transparent hover:border-purple-300 transition-all group"
                  style={{ background: occ.bg }}
                >
                  <span className="text-[28px] group-hover:scale-110 transition-transform">{occ.icon}</span>
                  <span className="text-[12px] font-semibold" style={{ color: occ.color }}>{occ.label}</span>
                  <span className="text-[9px] text-gray-400 text-center leading-snug">{occ.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-5">
            You can add items from ALL occasions after setup.
          </p>
        </div>
      )}

      {/* Step 2 — name inputs */}
      {step === 2 && (
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-8">
          <button onClick={() => setStep(1)} className="text-[11px] text-gray-400 hover:text-gray-600 mb-5 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3"/> Back
          </button>

          <h2 className="text-[22px] font-light text-gray-900 mb-6" style={SERIF}>
            Create your registry
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="e.g., Priya Sharma"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
                style={UI}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                Registry Name
              </label>
              <input
                type="text"
                value={registryInput}
                onChange={e => setRegistryInput(e.target.value)}
                placeholder="e.g., Priya's Wedding Wishlist"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
                style={UI}
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!nameInput.trim() || !registryInput.trim()}
            className="w-full mt-7 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white py-3 rounded-full text-[13px] font-bold tracking-wide transition-colors"
            style={UI}
          >
            Create My Registry →
          </button>

          <p className="text-[11px] text-gray-400 text-center mt-4">
            You'll get a shareable link to send to family &amp; friends.
          </p>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   REGISTRY CARD — individual item card
═══════════════════════════════════════════════════════════ */
const RegistryCard: React.FC<{
  item: ReturnType<typeof useRegistry>['items'][0];
  isOwner?: boolean;
}> = ({ item, isOwner = true }) => {
  const { removeFromRegistry, markPurchased } = useRegistry();
  const { addToCart } = useStore();
  const disc = Math.round(((item.product.mrp - item.product.price) / item.product.mrp) * 100);

  return (
    <div
      className="group bg-white rounded-xl overflow-hidden relative"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)', opacity: item.isPurchased ? 0.75 : 1 }}
    >
      {/* Purchased overlay */}
      {item.isPurchased && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-green-500"/>
            <span className="text-[11px] font-bold text-green-700 uppercase tracking-wide" style={UI}>Gifted ✓</span>
          </div>
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-square bg-[#F8F5FF] overflow-hidden">
        <Link to={`/products/${item.product.id}`}>
          <img
            src={item.product.image}
            alt={item.product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </Link>

        {/* Occasion tag */}
        <div className="absolute top-2 left-2 z-10">
          <OccasionPill occasion={item.occasion}/>
        </div>

        {/* Remove button (owner only) */}
        {isOwner && !item.isPurchased && (
          <button
            onClick={() => removeFromRegistry(item.product.id, item.occasion)}
            className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3 text-red-500"/>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <Link to={`/products/${item.product.id}`}>
          <p className="text-[12px] text-gray-800 font-medium line-clamp-2 leading-snug hover:text-purple-700 transition-colors" style={UI}>
            {item.product.name}
          </p>
        </Link>

        <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[13px] font-bold text-gray-900" style={UI}>{inr(item.product.price)}</span>
          <span className="text-[10px] text-gray-400 line-through">{inr(item.product.mrp)}</span>
          <span className="text-[9px] font-bold text-emerald-600">{disc}% off</span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex border-t border-gray-100">
        {!item.isPurchased && !isOwner && (
          <button
            onClick={() => { addToCart(item.product); markPurchased(item.product.id, item.occasion); }}
            className="flex-1 py-2 text-[10px] font-semibold text-white bg-purple-700 hover:bg-purple-800 flex items-center justify-center gap-1 transition-colors"
            style={UI}
          >
            <ShoppingBag className="w-3 h-3"/> Gift This
          </button>
        )}
        {!item.isPurchased && isOwner && (
          <>
            <button
              onClick={() => addToCart(item.product)}
              className="flex-1 py-2 text-[10px] font-medium text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
              style={UI}
            >
              Add to Bag
            </button>
            <div className="w-px bg-gray-100"/>
            <button
              onClick={() => markPurchased(item.product.id, item.occasion)}
              className="flex-1 py-2 text-[10px] font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
              style={UI}
            >
              Mark Gifted
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN REGISTRY COMPONENT
═══════════════════════════════════════════════════════════ */
const AurusRegistry: React.FC = () => {
  const {
    registryName, ownerName, shareCode, items,
    totalItems, purchasedItems, clearRegistry,
  } = useRegistry();

  const [activeTab, setActiveTab]     = useState<OccasionKey | 'all'>('all');
  const [copied,    setCopied]        = useState(false);
  const [showShare, setShowShare]     = useState(false);

  /* Show setup if no registry created yet */
  if (!registryName) return <SetupScreen />;

  const filteredItems = activeTab === 'all'
    ? items
    : items.filter(i => i.occasion === activeTab);

  const progressPct = totalItems > 0 ? Math.round((purchasedItems / totalItems) * 100) : 0;
  const shareUrl    = `${window.location.origin}/registry`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const countFor = (occ: OccasionKey) => items.filter(i => i.occasion === occ).length;

  return (
    <div className="min-h-screen" style={{ background: '#F5F3FA', ...UI }}>

      {/* ── Header ─────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1100px] mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-purple-700 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5"/>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-semibold text-gray-900 truncate" style={SERIF}>{registryName}</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">by {ownerName} · {totalItems} items · {purchasedItems} gifted</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowShare(s => !s)}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-full text-[12px] font-semibold transition-colors"
              style={UI}
            >
              <Share2 className="w-3.5 h-3.5"/> Share
            </button>
            <Link
              to="/jewellery/rings"
              className="flex items-center gap-1.5 border border-purple-300 text-purple-700 hover:bg-purple-50 px-4 py-2 rounded-full text-[12px] font-semibold transition-colors"
              style={UI}
            >
              + Add Items
            </Link>
          </div>
        </div>

        {/* Share panel */}
        {showShare && (
          <div className="border-t border-gray-100 bg-purple-50 px-4 py-4">
            <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-white border border-purple-200 rounded-full px-4 py-2 min-w-0">
                <span className="text-[11px] text-gray-500 truncate flex-1">{shareUrl} · Code: <strong className="text-purple-700">{shareCode}</strong></span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 bg-white border border-purple-300 text-purple-700 px-4 py-2 rounded-full text-[12px] font-semibold hover:bg-purple-50 transition-colors"
                  style={UI}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Check my Wish Registry — ${registryName}! ${shareUrl} (Code: ${shareCode})`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full text-[12px] font-semibold transition-colors"
                  style={UI}
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-[1100px] mx-auto px-4 py-6">

        {/* ── Progress bar ──────────────────────────── */}
        {totalItems > 0 && (
          <div className="bg-white rounded-xl p-4 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-gray-700">Registry Progress</span>
              <span className="text-[12px] text-gray-500">{purchasedItems} of {totalItems} items gifted</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #7C3AED, #9333EA)' }}
              />
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {OCCASION_KEYS.filter(k => countFor(k) > 0).map(k => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[12px]">{OCCASIONS[k].icon}</span>
                  <span className="text-[11px] text-gray-500">{OCCASIONS[k].label}: <strong className="text-gray-700">{countFor(k)}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Occasion tabs ─────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-all border ${
              activeTab === 'all'
                ? 'bg-purple-700 text-white border-purple-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
            }`}
            style={UI}
          >
            All ({totalItems})
          </button>
          {OCCASION_KEYS.map(key => {
            const count = countFor(key);
            const occ   = OCCASIONS[key];
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-all border"
                style={{
                  background: isActive ? occ.color : occ.bg,
                  color:      isActive ? '#fff'    : occ.color,
                  border:     `1px solid ${isActive ? occ.color : occ.border}`,
                }}
              >
                {occ.icon} {occ.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Empty state ───────────────────────────── */}
        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <div className="text-[48px] mb-4">
              {activeTab === 'all' ? '🛍️' : OCCASIONS[activeTab as OccasionKey].icon}
            </div>
            <h3 className="text-[20px] font-light text-gray-700 mb-2" style={SERIF}>
              {activeTab === 'all' ? 'Your registry is empty' : `No ${OCCASIONS[activeTab as OccasionKey].label} items yet`}
            </h3>
            <p className="text-[13px] text-gray-400 mb-6">
              Browse our collection and add items you love.
            </p>
            <Link
              to="/jewellery/rings"
              className="inline-block bg-purple-700 hover:bg-purple-800 text-white px-8 py-2.5 rounded-full text-[13px] font-bold transition-colors"
              style={UI}
            >
              Browse Collection
            </Link>
          </div>
        )}

        {/* ── Product grid ──────────────────────────── */}
        {filteredItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item, i) => (
              <RegistryCard key={`${item.product.id}-${item.occasion}-${i}`} item={item} isOwner={true}/>
            ))}
          </div>
        )}

        {/* ── Occasion grid — add more items CTA ────── */}
        {totalItems > 0 && (
          <div className="mt-12 bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-[16px] font-semibold text-gray-900 mb-1" style={UI}>Add more items by occasion</h3>
            <p className="text-[12px] text-gray-400 mb-5">Browse our curated collections for each occasion</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {OCCASION_KEYS.map(key => {
                const occ = OCCASIONS[key];
                return (
                  <Link
                    key={key}
                    to="/jewellery/rings"
                    className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-transparent hover:border-purple-200 transition-all"
                    style={{ background: occ.bg }}
                  >
                    <span className="text-[24px]">{occ.icon}</span>
                    <span className="text-[11px] font-semibold" style={{ color: occ.color }}>{occ.label}</span>
                    <span className="text-[9px] text-gray-400 text-center">{countFor(key)} items</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Danger zone ───────────────────────────── */}
        {totalItems > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => { if (window.confirm('Clear your entire registry? This cannot be undone.')) clearRegistry(); }}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
              style={UI}
            >
              Clear entire registry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AurusRegistry;
