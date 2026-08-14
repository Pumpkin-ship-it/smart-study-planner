import { auth } from "@/services/firebase";
import { useTheme } from "@/components/ThemeContext";
import { useRouter } from "expo-router";
import { sendEmailVerification, signOut } from "firebase/auth";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Shown after registration (and whenever a signed-in but unverified user
// tries to use the app). Blocks access until the user clicks the link in
// their verification email - this is checked centrally in app/index.tsx.
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleResend() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setResending(true);
    try {
      await sendEmailVerification(currentUser);
      Alert.alert("Email sent", "Check your inbox for the verification link.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setResending(false);
    }
  }

  // Firebase doesn't push verification status changes automatically - we
  // have to manually reload the user's data to pick up a fresh
  // emailVerified value after they click the link in another app/tab.
  async function handleCheckVerification() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setChecking(true);
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        router.replace("/onboarding");
      } else {
        Alert.alert(
          "Not verified yet",
          "We couldn't confirm your email is verified. Please click the link in the email first, then try again."
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleUseDifferentAccount() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to {auth.currentUser?.email}. Click the
        link in that email, then come back and tap "I've Verified" below.
      </Text>

      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleCheckVerification}
        disabled={checking}
      >
        <Text style={styles.buttonText}>{checking ? "Checking..." : "I've Verified"}</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={handleResend}
        disabled={resending}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
          {resending ? "Sending..." : "Resend Verification Email"}
        </Text>
      </Pressable>

      <Pressable onPress={handleUseDifferentAccount}>
        <Text style={styles.link}>Use a different account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#1e293b",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  secondaryButtonText: { fontWeight: "600", fontSize: 14 },
  link: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
  },
});
