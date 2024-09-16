export const Arrays = {
  isNonEmpty: <T>(ts: readonly T[]): ts is readonly [T, ...T[]] => {
    if (ts.length === 0) return false;
    return true;
  }
} as const;
