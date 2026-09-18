export type CachedAsset = {
  image: CanvasImageSource;
  refs: number;
  last: number;
  bytes: number;
};

const MAX_IDLE_MS = 3 * 60 * 1000;
const MAX_ENTRIES = 48;

export class AssetManager {
  private cache = new Map<string, CachedAsset>();
  private inflight = new Map<string, Promise<CanvasImageSource>>();

  has(url: string) {
    return this.cache.has(url);
  }

  get(url: string): CanvasImageSource | undefined {
    const hit = this.cache.get(url);
    if (hit) hit.last = performance.now();
    return hit?.image;
  }

  async loadImage(url: string, signal?: AbortSignal): Promise<CanvasImageSource> {
    const hit = this.cache.get(url);
    if (hit) {
      hit.refs += 1;
      hit.last = performance.now();
      return hit.image;
    }
    const pending = this.inflight.get(url);
    if (pending) {
      const img = await pending;
      const c = this.cache.get(url);
      if (c) c.refs += 1;
      return img;
    }
    const job = this.fetchDecode(url, signal).then((image) => {
      this.inflight.delete(url);
      const prev = this.cache.get(url);
      if (prev) {
        prev.refs += 1;
        prev.last = performance.now();
        return prev.image;
      }
      this.cache.set(url, { image, refs: 1, last: performance.now(), bytes: 0 });
      this.sweep();
      return image;
    }).catch((err) => {
      this.inflight.delete(url);
      throw err;
    });
    this.inflight.set(url, job);
    return job;
  }

  acquire(url: string) {
    const hit = this.cache.get(url);
    if (hit) {
      hit.refs += 1;
      hit.last = performance.now();
    }
  }

  release(url: string) {
    const hit = this.cache.get(url);
    if (!hit) return;
    hit.refs = Math.max(0, hit.refs - 1);
    hit.last = performance.now();
  }

  releaseAll(urls: string[]) {
    for (const u of urls) this.release(u);
  }

  /** Drop unused entries that have been idle. Never evicts ref > 0. */
  sweep(now = performance.now()) {
    if (this.cache.size <= MAX_ENTRIES) {
      for (const [k, v] of this.cache) {
        if (v.refs <= 0 && now - v.last > MAX_IDLE_MS) this.drop(k, v);
      }
      return;
    }
    const idle = [...this.cache.entries()]
      .filter(([, v]) => v.refs <= 0)
      .sort((a, b) => a[1].last - b[1].last);
    for (const [k, v] of idle) {
      if (this.cache.size <= MAX_ENTRIES) break;
      this.drop(k, v);
    }
  }

  private drop(key: string, v: CachedAsset) {
    const img = v.image;
    if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) img.close();
    this.cache.delete(key);
  }

  private async fetchDecode(url: string, signal?: AbortSignal): Promise<CanvasImageSource> {
    const img = await loadHtmlImage(url, signal);
    return img;
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
