// Root sidebar container — nav moved to Navbar, sidebar now only shows EpisodePanel [AMVerge Plus]
import EpisodePanel from "./episodePanel/EpisodePanel";
import type { SidebarProps } from "./types";

export default function Sidebar({
  activePage,
  setActivePage,
  sideBarEnabled,
  ...episodePanelProps
}: SidebarProps) {
  return (
    <div className={`sidebar-container${sideBarEnabled ? "" : " sidebar-collapsed"}`}>
      <EpisodePanel sideBarEnabled={sideBarEnabled} {...episodePanelProps} />
    </div>
  );
}
