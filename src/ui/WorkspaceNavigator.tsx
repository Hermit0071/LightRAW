import type { LibraryCollection, WorkspaceTheme } from "./workspace-layout";
import { useI18n } from "./i18n";

export type GpuStatus = "checking" | "ready" | "error";

export function WorkspaceNavigator({ collection, total, rated, selected, theme, gpuStatus, onCollection, onTheme }: {
  collection: LibraryCollection;
  total: number;
  rated: number;
  selected: number;
  theme: WorkspaceTheme;
  gpuStatus: GpuStatus;
  onCollection: (collection: LibraryCollection) => void;
  onTheme: (theme: WorkspaceTheme) => void;
}) {
  const { locale, setLocale, t } = useI18n();
  const collections: { id: LibraryCollection; label: string; count: number; icon: string }[] = [
    { id: "all", label: t("全部照片", "All photos"), count: total, icon: "▦" },
    { id: "rated", label: t("已评分", "Rated"), count: rated, icon: "☆" },
    { id: "selected", label: t("已选择", "Selected"), count: selected, icon: "✓" },
  ];
  return <aside className="workspace-nav" aria-label={t("图库导航", "Library navigation")}>
    <div className="nav-heading"><span>{t("工作区", "Workspace")}</span><strong>{t("本地图库", "Local library")}</strong></div>
    <nav>{collections.map((item) => <button key={item.id} type="button"
      className={collection === item.id ? "active" : ""} aria-label={item.label} onClick={() => onCollection(item.id)}>
      <i aria-hidden="true">{item.icon}</i><span>{item.label}</span><b>{item.count}</b>
    </button>)}</nav>
    <div className="nav-section"><span>{t("本地引擎", "Local engine")}</span><div className={`engine-status ${gpuStatus}`}><i /><div>
      <strong>{gpuStatus === "ready" ? t("GPU 就绪", "GPU ready") : gpuStatus === "error" ? t("GPU 不可用", "GPU unavailable") : t("GPU 检查中", "Checking GPU")}</strong>
      <small>{t("本地 AI · 尚未接入", "Local AI · not connected")}</small></div></div></div>
    <div className="language-switcher" aria-label={t("界面语言", "Interface language")}><span>{t("语言", "Language")}</span><div>
      <button type="button" className={locale === "zh" ? "active" : ""} aria-label="中文" title="中文" onClick={() => setLocale("zh")}>中</button>
      <button type="button" className={locale === "en" ? "active" : ""} aria-label="English" title="English" onClick={() => setLocale("en")}>EN</button>
    </div></div>
    <div className="theme-switcher" aria-label={t("界面主题", "Interface theme")}>
      <span>{t("外观", "Theme")}</span><div>{(["dark", "grey", "light"] as WorkspaceTheme[]).map((value) => <button key={value}
        type="button" className={theme === value ? "active" : ""} aria-label={`${value} ${t("主题", "theme")}`}
        title={`${value} ${t("主题", "theme")}`} onClick={() => onTheme(value)}><i className={`theme-dot ${value}`} /></button>)}</div>
    </div>
  </aside>;
}
