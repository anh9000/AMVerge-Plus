// Root sidebar container — import button + EpisodePanel [AMVerge Plus]
import EpisodePanel from "./episodePanel/EpisodePanel";
import type { SidebarProps } from "./types";

export default function Sidebar({
  activePage,
  setActivePage,
  sideBarEnabled,
  onImportClick,
  isLoading,
  ...episodePanelProps
}: SidebarProps) {
  return (
    <div className={`sidebar-container has-beam${sideBarEnabled ? "" : " sidebar-collapsed"}`}>
      <div className="sidebar-import-bar">
        <button
          className="sidebar-import-btn"
          onClick={onImportClick}
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : "+ Import"}
        </button>
      </div>
      <EpisodePanel sideBarEnabled={sideBarEnabled} {...episodePanelProps} />
    </div>
  );
}
