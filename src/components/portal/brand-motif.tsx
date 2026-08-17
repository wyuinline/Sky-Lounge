/**
 * Inline Group's triangle composition, rebuilt as inline SVG.
 *
 * The contour lines inside the teal panel are the point: Inline is a
 * geotechnical / survey firm, so topographic contours are the literal
 * artifact of their work rather than abstract decoration.
 */
export function BrandMotif({ className }: { className?: string }) {
  // Concentric rings read as a topographic survey plot.
  const rings = [14, 26, 38, 50, 62, 74, 86];

  return (
    <svg
      viewBox="0 0 320 220"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <clipPath id="brand-motif-teal">
          <polygon points="150,220 320,50 320,220" />
        </clipPath>
      </defs>

      {/* lime wedge — the brand's high-energy note, top right */}
      <polygon points="150,0 320,0 320,48" fill="var(--brand-lime)" />

      {/* sage wedge — mid tone, overlaps toward the copy */}
      <polygon points="66,220 190,96 190,220" fill="var(--brand-sage)" opacity="0.45" />

      {/* teal panel carrying the survey contours */}
      <g clipPath="url(#brand-motif-teal)">
        <polygon points="150,220 320,50 320,220" fill="var(--brand-teal)" />
        <g
          fill="none"
          stroke="#26383d"
          strokeWidth="1.1"
          opacity="0.65"
          transform="rotate(-28 268 158)"
        >
          {rings.map((r) => (
            <ellipse key={r} cx="268" cy="158" rx={r} ry={r * 0.62} />
          ))}
        </g>
      </g>
    </svg>
  );
}
