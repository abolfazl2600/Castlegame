export const TILE_SIZE = 4;
export const WORLD_COLS = 22;
export const WORLD_ROWS = 22;
export const WORLD_WIDTH = WORLD_COLS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;

/** Legacy single-save key kept only for one-time migration. */
export const SAVE_KEY = 'castle-role.saves.v1.has-save';
export const SAVE_LEGACY_KEY = 'castle-role-save-v1';

/** Current persistent save schema version. */
export const SAVE_VERSION = 11;
export const CASTLE_DETAIL_VERSION = 1;

export const SAVE_STORAGE_PREFIX = 'castle-role.saves.v1.';
export const SAVE_SLOT_COUNT = 3;
export const SAVE_QUICK_KEY = `${SAVE_STORAGE_PREFIX}quick`;
export const SAVE_AUTOSAVE_KEY = `${SAVE_STORAGE_PREFIX}autosave`;
