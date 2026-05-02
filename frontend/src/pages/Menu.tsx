import { useState } from "react";
import SettingsSection from "../components/menu/SettingsSection";
import AboutSection from "../components/menu/AboutSection";
import ConsoleSection from "../components/menu/ConsoleSection";
import LogsSection from "../components/menu/LogsSection";
import CreditSection from "../components/menu/CreditSection";
import RemuxSection from "../components/menu/RemuxSection";

const PAGES = [
  { key: "about",    label: "About",      icon: "◈" },
  { key: "remux",    label: "Remux",      icon: "⇄" },
  { key: "settings", label: "Settings",   icon: "⚙" },
  { key: "console",  label: "Console",    icon: "⌨" },
  { key: "logs",     label: "Changelog",  icon: "◎" },
  { key: "credits",  label: "Credits",    icon: "✦" },
];

export default function Menu() {
  const [activePage, setActivePage] = useState("about");

  return (
    <div className="editor-page">
      {/* Left vertical nav */}
      <nav className="editor-nav">
        <div className="editor-nav-brand">EDITOR</div>
        {PAGES.map((page) => (
          <button
            key={page.key}
            className={`editor-nav-item${activePage === page.key ? " active" : ""}`}
            onClick={() => setActivePage(page.key)}
          >
            <span className="editor-nav-icon">{page.icon}</span>
            <span className="editor-nav-label">{page.label}</span>
          </button>
        ))}
      </nav>

      {/* Glass card content area */}
      <div className="editor-content">
        <div className="editor-card">
          {activePage === "about"    && <AboutSection />}
          {activePage === "remux"    && <RemuxSection />}
          {activePage === "settings" && <SettingsSection />}
          {activePage === "console"  && <ConsoleSection />}
          {activePage === "logs"     && <LogsSection />}
          {activePage === "credits"  && <CreditSection />}
        </div>
      </div>
    </div>
  );
}
