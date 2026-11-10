import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Lock } from 'lucide-react';

/* ─── Design tokens ──────────────────────────────────────────────────────────
 * Warm off-white canvas, white surfaces, hairline warm borders and one refined
 * violet accent. Spacing sticks to the 8px grid (Tailwind 2/4/6/8/12 units);
 * radius: 12px for cards, 8px for controls.
 */
export const C = {
  bg:           '#FAF8F5',
  surface:      '#FFFFFF',
  border:       '#E8E3DB',
  borderStrong: '#D6CFC4',
  ink:          '#1C1917',
  muted:        '#5F5953', // 6.6:1 on white
  accent:       '#6D28D9',
  accentSoft:   '#F6F2FF',
  success:      '#0F766E',
  danger:       '#B42318',
} as const;

export const UI    = { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' };
export const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

export const CARD = 'bg-white rounded-xl border border-[#E8E3DB] shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-16px_rgba(28,25,23,0.12)]';
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2';
export const BTN_PRIMARY =
  `inline-flex items-center justify-center gap-2 rounded-lg bg-[#6D28D9] text-white font-semibold tracking-[0.08em] uppercase transition-colors hover:bg-[#5B21B6] active:bg-[#4C1D95] disabled:bg-[#A8A29E] disabled:cursor-not-allowed ${FOCUS}`;
export const BTN_SECONDARY =
  `inline-flex items-center justify-center gap-2 rounded-lg border border-[#D6CFC4] bg-white text-[#1C1917] font-medium transition-colors hover:border-[#6D28D9] hover:text-[#6D28D9] disabled:opacity-50 ${FOCUS}`;
export const LINK_BTN = `text-[13px] font-semibold text-[#6D28D9] hover:text-[#4C1D95] underline-offset-4 hover:underline rounded ${FOCUS}`;

/* ─── Selectable option cards (shipping, payment, saved addresses) ─────────── */
/** Colour/shadow transition that switches itself off under prefers-reduced-motion. */
export const EASE = 'transition-[border-color,background-color,box-shadow,color] duration-200 ease-out motion-reduce:transition-none';
const KEYBOARD_RING = '[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-[#6D28D9] [&:has(:focus-visible)]:ring-offset-2';
export const optionCard = (selected: boolean) =>
  `relative flex items-center gap-3 sm:gap-4 rounded-xl border cursor-pointer ${EASE} ${KEYBOARD_RING} ` +
  (selected
    ? 'border-[#6D28D9] bg-[#F6F2FF] shadow-[inset_0_0_0_1px_#6D28D9,0_4px_16px_-8px_rgba(109,40,217,0.35)]'
    : 'border-[#E8E3DB] bg-white hover:border-[#C4B5FD] hover:shadow-[0_4px_16px_-10px_rgba(28,25,23,0.25)]');
export const optionIcon = (selected: boolean) =>
  `w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${EASE} ` +
  (selected ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#FAF8F5] border-[#EFEAE3] text-[#6D28D9]');

/** Classic radio indicator (purely visual — the real control is the sr-only native input). */
export const RadioDot: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden
    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 bg-white ${EASE} ${checked ? 'border-[#6D28D9]' : 'border-[#CFC7BB]'}`}
  >
    <span className={`w-2.5 h-2.5 rounded-full bg-[#6D28D9] transition-transform duration-200 motion-reduce:transition-none ${checked ? 'scale-100' : 'scale-0'}`} />
  </span>
);

/* ─── Page shell + header ──────────────────────────────────────────────────── */
export const CHECKOUT_STEPS = ['Bag', 'Address', 'Shipping', 'Review & Pay'] as const;

/**
 * Four equal columns, label under each marker, connector drawn between marker
 * centres — so it stays balanced from 375px up without hiding any label.
 */
const ProgressSteps: React.FC<{ current: number }> = ({ current }) => (
  <ol aria-label="Checkout progress" className="grid grid-cols-4 max-w-[560px] mx-auto py-2">
    {CHECKOUT_STEPS.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <li key={label} className="relative flex flex-col items-center gap-1" aria-current={active ? 'step' : undefined}>
          {i < CHECKOUT_STEPS.length - 1 && (
            <span aria-hidden className="absolute top-3 left-[calc(50%+18px)] right-[calc(-50%+18px)] h-0.5 rounded-full bg-[#E8E3DB] overflow-hidden">
              <span className={`block h-full bg-[#6D28D9] origin-left transition-transform duration-300 motion-reduce:transition-none ${done ? 'scale-x-100' : 'scale-x-0'}`} />
            </span>
          )}
          <span
            className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${EASE} ${active ? 'ring-4 ring-[#6D28D9]/15' : ''}`}
            style={{
              background:  done ? C.accent : active ? C.surface : C.surface,
              borderColor: done || active ? C.accent : C.borderStrong,
              color:       done ? '#fff' : active ? C.accent : C.muted,
            }}
          >
            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : i + 1}
          </span>
          <span
            className={`text-[11px] sm:text-[12px] leading-4 whitespace-nowrap ${active ? 'font-semibold' : done ? 'font-medium' : ''}`}
            style={{ color: active || done ? C.ink : C.muted }}
          >
            {label}
            {done && <span className="sr-only"> (completed)</span>}
          </span>
        </li>
      );
    })}
  </ol>
);

/** Total header height — the desktop sidebar sticks just below it. */
export const HEADER_OFFSET = 'lg:top-[144px]';

export const CheckoutShell: React.FC<{
  currentStep: number;
  onBackToBag: () => void;
  children: React.ReactNode;
}> = ({ currentStep, onBackToBag, children }) => (
  <div className="min-h-screen" style={{ ...UI, background: C.bg, color: C.ink }}>
    <header className="sticky top-0 z-40 bg-white border-b border-[#E8E3DB]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Equal side columns keep the wordmark optically centred at every width. */}
        <div className="h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            type="button"
            onClick={onBackToBag}
            aria-label="Back to Bag"
            className={`justify-self-start -ml-2 h-10 px-2 flex items-center gap-2 text-[13px] font-medium text-[#5F5953] hover:text-[#6D28D9] ${EASE} rounded-lg ${FOCUS}`}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">Back to Bag</span>
            <span className="sm:hidden">Bag</span>
          </button>
          <Link to="/" className={`text-[22px] sm:text-[26px] leading-none font-semibold tracking-[0.28em] pl-[0.28em] text-[#1C1917] rounded ${FOCUS}`} style={SERIF} aria-label="Aurus home">
            AURUS
          </Link>
          <span className="justify-self-end flex items-center gap-2 text-[12px] text-[#5F5953]">
            <Lock className="w-3.5 h-3.5 text-[#0F766E]" aria-hidden />
            <span className="hidden sm:inline">Secure checkout</span>
            <span className="sr-only sm:hidden">Secure checkout</span>
          </span>
        </div>
        <div className="border-t border-[#F1EDE7]">
          <ProgressSteps current={currentStep} />
        </div>
      </div>
    </header>
    {children}
  </div>
);

/** Full-page centred state (loading / empty / error), inside the same canvas. */
export const CenterState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ ...UI, background: C.bg, color: C.ink }}>
    {children}
  </div>
);

/* ─── Section card ─────────────────────────────────────────────────────────── */
export type SectionStatus = 'active' | 'done' | 'upcoming';

export const SectionCard: React.FC<{
  index: number;
  title: string;
  status: SectionStatus;
  action?: React.ReactNode;
  upcomingHint?: string;
  children?: React.ReactNode;
  id?: string;
}> = ({ index, title, status, action, upcomingHint, children, id }) => {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={`${CARD} ${status === 'upcoming' ? 'bg-white/60 shadow-none' : ''}`}>
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 pt-6 pb-4">
        <span
          aria-hidden
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 border"
          style={{
            background:  status === 'done' ? C.accent : status === 'active' ? C.accentSoft : C.surface,
            borderColor: status === 'upcoming' ? C.borderStrong : C.accent,
            color:       status === 'done' ? '#fff' : status === 'active' ? C.accent : C.muted,
          }}
        >
          {status === 'done' ? <Check className="w-4 h-4" strokeWidth={3} /> : index}
        </span>
        <h2 id={headingId} className="flex-1 min-w-0 text-[19px] min-[400px]:text-[20px] sm:text-[24px] leading-tight font-semibold whitespace-nowrap truncate" style={{ ...SERIF, color: status === 'upcoming' ? C.muted : C.ink }}>
          {title}
        </h2>
        {action}
      </div>
      {status === 'upcoming' ? (
        upcomingHint ? <p className="px-4 sm:px-6 pb-6 -mt-2 pl-[60px] sm:pl-[72px] text-[13px] text-[#5F5953]">{upcomingHint}</p> : <div className="pb-2" />
      ) : (
        <div className="px-4 sm:px-6 pb-6">{children}</div>
      )}
    </section>
  );
};

/* ─── Form field ───────────────────────────────────────────────────────────── */
export const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  required?: boolean; className?: string;
}> = ({ label, value, onChange, placeholder, type = 'text', autoComplete, inputMode, required, className }) => {
  // Ties the visible label to its input, so screen readers announce it.
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block mb-2 text-[12px] font-medium text-[#5F5953]">
        {label}{required && <span aria-hidden className="text-[#6D28D9]"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-required={required || undefined}
        className="w-full h-12 px-4 rounded-lg border border-[#D6CFC4] bg-white text-[14px] text-[#1C1917] placeholder:text-[#A8A29E] outline-none transition-shadow focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/15"
      />
    </div>
  );
};

/* ─── Price row ────────────────────────────────────────────────────────────── */
export const PriceRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; tone?: 'default' | 'success' | 'muted' }> = ({ label, value, tone = 'default' }) => (
  <div className="flex items-baseline justify-between gap-4 text-[14px]">
    <dt className="text-[#5F5953]">{label}</dt>
    <dd className="font-medium tabular-nums text-right" style={{ color: tone === 'success' ? C.success : tone === 'muted' ? C.muted : C.ink }}>
      {value}
    </dd>
  </div>
);

/* ─── Line item ────────────────────────────────────────────────────────────── */
export interface SummaryLine {
  id: string;
  name: string;
  brand?: string | null;
  image: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variantOptions?: Record<string, string> | null;
}

export const LineItem: React.FC<{ item: SummaryLine; formatPrice: (n: number) => string }> = ({ item, formatPrice }) => {
  const options = item.variantOptions ? Object.entries(item.variantOptions) : [];
  const listTotal = item.unitPrice * item.quantity;
  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      {/* Fixed 4:5 frame — no layout shift while the image loads. */}
      <div className="relative w-[72px] h-[90px] flex-shrink-0">
        <div className="w-full h-full rounded-lg overflow-hidden bg-[#F1EDE7] ring-1 ring-inset ring-black/5">
          {item.image && <img src={item.image} alt="" loading="lazy" width={72} height={90} className="w-full h-full object-cover" />}
        </div>
        {item.quantity > 1 && (
          <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-[#1C1917] text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-white" aria-hidden>
            {item.quantity}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {item.brand && <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#5F5953] mb-1">{item.brand}</p>}
        <p className="text-[14px] font-medium text-[#1C1917] leading-snug line-clamp-2">{item.name}</p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {options.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="text-[#5F5953] capitalize">{k}</dt>
              <dd className="font-medium text-[#1C1917]">{v}</dd>
            </div>
          ))}
          <div className="flex gap-1">
            <dt className="text-[#5F5953]">Qty</dt>
            <dd className="font-medium text-[#1C1917]">{item.quantity}</dd>
          </div>
        </dl>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[14px] font-semibold tabular-nums">{formatPrice(item.lineTotal)}</p>
        {listTotal > item.lineTotal && (
          <p className="text-[12px] text-[#5F5953] line-through tabular-nums mt-1">
            <span className="sr-only">Was </span>{formatPrice(listTotal)}
          </p>
        )}
      </div>
    </li>
  );
};

/* ─── Disclosure (coupon panels) ───────────────────────────────────────────── */
/**
 * Expand/collapse row. The panel animates its height with a grid-rows
 * transition (no JS measuring, no layout jump) and is `invisible` when closed,
 * so collapsed controls drop out of the tab order and accessibility tree.
 */
export const Disclosure: React.FC<{
  open: boolean;
  onToggle: () => void;
  summary: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onToggle, summary, icon, children }) => {
  const panelId = useId();
  return (
    <div className={`rounded-xl border ${EASE} ${open ? 'border-[#D6CFC4] bg-[#FDFCFA]' : 'border-[#E8E3DB] bg-white hover:border-[#C4B5FD]'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-4 h-12 text-left text-[14px] font-medium rounded-xl ${FOCUS}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{summary}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5F5953] flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
