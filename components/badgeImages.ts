// Maps each badge ID to its icon image. Filenames match the badge IDs
// exactly (e.g. "stars_1" -> badge_stars_1.png), so this stays easy to
// keep in sync as badges are added or changed.
export const BADGE_IMAGES: Record<string, any> = {
  stars_1: require("../assets/icons/badges/badge_stars_1.png"),
  stars_3: require("../assets/icons/badges/badge_stars_3.png"),
  stars_5: require("../assets/icons/badges/badge_stars_5.png"),
  stars_8: require("../assets/icons/badges/badge_stars_8.png"),
  stars_12: require("../assets/icons/badges/badge_stars_12.png"),
  stars_16: require("../assets/icons/badges/badge_stars_16.png"),
  stars_20: require("../assets/icons/badges/badge_stars_20.png"),
  stars_25: require("../assets/icons/badges/badge_stars_25.png"),
  stars_30: require("../assets/icons/badges/badge_stars_30.png"),
  stars_40: require("../assets/icons/badges/badge_stars_40.png"),
};
