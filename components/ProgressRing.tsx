import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { StyleSheet, Text } from "react-native";

// A reusable circular progress ring. Made up of two overlapping circles:
// a light gray "track" circle (the full ring), and a colored "progress"
// circle drawn on top, whose visible portion is controlled by
// strokeDashoffset - this is the standard SVG trick for circular progress.
// Used on both the Dashboard and Progress screens for consistency.
export function ProgressRing({
  percent,
  size = 140,
  color = "#2563eb",
  trackColor = "#e5e7eb",
  // Lets the percentage text be white when the ring sits on a colored
  // background (e.g. the purple Daily Progress card), or dark when it
  // sits on a plain white background.
  textColor = "#111111",
  // Lets callers hide the ring's own built-in percentage label, for
  // cases where they want to overlay their own custom text instead
  // (e.g. the Focus Timer showing a countdown clock instead of a %).
  showLabel = true,
}: {
  percent: number;
  size?: number;
  color?: string;
  trackColor?: string;
  textColor?: string;
  showLabel?: boolean;
}) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // How much of the circle's outline to "hide" so only `percent`% shows as drawn.
  const strokeDashoffset = circumference * (1 - percent / 100);

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
        {/* Foreground progress - only shows `percent`% of the circle's outline */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          // Rotate so the ring starts filling from the top (12 o'clock)
          // instead of SVG's default 3 o'clock starting point.
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Percentage text, centered on top of the ring - only shown when
          showLabel is true, so callers can overlay their own text instead. */}
      {showLabel && (
        <View style={styles.textOverlay}>
          <Text style={[styles.percentText, { color: textColor }]}>{percent}%</Text>
        </View>
      )}
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

