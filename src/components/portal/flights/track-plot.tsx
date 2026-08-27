import { haversine } from "@/lib/telemetry";

export type TrackPoint = { t: number; lat: number; lon: number; alt: number | null };

/**
 * The flight track, drawn as a self-contained plot.
 *
 * Deliberately not a map. A basemap needs a tile provider, an API key and a
 * network request, none of which survive the print stylesheet or an audit
 * copy filed as a PDF — and for evidence purposes what matters is the shape of
 * the flight, its extent, and where it started, all of which a georeferenced
 * plot carries. The corner coordinates and the scale bar make it locatable.
 *
 * Altitude colours the path, so a climb reads without a second chart.
 */
export function TrackPlot({
  track,
  height = 260,
}: {
  track: TrackPoint[];
  height?: number;
}) {
  if (track.length < 2) {
    return (
      <p className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No positions in this import — the file carried altitude but no fixes.
      </p>
    );
  }

  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Longitude degrees shrink toward the poles; without this the track is
  // stretched east-west and a square pattern flown looks like a rectangle.
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);

  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const spanLon = Math.max((maxLon - minLon) * lonScale, 1e-6);

  const pad = 14;
  const width = 640;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  // One scale for both axes, so the plot is not distorted.
  const scale = Math.min(innerW / spanLon, innerH / spanLat);
  const drawnW = spanLon * scale;
  const drawnH = spanLat * scale;
  const offsetX = pad + (innerW - drawnW) / 2;
  const offsetY = pad + (innerH - drawnH) / 2;

  const x = (lon: number) => offsetX + (lon - minLon) * lonScale * scale;
  // Latitude increases northward, y increases downward.
  const y = (lat: number) => offsetY + (maxLat - lat) * scale;

  const alts = track.map((p) => p.alt).filter((a): a is number => a !== null);
  const minAlt = alts.length > 0 ? Math.min(...alts) : 0;
  const maxAlt = alts.length > 0 ? Math.max(...alts) : 0;
  const altRange = Math.max(maxAlt - minAlt, 1);

  /** Ground to sky: brand sage through teal to ink as the aircraft climbs. */
  const colourFor = (alt: number | null) => {
    if (alt === null) return "var(--muted-foreground)";
    const f = (alt - minAlt) / altRange;
    return `color-mix(in oklab, var(--brand-sage) ${Math.round((1 - f) * 100)}%, var(--brand-ink))`;
  };

  // A scale bar rounded to something a person reads: 10 m, 25 m, 100 m.
  const metresAcross = haversine(midLat, minLon, midLat, maxLon);
  const niceMetres = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000].reduce((best, candidate) =>
    candidate <= metresAcross / 2 ? candidate : best,
  10);
  const barPx = drawnW * (niceMetres / Math.max(metresAcross, 1));

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border bg-[var(--control-face)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Flight track over ${Math.round(metresAcross)} metres, ${track.length} points, reaching ${Math.round(maxAlt)} metres`}
        >
          {/* The path, segment by segment so altitude can colour it. */}
          {track.slice(1).map((p, i) => {
            const prev = track[i];
            return (
              <line
                key={i}
                x1={x(prev.lon)}
                y1={y(prev.lat)}
                x2={x(p.lon)}
                y2={y(p.lat)}
                stroke={colourFor(p.alt)}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Take-off and landing, so the direction of travel is readable. */}
          <circle
            cx={x(track[0].lon)}
            cy={y(track[0].lat)}
            r={4}
            fill="var(--status-good)"
            stroke="var(--control-face)"
            strokeWidth={1.5}
          />
          <circle
            cx={x(track[track.length - 1].lon)}
            cy={y(track[track.length - 1].lat)}
            r={4}
            fill="var(--status-critical)"
            stroke="var(--control-face)"
            strokeWidth={1.5}
          />

          {/* Scale bar */}
          <g transform={`translate(${pad}, ${height - 8})`}>
            <line x1={0} y1={0} x2={barPx} y2={0} stroke="var(--foreground)" strokeWidth={1.5} />
            <line x1={0} y1={-3} x2={0} y2={3} stroke="var(--foreground)" strokeWidth={1.5} />
            <line
              x1={barPx}
              y1={-3}
              x2={barPx}
              y2={3}
              stroke="var(--foreground)"
              strokeWidth={1.5}
            />
            <text
              x={barPx + 6}
              y={3.5}
              fontSize={10}
              fill="var(--muted-foreground)"
              fontFamily="ui-monospace, monospace"
            >
              {niceMetres >= 1000 ? `${niceMetres / 1000} km` : `${niceMetres} m`}
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
        <span>
          {minLat.toFixed(5)}, {minLon.toFixed(5)} — {maxLat.toFixed(5)}, {maxLon.toFixed(5)}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-[var(--status-good)]"
            />
            take-off
          </span>
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-[var(--status-critical)]"
            />
            landing
          </span>
          {alts.length > 0 ? (
            <span>
              {Math.round(minAlt)}–{Math.round(maxAlt)} m
            </span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}
