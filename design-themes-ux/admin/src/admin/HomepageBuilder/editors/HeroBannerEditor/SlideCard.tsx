import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Image, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { HeroSlide } from './types';
import { isBannerSlide } from './types';

interface SlideCardProps {
  slide: HeroSlide;
  index: number;
  isActive: boolean;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const SlideCard: React.FC<SlideCardProps> = ({
  slide, index, isActive, onEdit, onToggle, onDelete,
}) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const isBanner   = isBannerSlide(slide);
  const typeBg     = isBanner ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                              : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
  const TypeIcon   = isBanner ? Image : FileText;
  const typeLabel  = isBanner ? 'Banner' : 'Editorial';

  // Mini colour preview for editorial slides
  const editorialBg = !isBanner
    ? `linear-gradient(135deg, ${slide.overlayGradient.from} 0%, ${slide.overlayGradient.to} 100%)`
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all',
        isDragging ? 'shadow-xl bg-white dark:bg-slate-800 opacity-95' : '',
        isActive
          ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-500'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600',
        !slide.isEnabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={15} />
      </div>

      {/* Index */}
      <span className="flex-shrink-0 w-5 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
        {index + 1}
      </span>

      {/* Colour/image preview */}
      <div
        className="flex-shrink-0 w-10 h-7 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700"
        style={editorialBg ? { background: editorialBg } : { background: '#E2E8F0' }}
      >
        {isBanner && slide.src && (
          <img src={slide.src} alt={slide.alt} className="w-full h-full object-cover object-top" />
        )}
      </div>

      {/* Type badge + label */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeBg}`}>
            <TypeIcon size={9} />
            {typeLabel}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 truncate leading-tight">
          {isBanner
            ? (slide.alt || 'Banner slide')
            : (slide.headlineL1 || 'Editorial slide')
          }
        </p>
      </div>

      {/* Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Switch
            checked={slide.isEnabled}
            onCheckedChange={() => onToggle(slide.id)}
            className="flex-shrink-0"
          />
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {slide.isEnabled ? 'Slide visible' : 'Slide hidden'}
        </TooltipContent>
      </Tooltip>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onEdit(slide.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Edit slide</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onDelete(slide.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Delete slide</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default SlideCard;
