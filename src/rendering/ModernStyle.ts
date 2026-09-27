/**
 * Shared visual tokens for Modern Mode.
 *
 * The values intentionally stay separate from medieval masonry/plaster roles
 * while following the same centralized style-token pattern as WorldStyle and
 * CastleArchitectureStyle.
 */
export const MODERN_STYLE = {
  palette: {
    reinforcedConcrete: 0x879093,
    structuralSteel: 0x3d4951,
    armoredSteel: 0x5d6971,
    compositePanel: 0x263239,
    reinforcedGlass: 0x78cbd3,
    glassEmissive: 0x0a4650,
    industrialMetal: 0x20282e,
    concreteFlooring: 0x566064,
    securityLight: 0x9beef3,
    securityEmissive: 0x24b8c3,
    warningStripe: 0xd6a34b,
  },
  material: {
    concreteRoughness: 0.86,
    concreteMetalness: 0.03,
    steelRoughness: 0.42,
    steelMetalness: 0.78,
    armorRoughness: 0.32,
    armorMetalness: 0.86,
    panelRoughness: 0.36,
    panelMetalness: 0.62,
    glassRoughness: 0.16,
    glassMetalness: 0.18,
    glassOpacity: 0.68,
    glassEmissiveIntensity: 0.48,
    industrialRoughness: 0.56,
    industrialMetalness: 0.72,
    floorRoughness: 0.95,
    floorMetalness: 0.02,
    lightRoughness: 0.2,
    lightMetalness: 0.08,
    lightEmissiveIntensity: 1.25,
    warningRoughness: 0.5,
    warningMetalness: 0.28,
  },
} as const;
