export function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-3 font-heading text-xs font-bold tracking-[0.15em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
