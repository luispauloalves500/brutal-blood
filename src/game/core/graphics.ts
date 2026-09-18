import type { AccelMode, QualityPreset, RendererKind } from "./config";

export function detectRenderer(accel: AccelMode): RendererKind {
  if (typeof document === "undefined" || accel === "off") return "canvas2d";
  const preferGpu = accel === "on" || accel === "auto";
  if (!preferGpu) return "canvas2d";
  try {
    if ("gpu" in navigator) {
      return "webgpu";
    }
  } catch {
    /* ignore */
  }
  try {
    const c = document.createElement("canvas");
    if (c.getContext("webgl2") || c.getContext("webgl")) return "webgl";
  } catch {
    /* ignore */
  }
  return "canvas2d";
}

export function recommendQuality(): QualityPreset {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  let gpuScore = 1;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : "";
      const low = /swiftshader|llvmpipe|software|mali-4|adreno 3/i.test(renderer);
      if (low) gpuScore = 0;
      else if (/nvidia|radeon|apple m|adreno 7|mali-g/i.test(renderer)) gpuScore = 2;
    }
  } catch {
    /* ignore */
  }
  const score = (cores >= 8 ? 2 : cores >= 4 ? 1 : 0) + (mem >= 8 ? 2 : mem >= 4 ? 1 : 0) + gpuScore;
  if (score <= 2) return "low";
  if (score <= 4) return "medium";
  if (score <= 6) return "high";
  return "ultra";
}

export function get2dContext(canvas: HTMLCanvasElement, _accel: AccelMode): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });
  if (!ctx) throw new Error("Canvas 2D indisponível");
  return ctx;
}
