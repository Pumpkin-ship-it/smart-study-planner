import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";

// A single day indicator in the streak week row, built from two fixed
// rows so the letter and flame icon always sit at the SAME height:
// - Top row: the weekday letter (inactive) OR a flame icon (active).
// - Bottom row: an empty gray circle (inactive) OR the letter, now
//   positioned under the flame icon (active).
export function StreakWeekDay({
  label,
  isActive,
  isToday,
  color,
}: {
  label: string;
  isActive: boolean;
  isToday: boolean;
  color: string;
}) {
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  // Crossfades between the two states, so the change feels smooth
  // rather than an instant jump.
  const activeOpacity = progress; // 0 = inactive visuals, 1 = active visuals
  const inactiveOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.column}>
      {/* Top row: letter (inactive) OR flame icon image (active), same
          fixed height either way */}
      <View style={styles.topRow}>
        <Animated.Text style={[styles.letterTop, { opacity: inactiveOpacity }]}>
          {label}
        </Animated.Text>
        <Animated.Image
          source={require("../assets/icons/fire.png")}
          style={[styles.flameIcon, { opacity: activeOpacity }]}
        />
      </View>

      {/* Bottom row: empty gray circle (inactive) OR the letter (active) */}
      <View style={styles.bottomRow}>
        <Animated.View
          style={[
            styles.circle,
            isToday && !isActive && styles.circleToday,
            { opacity: inactiveOpacity },
          ]}
        />
        <Animated.Text
          style={[styles.letterBottom, { color, opacity: activeOpacity }]}
        >
          {label}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center", width: 26 },
  topRow: {
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  letterTop: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },
  flameIcon: {
    position: "absolute",
    width: 14,
    height: 14,
  },
  bottomRow: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e2e8f0",
  },
  circleToday: { borderWidth: 2, borderColor: "#94a3b8" },
  letterBottom: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
  },
});
