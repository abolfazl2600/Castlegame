/**
 * Remote-only honor badge asset delivery for web and Capacitor Android.
 *
 * Art lives in /honor-badges/ at repository root, NEVER in /public/, so it
 * cannot be silently bundled into Android builds. The only way to acquire an
 * image is an explicit GitHub download. Already verified files live in IDB.
 *
 * This is a *delivery/cache* layer, NOT an entitlement or Royal Credits shop.
 * A later feature must check an award/purchase before offering download.
 */

export const HONOR_BADGE_REMOTE_BASE =
  'https://raw.githubusercontent.com/abolfazl2600/Castlegame/main/honor-badges/';
export const HONOR_BADGE_CATALOG_URL = HONOR_BADGE_REMOTE_BASE + 'catalog.v1.json';
export const HONOR_BADGE_DATABASE = 'castle-role-honor-badges-v1';

const MAX_BADGE_BYTES = 2 * 1024 * 1024;
const MAX_CATALOG_BYTES = 256 * 1024;
const NETWORK_TIMEOUT_MS = 12_000;
const ID_REGEX = /^[a-z][a-z0-9-]{1,47}$/;
const ASSET_PATH_REGEX = /^assets\/[a-z0-9][a-z0-9/_-]*\.(png|webp)$/;
const SHA256_REGEX = /^[a-f0-9]{64}$/;

export type HonorBadgeMimeType = 'image/png' | 'image/webp';
export type HonorCatalogSource = 'network' | 'cached' | 'unavailable';

export interface HonorBadgeDefinition {
  id: string;
  name: { fa: string; en: string };
  description: { fa: string; en: string };
  assetPath: string;
  mimeType: HonorBadgeMimeType;
  sha256: string;
}

export interface HonorBadgeCatalog {
  schemaVersion: 1;
  badges: HonorBadgeDefinition[];
}

export interface HonorCatalogResult {
  catalog: HonorBadgeCatalog | null;
  source: HonorCatalogSource;
}

export interface DownloadedHonorBadge {
  id: string;
  name: { fa: string; en: string };
  description: { fa: string; en: string };
  sha256: string;
  mimeType: HonorBadgeMimeType;
  image: Blob;
  downloadedAt: number;
}

export interface HonorBadgeDownloadResult {
  status: 'cached' | 'downloaded';
  badge: DownloadedHonorBadge;
}

export class HonorBadgeError extends Error {
  constructor(
    readonly code: 'catalog_unavailable' | 'badge_unknown' | 'invalid_catalog' |
      'download_unavailable' | 'integrity_failed' | 'storage_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'HonorBadgeError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function localizedText(value: unknown): value is { fa: string; en: string } {
  return isObject(value) &&
    typeof value.fa === 'string' && value.fa.trim().length > 0 && value.fa.length <= 100 &&
    typeof value.en === 'string' && value.en.trim().length > 0 && value.en.length <= 100;
}

function validateDefinition(value: unknown): HonorBadgeDefinition {
  if (!isObject(value) || typeof value.id !== 'string' || !ID_REGEX.test(value.id) ||
    !localizedText(value.name) || !localizedText(value.description) ||
    typeof value.assetPath !== 'string' || !ASSET_PATH_REGEX.test(value.assetPath) ||
    (value.mimeType !== 'image/png' && value.mimeType !== 'image/webp') ||
    !value.assetPath.endsWith(value.mimeType === 'image/png' ? '.png' : '.webp') ||
    typeof value.sha256 !== 'string' || !SHA256_REGEX.test(value.sha256)) {
    throw new HonorBadgeError('invalid_catalog', 'Invalid honor badge metadata or artwork path');
  }
  return {
    id: value.id, name: { fa: value.name.fa, en: value.name.en },
    description: { fa: value.description.fa, en: value.description.en },
    assetPath: value.assetPath, mimeType: value.mimeType, sha256: value.sha256,
  };
}

export function validateHonorBadgeCatalog(value: unknown): HonorBadgeCatalog {
  if (!isObject(value) || value.schemaVersion !== 1 ||
    !Array.isArray(value.badges) || value.badges.length > 100) {
    throw new HonorBadgeError('invalid_catalog', 'Unsupported honor badge catalog');
  }
  const badges = value.badges.map(validateDefinition);
  if (new Set(badges.map((badge) => badge.id)).size !== badges.length) {
    throw new HonorBadgeError('invalid_catalog', 'Duplicate honor badge ID');
  }
  return { schemaVersion: 1, badges };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new HonorBadgeError('storage_unavailable', 'Offline badge storage unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HONOR_BADGE_DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new HonorBadgeError('storage_unavailable', 'Could not open offline badge storage'));
    request.onblocked = () => reject(new HonorBadgeError('storage_unavailable', 'Offline badge storage is blocked'));
  });
}

async function readStore<T>(store: 'assets' | 'catalog', key: string): Promise<T | null> {
  const db = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(new HonorBadgeError('storage_unavailable', 'Unable to read offline badge storage'));
    });
  } finally {
    db.close();
  }
}

async function writeStore(store: 'assets' | 'catalog', value: unknown, key?: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const objectStore = tx.objectStore(store);
      if (key === undefined) objectStore.put(value);
      else objectStore.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new HonorBadgeError('storage_unavailable', 'Failed to persist downloaded badge'));
      tx.onerror = () => reject(new HonorBadgeError('storage_unavailable', 'Failed to persist downloaded badge'));
    });
  } finally {
    db.close();
  }
}

async function readAllBadges(): Promise<DownloadedHonorBadge[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('assets', 'readonly').objectStore('assets').getAll();
      req.onsuccess = () => resolve(req.result as DownloadedHonorBadge[]);
      req.onerror = () => reject(new HonorBadgeError('storage_unavailable', 'Failed to read downloaded badges'));
    });
  } finally {
    db.close();
  }
}

async function boundedResponse(response: Response, maximum: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maximum) throw new Error('File exceeds permitted size');
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maximum) throw new Error('File exceeds permitted size');
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) throw new Error('File exceeds permitted size');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

async function networkBytes(url: string, maxBytes: number): Promise<Uint8Array> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      mode: 'cors', credentials: 'omit', cache: 'no-store',
      signal: abort.signal,
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await boundedResponse(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}

function validImageSignature(bytes: Uint8Array, type: HonorBadgeMimeType): boolean {
  if (type === 'image/png') {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
  }
  return bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * No artwork is ever exposed for an undownloaded badge. Only caller-created
 * object URLs from downloaded blobs can be used by the future gallery UI.
 */
export class HonorBadgeRepository {
  private readonly inFlight = new Map<string, Promise<HonorBadgeDownloadResult>>();

  async loadCatalog(): Promise<HonorCatalogResult> {
    try {
      const bytes = await networkBytes(HONOR_BADGE_CATALOG_URL, MAX_CATALOG_BYTES);
      const catalog = validateHonorBadgeCatalog(JSON.parse(new TextDecoder().decode(bytes)));
      try { await writeStore('catalog', catalog, 'latest'); }
      catch { /* Network catalog remains usable when persistence is blocked. */ }
      return { catalog, source: 'network' };
    } catch {
      try {
        const stored = await readStore<unknown>('catalog', 'latest');
        if (stored) return { catalog: validateHonorBadgeCatalog(stored), source: 'cached' };
      } catch { /* There is no usable offline catalog. */ }
      return { catalog: null, source: 'unavailable' };
    }
  }

  async getDownloaded(id: string): Promise<DownloadedHonorBadge | null> {
    if (!ID_REGEX.test(id)) return null;
    const stored = await readStore<DownloadedHonorBadge>('assets', id);
    if (!stored || !stored.image || !(stored.image instanceof Blob) ||
      !SHA256_REGEX.test(stored.sha256)) return null;
    return stored;
  }

  async listDownloaded(): Promise<DownloadedHonorBadge[]> {
    return (await readAllBadges()).filter((badge) =>
      ID_REGEX.test(badge.id) && badge.image instanceof Blob && SHA256_REGEX.test(badge.sha256));
  }

  async download(id: string): Promise<HonorBadgeDownloadResult> {
    if (!ID_REGEX.test(id)) throw new HonorBadgeError('badge_unknown', 'Unknown honor badge');
    const current = this.inFlight.get(id);
    if (current) return current;
    const job = this.downloadOne(id).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, job);
    return job;
  }

  private async downloadOne(id: string): Promise<HonorBadgeDownloadResult> {
    const known = await this.loadCatalog();
    if (!known.catalog) throw new HonorBadgeError('catalog_unavailable', 'Connect to the internet to load the honor badge catalog');
    const entry = known.catalog.badges.find((badge) => badge.id === id);
    if (!entry) throw new HonorBadgeError('badge_unknown', 'Unknown honor badge');

    const cached = await this.getDownloaded(id);
    if (cached?.sha256 === entry.sha256) return { status: 'cached', badge: cached };

    let bytes: Uint8Array;
    try {
      // The validated relative path prevents redirects to arbitrary hosts.
      const imageUrl = new URL(entry.assetPath, HONOR_BADGE_REMOTE_BASE);
      if (!imageUrl.href.startsWith(HONOR_BADGE_REMOTE_BASE)) throw new Error('Unexpected artwork origin');
      bytes = await networkBytes(imageUrl.href, MAX_BADGE_BYTES);
    } catch {
      throw new HonorBadgeError('download_unavailable', 'Internet connection required to download this badge');
    }
    if (!validImageSignature(bytes, entry.mimeType) ||
      await sha256Hex(bytes) !== entry.sha256) {
      throw new HonorBadgeError('integrity_failed', 'Downloaded badge failed its integrity check');
    }

    const badge: DownloadedHonorBadge = {
      id: entry.id, name: entry.name, description: entry.description,
      sha256: entry.sha256, mimeType: entry.mimeType,
      image: new Blob([bytes.slice().buffer], { type: entry.mimeType }),
      downloadedAt: Date.now(),
    };
    await writeStore('assets', badge);
    return { status: 'downloaded', badge };
  }
}
