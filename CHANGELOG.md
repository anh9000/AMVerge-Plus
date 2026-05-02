# Changelog

## [0.5.0] - 2026-05-01

### Added
- In-app update checker, checks GitHub releases on startup (3s delay)
- One-click update download with progress bar, downloads, extracts, and relaunches automatically
- New signing keypair for update verification

### Fixed
- Orphaned ffmpeg processes after app close, process tree now killed on window destroy

### Security
- Content Security Policy enabled (was completely disabled)
- Asset protocol scope narrowed from `$APPDATA/**` to app folder only
- Video path validation added before passing to ffmpeg

### Changed
- Renamed project to AMVerge Plus
- Replaced upstream signing key with own keypair
- Removed repo meta files (README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, documentation.md)
- Updated `.gitignore` to block local AI context files
