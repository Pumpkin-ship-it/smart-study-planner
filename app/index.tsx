import { Redirect } from "expo-router";

// When the app opens at the root path ("/"), send the user straight to the dashboard tab.
export default function IndexScreen() {
  return <Redirect href="/(tabs)/dashboard" />;
}