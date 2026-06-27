/**
 * HeroBannerEditor — Phase 2A (refactored to use SectionEditor framework)
 *
 * Reference implementation for all Aurus section editors.
 * The framework handles: header, tabs, split-pane, state, save/publish.
 * This file implements only the Hero-specific content form and preview.
 */

import React, { useState, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SectionEditor } from '../framework/SectionEditor';
import HeroPreview    from './HeroPreview';
import SlideCard      from './SlideCard';
import SlideForm      from './SlideForm';
import DisplaySettings from './DisplaySettings';
import {
  parseHeroConfig, generateSlideId, DEFAULT_HERO_CONFIG,
  type HeroConfig, type HeroSlide,
} from './types';

// ─── Content tab ──────────────────────────────────────────────────────────────

const HeroContentTab: React.FC<{
  config: HeroConfig;
  onChange: (c: HeroConfig) => void;
}> = ({ config, onChange }) => {
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = config.slides.findIndex(s => s.id === active.id);
    const newIdx = config.slides.findIndex(s => s.id === over.id);
    onChange({ ...config, slides: arrayMove(config.slides, oldIdx, newIdx) });
  }, [config, onChange]);

  const handleToggle = useCallback((id: string) => {
    onChange({ ...config, slides: config.slides.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s) });
  }, [config, onChange]);

  const handleDelete = useCallback((id: string) => {
    if (config.slides.length <= 1) { toast.error('Cannot delete the last slide'); return; }
    onChange({ ...config, slides: config.slides.filter(s => s.id !== id) });
  }, [config, onChange]);

  const handleAddSlide = useCallback(() => {
    if (config.slides.length >= 5) { toast.error('Maximum 5 slides allowed'); return; }
    const newSlide: HeroSlide = {
      id: generateSlideId(), type: 'editorial', isEnabled: true,
      backgroundImage: '', overlayGradient: { from: '#6B21A8', fromAlpha: 80, to: '#1E1B4B', toAlpha: 10 },
      eyebrowText: 'New Slide', brandName: '', headlineL1: 'Your headline here',
      headlineL2: '', headlineL2Color: '#FEF08A', disclaimer: '', ctaText: 'Shop Now', ctaUrl: '/',
    };
    onChange({ ...config, slides: [...config.slides, newSlide] });
    setEditingSlideId(newSlide.id);
  }, [config, onChange]);

  const editingSlide = editingSlideId ? config.slides.find(s => s.id === editingSlideId) : null;

  if (editingSlide) {
    return (
      <SlideForm
        slide={editingSlide}
        onApply={updated => {
          onChange({ ...config, slides: config.slides.map(s => s.id === updated.id ? updated : s) });
          setEditingSlideId(null);
        }}
        onCancel={() => setEditingSlideId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Slides
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({config.slides.filter(s => s.isEnabled).length}/{config.slides.length} enabled)
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Drag to reorder · max 5 slides</p>
        </div>
        <button
          onClick={handleAddSlide}
          disabled={config.slides.length >= 5}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
        >
          <Plus size={12} /> Add Slide
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={config.slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {config.slides.map((slide, idx) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                index={idx}
                isActive={editingSlideId === slide.id}
                onEdit={id => setEditingSlideId(id)}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

// ─── Editor component ─────────────────────────────────────────────────────────

interface HeroBannerEditorProps {
  sectionId: string;
  onBack: () => void;
}

const HeroBannerEditor: React.FC<HeroBannerEditorProps> = ({ sectionId, onBack }) => (
  <SectionEditor<HeroConfig>
    sectionId={sectionId}
    sectionLabel="Hero Banner Carousel"
    onBack={onBack}
    defaultConfig={DEFAULT_HERO_CONFIG}
    parseConfig={parseHeroConfig}
    renderPreview={(config) => <HeroPreview config={config} />}
    renderContent={(config, onChange) => <HeroContentTab config={config} onChange={onChange} />}
    renderDisplay={(config, onChange) => <DisplaySettings config={config} onChange={p => onChange({ ...config, ...p })} />}
  />
);

export default HeroBannerEditor;
