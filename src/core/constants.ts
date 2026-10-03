export const TILE_SIZE = 4;
// 25×25 provides a full 100×100 world-unit gameplay grid while preserving the 4-unit building tile.
// Existing authored layouts keep their own dimensions and are centered inside the larger ocean-backed world.
export const WORLD_COLS = 25;
export const WORLD_ROWS = 25;
export const WORLD_WIDTH = WORLD_COLS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;

/** Legacy single-save key kept only for one-time migration. */
export const SAVE_KEY = 'castle-role.saves.v1.has-save';
export const SAVE_LEGACY_KEY = 'castle-role-save-v1';

/** Current persistent save schema version. */
export const SAVE_VERSION = 19;
export const CASTLE_DETAIL_VERSION = 2;

export const SAVE_STORAGE_PREFIX = 'castle-role.saves.v1.';
export const SAVE_SLOT_COUNT = 3;
export const SAVE_QUICK_KEY = `${SAVE_STORAGE_PREFIX}quick`;
export const SAVE_AUTOSAVE_KEY = `${SAVE_STORAGE_PREFIX}autosave`;
