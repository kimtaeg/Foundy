import { useId } from "react";
import { PreparationRingArc } from "@/components/dashboard/PreparationRingArc";

export interface PreparationRingTransitionProps {
  offset: number;
  length: number;
  from: string;
  to: string;
}

export function PreparationRingTransition({ offset, length, from, to }: PreparationRingTransitionProps) {
  const gradientId = useId();
  const start = offset / 100 * Math.PI * 2;
  const end = (offset + length) / 100 * Math.PI * 2;
  const firstLength = Math.min(length, 100 - offset);
  const wrappedLength = Math.max(0, length - firstLength);
  const color = `url(#${gradientId})`;
  return (
    <g data-ring-transition="">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" colorInterpolation="sRGB"
          x1={100 + 84 * Math.cos(start)} y1={100 + 84 * Math.sin(start)}
          x2={100 + 84 * Math.cos(end)} y2={100 + 84 * Math.sin(end)}>
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <PreparationRingArc length={firstLength} offset={offset} color={color} roundCaps={false} />
      {wrappedLength > 0 && <PreparationRingArc length={wrappedLength} color={color} roundCaps={false} />}
    </g>
  );
}
