import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(process.argv[2] || "dist");
if (!existsSync(outDir)) throw new Error(`Output directory not found: ${outDir}`);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const rosterSrc = readFileSync(join(root, "src/game/progression/rosterSlots.ts"), "utf8");
const initialFighters = new Set(
  [...rosterSrc.matchAll(/id:\s*"([^"]+)"[^\n]*initiallyUnlocked:\s*true[^\n]*playable:\s*true/g)].map((m) => m[1]),
);
if (!initialFighters.size) throw new Error("No playable initial fighters found in rosterSlots.ts");

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "offline-manifest.json") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else files.push(`./${relative(outDir, full).replaceAll("\\", "/")}`);
  }
}
walk(outDir);

const core = [];
const initial = [];
const optional = [];
for (const path of files) {
  if (
    path === "./index.html" || path === "./manifest.webmanifest" || path === "./favicon.svg" ||
    path.startsWith("./assets/") || path.startsWith("./icons/") || path.startsWith("./ui/") ||
    /^\.\/fighters\/[^/]+\.webp$/.test(path)
  ) {
    core.push(path);
    continue;
  }
  const fighter = path.match(/^\.\/fighters\/([^/]+)\//)?.[1];
  if (fighter && initialFighters.has(fighter)) initial.push(path);
  else if (path !== "./sw.js") optional.push(path);
}
core.unshift("./");

const manifest = {
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  strategy: "core + current initial fighters precached; future unlockables cached on demand",
  initialFighters: [...initialFighters],
  core: [...new Set(core)].sort(),
  initial: [...new Set(initial)].sort(),
  optional: [...new Set(optional)].sort(),
};
writeFileSync(join(outDir, "offline-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const swPath = join(outDir, "sw.js");
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf8").replaceAll("__APP_VERSION__", String(pkg.version));
  writeFileSync(swPath, sw);
}
console.log(`[offline] ${manifest.core.length} core, ${manifest.initial.length} initial, ${manifest.optional.length} optional`);
