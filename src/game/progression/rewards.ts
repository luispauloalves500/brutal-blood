import { getSave, patchSave, type SaveData } from "../core/save";
import { DEFAULT_PALETTES, type PaletteDef } from "../assets/palettes";
import { getCharacterAssets } from "../assets/manifests";
import { reqMet, reqProgress } from "./evaluate";
import { REWARDS, rewardById, REWARD_KIND_LABELS } from "./rewardsCatalog";
import type { RewardDef, RewardKind } from "./types";

export type RewardStatus = "locked" | "granted" | "usable";

export function hasReward(id: string, save: SaveData = getSave()) {
  return (save.grantedRewards ?? []).includes(id);
}

export function isRewardUsable(id: string, save: SaveData = getSave()) {
  const r = rewardById(id);
  if (!r || !hasReward(id, save)) return false;
  return !r.comingSoon;
}

export function rewardStatus(id: string, save: SaveData = getSave()): RewardStatus {
  if (!hasReward(id, save)) return "locked";
  return isRewardUsable(id, save) ? "usable" : "granted";
}

export function grantedOfKind(kind: RewardKind, save: SaveData = getSave()) {
  return REWARDS.filter((r) => r.kind === kind && hasReward(r.id, save));
}

export function extraPalettes(fighterId: string, save: SaveData = getSave()): PaletteDef[] {
  return REWARDS
    .filter((r) => r.kind === "palette" && r.fighterId === fighterId && r.palette && isRewardUsable(r.id, save))
    .map((r) => r.palette!);
}

export function availablePalettes(fighterId: string, save: SaveData = getSave()): PaletteDef[] {
  const base = getCharacterAssets(fighterId).palettes ?? DEFAULT_PALETTES;
  const core = base.filter((p) => p.id === "default" || p.id === "alternate");
  const seen = new Set(core.map((p) => p.id));
  const extra: PaletteDef[] = [];
  for (const p of extraPalettes(fighterId, save)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    extra.push(p);
  }
  return core.length ? [...core, ...extra] : [...DEFAULT_PALETTES, ...extra];
}

export function isPaletteUnlocked(fighterId: string, paletteId: string, save: SaveData = getSave()) {
  if (paletteId === "default" || paletteId === "alternate") return true;
  return extraPalettes(fighterId, save).some((p) => p.id === paletteId);
}

export function grantReward(id: string, opts?: { cinematic?: boolean }): boolean {
  const reward = rewardById(id);
  if (!reward) return false;
  const save = getSave();
  if (hasReward(id, save)) return false;
  const pending = [...(save.pendingRewards ?? [])];
  const seen = save.seenRewardCinematics ?? [];
  if (opts?.cinematic !== false && !seen.includes(id) && !pending.includes(id)) pending.push(id);
  patchSave({
    grantedRewards: Array.from(new Set([...(save.grantedRewards ?? []), id])),
    pendingRewards: pending,
  });
  return true;
}

export function flushRewards(): string[] {
  const save = getSave();
  const granted = new Set(save.grantedRewards ?? []);
  const pending = [...(save.pendingRewards ?? [])];
  const seen = save.seenRewardCinematics ?? [];
  const fresh: string[] = [];

  for (const reward of REWARDS) {
    if (granted.has(reward.id)) continue;
    if (reward.initiallyGranted) {
      granted.add(reward.id);
      continue;
    }
    if (reward.unlock && reqMet(reward.unlock, save)) {
      granted.add(reward.id);
      if (!seen.includes(reward.id) && !pending.includes(reward.id)) {
        pending.push(reward.id);
        fresh.push(reward.id);
      }
    }
  }

  patchSave({
    grantedRewards: Array.from(granted),
    pendingRewards: pending,
  });
  return fresh;
}

export function consumeRewardCinematic(id: string) {
  const save = getSave();
  patchSave({
    pendingRewards: (save.pendingRewards ?? []).filter((x) => x !== id),
    seenRewardCinematics: Array.from(new Set([...(save.seenRewardCinematics ?? []), id])),
  });
}

export function equipTitle(id: string | null) {
  if (id && !isRewardUsable(id)) return;
  patchSave({ equippedTitle: id });
}

export function equippedTitleName(save: SaveData = getSave()): string | null {
  const id = save.equippedTitle;
  if (!id || !isRewardUsable(id, save)) return null;
  return rewardById(id)?.name ?? null;
}

export function equipPalette(fighterId: string, paletteId: string) {
  if (!isPaletteUnlocked(fighterId, paletteId)) return;
  const save = getSave();
  patchSave({ equippedPalettes: { ...(save.equippedPalettes ?? {}), [fighterId]: paletteId } });
}

export function equippedPalette(fighterId: string, save: SaveData = getSave()) {
  const id = save.equippedPalettes?.[fighterId] ?? "default";
  return isPaletteUnlocked(fighterId, id, save) ? id : "default";
}

export function rewardHint(reward: RewardDef, save: SaveData = getSave()): string {
  if (hasReward(reward.id, save)) return reward.comingSoon ? "CONQUISTADO · EM BREVE" : "CONQUISTADO";
  const req = reward.unlock;
  if (!req) return "BLOQUEADO";
  if (req.hiddenDescription) return req.hiddenDescription;
  const p = reqProgress(req, save);
  if (p) return `${req.description}  (${Math.min(p.current, p.needed)}/${p.needed})`;
  return req.description;
}

export function catalogByKind() {
  const groups: Record<RewardKind, RewardDef[]> = {
    fighter: [], palette: [], skin: [], stage: [], music: [], gallery: [], ending: [], title: [],
  };
  for (const r of REWARDS) groups[r.kind].push(r);
  return groups;
}

export function debugGrantAllRewards() {
  const ids = REWARDS.map((r) => r.id);
  patchSave({
    grantedRewards: ids,
    pendingRewards: [],
    seenRewardCinematics: ids,
  });
}

export { REWARDS, rewardById, REWARD_KIND_LABELS };
