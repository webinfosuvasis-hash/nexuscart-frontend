/**
 * VideoCallSection registry entry.
 *
 * This section renders null because the video call card is already included
 * in TryAtHomeSection. It exists in the DB for future independent
 * configuration (e.g. the merchant could move it to a separate slot later).
 *
 * sortOrder: 12 (after try_at_home at sortOrder 11).
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoCallConfig {
  enabled: boolean;
}

const DEFAULT: VideoCallConfig = {
  enabled: true,
};

function parseConfig(raw: unknown): VideoCallConfig {
  const parsed = safeParseJson(raw) as Partial<VideoCallConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: VideoCallConfig): ValidationResult<VideoCallConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<VideoCallConfig, Record<string, never>> = async () => ({});

// ─── Component ────────────────────────────────────────────────────────────────

// Intentionally renders nothing — the video call card is rendered by TryAtHomeSection.
const VideoCallSection: React.FC<
  SectionComponentProps<VideoCallConfig, Record<string, never>>
> = () => null;

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const VideoCallEntry: SectionRegistryEntry<VideoCallConfig, Record<string, never>> = {
  sectionType:   'video_call',
  component:     VideoCallSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {},
  meta: {
    label:            'Video Call (stub)',
    supportsPreview:  false,
    dataRequirements: [],
  },
};
