import type { LibraryCollection, WorkspaceTheme } from "./workspace-layout";

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
  const collections: { id: LibraryCollection; label: string; count: number; icon: string }[] = [
    { id: "all", label: "全部照片", count: total, icon: "▦" },
    { id: "rated", label: "已评分", count: rated, icon: "☆" },
    { id: "selected", label: "已选择", count: selected, icon: "✓" },
  ];
  return <aside className="workspace-nav" aria-label="图库导航">
    <div className="nav-heading"><span>工作区</span><strong>本地图库</strong></div>
    <nav>{collections.map((item) => <button key={item.id} type="button"
      className={collection === item.id ? "active" : ""} aria-label={item.label} onClick={() => onCollection(item.id)}>
      <i aria-hidden="true">{item.icon}</i><span>{item.label}</span><b>{item.count}</b>
    </button>)}</nav>
    <div className="nav-section"><span>本地引擎</span><div className={`engine-status ${gpuStatus}`}><i /><div>
      <strong>{gpuStatus === "ready" ? "GPU 就绪" : gpuStatus === "error" ? "GPU 不可用" : "GPU 检查中"}</strong>
      <small>本地 AI · 尚未接入</small></div></div></div>
    <div className="theme-switcher" aria-label="界面主题">
      <span>外观</span><div>{(["dark", "grey", "light"] as WorkspaceTheme[]).map((value) => <button key={value}
        type="button" className={theme === value ? "active" : ""} aria-label={`${value} 主题`}
        title={`${value} 主题`} onClick={() => onTheme(value)}><i className={`theme-dot ${value}`} /></button>)}</div>
    </div>
  </aside>;
}
