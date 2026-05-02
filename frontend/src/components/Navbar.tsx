import React from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import type { Page } from "./sidebar/types"

type NavbarProps = {
    setSideBarEnabled: React.Dispatch<React.SetStateAction<boolean>>
    sideBarEnabled: boolean
    isDarkMode: boolean
    onThemeToggle: () => void
    activePage: Page
    setActivePage: React.Dispatch<React.SetStateAction<Page>>
}

const appWin = getCurrentWindow();

export default function Navbar({
    setSideBarEnabled,
    sideBarEnabled,
    isDarkMode,
    onThemeToggle,
    activePage,
    setActivePage,
}: NavbarProps) {
    return (
        <div className="navbar" data-tauri-drag-region>
            {/* Left: sidebar toggle + wordmark */}
            <div className="nav-left">
                <button
                    className="sidebar-toggle"
                    onClick={() => setSideBarEnabled(prev => !prev)}
                    title={sideBarEnabled ? "Hide panel" : "Show panel"}
                    aria-label="Toggle sidebar"
                >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <rect x="1" y="2.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                        <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                        <rect x="1" y="10.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                    </svg>
                </button>
                <span className="wordmark">
                    <span className="wordmark-accent">AMV</span>erge Plus
                </span>
            </div>

            {/* Center: page navigation tabs */}
            <nav className="nav-tabs">
                <button
                    className={`nav-tab${activePage === "home" ? " active" : ""}`}
                    onClick={() => setActivePage("home")}
                >
                    Home
                </button>
                <button
                    className={`nav-tab${activePage === "menu" ? " active" : ""}`}
                    onClick={() => setActivePage("menu")}
                >
                    Menu
                </button>
            </nav>

            {/* Right: theme toggle + window controls */}
            <div className="nav-right">
                <button
                    className="theme-toggle"
                    onClick={onThemeToggle}
                    title={isDarkMode ? "Switch to light" : "Switch to dark"}
                    aria-label="Toggle theme"
                >
                    {isDarkMode
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    }
                </button>

                {/* Window controls — required because decorations: false */}
                <div className="win-controls">
                    <button
                        className="win-btn win-min"
                        onClick={() => appWin.minimize()}
                        title="Minimize"
                        aria-label="Minimize"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    </button>
                    <button
                        className="win-btn win-max"
                        onClick={() => appWin.toggleMaximize()}
                        title="Maximize"
                        aria-label="Maximize"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        </svg>
                    </button>
                    <button
                        className="win-btn win-close"
                        onClick={() => appWin.close()}
                        title="Close"
                        aria-label="Close"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
