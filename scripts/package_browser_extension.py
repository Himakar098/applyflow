#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
EXTENSION_DIR = ROOT / "extension" / "applyflow-autofill"
OUTPUT_DIR = ROOT / "artifacts" / "browser-store"


def write_zip(target: Path) -> None:
    if target.exists():
        target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(EXTENSION_DIR.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(EXTENSION_DIR))


def main() -> None:
    chrome_zip = OUTPUT_DIR / "applyflow-autofill-chrome-web-store.zip"
    edge_zip = OUTPUT_DIR / "applyflow-autofill-edge-addons.zip"

    write_zip(chrome_zip)
    shutil.copy2(chrome_zip, edge_zip)

    print(f"Created {chrome_zip}")
    print(f"Created {edge_zip}")


if __name__ == "__main__":
    main()
