/**
 * TrustBadgesBarSection
 * Horizontal row of 4 trust badges with icon + title + description.
 * eCraftIndia pattern: Safe Payment | 7 Days Return | Free Shipping | Help Centre
 */

import React from 'react';
import { Shield, RotateCcw, Truck, CheckCircle, Star, Award, Package, HeadphonesIcon } from 'lucide-react';
import type { SectionDoc } from '@/admin/editor/types';

interface Badge { icon: string; title: string; description?: string }

const ICON_MAP: Record<string, React.ElementType> = {
  shield:   Shield,
  returns:  RotateCcw,
  shipping: Truck,
  check:    CheckCircle,
  star:     Star,
  award:    Award,
  package:  Package,
  help:     HeadphonesIcon,
};

const DEFAULT_BADGES: Badge[] = [
  { icon: '🔒', title: '100% Safe & Secure Payments', description: 'All transactions are secured' },
  { icon: '↩️', title: '7 Days Return',               description: 'Hassle-free returns policy' },
  { icon: '🚚', title: 'Free Shipping',                description: 'On orders above ₹499' },
  { icon: '🎧', title: 'Help Centre',                  description: 'Call us at +91 8000000000' },
];

const TrustBadgesBarSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const s      = section.settings;
  const badges = (s.badges as Badge[]) ?? DEFAULT_BADGES;
  const bg     = (s.bg as string)         ?? '#ffffff';
  const border = (s.borderColor as string) ?? '#e5e7eb';
  const pt     = Number(s.paddingTop    ?? 20);
  const pb     = Number(s.paddingBottom ?? 20);

  return (
    <div
      data-section-type="trust_badges_bar"
      style={{
        background:  bg,
        padding:     `${pt}px 24px ${pb}px`,
        borderTop:   `1px solid ${border}`,
        borderBottom:`1px solid ${border}`,
      }}
    >
      <div style={{
        maxWidth:            1200,
        margin:              '0 auto',
        display:             'grid',
        gridTemplateColumns: `repeat(${badges.length}, 1fr)`,
        gap:                 16,
      }}>
        {badges.map((badge, i) => {
          // Skip badges with no content (merchant hasn't filled them yet)
          if (!badge.title && !badge.description) return null;
          const Icon = ICON_MAP[badge.icon] ?? CheckCircle;
          return (
            <div key={i} style={{
              display:     'flex',
              alignItems:  'center',
              gap:         12,
              padding:     '8px 0',
              borderRight: i < badges.length - 1 ? `1px solid ${border}` : 'none',
              justifyContent: 'center',
            }}>
              <Icon size={28} style={{ color: '#374151', flexShrink: 0 }} />
              <div>
                {badge.title && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{badge.title}</p>}
                {badge.description && <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{badge.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrustBadgesBarSection;
