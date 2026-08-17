export function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-heading text-xs font-bold tracking-[0.15em] text-brand-teal uppercase">
      <span className="h-3 w-0.5 bg-brand-sage" aria-hidden="true" />
      {children}
    </h2>
  );
}
