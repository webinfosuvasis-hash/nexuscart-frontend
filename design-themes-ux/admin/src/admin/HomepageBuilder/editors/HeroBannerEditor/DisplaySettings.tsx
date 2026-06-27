import React from 'react';
import type { HeroConfig } from './types';

interface DisplaySettingsProps {
  config: HeroConfig;
  onChange: (updated: Partial<HeroConfig>) => void;
}

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}> = ({ value, onChange, min = 0, max = 9999, step = 1, suffix }) => (
  <div className="flex items-center gap-1.5">
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
    />
    {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
  </div>
);

const ToggleChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={[
      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
    ].join(' ')}
  >
    {children}
  </button>
);

const DisplaySettings: React.FC<DisplaySettingsProps> = ({ config, onChange }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
      Carousel behaviour
    </p>

    <Row label="Auto-rotate" hint="Automatically advance to the next slide.">
      <div className="flex gap-1.5">
        <ToggleChip active={config.autoRotate}  onClick={() => onChange({ autoRotate: true  })}>On</ToggleChip>
        <ToggleChip active={!config.autoRotate} onClick={() => onChange({ autoRotate: false })}>Off</ToggleChip>
      </div>
    </Row>

    {config.autoRotate && (
      <Row label="Auto-rotate speed" hint="Seconds between slide transitions.">
        <NumberInput
          value={config.autoRotateSpeed}
          onChange={autoRotateSpeed => onChange({ autoRotateSpeed })}
          min={1} max={30} step={0.5}
          suffix="s"
        />
      </Row>
    )}

    <Row label="Slide indicator" hint="How the current slide position is shown.">
      <div className="flex gap-1.5">
        <ToggleChip
          active={config.indicatorStyle === 'pill-counter'}
          onClick={() => onChange({ indicatorStyle: 'pill-counter' })}
        >
          Pill + dots
        </ToggleChip>
        <ToggleChip
          active={config.indicatorStyle === 'dots'}
          onClick={() => onChange({ indicatorStyle: 'dots' })}
        >
          Dots only
        </ToggleChip>
      </div>
    </Row>

    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-6 mb-3">
      Size & spacing
    </p>

    <Row label="Desktop height" hint="Height of the hero section on screens ≥ 1024px.">
      <NumberInput
        value={config.height}
        onChange={height => onChange({ height })}
        min={200} max={900} step={10}
        suffix="px"
      />
    </Row>

    <Row label="Mobile height" hint="Height on screens < 768px.">
      <NumberInput
        value={config.mobileHeight}
        onChange={mobileHeight => onChange({ mobileHeight })}
        min={150} max={600} step={10}
        suffix="px"
      />
    </Row>

    <Row label="Side margin" hint="Left and right margin outside the carousel container.">
      <NumberInput
        value={config.sideMargin}
        onChange={sideMargin => onChange({ sideMargin })}
        min={0} max={80} step={4}
        suffix="px"
      />
    </Row>

    <Row label="Corner radius" hint="Border radius of the carousel container.">
      <NumberInput
        value={config.cornerRadius}
        onChange={cornerRadius => onChange({ cornerRadius })}
        min={0} max={48} step={4}
        suffix="px"
      />
    </Row>
  </div>
);

export default DisplaySettings;
