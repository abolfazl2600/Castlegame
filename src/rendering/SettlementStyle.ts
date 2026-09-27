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
  cottage: [
    { x: -1.18, z: -1.03, rotation: 0, width: 0.84, depth: 0.72, height: 1.28, detailed: false },
    { x: 0, z: -1.08, rotation: 0, width: 0.78, depth: 0.7, height: 1.18, detailed: false },
    { x: 1.12, z: -0.96, rotation: 0, width: 0.86, depth: 0.72, height: 1.3, detailed: true },
    { x: -1.12, z: 1.02, rotation: Math.PI, width: 0.8, depth: 0.7, height: 1.18, detailed: false },
    { x: 0.05, z: 1.08, rotation: Math.PI, width: 0.78, depth: 0.68, height: 1.12, detailed: false },
  ],
  house: [
    { x: -1.2, z: -1.02, rotation: 0, width: 0.88, depth: 0.74, height: 1.48, detailed: true },
    { x: -0.12, z: -1.1, rotation: 0, width: 0.82, depth: 0.72, height: 1.38, detailed: true },
    { x: 1.08, z: -0.96, rotation: 0, width: 0.9, depth: 0.76, height: 1.52, detailed: true },
    { x: -1.16, z: 1.02, rotation: Math.PI, width: 0.84, depth: 0.72, height: 1.34, detailed: false },
    { x: -0.06, z: 1.08, rotation: Math.PI, width: 0.8, depth: 0.7, height: 1.3, detailed: true },
    { x: 1.08, z: 1, rotation: Math.PI, width: 0.84, depth: 0.72, height: 1.4, detailed: false },
  ],
  manor: [
    { x: 0, z: -0.8, rotation: 0, width: 1.34, depth: 1, height: 2.05, detailed: true },
    { x: -1.24, z: -0.95, rotation: 0, width: 0.72, depth: 0.68, height: 1.22, detailed: true },
    { x: 1.24, z: -0.95, rotation: 0, width: 0.72, depth: 0.68, height: 1.26, detailed: true },
    { x: -1.16, z: 1.05, rotation: Math.PI, width: 0.82, depth: 0.72, height: 1.28, detailed: false },
    { x: 1.14, z: 1.04, rotation: Math.PI, width: 0.82, depth: 0.72, height: 1.3, detailed: false },
  ],
  villa: [
    { x: -1.18, z: -0.95, rotation: 0, width: 0.92, depth: 0.78, height: 1.55, detailed: true },
    { x: -0.02, z: -1.05, rotation: 0, width: 0.86, depth: 0.74, height: 1.42, detailed: true },
    { x: 1.12, z: -0.9, rotation: 0, width: 0.92, depth: 0.78, height: 1.5, detailed: true },
    { x: -1.08, z: 1, rotation: Math.PI, width: 0.84, depth: 0.72, height: 1.38, detailed: true },
    { x: 0.08, z: 1.08, rotation: Math.PI, width: 0.84, depth: 0.72, height: 1.44, detailed: false },
  ],
};

export function settlementVariant(x: number, y: number, part: number, salt = 0): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(part, 83492791) ^ salt) | 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
