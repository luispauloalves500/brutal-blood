import type { CharacterDef, ComboDef, ComboRoute } from "../characters/types";

export type ComboGap = {
  fighter: string;
  combo: string;
  from: string;
  into: string;
  route: ComboRoute;
};

/** True when `into` is listed on `from.move.cancelInto`. */
export function canCancelInto(data: CharacterDef, fromId: string, intoId: string): boolean {
  const move = data.moves[fromId];
  if (!move) return false;
  return move.cancelInto?.includes(intoId) ?? false;
}

export function comboRoute(combo: ComboDef): ComboRoute {
  return combo.route ?? "cancel";
}

/**
 * Gaps only for cancel routes. Link/setup sequences are free of cancelInto checks
 * (setup may still use cancels when present; gaps are ignored).
 */
export function findCancelGaps(data: CharacterDef): ComboGap[] {
  const gaps: ComboGap[] = [];
  for (const combo of data.combos) {
    const route = comboRoute(combo);
    if (route !== "cancel") continue;
    for (let i = 0; i < combo.sequence.length - 1; i++) {
      const from = combo.sequence[i]!;
      const into = combo.sequence[i + 1]!;
      if (!canCancelInto(data, from, into)) {
        gaps.push({ fighter: data.id, combo: combo.id, from, into, route });
      }
    }
  }
  return gaps;
}

export function assertCancelCombosLegal(roster: CharacterDef[]): ComboGap[] {
  return roster.flatMap(findCancelGaps);
}
