import sys
from pathlib import Path
from shutil import which


if getattr(sys, "frozen", False):
    ROOT = Path(sys.executable).resolve().parent
else:
    ROOT = Path(__file__).resolve().parent.parent


def get_binary(name: str) -> str:
    """Return the path to a bundled binary like ffmpeg/ffprobe.

    Normalises the name for the current platform: adds .exe on Windows,
    strips it on Linux/macOS.  Callers may pass either form.

    Supports:
    - dev layout: backend/bin/ffmpeg[.exe]
    - older dev layout: backend/ffmpeg[.exe]
    - PyInstaller onedir: dist folder + _internal
    - PATH fallback
    """
    import sys as _sys

    # Normalise name for the current platform.
    if _sys.platform == "win32":
        if not name.endswith(".exe"):
            name = name + ".exe"
    else:
        if name.endswith(".exe"):
            name = name[:-4]

    candidates = [
        ROOT / "bin" / name,
        ROOT / name,
        ROOT / "_internal" / name,
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    found = which(name)
    if found:
        return found

    return str(candidates[0])