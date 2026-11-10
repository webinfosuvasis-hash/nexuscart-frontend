import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package, Receipt, ArrowRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { authPath, CHECKOUT_PATH } from '@/lib/authRedirect';

const UI    = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

/**
 * Only benefits an account actually unlocks today. Deliberately absent until
 * the features exist: reordering (no reorder flow), wishlist (stored per
 * browser in StoreContext, not per account) and member offers/rewards (no
 * customer-facing loyalty).
 */
const BENEFITS = [
  {
    Icon: Package,
    title: 'Track Your Orders',
    body: 'View order history and track deliveries in one place.',
  },
  {
    Icon: MapPin,
    title: 'Save Your Addresses',
    body: 'Faster checkout with saved shipping addresses.',
  },
  {
    Icon: Receipt,
    title: 'Manage Your Orders',
    body: 'Cancel eligible orders and download invoices anytime.',
  },
] as const;

interface GuestCheckoutPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called for "Continue as Guest" — the prompt closes itself first. */
  onContinueAsGuest: () => void;
  /** Where to land after signing in/registering. */
  redirectTo?: string;
}

/**
 * Optional, dismissible account prompt shown to a guest on their way to
 * checkout. Never blocks: Escape, the close button, an outside click and
 * "Continue as Guest" all lead on without an account.
 */
const GuestCheckoutPrompt: React.FC<GuestCheckoutPromptProps> = ({
  open, onOpenChange, onContinueAsGuest, redirectTo = CHECKOUT_PATH,
}) => {
  const primaryRef = useRef<HTMLAnchorElement>(null);
  // Opened programmatically (no Radix Trigger), so Radix has nothing to
  // return focus to on close — remember what had focus and restore it.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // The last selector group enlarges shadcn's built-in close button (16px icon) to a 40px touch target.
        className="w-[calc(100%-2rem)] max-w-[440px] max-h-[calc(100dvh-2rem)] overflow-y-auto gap-0 rounded-2xl sm:rounded-2xl border-0 bg-white p-0 shadow-2xl [&>button]:right-2 [&>button]:top-2 [&>button]:inline-flex [&>button]:h-10 [&>button]:w-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full"
        style={UI}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          primaryRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // Skipped when a CTA navigated away and the opener is gone.
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
          returnFocusRef.current = null;
        }}
      >
        <div className="px-6 pt-7 pb-5 sm:px-7 text-center" style={{ background: 'linear-gradient(180deg,#F5F0FF 0%,#FFFFFF 100%)' }}>
          <DialogHeader className="space-y-2 text-center sm:text-center">
            <DialogTitle className="text-[24px] leading-tight font-semibold text-gray-900" style={SERIF}>
              Enjoy a Better Shopping Experience!
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Create an account for a faster and more convenient checkout.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ul className="px-6 sm:px-7 space-y-2.5" aria-label="Account benefits">
          {BENEFITS.map(({ Icon, title, body }, i) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-xl border border-purple-100 bg-white px-3.5 py-3 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none"
              style={{ animationDelay: `${80 + i * 60}ms` }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700" aria-hidden="true">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-gray-900">{title}</span>
                <span className="block text-[12px] leading-snug text-gray-500 mt-0.5">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="px-6 sm:px-7 pt-5 pb-6 space-y-2.5">
          <Link
            ref={primaryRef}
            to={authPath('/login', redirectTo)}
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold tracking-wide text-white transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
          >
            Sign In / Create Account
          </Link>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onContinueAsGuest();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white py-3 text-[13px] font-semibold text-gray-800 transition-colors hover:border-purple-300 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            Continue as Guest <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <p className="pt-1 text-center text-[11.5px] leading-snug text-gray-500">
            Creating an account is optional. Continue as a guest to proceed without registering.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestCheckoutPrompt;
