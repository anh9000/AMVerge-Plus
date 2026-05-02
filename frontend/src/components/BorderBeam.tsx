import { useRef } from "react";
import { useAnimationFrame } from "framer-motion";

interface BorderBeamProps {
  color?: string;
  duration?: number; // ms
  size?: number;     // px diameter of the glow dot
}

export default function BorderBeam({
  color = "rgba(175, 255, 0, 0.85)",
  duration = 4000,
  size = 120,
}: BorderBeamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);

  useAnimationFrame((t) => {
    const container = containerRef.current;
    const dot = dotRef.current;
    if (!container || !dot) return;

    if (startRef.current === null) startRef.current = t;
    const elapsed = t - startRef.current;
    const progress = (elapsed % duration) / duration; // 0 → 1

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    const perimeter = 2 * (w + h);
    const dist = progress * perimeter;

    const half = size / 2;
    let x: number, y: number;

    if (dist <= w) {
      // top edge: left → right
      x = dist - half;
      y = -half;
    } else if (dist <= w + h) {
      // right edge: top → bottom
      x = w - half;
      y = dist - w - half;
    } else if (dist <= 2 * w + h) {
      // bottom edge: right → left
      x = w - (dist - w - h) - half;
      y = h - half;
    } else {
      // left edge: bottom → top
      x = -half;
      y = h - (dist - 2 * w - h) - half;
    }

    dot.style.transform = `translate(${x}px, ${y}px)`;
  });

  return (
    <div ref={containerRef} className="bb-container" aria-hidden="true">
      <div
        ref={dotRef}
        className="bb-dot"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${color} 0%, ${color.replace(/[\d.]+\)$/, "0.3)")} 40%, transparent 70%)`,
        }}
      />
    </div>
  );
}
