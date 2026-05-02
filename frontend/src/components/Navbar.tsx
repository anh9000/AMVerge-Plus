import React from "react"

type NavbarProps = {
    setSideBarEnabled: React.Dispatch<React.SetStateAction<boolean>>
    sideBarEnabled: boolean
    userHasHEVC: React.RefObject<boolean>
    videoIsHEVC: boolean | null
    isDarkMode: boolean // [AMVerge Plus]
    onThemeToggle: () => void // [AMVerge Plus]
}

export default function Navbar({
    setSideBarEnabled,
    sideBarEnabled,
    userHasHEVC,
    videoIsHEVC,
    isDarkMode,
    onThemeToggle,
}: NavbarProps) {
    return (
        <div className="navbar">
            <div className="left-nav">
                <svg
                    onClick={() => setSideBarEnabled(prev => !prev)}
                    width="22" height="22" viewBox="0 0 24 24"
                    fill="none" xmlns="http://www.w3.org/2000/svg"
                    style={{
                        transform: sideBarEnabled ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.22s ease',
                    }}
                >
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h1><span>AMV</span>erge Plus</h1>
            </div>

            {/* Codec status */}
            <div className="hevc-check">
                <div className="hevc-row">
                    <span>user has hevc?</span>
                    <span className={`status-dot ${userHasHEVC.current ? "ok" : "bad"}`} />
                </div>
                {!userHasHEVC.current && (
                    <div className="hevc-row">
                        <span>video is HEVC encoded?</span>
                        <span
                            className={`status-dot ${
                                videoIsHEVC === true ? "ok" : videoIsHEVC === false ? "bad" : "unknown"
                            }`}
                        />
                    </div>
                )}
            </div>

            {/* Light / Dark toggle — [AMVerge Plus] */}
            <button
                className="theme-toggle-btn"
                onClick={onThemeToggle}
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
            >
                {isDarkMode ? "☀" : "◑"}
            </button>
        </div>
    )
}
