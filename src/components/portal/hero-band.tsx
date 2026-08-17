import type { ReactNode } from "react";

export function HeroBand({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-md bg-sidebar px-6 py-8 text-sidebar-foreground sm:px-8 sm:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 font-heading text-xs font-bold tracking-[0.2em] text-[#a1d884] uppercase">
            {eyebrow}
          </p>
          <div className="mb-3 h-px w-12 bg-[#a1d884]" />
          <h1 className="font-heading text-4xl leading-none font-bold tracking-tight uppercase sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-sidebar-foreground/70">{subtitle}</p>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
