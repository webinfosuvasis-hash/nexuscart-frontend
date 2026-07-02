import { EngineMetadata } from '../engines/engine-metadata';
import { EngineSet }       from '../engines/engine-set.interface';

export const ENGINE_RESOLVER = Symbol('IEngineResolver');

export interface EngineSlotInspect extends EngineMetadata {
  overridden: boolean;
}

export interface EngineInspectResult {
  storeId:    string;
  resolvedBy: string;
  engines: {
    inventory: EngineSlotInspect;
    pricing:   EngineSlotInspect;
    promotion: EngineSlotInspect;
    shipping:  EngineSlotInspect;
    tax:       EngineSlotInspect;
  };
}

export interface IEngineResolver {
  resolve(storeId: string): Promise<EngineSet> | EngineSet;
  register?(storeId: string, overrides: Partial<EngineSet>): Promise<void> | void;
  deregister?(storeId: string, engine?: keyof EngineSet): Promise<void> | void;
  inspect(storeId: string): Promise<EngineInspectResult> | EngineInspectResult;
}
