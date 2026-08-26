"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { dockTransform, DOCK_REST } from "@/lib/dock";

/**
 * Dock-style magnification for a row of equal tiles.
 *
 * Each tile swells with its distance from the cursor, so the row bulges around
 * the pointer the way the macOS Dock does. Only transforms change, never
 * layout, so nothing reflows while the cursor crosses it.
 *
 * The curve itself lives in lib/dock.ts and is tested there; this is the
 * pointer listener and the frame loop around it.
 *
 * Deliberately scoped to this one grid. The same effect on buttons in a dense
 * table would move the target while someone is aiming at it, which costs
 * misclicks all day in an operational tool — there, controls pop in place.
 */
export function DockGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    // A magnification field needs a pointer to follow. Touch has none, and
    // someone who asked for less motion should not get a swelling row.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    // A boolean rather than the frame id: "frame = requestAnimationFrame(apply)"
    // assigns *after* apply has run and cleared it, so a synchronous frame
    // would leave the guard permanently set and silently stop all updates.
    let pending = false;
    let frame = 0;
    let pointerX: number | null = null;

    const tiles = () => Array.from(container.children) as HTMLElement[];

    const paint = (tile: HTMLElement, t: typeof DOCK_REST) => {
      if (t.scale === 1 && t.lift === 0) {
        tile.style.transform = "";
        tile.style.zIndex = "";
        return;
      }
      tile.style.transform = `translateY(${(-t.lift).toFixed(2)}px) scale(${t.scale.toFixed(3)})`;
      tile.style.zIndex = t.raised ? "10" : "";
    };

    const apply = () => {
      pending = false;
      const items = tiles();
      if (items.length === 0) return;
      const tileWidth = items[0].offsetWidth;

      for (const tile of items) {
        if (pointerX === null) {
          paint(tile, DOCK_REST);
          continue;
        }
        const box = tile.getBoundingClientRect();
        const centre = box.left + box.width / 2;
        paint(tile, dockTransform(Math.abs(pointerX - centre), tileWidth));
      }
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(apply);
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || calm.matches) return;
      pointerX = event.clientX;
      schedule();
    };
    const onLeave = () => {
      pointerX = null;
      schedule();
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);

    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      // Leave nothing behind if this unmounts mid-hover.
      for (const tile of tiles()) paint(tile, DOCK_REST);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
