import { assets } from "./AssetManager";
import { getCharacterAssets } from "./manifests";
import { getStageAssets } from "./stages";
import type { AssetJob, CharacterSpritePack, FightAssetPack, LoadProgress } from "./types";

export type FightLoadRequest = {
  p1: string;
  p2: string;
  stage: string;
};

let lastKeys: string[] = [];

export function collectFightJobs(req: FightLoadRequest): AssetJob[] {
  const jobs: AssetJob[] = [];
  const seen = new Set<string>();
  const add = (job: AssetJob) => {
    if (!job.url || seen.has(job.url)) return;
    seen.add(job.url);
    jobs.push(job);
  };

  for (const id of [req.p1, req.p2]) {
    const man = getCharacterAssets(id);
    if (man.portrait) add({ key: `${id}:portrait`, url: man.portrait, kind: "portrait", critical: false });
    for (const clip of Object.values(man.clips)) {
      if (clip.src) add({ key: `${id}:${clip.name}`, url: clip.src, kind: "sheet", critical: false });
    }
    for (const fx of man.effects) add({ key: `${id}:fx:${fx}`, url: fx, kind: "effect", critical: false });
    for (const a of man.audio) add({ key: `${id}:sfx:${a}`, url: a, kind: "audio", critical: false });
  }

  const stage = getStageAssets(req.stage);
  if (stage.backdrop) add({ key: `stage:${stage.id}`, url: stage.backdrop, kind: "stage", critical: false });
  if (stage.music) add({ key: `stage:music:${stage.id}`, url: stage.music, kind: "audio", critical: false });

  return jobs;
}

export async function loadFightAssets(
  req: FightLoadRequest,
  opts: {
    onProgress?: (p: LoadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<FightAssetPack> {
  const jobs = collectFightJobs(req);
  const failed: { url: string; error: string }[] = [];
  const loadedUrls: string[] = [];
  const report = (loaded: number, current: string) => {
    const total = Math.max(1, jobs.length);
    opts.onProgress?.({
      loaded,
      total,
      percent: Math.round((loaded / total) * 100),
      current,
      failed,
    });
  };

  if (jobs.length === 0) {
    report(1, "pronto");
  }

  let done = 0;
  for (const job of jobs) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    report(done, job.url);
    try {
      await assets.loadImage(job.url, opts.signal);
      loadedUrls.push(job.url);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ url: job.url, error });
      if (job.critical) throw e;
    }
    done += 1;
    report(done, job.url);
  }

  assets.releaseAll(lastKeys.filter((k) => !loadedUrls.includes(k)));
  lastKeys = loadedUrls;
  assets.sweep();

  const packFor = (id: string): CharacterSpritePack => {
    const man = getCharacterAssets(id);
    const images = new Map<string, CanvasImageSource>();
    if (man.portrait) {
      const img = assets.get(man.portrait);
      if (img) images.set(man.portrait, img);
    }
    for (const clip of Object.values(man.clips)) {
      if (!clip.src) continue;
      const img = assets.get(clip.src);
      if (img) images.set(clip.src, img);
    }
    return { id, clips: man.clips, images };
  };

  const stage = getStageAssets(req.stage);
  const stageImages = new Map<string, CanvasImageSource>();
  if (stage.backdrop) {
    const img = assets.get(stage.backdrop);
    if (img) stageImages.set(stage.backdrop, img);
  }

  return {
    p1: packFor(req.p1),
    p2: packFor(req.p2),
    stageImages,
    keys: loadedUrls,
    failed,
  };
}

export function releaseFightAssets(pack: FightAssetPack | null) {
  if (!pack) return;
  assets.releaseAll(pack.keys);
  lastKeys = lastKeys.filter((k) => !pack.keys.includes(k));
  assets.sweep();
}
