import { View } from "react-native";
import Svg, { Circle, Rect, Polygon } from "react-native-svg";
import { HeroId } from "@/types";

// Colors used to distinguish each hero archetype's outfit.
const HERO_COLORS: Record<HeroId, string> = {
  elf: "#22c55e",
  knight: "#94a3b8",
  mage: "#8b5cf6",
  warrior: "#dc2626",
  rogue: "#334155",
};

// Draws a simple 2D silhouette for a hero, built from basic shapes
// (circle for head, rectangle for body, triangle accents for outfit
// details). Deliberately simple so it renders reliably everywhere and
// doesn't require any external art assets.
export function HeroFigure({
  heroId,
  size = 140,
  scale = 1,
}: {
  heroId: HeroId;
  size?: number;
  // scale grows the figure slightly as the hero levels up (1 = normal, up to ~1.4 = max level)
  scale?: number;
}) {
  const color = HERO_COLORS[heroId];
  const cx = size / 2;

  const headRadius = 14 * scale;
  const headY = size * 0.32;

  const bodyWidth = 34 * scale;
  const bodyHeight = 44 * scale;
  const bodyY = headY + headRadius - 2;

  const legWidth = 10 * scale;
  const legHeight = 28 * scale;
  const legY = bodyY + bodyHeight - 4;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Head */}
        <Circle cx={cx} cy={headY} r={headRadius} fill="#fcd9b8" />

        {/* Body */}
        <Rect
          x={cx - bodyWidth / 2}
          y={bodyY}
          width={bodyWidth}
          height={bodyHeight}
          rx={8}
          fill={color}
        />

        {/* Legs */}
        <Rect x={cx - bodyWidth / 2 + 3} y={legY} width={legWidth} height={legHeight} fill="#3f3f46" />
        <Rect x={cx + bodyWidth / 2 - legWidth - 3} y={legY} width={legWidth} height={legHeight} fill="#3f3f46" />

        {/* A small archetype-specific accent, to visually distinguish heroes */}
        {heroId === "knight" && (
          // Helmet crest - a small triangle above the head
          <Polygon
            points={`${cx - 6},${headY - headRadius} ${cx},${headY - headRadius - 12} ${cx + 6},${headY - headRadius}`}
            fill="#dc2626"
          />
        )}
        {heroId === "mage" && (
          // Pointed hat
          <Polygon
            points={`${cx - 14},${headY - headRadius + 4} ${cx},${headY - headRadius - 22} ${cx + 14},${headY - headRadius + 4}`}
            fill="#6d28d9"
          />
        )}
        {heroId === "elf" && (
          // Pointed ears - two small triangles either side of the head
          <>
            <Polygon
              points={`${cx - headRadius},${headY} ${cx - headRadius - 8},${headY - 6} ${cx - headRadius},${headY - 10}`}
              fill="#fcd9b8"
            />
            <Polygon
              points={`${cx + headRadius},${headY} ${cx + headRadius + 8},${headY - 6} ${cx + headRadius},${headY - 10}`}
              fill="#fcd9b8"
            />
          </>
        )}
        {heroId === "warrior" && (
          // A simple sword accent to the side
          <Rect x={cx + bodyWidth / 2} y={bodyY - 6} width={5} height={bodyHeight + 6} fill="#9ca3af" />
        )}
        {heroId === "rogue" && (
          // A hood shadow - a dark arc-like rectangle over the top of the head
          <Rect x={cx - headRadius - 2} y={headY - headRadius - 4} width={headRadius * 2 + 4} height={headRadius + 6} rx={12} fill="#1e293b" opacity={0.85} />
        )}
      </Svg>
    </View>
  );
}
