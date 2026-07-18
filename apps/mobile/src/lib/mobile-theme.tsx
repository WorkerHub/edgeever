import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { readMobileThemePreference, writeMobileThemePreference, type MobileThemePreference } from "./preferences";

export type MobileResolvedTheme = "light" | "dark";

type MobileThemeContextValue = {
  preference: MobileThemePreference;
  resolvedTheme: MobileResolvedTheme;
  setPreference: (preference: MobileThemePreference) => void;
  toggleTheme: () => void;
};

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null);

const foregroundDarkMap: Record<string, string> = {
  "#020617": "#f8fafc",
  "#0f172a": "#f8fafc",
  "#1e293b": "#f1f5f9",
  "#17211a": "#f8fafc",
  "#334155": "#e2e8f0",
  "#475569": "#e2e8f0",
  "#64748b": "#cbd5e1",
  "#94a3b8": "#94a3b8",
  "#b91c1c": "#fca5a5",
  "#be123c": "#fda4af",
  "#e11d48": "#fb7185",
};

const backgroundDarkMap: Record<string, string> = {
  "#ffffff": "#0f172a",
  "#f8fafc": "#020617",
  "#f7faf7": "#020617",
  "#f1f5f9": "#1e293b",
  "#ecfdf5": "#064e3b",
  "#ecfdf3": "#064e3b",
  "#f0fdf4": "#052e16",
  "#fef2f2": "#450a0a",
  "#fff1f2": "#4c0519",
  "#fffbeb": "#451a03",
};

const borderDarkMap: Record<string, string> = {
  "#f1f5f9": "#1e293b",
  "#e2e8f0": "#334155",
  "#cbd5e1": "#475569",
  "#a7f3d0": "#047857",
  "#fecaca": "#7f1d1d",
  "#fda4af": "#9f1239",
  "#dce7dd": "#334155",
  "#cad8cc": "#475569",
  "#bbf7d0": "#047857",
  "#fde68a": "#92400e",
};

const mapThemeColor = (value: unknown, theme: MobileResolvedTheme, palette: Record<string, string>) => {
  if (theme !== "dark" || typeof value !== "string") {
    return value;
  }
  return palette[value.toLowerCase()] ?? value;
};

export const resolveMobileThemeColor = (value: string | undefined, theme: MobileResolvedTheme, usage: "foreground" | "background" | "border" = "foreground") =>
  mapThemeColor(value, theme, usage === "background" ? backgroundDarkMap : usage === "border" ? borderDarkMap : foregroundDarkMap) as string | undefined;

export const resolveMobileThemeStyles = <T extends Record<string, unknown>>(styleSheet: T, theme: MobileResolvedTheme): T => {
  if (theme === "light") {
    return styleSheet;
  }
  return Object.fromEntries(
    Object.entries(styleSheet).map(([styleName, styleValue]) => {
      if (!styleValue || typeof styleValue !== "object") {
        return [styleName, styleValue];
      }
      const resolvedStyle = Object.fromEntries(
        Object.entries(styleValue).map(([property, value]) => {
          if (property === "color" || property === "tintColor") {
            return [property, mapThemeColor(value, theme, foregroundDarkMap)];
          }
          if (property === "backgroundColor") {
            return [property, mapThemeColor(value, theme, backgroundDarkMap)];
          }
          if (property.startsWith("border") && property.endsWith("Color")) {
            return [property, mapThemeColor(value, theme, borderDarkMap)];
          }
          return [property, value];
        })
      );
      return [styleName, resolvedStyle];
    })
  ) as T;
};

export const MobileThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemTheme = useColorScheme();
  const [preference, setPreferenceState] = useState<MobileThemePreference>("system");

  useEffect(() => {
    let active = true;
    void readMobileThemePreference().then((storedPreference) => {
      if (active) {
        setPreferenceState(storedPreference);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const resolvedTheme: MobileResolvedTheme = preference === "system" ? (systemTheme === "dark" ? "dark" : "light") : preference;
  const value = useMemo<MobileThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference: (nextPreference) => {
      setPreferenceState(nextPreference);
      void writeMobileThemePreference(nextPreference);
    },
    toggleTheme: () => {
      const nextPreference = resolvedTheme === "dark" ? "light" : "dark";
      setPreferenceState(nextPreference);
      void writeMobileThemePreference(nextPreference);
    },
  }), [preference, resolvedTheme]);

  return <MobileThemeContext.Provider value={value}>{children}</MobileThemeContext.Provider>;
};

export const useMobileTheme = () => {
  const context = useContext(MobileThemeContext);
  if (!context) {
    throw new Error("useMobileTheme must be used within MobileThemeProvider");
  }
  return context;
};
