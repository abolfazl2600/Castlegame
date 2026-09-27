import * as THREE from 'three';

export const WORLD_STYLE = {
  palette: {
    grassSunlit: 0x9ab756,
    grassShaded: 0x65894a,
    grassForest: 0x496d3e,
    soil: 0x80664a,
    shoreSand: 0xd2bd82,
    shoreWet: 0x9a8d69,
    shallowWater: 0x77bde1,
    deepWater: 0x286f96,
    riverWater: 0x5bb8d2,
    riverBed: 0x625949,
    foliageDark: 0x264e35,
    foliageMid: 0x4f783e,
    foliageLight: 0x789f50,
    terrainRock: 0x817b70,
  },
  camera: {
    position: new THREE.Vector3(68, 80, 76),
    near: 0.1,
    far: 700,
    minDistance: 32,
    maxDistance: 150,
  },
  lighting: {
    sky: 0xc4e1e7,
    ground: 0x4c493d,
    sun: 0xffd7a3,
    sunIntensity: 3.05,
    fill: 0x91c1cf,
    fillIntensity: 0.7,
    bounce: 0xc99667,
    bounceIntensity: 3.5,
    fog: 0x89a6a2,
    fogNear: 132,
    fogFar: 270,
  },
} as const;

export function styleTone(elevation: number): number {
  return THREE.MathUtils.clamp(1 + elevation * 0.032, 0.86, 1.12);
}
