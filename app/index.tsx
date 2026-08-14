import { auth } from "@/services/firebase";
import { Redirect } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

// Three possible auth states: not logged in, logged in but unverified,
// or logged in and verified.
type AuthState = "checking" | "loggedOut" | "unverified" | "verified";

export default function IndexScreen() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    // Firebase tells us whenever the login state changes (login, logout, app start).
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        setAuthState("loggedOut");
      } else if (!user.emailVerified) {
        setAuthState("unverified");
      } else {
        setAuthState("verified");
      }
    });
    return unsubscribe;
  }, []);

  // While we're checking, show a simple loading spinner instead of a blank screen.
  if (authState === "checking") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Now we know for sure - send them to the right place. Unverified users
  // are blocked from the main app until they confirm their email.
  if (authState === "verified") {
    return <Redirect href="/(tabs)/dashboard" />;
  }
  if (authState === "unverified") {
    return <Redirect href="/verify-email" />;
  }
  return <Redirect href="/login" />;
}
