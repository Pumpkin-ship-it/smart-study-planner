import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

export interface RingSegment {
  percent: number; // this segment's share of the full circle, 0-100
  color: string;
}

// A circular progress ring made of multiple colored arc segments instead
// of one solid color - e.g. showing each subject's contribution to overall
// completion, stacked around the ring in sequence. Segments are drawn in
// order, each starting where the previous one ended.
export function MultiSegmentRing({
  segments,
  totalPercent,
  size = 140,
  strokeWidth = 20,
  trackColor = "#e2e8f0",
  textColor = "#1e293b",
}: {
  segments: RingSegment[];
  totalPercent: number; // shown as the center label
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  textColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Tracks how far around the circle we've drawn so far, so each new
  // segment picks up exactly where the last one left off.
  let cumulativePercent = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background track - the full, unfilled circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* One colored arc per segment, each offset to start where the
            previous segment ended. */}
        {segments.map((segment, index) => {
          const segmentLength = (segment.percent / 100) * circumference;
          // Negative offset shifts the arc's starting point around the
          // circle by however much has already been drawn.
          const offset = -((cumulativePercent / 100) * circumference);
          cumulativePercent += segment.percent;

          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={offset}
              // Rotate so segments start filling from the top (12 o'clock).
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
      </Svg>
      <View style={styles.textOverlay}>
        <Text style={[styles.percentText, { color: textColor }]}>{totalPercent}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  percentText: { fontSize: 24, fontWeight: "bold" },
});
