import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// A small set of preset accent colors the user can choose from. Each theme
// just defines one primary color and a matching light background tint -
// every screen that wants to be "theme-aware" reads these two values
// instead of hardcoding a color directly.
export interface Theme {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
}

export const THEMES: Theme[] = [
  { id: "blue", name: "Blue", primary: "#2563eb", primaryLight: "#eef2ff" },
  { id: "purple", name: "Purple", primary: "#7c3aed", primaryLight: "#f3e8ff" },
  { id: "green", name: "Green", primary: "#16a34a", primaryLight: "#dcfce7" },
  { id: "orange", name: "Orange", primary: "#ea580c", primaryLight: "#ffedd5" },
  { id: "pink", name: "Pink", primary: "#db2777", primaryLight: "#fce7f3" },
];

const STORAGE_KEY = "studyflow_theme_id";

interface ThemeContextValue {
  theme: Theme;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setThemeId: () => {},
});

// Wraps the whole app so any screen can read the current theme via useTheme().
// Remembers the user's choice on this device using AsyncStorage, so it
// persists across app restarts (this is a plain local preference, not
// user account data, so it does not need to live in Firestore).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState("blue");

  // Load the saved theme choice when the app starts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((savedId) => {
      if (savedId && THEMES.some((t) => t.id === savedId)) {
        setThemeIdState(savedId);
      }
    });
  }, []);

  // Updates the theme in memory AND saves it so it's remembered next time.
  function setThemeId(id: string) {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
  }

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>{children}</ThemeContext.Provider>
  );
}

// Hook used by any screen that wants to read/change the current theme.
export function useTheme() {
  return useContext(ThemeContext);
}
