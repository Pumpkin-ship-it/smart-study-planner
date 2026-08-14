import { Image, StyleSheet, View } from "react-native";
import { HeroId } from "@/types";

// Maps each hero archetype to its portrait image file.
const HERO_IMAGES: Record<HeroId, any> = {
  elf: require("../assets/heroes/elf.png"),
  knight: require("../assets/heroes/knight.png"),
  mage: require("../assets/heroes/mage.png"),
  warrior: require("../assets/heroes/warrior.png"),
  rogue: require("../assets/heroes/rogue.png"),
};

// Displays a hero's portrait image.
// crop="full" (default) shows the entire image, unclipped.
// crop="bust" shows only the upper half (head/shoulders) - used for small
// circular avatars, where a full-body image would look too cramped.
export function HeroFigure({
  heroId,
  size = 140,
  scale = 1,
  crop = "full",
}: {
  heroId: HeroId;
  size?: number;
  // scale grows the image slightly as the hero levels up (1 = normal, up to ~1.4 = max level)
  scale?: number;
  crop?: "full" | "bust";
}) {
  const finalSize = size * scale;

  if (crop === "bust") {
    return (
      <View style={[styles.bustContainer, { width: size, height: size }]}>
        {/* Image is rendered at DOUBLE the container's height, anchored
            to the top - this clips off the bottom half, leaving only
            the upper portion (head/shoulders) visible. */}
        <Image
          source={HERO_IMAGES[heroId]}
          style={{ width: finalSize, height: finalSize * 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={HERO_IMAGES[heroId]}
        style={{ width: finalSize, height: finalSize }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  bustContainer: {
    alignItems: "center",
    overflow: "hidden",
  },
});
