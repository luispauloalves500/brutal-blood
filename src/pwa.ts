/** Register the scoped offline worker. Safe on localhost and GitHub Pages subpaths. */
export async function registerOfflineWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  try {
    const base = new URL(import.meta.env.BASE_URL || "./", document.baseURI);
    const swUrl = new URL("sw.js", base);
    const registration = await navigator.serviceWorker.register(swUrl, { scope: base.pathname });

    // Let a newly installed worker take over without requiring a second visit.
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  } catch (error) {
    console.warn("[BRUTAL BLOOD] Offline worker unavailable", error);
  }
}
