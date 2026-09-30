import type { StoneStyle } from '../core/types';

export const CASTLE_STONE_PALETTES: Record<
  StoneStyle,
  {
    body: number;
    alt: number;
    dark: number;
    foundation: number;
    walkway: number;
  }
> = {
  limestone: {
    body: 0xc8c9b2,
    alt: 0xd8d6bd,
    dark: 0x9a9c88,
    foundation: 0x8d927f,
    walkway: 0xb3b49f,
  },
  darkStone: {
    body: 0x6f7474,
    alt: 0x818686,
    dark: 0x4b5050,
    foundation: 0x424747,
    walkway: 0x626867,
  },
  sandstone: {
    body: 0xc4a476,
    alt: 0xd5b884,
    dark: 0x8f7556,
    foundation: 0x79654c,
    walkway: 0xac9068,
  },
  earthen: {
    body: 0xb98555,
    alt: 0xc79765,
    dark: 0x865c3d,
    foundation: 0x755139,
    walkway: 0xa9784e,
  },
  frontier: {
    body: 0x908b81,
    alt: 0xa6a094,
    dark: 0x666159,
    foundation: 0x57524b,
    walkway: 0x7d776f,
  },
};

export const CASTLE_ARCHITECTURE_STYLE = {
  palette: {
    timber: 0x654531,
    timberDark: 0x473327,
    iron: 0x555d5f,
    roofTerracotta: 0xc96b3e,
    roofShadow: 0x704432,
    opening: 0x1b1b19,
    moss: 0x667153,
  },
  elevation: {
    groundSurfaceY: 2.22,
    bodyBaseY: 2.58,
  },
  wall: {
    stoneBaseHeight: 5.2,
    timberBaseHeight: 4.7,
    reinforcedBaseHeight: 5.8,
    levelRise: 2.15,
    joinOverlap: 0.32,
    foundationBaseHeight: 0.78,
    foundationWidthScale: 1.38,
    plinthWidthScale: 1.2,
    walkwayThickness: 0.3,
    walkwayInset: 0.28,
  },
  battlement: {
    merlonWidth: 0.76,
    crenelWidth: 0.52,
    baseHeight: 0.42,
    merlonHeight: 1.0,
    depth: 0.36,
    bevel: 0.035,
  },
  gate: {
    width: 4.05,
    depth: 2.58,
    pierWidth: 0.98,
    bodyHeight: 5.3,
    openingWidth: 2.08,
    openingHeight: 3.42,
    topBandHeight: 1.02,
    walkwayThickness: 0.3,
  },
  tower: {
    levelRise: 2.15,
    squareWidth: 3.9,
    cornerWidth: 4.18,
    roundRadius: 2.08,
    octagonalRadius: 2.0,
    watchRadius: 1.72,
    connectorWidth: 2.04,
    connectorFoundationWidth: 2.5,
    platformOverhang: 0.58,
  },
  bridge: {
    stoneDeckWidth: 2.0,
    stoneRailOffset: 0.86,
    stoneRailWidth: 0.28,
    stoneRailHeight: 0.72,
    woodDeckWidth: 1.78,
    woodRailOffset: 0.8,
  },
  access: {
    rampWidth: 1.82,
    stairWidth: 1.82,
    railOffset: 0.96,
    stairTowerWidth: 3.62,
    stairTowerLandingWidth: 1.96,
  },
  keep: {
    floorHeight: 2.45,
    foundationPadding: 1.05,
    foundationCapPadding: 0.62,
  },
} as const;
