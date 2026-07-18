#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
EXTENSION_DIR = ROOT / "extension" / "applyflow-autofill"
SAFARI_PROJECT_DIR = (
    ROOT
    / "extension"
    / "applyflow-autofill-safari-project"
    / "ApplyFlow Autofill Safari"
)
OUTPUT_DIR = ROOT / "artifacts" / "browser-store"
PUBLIC_DOWNLOAD_DIR = ROOT / "public" / "downloads"


def write_zip(source: Path, target: Path, archive_prefix: str | None = None) -> None:
    if target.exists():
        target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive_path = path.relative_to(source)
                if archive_prefix:
                    archive_path = Path(archive_prefix) / archive_path
                archive.write(path, archive_path)


def main() -> None:
    chrome_zip = OUTPUT_DIR / "applyflow-autofill-chrome-web-store.zip"
    edge_zip = OUTPUT_DIR / "applyflow-autofill-edge-addons.zip"
    chromium_download_zip = PUBLIC_DOWNLOAD_DIR / "applyflow-autofill-chromium.zip"
    safari_download_zip = PUBLIC_DOWNLOAD_DIR / "applyflow-autofill-safari-project.zip"

    write_zip(EXTENSION_DIR, chrome_zip)
    shutil.copy2(chrome_zip, edge_zip)
    shutil.copy2(chrome_zip, chromium_download_zip)
    write_zip(
        SAFARI_PROJECT_DIR,
        safari_download_zip,
        archive_prefix=SAFARI_PROJECT_DIR.name,
    )

    print(f"Created {chrome_zip}")
    print(f"Created {edge_zip}")
    print(f"Created {chromium_download_zip}")
    print(f"Created {safari_download_zip}")


if __name__ == "__main__":
    main()
