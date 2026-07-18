import { ApiRequestError } from "@edgeever/client";
import type { AuthUser } from "@edgeever/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, UserRound, Users, X } from "../components/icons";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, Text, TextInput } from "../components/LocalizedText";
import { resolveMobileThemeStyles, useMobileTheme, type MobileResolvedTheme } from "../lib/mobile-theme";
import { useSession } from "../lib/session";

type Section = "password" | "users";

export const AccountSecurityModal = ({
  currentUser,
  initialSection = "password",
  onClose,
  visible,
}: {
  currentUser: AuthUser | null;
  initialSection?: Section;
  onClose: () => void;
  visible: boolean;
}) => {
  const { resolvedTheme } = useMobileTheme();
  refreshAccountSecurityThemeStyles(resolvedTheme);
  const { client } = useSession();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const usersQuery = useQuery({
    queryKey: ["mobile", "users"],
    queryFn: async () => {
      if (!client) throw new Error("Client is not ready");
      return client.listUsers();
    },
    enabled: Boolean(client && visible && currentUser?.role === "owner" && section === "users"),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Client is not ready");
      if (newPassword.length < 8) throw new Error("新密码至少需要 8 个字符");
      if (newPassword !== confirmPassword) throw new Error("两次输入的新密码不一致");
      return client.changePassword({ currentPassword, newPassword, confirmPassword });
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("密码已更新", "下次登录请使用新密码。");
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Client is not ready");
      if (memberPassword.length < 8) throw new Error("密码至少需要 8 个字符");
      return client.createUser({ username: username.trim(), displayName: displayName.trim() || null, password: memberPassword });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setUsername("");
      setDisplayName("");
      setMemberPassword("");
      await queryClient.invalidateQueries({ queryKey: ["mobile", "users"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: { password?: string; isDisabled?: boolean } }) => {
      if (!client) throw new Error("Client is not ready");
      return client.updateUser(userId, input);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["mobile", "users"] }),
  });

  useEffect(() => {
    if (visible) {
      setSection(initialSection);
    } else {
      setSection("password");
      passwordMutation.reset();
      createUserMutation.reset();
      updateUserMutation.reset();
    }
  }, [initialSection, visible]);

  const errorMessage = (error: unknown) => {
    if (error instanceof ApiRequestError && error.code === "invalid_current_password") return "当前密码不正确";
    if (error instanceof ApiRequestError && error.code === "username_exists") return "该用户名已经存在";
    return error instanceof Error ? error.message : "操作失败，请稍后再试";
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="关闭" onPress={onClose} style={styles.iconButton}>
            <X color="#17211a" size={20} />
          </Pressable>
          <Text style={styles.title}>账户与安全</Text>
          <View style={styles.iconPlaceholder} />
        </View>

        {currentUser?.role === "owner" ? (
          <View style={styles.tabs}>
            <Tab active={section === "password"} icon={<KeyRound color={section === "password" ? "#ffffff" : "#475569"} size={16} />} label="修改密码" onPress={() => setSection("password")} />
            <Tab active={section === "users"} icon={<Users color={section === "users" ? "#ffffff" : "#475569"} size={16} />} label="用户管理" onPress={() => setSection("users")} />
          </View>
        ) : null}

        {section === "password" ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <KeyRound color="#15803d" size={22} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>修改登录密码</Text>
                <Text style={styles.help}>密码更新后，现有 App 会话继续有效。</Text>
              </View>
            </View>
            <Field label="当前密码" onChangeText={setCurrentPassword} value={currentPassword} />
            <Field label="新密码" onChangeText={setNewPassword} value={newPassword} />
            <Field label="确认新密码" onChangeText={setConfirmPassword} value={confirmPassword} />
            {passwordMutation.error ? <Text style={styles.error}>{errorMessage(passwordMutation.error)}</Text> : null}
            <PrimaryButton
              disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              label={passwordMutation.isPending ? "正在修改…" : "修改密码"}
              onPress={() => passwordMutation.mutate()}
            />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>实例用户</Text>
                <Text style={styles.help}>每个用户拥有隔离的笔记空间。</Text>
              </View>
              <Pressable onPress={() => setCreateOpen((value) => !value)} style={styles.addButton}>
                <Plus color="#ffffff" size={16} />
                <Text style={styles.addButtonText}>添加</Text>
              </Pressable>
            </View>

            {createOpen ? (
              <View style={styles.createCard}>
                <Field label="用户名" onChangeText={setUsername} secure={false} value={username} />
                <Field label="显示名称（可选）" onChangeText={setDisplayName} secure={false} value={displayName} />
                <Field label="初始密码" onChangeText={setMemberPassword} value={memberPassword} />
                {createUserMutation.error ? <Text style={styles.error}>{errorMessage(createUserMutation.error)}</Text> : null}
                <PrimaryButton
                  disabled={createUserMutation.isPending || !username.trim() || memberPassword.length < 8}
                  label={createUserMutation.isPending ? "正在创建…" : "创建用户"}
                  onPress={() => createUserMutation.mutate()}
                />
              </View>
            ) : null}

            {usersQuery.isLoading ? <ActivityIndicator color="#15803d" /> : null}
            {usersQuery.error ? <Text style={styles.error}>{errorMessage(usersQuery.error)}</Text> : null}
            {usersQuery.data?.users.map((user) => (
              <View key={user.id} style={styles.userBlock}>
                <View style={styles.userCard}>
                  <View style={styles.userIcon}><UserRound color="#15803d" size={18} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.userName}>{user.displayName || user.username}</Text>
                    <Text style={styles.help}>@{user.username} · {user.role === "owner" ? "所有者" : user.isDisabled ? "已停用" : "已启用"}</Text>
                    <Pressable onPress={() => { setResetUserId(user.id); setResetPasswordValue(""); }}><Text style={styles.link}>重置密码</Text></Pressable>
                  </View>
                  {user.role !== "owner" ? (
                    <Switch
                      disabled={updateUserMutation.isPending}
                      onValueChange={(enabled) => updateUserMutation.mutate({ userId: user.id, input: { isDisabled: !enabled } })}
                      value={!user.isDisabled}
                    />
                  ) : null}
                </View>
                {resetUserId === user.id ? (
                  <View style={styles.resetCard}>
                    <Field label={`@${user.username} 的新密码`} onChangeText={setResetPasswordValue} value={resetPasswordValue} />
                    <View style={styles.resetActions}>
                      <Pressable onPress={() => setResetUserId(null)}><Text style={styles.cancelText}>取消</Text></Pressable>
                      <PrimaryButton
                        disabled={updateUserMutation.isPending || resetPasswordValue.length < 8}
                        label={updateUserMutation.isPending ? "正在重置…" : "确认重置"}
                        onPress={() => updateUserMutation.mutate(
                          { userId: user.id, input: { password: resetPasswordValue } },
                          { onSuccess: () => { setResetUserId(null); setResetPasswordValue(""); } }
                        )}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const Tab = ({ active, icon, label, onPress }: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
    {icon}<Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </Pressable>
);

const Field = ({ label, onChangeText, secure = true, value }: { label: string; onChangeText: (value: string) => void; secure?: boolean; value: string }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={onChangeText} secureTextEntry={secure} style={styles.input} value={value} />
  </View>
);

const PrimaryButton = ({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) => (
  <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}>
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>
);

const baseAccountSecurityStyles = StyleSheet.create({
  safeArea: { backgroundColor: "#f7faf7", flex: 1 },
  header: { alignItems: "center", borderBottomColor: "#dce7dd", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16 },
  title: { color: "#17211a", fontSize: 17, fontWeight: "800" },
  iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  iconPlaceholder: { width: 40 },
  tabs: { flexDirection: "row", gap: 8, padding: 12 },
  tab: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#dce7dd", borderRadius: 10, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", padding: 11 },
  tabActive: { backgroundColor: "#15803d", borderColor: "#15803d" },
  tabText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#ffffff" },
  content: { gap: 14, padding: 16, paddingBottom: 40 },
  hero: { alignItems: "center", backgroundColor: "#ecfdf3", borderRadius: 14, flexDirection: "row", gap: 12, padding: 16 },
  sectionHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  cardTitle: { color: "#17211a", fontSize: 16, fontWeight: "800" },
  help: { color: "#64748b", fontSize: 12, lineHeight: 18, marginTop: 3 },
  field: { gap: 7 },
  label: { color: "#334155", fontSize: 13, fontWeight: "700" },
  input: { backgroundColor: "#ffffff", borderColor: "#cad8cc", borderRadius: 10, borderWidth: 1, color: "#17211a", minHeight: 48, paddingHorizontal: 13 },
  primaryButton: { alignItems: "center", backgroundColor: "#15803d", borderRadius: 10, minHeight: 48, justifyContent: "center" },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  error: { color: "#be123c", fontSize: 13, lineHeight: 19 },
  addButton: { alignItems: "center", backgroundColor: "#15803d", borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  createCard: { backgroundColor: "#ffffff", borderColor: "#dce7dd", borderRadius: 14, borderWidth: 1, gap: 13, padding: 14 },
  userCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#dce7dd", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 },
  userBlock: { gap: 8 },
  resetCard: { backgroundColor: "#f8fafc", borderColor: "#dce7dd", borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 },
  resetActions: { alignItems: "center", flexDirection: "row", gap: 14, justifyContent: "flex-end" },
  cancelText: { color: "#64748b", fontSize: 13, fontWeight: "700" },
  userIcon: { alignItems: "center", backgroundColor: "#ecfdf3", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  userName: { color: "#17211a", fontSize: 14, fontWeight: "800" },
  link: { color: "#15803d", fontSize: 12, fontWeight: "700", marginTop: 6 },
});

let styles = baseAccountSecurityStyles;
let accountSecurityStylesTheme: MobileResolvedTheme = "light";

const refreshAccountSecurityThemeStyles = (theme: MobileResolvedTheme) => {
  if (accountSecurityStylesTheme !== theme) {
    styles = resolveMobileThemeStyles(baseAccountSecurityStyles, theme);
    accountSecurityStylesTheme = theme;
  }
};
