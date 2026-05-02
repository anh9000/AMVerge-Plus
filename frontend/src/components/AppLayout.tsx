import React from "react";
import { BorderBeam } from "border-beam";
import Sidebar from "./sidebar/Sidebar";
import Navbar from "./Navbar";

export interface AppLayoutProps {
  windowWrapperRef: React.RefObject<HTMLDivElement | null>;
  sidebarProps: React.ComponentProps<typeof Sidebar>;
  navbarProps: React.ComponentProps<typeof Navbar>;
  dividerProps: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    dividerOffsetPx: number;
    sidebarWidthPx: number;
  };
  children: React.ReactNode;
  loadingOverlay?: React.ReactNode;
  isDragging: boolean;
}

export default function AppLayout({
  windowWrapperRef,
  sidebarProps,
  navbarProps,
  dividerProps,
  children,
  loadingOverlay,
  isDragging,
}: AppLayoutProps) {
  const { isDarkMode } = navbarProps;

  return (
    <BorderBeam
      size="md"
      colorVariant="colorful"
      theme={isDarkMode ? "dark" : "light"}
      duration={5}
      strength={0.65}
      borderRadius={14}
      className="app-root"
    >
      {loadingOverlay}
      {isDragging && (
        <div className="dragging-overlay">
          <h1>Drag file(s) here.</h1>
        </div>
      )}

      {/* Full-width floating navbar pill */}
      <Navbar {...navbarProps} />

      {/* Body: sidebar + content */}
      <div
        className="window-wrapper"
        ref={windowWrapperRef}
        style={{
          ["--amverge-sidebar-width" as any]: `${dividerProps.sidebarWidthPx}px`,
          ["--amverge-divider-offset" as any]: `${dividerProps.dividerOffsetPx}px`,
        }}
      >
        {/* Sidebar — always in DOM; CSS class drives collapse animation */}
        <Sidebar {...sidebarProps} />

        {/* Resize handle — invisible gap; hidden by CSS when sidebar collapsed */}
        <div
          className="divider sidebar-splitter"
          onPointerDown={dividerProps.onPointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={-1}
        >
          <span className="subdivider" />
          <span className="subdivider" />
        </div>

        <div className="content-wrapper">
          {children}
        </div>
      </div>
    </BorderBeam>
  );
}
