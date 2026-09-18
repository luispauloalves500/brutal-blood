type CacheEntry<T> = {
  data: T;
  refs: number;
  last: number;
  bytes: number;
};

const MAX_IDLE_MS = 3 * 60 * 1000;
const MAX_ENTRIES = 64;

export class AssetManager {
  private images = new Map<string, CacheEntry<CanvasImageSource>>();
  private audio = new Map<string, CacheEntry<AudioBuffer>>();
  private inflightImg = new Map<string, Promise<CanvasImageSource>>();
  private inflightAud = new Map<string, Promise<AudioBuffer>>();

  hasImage(url: string) {
    return this.images.has(url);
  }

  hasAudio(url: string) {
    return this.audio.has(url);
  }

  has(url: string) {
    return this.hasImage(url) || this.hasAudio(url);
  }

  getImage(url: string): CanvasImageSource | undefined {
    const hit = this.images.get(url);
    if (hit) hit.last = performance.now();
    return hit?.data;
  }

  /** @deprecated use getImage */
  get(url: string): CanvasImageSource | undefined {
    return this.getImage(url);
  }

  getAudio(url: string): AudioBuffer | undefined {
    const hit = this.audio.get(url);
    if (hit) hit.last = performance.now();
    return hit?.data;
  }

  async loadImage(url: string, signal?: AbortSignal): Promise<CanvasImageSource> {
    const hit = this.images.get(url);
    if (hit) {
      hit.refs += 1;
      hit.last = performance.now();
      return hit.data;
    }
    const pending = this.inflightImg.get(url);
    if (pending) {
      const img = await pending;
      const c = this.images.get(url);
      if (c) c.refs += 1;
      return img;
    }
    const job = this.fetchImage(url, signal).then((image) => {
      this.inflightImg.delete(url);
      const prev = this.images.get(url);
      if (prev) {
        prev.refs += 1;
        prev.last = performance.now();
        return prev.data;
      }
      this.images.set(url, { data: image, refs: 1, last: performance.now(), bytes: 0 });
      this.sweep();
      return image;
    }).catch((err) => {
      this.inflightImg.delete(url);
      throw err;
    });
    this.inflightImg.set(url, job);
    return job;
  }

  async loadAudio(url: string, ctx: AudioContext | null | undefined, signal?: AbortSignal): Promise<AudioBuffer> {
    const hit = this.audio.get(url);
    if (hit) {
      hit.refs += 1;
      hit.last = performance.now();
      return hit.data;
    }
    if (!ctx) throw new Error(`audio context missing: ${url}`);
    const pending = this.inflightAud.get(url);
    if (pending) {
      const buf = await pending;
      const c = this.audio.get(url);
      if (c) c.refs += 1;
      return buf;
    }
    const job = this.fetchAudio(url, ctx, signal).then((buffer) => {
      this.inflightAud.delete(url);
      const prev = this.audio.get(url);
      if (prev) {
        prev.refs += 1;
        prev.last = performance.now();
        return prev.data;
      }
      this.audio.set(url, { data: buffer, refs: 1, last: performance.now(), bytes: buffer.length * 4 });
      this.sweep();
      return buffer;
    }).catch((err) => {
      this.inflightAud.delete(url);
      throw err;
    });
    this.inflightAud.set(url, job);
    return job;
  }

  acquire(url: string) {
    const img = this.images.get(url);
    if (img) {
      img.refs += 1;
      img.last = performance.now();
      return;
    }
    const aud = this.audio.get(url);
    if (aud) {
      aud.refs += 1;
      aud.last = performance.now();
    }
  }

  release(url: string) {
    const img = this.images.get(url);
    if (img) {
      img.refs = Math.max(0, img.refs - 1);
      img.last = performance.now();
      return;
    }
    const aud = this.audio.get(url);
    if (aud) {
      aud.refs = Math.max(0, aud.refs - 1);
      aud.last = performance.now();
    }
  }

  releaseAll(urls: string[]) {
    const seen = new Set<string>();
    for (const u of urls) {
      if (seen.has(u)) continue;
      seen.add(u);
      this.release(u);
    }
  }

  /** Drop unused entries that have been idle. Never evicts ref > 0. */
  sweep(now = performance.now()) {
    this.sweepMap(this.images, now, (v) => {
      const img = v.data;
      if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) img.close();
    });
    this.sweepMap(this.audio, now);
  }

  private sweepMap<T>(map: Map<string, CacheEntry<T>>, now: number, drop?: (v: CacheEntry<T>) => void) {
    if (map.size <= MAX_ENTRIES) {
      for (const [k, v] of map) {
        if (v.refs <= 0 && now - v.last > MAX_IDLE_MS) {
          drop?.(v);
          map.delete(k);
        }
      }
      return;
    }
    const idle = [...map.entries()].filter(([, v]) => v.refs <= 0).sort((a, b) => a[1].last - b[1].last);
    for (const [k, v] of idle) {
      if (map.size <= MAX_ENTRIES) break;
      drop?.(v);
      map.delete(k);
    }
  }

  private async fetchImage(url: string, signal?: AbortSignal): Promise<CanvasImageSource> {
    return loadHtmlImage(url, signal);
  }

  private async fetchAudio(url: string, ctx: AudioContext, signal?: AbortSignal): Promise<AudioBuffer> {
    const res = await fetch(url, { signal, cache: "force-cache" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const raw = await res.arrayBuffer();
    return await ctx.decodeAudioData(raw.slice(0));
  }
}

export const assets = new AssetManager();

function loadHtmlImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const fail = () => reject(new Error(`image ${url}`));
    img.onload = () => resolve(img);
    img.onerror = fail;
    signal?.addEventListener("abort", fail, { once: true });
    img.src = url;
  });
}
