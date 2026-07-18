import { enUS, zhCN } from "@edgeever/shared/i18n";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  readMobileLocalePreference,
  writeMobileLocalePreference,
  type MobileLocalePreference,
} from "./preferences";

type SupportedMobileLocale = "zh-CN" | "en-US";
type MobileLocaleContextValue = {
  preference: MobileLocalePreference;
  resolvedLocale: SupportedMobileLocale;
  setPreference: (preference: MobileLocalePreference) => void;
  translate: (value: string) => string;
};

type TranslationPair = { source: string; target: string; pattern?: RegExp; placeholders?: string[] };

const mobileOnlyTranslations = new Map<string, string>([
  ["返回", "Back"],
  ["切换到深色模式", "Switch to dark mode"],
  ["切换到浅色模式", "Switch to light mode"],
  ["完成编辑", "Finish editing"],
  ["完成新建笔记", "Finish creating note"],
  ["笔记列表操作", "Note list actions"],
  ["搜索", "Search"],
  ["搜索标题、正文或标签", "Search titles, content, or tags"],
  ["输入关键词开始搜索", "Enter a keyword to search"],
  ["搜索本机同步缓存，结果会即时显示", "Search the local synced cache with instant results"],
  ["笔记操作", "Note actions"],
  ["编辑笔记", "Edit note"],
  ["所在笔记本", "Notebook"],
  ["笔记标题", "Note title"],
  ["笔记标签", "Note tags"],
  ["选择笔记本", "Choose notebook"],
  ["没有正文预览", "No content preview"],
  ["原生运行时启动", "Native runtime startup"],
  ["启动至 JS 执行", "Launch to JavaScript execution"],
  ["启动至会话/缓存就绪", "Launch to session/cache ready"],
  ["启动至工作区首帧", "Launch to workspace first frame"],
  ["启动至列表数据就绪", "Launch to list data ready"],
  ["启动至交互空闲", "Launch to interaction idle"],
  ["最近一次本地编辑器启动", "Latest local editor startup"],
  ["暂不可用", "Unavailable"],
  ["尚未记录", "Not recorded"],
]);

const flattenStrings = (value: unknown, prefix = "", output = new Map<string, string>()) => {
  if (typeof value === "string") {
    output.set(prefix, value);
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenStrings(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const zhStrings = flattenStrings(zhCN);
const enStrings = flattenStrings(enUS);
const translationPairs: TranslationPair[] = Array.from(zhStrings.entries())
  .flatMap(([key, source]) => {
    const target = enStrings.get(key);
    if (!target || source === target) {
      return [];
    }
    const placeholders: string[] = [];
    const patternSource = escapeRegExp(source).replace(/\\\{\\\{(\w+)\\\}\\\}/g, (_match, placeholder: string) => {
      placeholders.push(placeholder);
      return "(.+?)";
    });
    return [{ source, target, pattern: placeholders.length > 0 ? new RegExp(`^${patternSource}$`) : undefined, placeholders }];
  })
  .sort((left, right) => right.source.length - left.source.length);
const exactTranslations = new Map(translationPairs.filter((pair) => !pair.pattern).map((pair) => [pair.source, pair.target]));
const templateTranslations = translationPairs.filter((pair) => pair.pattern);

const resolveSystemLocale = (): SupportedMobileLocale =>
  (Intl.DateTimeFormat().resolvedOptions().locale || "zh-CN").toLowerCase().startsWith("en") ? "en-US" : "zh-CN";

export const translateMobileText = (value: string, locale: SupportedMobileLocale) => {
  if (locale !== "en-US" || !/[\u3400-\u9fff]/.test(value)) {
    return value;
  }
  const exact = mobileOnlyTranslations.get(value) ?? exactTranslations.get(value);
  if (exact) {
    return exact;
  }
  for (const pair of templateTranslations) {
    const match = pair.pattern?.exec(value);
    if (!match) {
      continue;
    }
    return (pair.placeholders ?? []).reduce(
      (translated, placeholder, index) => translated.replace(`{{${placeholder}}}`, match[index + 1] ?? ""),
      pair.target
    );
  }
  return value;
};

let currentResolvedMobileLocale: SupportedMobileLocale = resolveSystemLocale();
export const translateCurrentMobileText = (value: string) => translateMobileText(value, currentResolvedMobileLocale);

const MobileLocaleContext = createContext<MobileLocaleContextValue>({
  preference: "system",
  resolvedLocale: resolveSystemLocale(),
  setPreference: () => undefined,
  translate: (value) => value,
});

export const MobileLocaleProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<MobileLocalePreference>("system");

  useEffect(() => {
    let active = true;
    void readMobileLocalePreference().then((storedPreference) => {
      if (active) {
        setPreferenceState(storedPreference);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const resolvedLocale = preference === "system" ? resolveSystemLocale() : preference;
  currentResolvedMobileLocale = resolvedLocale;
  const value = useMemo<MobileLocaleContextValue>(
    () => ({
      preference,
      resolvedLocale,
      setPreference: (nextPreference) => {
        setPreferenceState(nextPreference);
        void writeMobileLocalePreference(nextPreference);
      },
      translate: (text) => translateMobileText(text, resolvedLocale),
    }),
    [preference, resolvedLocale]
  );

  return <MobileLocaleContext.Provider value={value}>{children}</MobileLocaleContext.Provider>;
};

export const useMobileLocale = () => useContext(MobileLocaleContext);
