import type { ActionName } from "@/game/core/config";
import type { Input } from "@/game/input/Input";

export function TouchControls({ input }: { input: Input }) {
  const hold = (a: ActionName) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input.setVirtual(a, true);
    },
    onPointerUp: () => input.setVirtual(a, false),
    onPointerCancel: () => input.setVirtual(a, false),
  });

  const Btn = ({ a, label, className }: { a: ActionName; label: string; className?: string }) => (
    <button
      type="button"
      className={`min-h-11 min-w-11 rounded-full border border-line bg-panel/80 font-display text-[0.65rem] tracking-widest text-bone ${className ?? ""}`}
      {...hold(a)}
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-between px-2 sm:hidden">
      <div className="pointer-events-auto grid grid-cols-3 gap-1">
        <span />
        <Btn a="up" label="▲" />
        <span />
        <Btn a="left" label="◀" />
        <Btn a="down" label="▼" />
        <Btn a="right" label="▶" />
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-1">
        <Btn a="light" label="LP" />
        <Btn a="medium" label="MP" />
        <Btn a="heavy" label="HP" />
        <Btn a="kickLight" label="LK" />
        <Btn a="kickHeavy" label="HK" />
        <Btn a="special" label="SP" />
        <Btn a="block" label="BL" />
        <Btn a="super" label="SU" />
        <Btn a="throw" label="TH" />
      </div>
    </div>
  );
}
