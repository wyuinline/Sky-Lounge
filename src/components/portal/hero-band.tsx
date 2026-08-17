import type { ReactNode } from "react";
import { BrandMotif } from "@/components/portal/brand-motif";

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
    <div className="relative overflow-hidden rounded-md bg-brand-ink text-white">
      {/* Brand triangle composition, anchored right. Hidden on small screens
          so it never crowds the title. */}
      <BrandMotif className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[300px] md:block lg:w-[380px]" />

      <div className="relative flex flex-col gap-5 px-6 py-8 sm:px-8 sm:py-10 md:pr-[280px] lg:pr-[360px]">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-brand-lime uppercase">
            {eyebrow}
          </p>
          <div className="mt-2.5 h-0.5 w-10 bg-brand-lime" />
          <h1 className="mt-3 text-[2rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
