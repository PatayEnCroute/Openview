/**
 * Converts typographic points (pt) to millimeters (mm).
 */
export function mmFromPt(pt: number): number {
  return (pt * 25.4) / 72;
}

/**
 * Converts millimeters (mm) to typographic points (pt).
 */
export function ptFromMm(mm: number): number {
  return (mm * 72) / 25.4;
}
