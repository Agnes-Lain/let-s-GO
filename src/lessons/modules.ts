// Home modules (docs/specs/M6-settings-onboarding-a11y.md §4.8): three named groups of units.
// Pure: the home screen draws one collapsible group per module from these summaries.
import type { MapRow } from './map';
import type { TextKey } from './schema';

export type ModuleId = 1 | 2 | 3;

export interface ModuleDef {
  id: ModuleId;
  /** First and last unit (inclusive). */
  from: number;
  to: number;
  titleKey: TextKey;
}

/** Module 1 = units 1–5, module 2 = 6–9, module 3 = 10–14 (AC 55). A new unit is added on purpose. */
export const MODULES: readonly ModuleDef[] = [
  { id: 1, from: 1, to: 5, titleKey: 'home.module.1.title' },
  { id: 2, from: 6, to: 9, titleKey: 'home.module.2.title' },
  { id: 3, from: 10, to: 14, titleKey: 'home.module.3.title' },
];

/** The module holding a unit, or null for a unit outside the table. */
export function moduleOf(unit: number): ModuleId | null {
  return MODULES.find((m) => unit >= m.from && unit <= m.to)?.id ?? null;
}

export interface ModuleSummary {
  module: ModuleDef;
  /** The map rows of the module's units, in map order. */
  rows: MapRow[];
  /** Rows with ≥ 1★ (lessons and checkpoints). */
  done: number;
  /** Rows that count: lessons and checkpoints, not "coming soon" rows. */
  total: number;
  /** The module's first row is locked (AC 60). */
  locked: boolean;
}

export function moduleSummaries(rows: readonly MapRow[]): ModuleSummary[] {
  return MODULES.map((module) => {
    const own = rows.filter((r) => moduleOf(r.unit) === module.id);
    return {
      module,
      rows: own,
      done: own.filter((r) => r.state === 'done').length,
      total: own.filter((r) => r.state !== 'soon').length,
      locked: own[0]?.state === 'locked',
    };
  });
}

/**
 * The modules open when Home opens (AC 57): the one holding the Continue target (the first
 * `available` row); none when everything is done.
 */
export function defaultExpandedModules(rows: readonly MapRow[]): ModuleId[] {
  const next = rows.find((r) => r.state === 'available');
  const id = next ? moduleOf(next.unit) : null;
  return id ? [id] : [];
}
