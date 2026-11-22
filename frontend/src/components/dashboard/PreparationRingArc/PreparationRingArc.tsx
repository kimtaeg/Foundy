const RADIUS = 84;
const STROKE_WIDTH = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface PreparationRingArcProps {
  length: number;
  offset?: number;
  color: string;
  opacity?: number;
  roundCaps?: boolean;
}

/** Only exposed progress endpoints need round caps; internal stage boundaries stay flush. */
export function PreparationRingArc({ length, offset = 0, color, opacity = 1, roundCaps = true }: PreparationRingArcProps) {
  if (length <= 0) return null;
  const fullCircle = length >= 100;
  const capLength = STROKE_WIDTH / CIRCUMFERENCE * 100;
  // Tiny contributions keep their true length rather than becoming oversized dots.
  const rounded = roundCaps && length > capLength;

  return (
    <circle
      cx="100" cy="100" r={RADIUS} fill="none"
      stroke={color} strokeOpacity={opacity} strokeWidth={STROKE_WIDTH} strokeLinecap={rounded ? "round" : "butt"}
      pathLength="100"
      strokeDasharray={fullCircle ? undefined : `${rounded ? length - capLength : length} 100`}
      strokeDashoffset={fullCircle ? undefined : -(offset + (rounded ? capLength / 2 : 0))}
    />
  );
}
