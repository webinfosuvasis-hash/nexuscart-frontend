import React from 'react';
import { Clock, Minus } from 'lucide-react';
import type { BuilderSectionStatus } from '@/types';

interface StatusBadgeProps {
  status: BuilderSectionStatus;
  scheduledAt?: string;
}

const CONFIG: Record<BuilderSectionStatus, {
  dot: string;
  bg: string;
  text: string;
  label: string;
}> = {
  LIVE:      { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Live' },
  DRAFT:     { dot: 'bg-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-400',     label: 'Draft' },
  SCHEDULED: { dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-400',       label: 'Scheduled' },
  DISABLED:  { dot: 'bg-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500 dark:text-slate-400',     label: 'Disabled' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, scheduledAt }) => {
  const c = CONFIG[status];

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        {status === 'SCHEDULED' ? (
          <Clock size={10} className="flex-shrink-0" />
        ) : status === 'DISABLED' ? (
          <Minus size={10} className="flex-shrink-0" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
        )}
        {c.label}
      </span>
      {status === 'SCHEDULED' && scheduledAt && (
        <span className="text-[10px] text-slate-400 pl-1">{scheduledAt}</span>
      )}
    </div>
  );
};

/** Read-only badge shown for sections managed outside the Homepage Builder. */
export const ThemeEngineBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600">
    ⚙ Theme Engine
  </span>
);

export default StatusBadge;
