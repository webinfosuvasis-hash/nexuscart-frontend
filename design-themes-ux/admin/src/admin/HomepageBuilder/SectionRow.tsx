import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Lock, Pencil, Copy, MoreHorizontal,
  ExternalLink, Calendar, History, Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import StatusBadge, { ThemeEngineBadge } from './StatusBadge';
import SectionThumbnail from './SectionThumbnail';
import type { SectionDefinition } from './SectionRegistry';
import type { BuilderSectionStatus } from '@/types';

export interface SectionRowData {
  id: string;
  sectionType: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  isLocked: boolean;
  status: BuilderSectionStatus;
  scheduledAt?: string;
}

interface SectionRowProps {
  section: SectionRowData;
  definition: SectionDefinition;
  position: number;
  /** When false, drag is disabled even for non-locked sections (e.g. while filtering). */
  isDndEnabled: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSchedule: (id: string) => void;
  onViewHistory: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenThemeEngine: () => void;
}

const SectionRow: React.FC<SectionRowProps> = ({
  section,
  definition,
  position,
  isDndEnabled,
  onToggle,
  onEdit,
  onDuplicate,
  onSchedule,
  onViewHistory,
  onDelete,
  onOpenThemeEngine,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    disabled: section.isLocked || !isDndEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const isLocked = section.isLocked;
  const isDragDisabled = isLocked || !isDndEnabled;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50',
        'transition-colors',
        isDragging
          ? 'shadow-xl bg-white dark:bg-slate-800 rounded-xl opacity-95 border border-slate-200 dark:border-slate-700'
          : isLocked
            ? 'bg-slate-50/70 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/30'
            : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40',
      ].join(' ')}
    >
      {/* ── Drag handle ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {isLocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Lock size={12} className="text-slate-300 dark:text-slate-600" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs max-w-[180px]">
              Managed in {definition.lockSource}. Cannot be moved.
            </TooltipContent>
          </Tooltip>
        ) : isDndEnabled ? (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-500 dark:hover:text-slate-400"
            aria-label="Drag to reorder"
          >
            <GripVertical size={15} />
          </div>
        ) : (
          <div className="w-4 h-4" /> /* spacer when filtering */
        )}
      </div>

      {/* ── Position ────────────────────────────────────────────────── */}
      <span className="flex-shrink-0 w-5 text-center text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">
        {position}
      </span>

      {/* ── Thumbnail ───────────────────────────────────────────────── */}
      <SectionThumbnail
        sectionType={section.sectionType}
        muted={isLocked || !section.isEnabled}
      />

      {/* ── Label + description ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate leading-tight ${
          isLocked
            ? 'text-slate-400 dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-200'
        }`}>
          {section.label}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 leading-tight">
          {definition.description}
        </p>
      </div>

      {/* ── Status ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-[120px]">
        {isLocked
          ? <ThemeEngineBadge />
          : <StatusBadge status={section.status} scheduledAt={section.scheduledAt} />
        }
      </div>

      {/* ── Visibility toggle ────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              checked={section.isEnabled}
              onCheckedChange={() => onToggle(section.id)}
              aria-label={`${section.isEnabled ? 'Hide' : 'Show'} ${section.label}`}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {section.isEnabled ? 'Visible on homepage — click to hide' : 'Hidden from homepage — click to show'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-[140px] flex items-center justify-end gap-0.5">
        {isLocked ? (
          <button
            onClick={onOpenThemeEngine}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors whitespace-nowrap"
          >
            Open Theme Engine
            <ExternalLink size={10} />
          </button>
        ) : (
          <>
            {/* Edit — inline button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onEdit(section.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Edit ${section.label}`}
                >
                  <Pencil size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Edit section</TooltipContent>
            </Tooltip>

            {/* More (⋮) dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="More options"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="text-xs">More options</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[11px] text-slate-500 font-medium">
                  {section.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => onEdit(section.id)}
                  className="text-sm gap-2 cursor-pointer"
                >
                  <Pencil size={13} className="text-slate-400" />
                  Edit section
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onDuplicate(section.id)}
                  className="text-sm gap-2 cursor-pointer"
                >
                  <Copy size={13} className="text-slate-400" />
                  Duplicate
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onSchedule(section.id)}
                  className="text-sm gap-2 cursor-pointer"
                >
                  <Calendar size={13} className="text-slate-400" />
                  Schedule…
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onViewHistory(section.id)}
                  className="text-sm gap-2 cursor-pointer"
                >
                  <History size={13} className="text-slate-400" />
                  Version history
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => onDelete(section.id)}
                  className="text-sm gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  <Trash2 size={13} />
                  Remove from page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
};

export default SectionRow;
