import { auth } from "@/services/firebase";
import { Redirect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function IndexScreen() {
  // undefined = still checking, true/false = known auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Firebase tells us whenever the login state changes (login, logout, app start).
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return unsubscribe;
  }, []);

  // While we're checking, show a simple loading spinner instead of a blank screen.
  if (isLoggedIn === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Now we know for sure — send them to the right place.
  return isLoggedIn ? (
    <Redirect href="/(tabs)/dashboard" />
  ) : (
    <Redirect href="/login" />
  );
}