import { auth, db } from "@/services/firebase";
import { GamificationStats, HeroId, PetId } from "@/types";
import { BADGES, calculateLevel, levelProgress } from "@/utils/gamification";
import { HeroFigure } from "@/components/HeroFigure";
import { useFocusEffect } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Default stats shown before the user has completed anything yet, and also
// used to fill in any fields missing from OLDER Firestore documents that
// were created before heroId/pets existed in our data model.
const EMPTY_STATS: GamificationStats = {
  userId: "",
  xp: 0,
  streak: 0,
  lastCompletedDate: null,
  badges: [],
  heroId: null,
  pets: [],
};

const HERO_OPTIONS: { id: HeroId; name: string; description: string }[] = [
  { id: "elf", name: "Elf Ranger", description: "Swift and sharp-eyed." },
  { id: "knight", name: "Knight", description: "Sturdy and disciplined." },
  { id: "mage", name: "Mage", description: "Wise and studious." },
  { id: "warrior", name: "Warrior", description: "Bold and relentless." },
  { id: "rogue", name: "Rogue", description: "Quick and resourceful." },
];

const PET_LABELS: Record<PetId, string> = {
  wolf: "Wolf",
  cat: "Cat",
  fox: "Fox",
  dragon: "Dragon",
  phoenix: "Phoenix",
};

export default function RewardsScreen() {
  const [stats, setStats] = useState<GamificationStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  // Loads this user's gamification stats document from Firestore.
  // Merges with EMPTY_STATS so any fields missing from an older document
  // (e.g. accounts created before heroId/pets existed) get safe defaults
  // instead of causing crashes elsewhere in this screen.
  async function loadStats() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      const statsSnap = await getDoc(doc(db, "gamification", currentUser.uid));
      if (statsSnap.exists()) {
        setStats({ ...EMPTY_STATS, ...(statsSnap.data() as Partial<GamificationStats>) });
      } else {
        setStats(EMPTY_STATS);
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  async function chooseHero(heroId: HeroId) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const updated: GamificationStats = { ...stats, userId: currentUser.uid, heroId };
    await setDoc(doc(db, "gamification", currentUser.uid), updated);
    setStats(updated);
  }

  const level = calculateLevel(stats.xp);
  const { currentLevelXp, xpForNextLevel, percent } = levelProgress(stats.xp);
  const heroScale = 1 + Math.min(level - 1, 4) * 0.1;

  if (!loading && !stats.heroId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Choose Your Hero</Text>
        <Text style={styles.subtitle}>
          Your hero grows as you level up by completing assessments.
        </Text>
        <FlatList
          data={HERO_OPTIONS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.heroOptionCard} onPress={() => chooseHero(item.id)}>
              <HeroFigure heroId={item.id} size={90} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroOptionName}>{item.name}</Text>
                <Text style={styles.heroOptionDescription}>{item.description}</Text>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Rewards</Text>

      {stats.heroId && (
        <View style={styles.heroCard}>
          <HeroFigure heroId={stats.heroId} size={140} scale={heroScale} />
          <Text style={styles.heroCardLabel}>
            {HERO_OPTIONS.find((h) => h.id === stats.heroId)?.name} - Level {level}
          </Text>
        </View>
      )}

      <View style={styles.levelCard}>
        <Text style={styles.levelNumber}>Level {level}</Text>
        <Text style={styles.xpLabel}>
          {currentLevelXp} / {xpForNextLevel} XP to next level
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.totalXp}>{stats.xp} total XP</Text>
      </View>

      <View style={styles.streakCard}>
        <Text style={styles.streakNumber}>{stats.streak}</Text>
        <Text style={styles.streakLabel}>
          day streak{stats.streak === 1 ? "" : "s"}
        </Text>
      </View>

      {stats.pets.length > 0 && (
        <View style={styles.petsRow}>
          {stats.pets.map((petId) => (
            <View key={petId} style={styles.petChip}>
              <Text style={styles.petChipText}>{PET_LABELS[petId]}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeader}>Badges</Text>

      <FlatList
        data={BADGES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        refreshing={loading}
        onRefresh={loadStats}
        renderItem={({ item }) => {
          const earned = stats.badges.includes(item.id);
          return (
            <View style={[styles.badgeCard, earned ? styles.badgeEarned : styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>{earned ? "[*]" : "[ ]"}</Text>
              <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                {item.name}
              </Text>
              <Text style={styles.badgeDescription}>{item.description}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#111111", marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#666666", marginBottom: 16 },
  heroOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  heroOptionName: { fontSize: 16, fontWeight: "700", color: "#111111" },
  heroOptionDescription: { fontSize: 12, color: "#666666", marginTop: 2 },
  heroCard: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  heroCardLabel: { fontSize: 14, fontWeight: "600", color: "#111111", marginTop: 4 },
  levelCard: {
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  levelNumber: { fontSize: 26, fontWeight: "bold", color: "#111111" },
  xpLabel: { fontSize: 13, color: "#555555", marginTop: 4, marginBottom: 10 },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#4f46e5", borderRadius: 6 },
  totalXp: { fontSize: 12, color: "#666666", marginTop: 8 },
  streakCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  streakNumber: { fontSize: 32, fontWeight: "bold", color: "#c2410c" },
  streakLabel: { fontSize: 13, color: "#854d0e", marginTop: 2 },
  petsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  petChip: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  petChipText: { color: "#166534", fontWeight: "600", fontSize: 12 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#111111", marginBottom: 8 },
  badgeCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  badgeEarned: { backgroundColor: "#fef9c3", borderColor: "#eab308" },
  badgeLocked: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
  badgeIcon: { fontSize: 14, fontWeight: "700", marginBottom: 4, color: "#111111" },
  badgeName: { fontSize: 13, fontWeight: "700", color: "#111111" },
  badgeNameLocked: { color: "#999999" },
  badgeDescription: { fontSize: 11, color: "#666666", marginTop: 2 },
});
