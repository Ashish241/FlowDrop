"""Check built distribution boundaries, not just hidden navigation."""

from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1] / "apps/web"
    desktop = root / "dist-desktop"
    online = root / "dist-online"
    offline_js = "".join(
        p.read_text(encoding="utf-8") for p in (desktop / "assets").glob("*.js")
    )
    online_js = "".join(
        p.read_text(encoding="utf-8") for p in (online / "assets").glob("*.js")
    )
    assert offline_js and online_js
    for marker in ("Create room", "/cloud", "AES-GCM", "Public FlowDrop website URL"):
        assert marker not in offline_js, (
            "Online/cloud implementation leaked into desktop: " + marker
        )
    for marker in (
        "/api/pair",
        "Host Dashboard URL",
        "Public FlowDrop website URL",
        "/cloud",
    ):
        assert marker not in online_js, (
            "Desktop/cloud implementation leaked into online: " + marker
        )
    assert not (desktop / "stream-sw.js").exists()
    assert (online / "stream-sw.js").exists()
    assert (online / "_headers").exists()
    print("PASS: separate desktop/online bundle boundaries and required resources")


if __name__ == "__main__":
    main()
