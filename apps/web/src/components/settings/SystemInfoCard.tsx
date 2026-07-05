import { useMemo, useState } from "react";
import { ChevronDown, Copy, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "./settings-utils";

type SystemInfoItem = {
  label: string;
  value: string;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const detectBrowser = (userAgent: string) => {
  if (/Edg\//.test(userAgent) || /EdgA\//.test(userAgent) || /EdgiOS\//.test(userAgent)) {
    return "Microsoft Edge";
  }
  if ((/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) && !/Chromium\//.test(userAgent)) {
    return "Chrome";
  }
  if (/Firefox\//.test(userAgent)) {
    return "Firefox";
  }
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) {
    return "Safari";
  }
  return null;
};

const detectOperatingSystem = (userAgent: string, platform: string) => {
  const source = `${userAgent} ${platform}`;

  if (/Windows/i.test(source)) {
    return "Windows";
  }
  if (/Android/i.test(source)) {
    return "Android";
  }
  if (/(iPhone|iPad|iPod)/i.test(source)) {
    return "iOS";
  }
  if (/Mac/i.test(source)) {
    return "macOS";
  }
  if (/Linux/i.test(source)) {
    return "Linux";
  }
  return null;
};

export const SystemInfoCard = () => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const infoItems = useMemo<SystemInfoItem[]>(() => {
    const language = navigator.language || i18n.language;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || t("systemInfo.unknown");
    const userAgent = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as NavigatorWithStandalone).standalone === true;

    return [
      { label: t("systemInfo.version"), value: `v${__EDGEEVER_APP_VERSION__}` },
      { label: t("systemInfo.build"), value: __EDGEEVER_BUILD_LABEL__ },
      {
        label: t("systemInfo.browser"),
        value: detectBrowser(userAgent) ?? t("systemInfo.unknown"),
      },
      {
        label: t("systemInfo.os"),
        value: detectOperatingSystem(userAgent, navigator.platform) ?? t("systemInfo.unknown"),
      },
      { label: t("systemInfo.language"), value: language },
      { label: t("systemInfo.timeZone"), value: timeZone },
      {
        label: t("systemInfo.installMode"),
        value: standalone ? t("systemInfo.standalone") : t("systemInfo.browserMode"),
      },
    ];
  }, [i18n.language, t]);

  const handleCopy = async () => {
    const details = infoItems.map((item) => `${item.label}: ${item.value}`).join("\n");

    if (!(await copyTextToClipboard(details))) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <Card className="w-full min-w-0 overflow-hidden shadow-none">
        <CardHeader className="p-4">
          <CollapsibleTrigger asChild>
            <button className="flex w-full min-w-0 items-start justify-between gap-3 text-left" type="button">
              <span className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="h-4 w-4 text-emerald-700" />
                  {t("systemInfo.title")}
                </CardTitle>
                <CardDescription className="mt-1 text-xs leading-4">{t("systemInfo.description")}</CardDescription>
              </span>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                  expanded ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent asChild>
          <CardContent className="grid gap-3 p-4 pt-0">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full bg-white px-3 text-xs sm:w-auto"
                type="button"
                onClick={() => void handleCopy()}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? t("common.copied") : t("systemInfo.copy")}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {infoItems.map((item) => (
                <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">{item.label}</div>
                  <div className="mt-1 truncate font-mono text-xs font-semibold text-slate-800" title={item.value}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
