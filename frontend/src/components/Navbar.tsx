import React, { useEffect, useRef } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
    LuPanelLeft,
    LuSun,
    LuMoon,
    LuMinus,
    LuSquare,
    LuX,
    LuImport,
    LuSettings,
    LuTerminal,
    LuFileText,
    LuHeart,
    LuInfo,
    LuRefreshCw,
    LuEye,
    LuEyeOff,
    LuCheck,
} from "react-icons/lu"
import type { Page } from "./sidebar/types"

type NavbarProps = {
    setSideBarEnabled: React.Dispatch<React.SetStateAction<boolean>>
    sideBarEnabled: boolean
    isDarkMode: boolean
    onThemeToggle: () => void
    activePage: Page
    setActivePage: React.Dispatch<React.SetStateAction<Page>>
    onImportClick?: () => void
    isLoading?: boolean
}

const appWin = getCurrentWindow();

export default function Navbar({
    setSideBarEnabled,
    sideBarEnabled,
    isDarkMode,
    onThemeToggle,
    activePage,
    setActivePage,
    onImportClick,
    isLoading,
}: NavbarProps) {
    const navbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = navbarRef.current;
        if (!el) return;

        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as Element;
            if (target.closest("button, a, input, select, [role='menu'], [data-radix-popper-content-wrapper]")) return;
            appWin.startDragging().catch(() => {});
        };

        el.addEventListener("mousedown", onMouseDown);
        return () => el.removeEventListener("mousedown", onMouseDown);
    }, []);

    return (
        <div className="navbar" ref={navbarRef}>
            {/* Left: toolbar menus + sidebar toggle + wordmark */}
            <div className="nav-left">
                {/* File menu */}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="nav-menu-trigger">File</button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="nav-dropdown" sideOffset={8} align="start">
                            <DropdownMenu.Item
                                className="nav-dropdown-item"
                                onSelect={() => onImportClick?.()}
                                disabled={isLoading}
                            >
                                <LuImport size={14} />
                                <span>Import</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="nav-dropdown-sep" />
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuSettings size={14} />
                                <span>Settings</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* View menu */}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="nav-menu-trigger">View</button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="nav-dropdown" sideOffset={8} align="start">
                            <DropdownMenu.CheckboxItem
                                className="nav-dropdown-item"
                                checked={sideBarEnabled}
                                onCheckedChange={() => setSideBarEnabled(prev => !prev)}
                            >
                                <LuPanelLeft size={14} />
                                <span>Sidebar</span>
                                <DropdownMenu.ItemIndicator className="nav-dropdown-check">
                                    <LuCheck size={12} />
                                </DropdownMenu.ItemIndicator>
                            </DropdownMenu.CheckboxItem>
                            <DropdownMenu.Separator className="nav-dropdown-sep" />
                            <DropdownMenu.Item
                                className="nav-dropdown-item"
                                onSelect={onThemeToggle}
                            >
                                {isDarkMode ? <LuSun size={14} /> : <LuMoon size={14} />}
                                <span>{isDarkMode ? "Light theme" : "Dark theme"}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Help menu */}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="nav-menu-trigger">Help</button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="nav-dropdown" sideOffset={8} align="start">
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuInfo size={14} />
                                <span>About AMVerge</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuRefreshCw size={14} />
                                <span>Remux</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="nav-dropdown-sep" />
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuTerminal size={14} />
                                <span>Console</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuFileText size={14} />
                                <span>Changelog</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="nav-dropdown-item">
                                <LuHeart size={14} />
                                <span>Credits</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Direct sidebar toggle icon */}
                <button
                    className="nav-icon-btn"
                    onClick={() => setSideBarEnabled(prev => !prev)}
                    title={sideBarEnabled ? "Hide sidebar" : "Show sidebar"}
                    aria-label="Toggle sidebar"
                >
                    <LuPanelLeft size={15} />
                </button>

                <span className="wordmark">
                    <span className="wordmark-accent">AMV</span>erge Plus
                </span>
            </div>

            {/* Center: page tabs */}
            <nav className="nav-tabs">
                <button
                    className={`nav-tab${activePage === "clipping" ? " active" : ""}`}
                    onClick={() => setActivePage("clipping")}
                >
                    CLIPPING
                </button>
                <button
                    className={`nav-tab${activePage === "editor" ? " active" : ""}`}
                    onClick={() => setActivePage("editor")}
                >
                    EDITOR
                </button>
            </nav>

            {/* Right: theme + window controls */}
            <div className="nav-right">
                <button
                    className="nav-icon-btn"
                    onClick={onThemeToggle}
                    title={isDarkMode ? "Light theme" : "Dark theme"}
                    aria-label="Toggle theme"
                >
                    {isDarkMode ? <LuSun size={14} /> : <LuMoon size={14} />}
                </button>

                <div className="win-controls">
                    <button className="win-btn win-min" onClick={() => appWin.minimize()} title="Minimize" aria-label="Minimize">
                        <LuMinus size={12} />
                    </button>
                    <button className="win-btn win-max" onClick={() => appWin.toggleMaximize()} title="Maximize" aria-label="Maximize">
                        <LuSquare size={10} />
                    </button>
                    <button className="win-btn win-close" onClick={() => appWin.close()} title="Close" aria-label="Close">
                        <LuX size={12} />
                    </button>
                </div>
            </div>
        </div>
    )
}
