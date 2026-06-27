/**
 * TrustBadges — P6
 * Configurable horizontal/vertical row of icon + title + description badges.
 * Default badges: Secure Payment, Easy Returns, Free Shipping, Genuine Product.
 */
import React from 'react';
import { Shield, RotateCcw, Truck, CheckCircle, Star, Award, Package } from 'lucide-react';
import type { NodeProps } from '../types';

const ICON_MAP: Record<string, React.ElementType> = {
  shield:     Shield,
  returns:    RotateCcw,
  shipping:   Truck,
  check:      CheckCircle,
  star:       Star,
  award:      Award,
  package:    Package,
};

interface Badge {
  icon:        string;
  title:       string;
  description?: string;
}

const DEFAULT_BADGES: Badge[] = [
  { icon: 'shield',   title: 'Secure Payment',    description: '100% safe & protected' },
  { icon: 'returns',  title: 'Easy Returns',       description: '7-day hassle-free returns' },
  { icon: 'shipping', title: 'Free Shipping',      description: 'On orders above ₹499' },
  { icon: 'check',    title: 'Genuine Products',   description: 'Certified & authentic' },
];

const TrustBadges: React.FC<NodeProps> = ({ node, style }) => {
  const s       = node.settings;
  const badges  = (s.badges as Badge[]) ?? DEFAULT_BADGES;
  const layout  = (s.layout  as string) ?? 'horizontal'; // 'horizontal' | 'vertical'
  const showDesc= s.showDescription !== false;
  const iconSize= Number(s.iconSize ?? 22);
  const cols    = Math.min(badges.length, Number(s.columns ?? badges.length));

  return (
    <div
      data-node-id={node.id}
      data-node-type="trust_badges"
      style={{
        display:             'grid',
        gridTemplateColumns: layout === 'vertical' ? '1fr' : `repeat(${cols}, 1fr)`,
        gap:                 12,
        ...style,
      }}
    >
      {badges.map((badge, i) => {
        if (!badge.title && !badge.description) return null; // skip unfilled badges
        const Icon = ICON_MAP[badge.icon] ?? CheckCircle;
        return (
          <div key={i} style={{
            display:    'flex',
            alignItems: layout === 'horizontal' ? 'center' : 'flex-start',
            gap:        10,
            padding:    '10px 12px',
            borderRadius: 8,
            background: (s.badgeBg as string) ?? '#f9fafb',
            border:     `1px solid ${(s.badgeBorder as string) ?? '#e5e7eb'}`,
            flexDirection: layout === 'vertical' ? 'row' : 'column',
            textAlign:  layout === 'horizontal' ? 'center' : 'left',
          }}>
            <Icon size={iconSize} style={{ color: (s.iconColor as string) ?? '#374151', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{badge.title}</p>
              {showDesc && badge.description && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{badge.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrustBadges;
