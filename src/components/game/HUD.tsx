import type { HudSnap } from "@/game/combat/Match";

export function HUD({ hud }: { hud: HudSnap | null }) {
  if (!hud) return null;
  const t = hud.mode === "training" ? "∞" : String(hud.timer).padStart(2, "0");
  const cpuTag = hud.mode === "versus" ? "PLAYER 2" : "CPU";
  return (
    <div className="pointer-events-none absolute inset-x-[3%] top-4 z-10 grid grid-cols-[1fr_7rem_1fr] items-start gap-3 sm:gap-5">
      <FighterHud side="left" snap={hud.p1} low={hud.lowLife.p1} superReady={hud.superReady.p1} tag="PLAYER 1" winsNeeded={hud.winsNeeded} />
      <div className="text-center font-display">
        <div className="text-[0.65rem] tracking-[0.28em] text-mute">{hud.roundLabel}</div>
        <div className="text-3xl tabular-nums leading-none text-bone sm:text-5xl">{t}</div>
      </div>
      <FighterHud side="right" snap={hud.p2} low={hud.lowLife.p2} superReady={hud.superReady.p2} tag={cpuTag} winsNeeded={hud.winsNeeded} />
      {hud.combo && (
        <div className="col-span-3 mt-2 justify-self-center font-display text-center">
          <div className="text-2xl tracking-widest text-blood">{hud.combo.hits} HITS</div>
          <div className="text-xs tracking-widest text-mute">
            {hud.combo.damage} DMG · MAX {hud.combo.max} · BÓNUS {hud.combo.bonus}
            {hud.comboScale < 0.99 ? ` · SCALE ${Math.round(hud.comboScale * 100)}%` : ""}
          </div>
        </div>
      )}
      {hud.combatEvent && (
        <div className="col-span-3 justify-self-center font-display text-sm tracking-[0.32em] text-ember">
          {hud.combatEvent}
          {hud.mode === "training" && hud.frameAdv !== 0 ? `  ${hud.frameAdv > 0 ? "+" : ""}${hud.frameAdv}F` : ""}
        </div>
      )}
      {hud.mode === "training" && hud.hitstopFrames > 0 && (
        <div className="col-span-3 justify-self-center font-display text-[0.65rem] tracking-[0.32em] text-ember">
          HITSTOP {hud.hitstopFrames}F
        </div>
      )}
      {hud.message && (
        <div className="pointer-events-none absolute left-1/2 top-[46vh] z-20 w-max -translate-x-1/2 -translate-y-1/2 font-display text-4xl tracking-[0.14em] text-bone sm:text-6xl"
          style={{ textShadow: "0 6px 0 #000, 0 0 28px #a90000" }}>
          {hud.message}
        </div>
      )}
      {hud.finish && (
        <div className="col-span-3 mt-8 text-center font-display text-xs tracking-[0.2em] text-ember">
          {hud.finishHint}
        </div>
      )}
    </div>
  );
}

function FighterHud({
  snap, side, low, superReady, tag, winsNeeded,
}: {
  snap: HudSnap["p1"];
  side: "left" | "right";
  low: boolean;
  superReady: boolean;
  tag: string;
  winsNeeded: number;
}) {
  const hp = Math.max(0, (snap.health / snap.maxHealth) * 100);
  const align = side === "right" ? "items-end text-right" : "items-start";
  const wins = "●".repeat(snap.roundWins) + "○".repeat(Math.max(0, winsNeeded - snap.roundWins));
  const portrait = snap.portrait ? (
    <img
      src={snap.portrait}
      alt=""
      className="h-11 w-9 shrink-0 object-cover object-top"
      style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
      crossOrigin="anonymous"
    />
  ) : null;
  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className={`flex w-full items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
        {portrait}
        <div className={`flex min-w-0 flex-1 items-center justify-between gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
          <div className={side === "right" ? "text-right" : ""}>
            <div className="text-[0.6rem] tracking-[0.24em] text-mute">{tag}</div>
            <div className="font-display text-sm tracking-[0.18em] sm:text-lg">{snap.name}</div>
          </div>
          <div className="font-display text-ember">{wins}</div>
        </div>
      </div>
      <div className={`h-5 w-full border-2 border-bone bg-ink p-0.5 ${low ? "animate-pulse" : ""}`}>
        <div className="health-bar" style={{ width: `${hp}%`, marginLeft: side === "right" ? "auto" : 0 }} />
      </div>
      <div className="mt-0.5 h-2 w-full border border-line bg-ink p-px">
        <div className="meter-bar" style={{ width: `${snap.meter}%`, marginLeft: side === "right" ? "auto" : 0 }} />
      </div>
      <div className={`h-1.5 w-full border border-line bg-ink p-px ${superReady ? "shadow-[0_0_12px_#e8c9a4]" : ""}`}>
        <div className="super-bar" style={{ width: `${snap.superMeter}%`, marginLeft: side === "right" ? "auto" : 0 }} />
      </div>
      {superReady && (
        <div className="font-display text-[0.6rem] tracking-[0.28em] text-super">SUPER</div>
      )}
    </div>
  );
}
