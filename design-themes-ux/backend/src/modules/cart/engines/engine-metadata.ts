export const ENGINE_METADATA = Symbol('ENGINE_METADATA');

export interface EngineMetadata {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}
