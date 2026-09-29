/** Shared settlement roles and bounded, reproducible variation. */
export const SETTLEMENT_STYLE = {
  plaster: [0xe6ddb5, 0xd9cda9, 0xf0e4c3],
  roof: [0xc96b3e, 0xb9603a, 0xe28a4b],
  roofShadow: 0x874b35,
  timber: 0x654531,
  foundation: 0x8d927f,
  window: 0x527c85,
  stone: 0xc8c9b2,
  path: 0xa98d70,
  soil: 0x80664a,
} as const;

export type ResidenceKind = 'cottage' | 'house' | 'manor' | 'villa' | 'cowBarn';

export interface ResidencePart {
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  detailed: boolean;
}

// Parts fit within the existing one-cell residential footprint. The manor
// receives a central hall, the villa an open garden, and cottages stay low.
export const RESIDENCE_LAYOUTS: Record<ResidenceKind, readonly ResidencePart[]> = {
  cowBarn: [
    { x: -0.5, z: -0.62, rotation: 0, width: 1.85, depth: 1.26, height: 1.62, detailed: true },
    { x: 0.92, z: 0.92, rotation: Math.PI, width: 0.82, depth: 0.72, height: 1.08, detailed: false },
  ],
  // Low, loose hamlet: three small roofs and a large amount of open yard.
  cottage: [
    { x: -1.12, z: -1.0, rotation: 0, width: 0.92, depth: 0.78, height: 1.12, detailed: false },
    { x: 0.18, z: -1.08, rotation: 0.06, width: 0.82, depth: 0.72, height: 1.02, detailed: false },
    { x: 1.04, z: 0.92, rotation: Math.PI, width: 0.9, depth: 0.76, height: 1.18, detailed: true },
  ],
  // Dense village block: more roof mass and a clear taller central dwelling.
  house: [
    { x: -1.16, z: -1.02, rotation: 0, width: 0.9, depth: 0.76, height: 1.46, detailed: true },
    { x: 0, z: -0.88, rotation: 0, width: 1.08, depth: 0.86, height: 1.82, detailed: true },
    { x: 1.15, z: -1.0, rotation: 0, width: 0.9, depth: 0.76, height: 1.5, detailed: true },
    { x: -0.82, z: 1.05, rotation: Math.PI, width: 0.86, depth: 0.72, height: 1.34, detailed: false },
    { x: 0.78, z: 1.05, rotation: Math.PI, width: 0.86, depth: 0.72, height: 1.38, detailed: true },
  ],
  // Formal court: one dominant hall with lower symmetric service wings.
  manor: [
    { x: 0, z: -0.52, rotation: 0, width: 1.72, depth: 1.22, height: 2.55, detailed: true },
    { x: -1.28, z: -0.88, rotation: 0, width: 0.72, depth: 0.7, height: 1.2, detailed: true },
    { x: 1.28, z: -0.88, rotation: 0, width: 0.72, depth: 0.7, height: 1.2, detailed: true },
    { x: -1.18, z: 1.12, rotation: Math.PI, width: 0.82, depth: 0.72, height: 1.24, detailed: false },
    { x: 1.18, z: 1.12, rotation: Math.PI, width: 0.82, depth: 0.72, height: 1.24, detailed: false },
  ],
  // Open U-shaped villa court: strong corner pavilion and deliberately empty garden center.
  villa: [
    { x: -1.2, z: -1.0, rotation: 0, width: 0.94, depth: 0.8, height: 1.58, detailed: true },
    { x: 0.02, z: -1.08, rotation: 0, width: 0.92, depth: 0.78, height: 1.48, detailed: true },
    { x: 1.2, z: -0.96, rotation: 0, width: 0.94, depth: 0.8, height: 1.92, detailed: true },
    { x: -1.22, z: 0.72, rotation: Math.PI / 2, width: 0.88, depth: 0.74, height: 1.42, detailed: true },
  ],
};

export const SETTLEMENT_SILHOUETTE_CONTRACT = {
  cottage: { massing: 'loose-low-hamlet', dominantHeight: 1.18, landmark: 'well-and-open-yard' },
  house: { massing: 'dense-roof-block', dominantHeight: 1.82, landmark: 'tall-central-dwelling' },
  manor: { massing: 'formal-hall-and-wings', dominantHeight: 2.55, landmark: 'dominant-central-hall' },
  villa: { massing: 'open-u-court', dominantHeight: 1.92, landmark: 'corner-pavilion-and-garden' },
  farm: { massing: 'open-field-rows', dominantHeight: 4.5, landmark: 'field-grid-and-granary' },
  cowBarn: { massing: 'barn-and-stockyard', dominantHeight: 5.0, landmark: 'barn-roof-and-herd-yard' },
  market: { massing: 'open-canopy-square', dominantHeight: 4.72, landmark: 'market-hall-and-canopies' },
  windmill: { massing: 'single-vertical-mill', dominantHeight: 6.0, landmark: 'four-sail-rotor' },
  armyCamp: { massing: 'tent-command-compound', dominantHeight: 5.2, landmark: 'command-tent-and-standards' },
  harbor: { massing: 'shore-to-water-axis', dominantHeight: 5.1, landmark: 'long-pier-and-cranes' },
  basilica: { massing: 'cross-nave-landmark', dominantHeight: 7.1, landmark: 'bell-tower-and-cross' },
  keep: { massing: 'fortified-vertical-core', dominantHeight: 8.0, landmark: 'battlemented-main-mass' },
  modernFortress: { massing: 'wide-fortified-campus', dominantHeight: 15.5, landmark: 'corner-towers-and-spire' },
} as const;

export function settlementVariant(x: number, y: number, part: number, salt = 0): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(part, 83492791) ^ salt) | 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
