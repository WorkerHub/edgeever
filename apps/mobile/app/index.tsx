import * as SplashScreen from "expo-splash-screen";
import { useIsRestoring } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../src/components/LocalizedText";
import { LoginScreen } from "../src/screens/LoginScreen";
import { useSession } from "../src/lib/session";
import { markStartup } from "../src/lib/startup-performance";
import { resolveMobileThemeStyles, useMobileTheme } from "../src/lib/mobile-theme";

const WorkspaceScreen = lazy(() =>
  import("../src/screens/WorkspaceScreen").then((module) => ({ default: module.WorkspaceScreen }))
);

export default function IndexScreen() {
  const { isLoading, session } = useSession();
  const isRestoringCache = useIsRestoring();

  useEffect(() => {
    if (!isLoading && !isRestoringCache) {
      markStartup("index-ready");
      void SplashScreen.hideAsync();
    }
  }, [isLoading, isRestoringCache]);

  if (isLoading || isRestoringCache) {
    return <StartupPlaceholder />;
  }

  return session ? (
    <Suspense fallback={<StartupPlaceholder showBrand />}>
      <WorkspaceScreen />
    </Suspense>
  ) : (
    <LoginScreen />
  );
}

const StartupPlaceholder = ({ showBrand = false }: { showBrand?: boolean }) => {
  const { resolvedTheme } = useMobileTheme();
  const themedStyles = resolveMobileThemeStyles(styles, resolvedTheme);
  return (
    <View style={themedStyles.loading}>
      {showBrand ? <Text style={themedStyles.brand}>EdgeEver</Text> : null}
      <ActivityIndicator color="#15803d" />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: "#f7faf7",
    flex: 1,
    gap: 16,
    justifyContent: "center",
  },
  brand: {
    color: "#17211a",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
});
