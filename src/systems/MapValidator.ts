export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePath(path: unknown): ValidationResult {
  if (!Array.isArray(path)) {
    return { valid: false, reason: 'Path must be an array of waypoints.' };
  }
  if (path.length < 2) {
    return { valid: false, reason: 'Path must contain at least 2 waypoints.' };
  }
  for (let i = 0; i < path.length; i += 1) {
    const p = path[i] as { x?: unknown; y?: unknown } | null;
    if (
      !p ||
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y)
    ) {
      return { valid: false, reason: `Waypoint ${i} has invalid coordinates.` };
    }
  }
  return { valid: true };
}
