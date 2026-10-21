import { registerHooks } from "node:module";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", "/index.ts"]) {
        if (existsSync(fileURLToPath(url) + suffix)) return next(url.href + suffix, context);
      }
    }
    return next(specifier, context);
  },
});

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(ROOT, "public");
const MAX_SPRITE_BYTES = 1024 * 1024;
const REQUIRED_GROUP = ["idle.webp", "walk.webp", "attack.webp", "hurt.webp", "jump.webp"];

const { FIGHTER_CONTENT } = await import("../src/game/content/registry.ts");
const { ANIM_NAMES, CLIP_FILES, clipInventory } = await import("../src/game/assets/clips.ts");
const { GAME_VERSION } = await import("../src/game/core/version.ts");

const errors = [];
const warnings = [];
let checked = 0;

function u24(buf, at) {
  return buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16);
}

function webpInfo(file) {
  const buf = readFileSync(file);
  if (buf.length < 20 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("invalid RIFF/WEBP header");
  }
  let pos = 12;
  let width = 0;
  let height = 0;
  let alpha = false;
  while (pos + 8 <= buf.length) {
    const type = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const data = pos + 8;
    if (type === "ALPH") alpha = true;
    if (type === "VP8X" && data + 10 <= buf.length) {
      alpha ||= !!(buf[data] & 0x10);
      width = u24(buf, data + 4) + 1;
      height = u24(buf, data + 7) + 1;
    } else if (type === "VP8 " && data + 10 <= buf.length && !width) {
      width = buf.readUInt16LE(data + 6) & 0x3fff;
      height = buf.readUInt16LE(data + 8) & 0x3fff;
    } else if (type === "VP8L" && data + 5 <= buf.length && !width) {
      alpha = true;
      const b1 = buf[data + 1], b2 = buf[data + 2], b3 = buf[data + 3], b4 = buf[data + 4];
      width = 1 + (((b2 & 0x3f) << 8) | b1);
      height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    }
    pos = data + size + (size & 1);
  }
  if (!width || !height) throw new Error("dimensions not found");
  return { width, height, alpha, bytes: buf.length };
}

function publicFromUrl(url) {
  if (!url) return null;
  const trimmed = url.replace(/^\.\//, "").replace(/^\//, "");
  return join(PUBLIC, trimmed);
}

const gridSeen = new Set();
function checkGrid(rel, info, columns, rows, frames, dedicated) {
  const cols = Math.max(1, columns || 1);
  const rowsN = Math.max(1, rows || 1);
  const key = `${rel}:${cols}x${rowsN}:${frames}:${dedicated ? "d" : "g"}`;
  if (gridSeen.has(key)) return;
  gridSeen.add(key);
  const cells = cols * rowsN;
  if (info.width % cols !== 0 || info.height % rowsN !== 0) {
    const msg = `${rel}: grid ${cols}x${rowsN} does not divide ${info.width}x${info.height}`;
    if (dedicated) errors.push(msg);
    else warnings.push(msg);
  }
  if (frames > cells) {
    const msg = `${rel}: frames=${frames} exceeds cells=${cells} (${cols}x${rowsN})`;
    if (dedicated) errors.push(msg);
    else warnings.push(msg);
  }
}

if (ANIM_NAMES.length !== 31) errors.push(`ANIM_NAMES expected 31, got ${ANIM_NAMES.length}`);

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
if (pkg.version !== GAME_VERSION) errors.push(`package.json ${pkg.version} != GAME_VERSION ${GAME_VERSION}`);

console.log(`[assets] BRUTAL BLOOD ${GAME_VERSION} — ${ANIM_NAMES.length} animation states`);

for (const entry of FIGHTER_CONTENT) {
  const { id, assets } = entry;
  const fighterDir = join(PUBLIC, "fighters", id);
  const portraitFile = publicFromUrl(assets.portrait);
  if (!portraitFile || !existsSync(portraitFile)) errors.push(`${id}: missing portrait`);
  if (!existsSync(fighterDir)) {
    errors.push(`${id}: missing fighter directory`);
    continue;
  }

  for (const name of REQUIRED_GROUP) {
    if (!existsSync(join(fighterDir, name))) errors.push(`${id}: missing group fallback ${name}`);
  }

  const inv = clipInventory(assets);
  if (inv.missing.length) {
    errors.push(`${id}: MISSING without fallback: ${inv.missing.join(", ")}`);
  }

  const declared = assets.availableClips ?? [];
  for (const anim of declared) {
    const fileName = CLIP_FILES[anim];
    if (!fileName) {
      errors.push(`${id}: unknown clip ${anim}`);
      continue;
    }
    const clip = assets.clips[anim];
    const file = publicFromUrl(clip?.src) || join(fighterDir, fileName);
    if (!existsSync(file)) errors.push(`${id}: availableClips lists missing ${fileName}`);
  }

  for (const name of ANIM_NAMES) {
    const clip = assets.clips[name];
    if (!clip) {
      errors.push(`${id}: manifest missing clip ${name}`);
      continue;
    }
    const dedicatedFile = clip.src ? publicFromUrl(clip.src) : null;
    if (dedicatedFile) {
      if (!existsSync(dedicatedFile)) errors.push(`${id}: ${name} src 404 ${clip.src}`);
      else {
        try {
          const info = webpInfo(dedicatedFile);
          checkGrid(relative(PUBLIC, dedicatedFile).replaceAll("\\", "/"), info, clip.columns, clip.rows, clip.frames, true);
        } catch (error) {
          errors.push(`${id}: ${name} ${error.message}`);
        }
      }
    }
    if (clip.fallbackSrc) {
      const groupFile = publicFromUrl(clip.fallbackSrc);
      if (groupFile && !existsSync(groupFile)) errors.push(`${id}: ${name} fallbackSrc 404 ${clip.fallbackSrc}`);
      else if (groupFile && existsSync(groupFile)) {
        try {
          const info = webpInfo(groupFile);
          checkGrid(
            relative(PUBLIC, groupFile).replaceAll("\\", "/"),
            info,
            clip.sheetColumns || clip.columns,
            clip.sheetRows || clip.rows,
            clip.sheetFrames || clip.frames,
            false,
          );
        } catch (error) {
          errors.push(`${id}: ${name} group ${error.message}`);
        }
      }
    }
  }

  console.log(
    `[assets] ${id.padEnd(8)} DEDICATED ${String(inv.dedicated.length).padStart(2)}  CLIP_FALLBACK ${String(inv.clipFallback.length).padStart(2)}  GROUP_FALLBACK ${String(inv.groupFallback.length).padStart(2)}  MISSING ${inv.missing.length}`,
  );
  console.log(`         dedicated: ${inv.dedicated.join(", ") || "—"}`);
  if (inv.clipFallback.length) console.log(`         clip fb:   ${inv.clipFallback.join(", ")}`);
  if (inv.groupFallback.length) console.log(`         group fb:  ${inv.groupFallback.join(", ")}`);
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".work") || name.startsWith("work-")) {
      warnings.push(`${relative(PUBLIC, join(dir, name))}: leftover process workdir`);
      continue;
    }
    const file = join(dir, name);
    const st = statSync(file);
    if (st.isDirectory()) walk(file);
    else if (name.endsWith(".webp")) {
      checked += 1;
      try {
        const info = webpInfo(file);
        const rel = relative(PUBLIC, file).replaceAll("\\", "/");
        if (info.width > 4096 || info.height > 4096) warnings.push(`${rel}: very large dimensions ${info.width}x${info.height}`);
        if (info.bytes > MAX_SPRITE_BYTES) warnings.push(`${rel}: ${(info.bytes / 1024 / 1024).toFixed(2)} MB exceeds 1 MB asset budget`);
        if (rel.startsWith("fighters/") && rel.split("/").length >= 3 && !info.alpha) {
          warnings.push(`${rel}: no alpha channel detected`);
        }
      } catch (error) {
        errors.push(`${relative(PUBLIC, file)}: ${error.message}`);
      }
    }
  }
}
walk(PUBLIC);

console.log(`[assets] checked ${checked} WebP files`);
for (const w of warnings) console.warn(`[assets][warn] ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`[assets][error] ${e}`);
  process.exitCode = 1;
} else {
  console.log(`[assets] OK — ${warnings.length} warning(s)`);
}
