/**
 * HeroAtmosphere — ambient underwater environment layer for the Aurus hero.
 *
 * Purely presentational and self-contained: no props, no HeroConfig wiring,
 * no data-model/admin changes. Mounted once as a sibling above the carousel's
 * slide stack (see HeroSection.tsx), it never touches slide content, layout,
 * or the carousel's own rotation timer.
 *
 * Motion budget: CSS @keyframes drive particles/caustics/rays/plants. The
 * only requestAnimationFrame loop is the mouse-parallax offset (desktop only,
 * max 5px, disabled for touch and prefers-reduced-motion).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import './HeroAtmosphere.css';

interface Particle {
  id: number;
  depth: 'near' | 'far';
  variant: 'bubble' | 'dust';
  size: number;
  left: number;
  duration: number;
  delay: number;
  driftX: number;
  peakOpacity: number;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const depth: Particle['depth'] = Math.random() < 0.45 ? 'near' : 'far';
    const duration = depth === 'near'
      ? 12 + Math.random() * 6    // near: 12–18s, faster
      : 20 + Math.random() * 10;  // far: 20–30s, slower
    particles.push({
      id: i,
      depth,
      variant: Math.random() < 0.28 ? 'bubble' : 'dust',
      size: depth === 'near' ? 2.4 + Math.random() * 1.6 : 1 + Math.random() * 1.4,
      left: Math.random() * 100,
      duration,
      delay: -Math.random() * duration, // negative delay = mid-cycle start, never synchronized
      driftX: (Math.random() - 0.5) * 40,
      peakOpacity: 0.05 + Math.random() * 0.15,
    });
  }
  return particles;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TOUCH_QUERY = '(hover: none), (pointer: coarse)';
const PARALLAX_MAX_PX = 5;
const PARALLAX_EASE = 0.06;

const HeroAtmosphere: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
    [],
  );
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia(TOUCH_QUERY).matches,
    [],
  );

  const particles = useMemo(() => generateParticles(36), []);

  // Layer 8 — pause all CSS motion while the tab is hidden.
  useEffect(() => {
    if (reducedMotion) return;
    const handleVisibility = () => {
      rootRef.current?.classList.toggle('aq-paused', document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [reducedMotion]);

  // Layer 6 — subtle mouse parallax, desktop only. Never touches text/CTA/logo.
  useEffect(() => {
    if (reducedMotion || isTouch) return;
    const section = rootRef.current?.closest('section');
    if (!section) return;

    const handleMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      target.current = {
        x: Math.max(-1, Math.min(1, nx)) * PARALLAX_MAX_PX,
        y: Math.max(-1, Math.min(1, ny)) * PARALLAX_MAX_PX,
      };
    };
    const handleLeave = () => {
      target.current = { x: 0, y: 0 };
    };

    const tick = () => {
      const el = rootRef.current;
      if (el && !document.hidden) {
        current.current.x += (target.current.x - current.current.x) * PARALLAX_EASE;
        current.current.y += (target.current.y - current.current.y) * PARALLAX_EASE;
        el.style.setProperty('--aq-parallax-x', `${current.current.x.toFixed(2)}px`);
        el.style.setProperty('--aq-parallax-y', `${current.current.y.toFixed(2)}px`);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    section.addEventListener('mousemove', handleMove);
    section.addEventListener('mouseleave', handleLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      section.removeEventListener('mousemove', handleMove);
      section.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, isTouch]);

  if (reducedMotion) return null;

  return (
    <div ref={rootRef} className="aq-atmo" aria-hidden="true">
      <div className="aq-layer aq-layer--rays">
        <span className="aq-ray aq-ray--1" />
        <span className="aq-ray aq-ray--2" />
      </div>

      <div className="aq-layer aq-layer--caustics">
        <span className="aq-caustic aq-caustic--1" />
        <span className="aq-caustic aq-caustic--2" />
        <span className="aq-caustic aq-caustic--3" />
      </div>

      <div className="aq-layer aq-layer--particles">
        {particles.map((p) => (
          <span
            key={p.id}
            className={`aq-particle aq-particle--${p.depth} aq-particle--${p.variant}`}
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ['--aq-drift' as string]: `${p.driftX}px`,
              ['--aq-peak-o' as string]: p.peakOpacity,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="aq-layer aq-layer--plants">
        <svg className="aq-plant aq-plant--left" viewBox="0 0 120 160">
          <path d="M10 160 C 6 120, 22 90, 14 40 C 10 20, 18 6, 24 0 C 20 30, 30 60, 22 100 C 18 125, 22 145, 30 160 Z" />
          <path d="M34 160 C 32 118, 46 96, 40 54 C 37 34, 44 16, 50 6 C 45 34, 54 66, 48 104 C 45 128, 46 146, 52 160 Z" />
        </svg>
        <svg className="aq-plant aq-plant--right" viewBox="0 0 120 160">
          <path d="M110 160 C 114 122, 98 92, 106 44 C 110 24, 102 8, 96 0 C 100 30, 90 62, 98 102 C 102 126, 98 146, 90 160 Z" />
          <path d="M86 160 C 88 116, 74 94, 80 52 C 83 32, 76 14, 70 4 C 75 32, 66 64, 72 102 C 75 126, 74 146, 68 160 Z" />
        </svg>
      </div>
    </div>
  );
};

export default HeroAtmosphere;
