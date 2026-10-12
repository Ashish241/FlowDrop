"""Summarize local Playwright diagnostics without dumping credentials or bodies."""

import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    for name in archive.namelist():
        if name.endswith(".network"):
            for line in archive.read(name).decode().splitlines():
                item = json.loads(line).get("snapshot", {})
                url = item.get("request", {}).get("url", "")
                if "stream" in url:
                    print(
                        {
                            "url": url,
                            "status": item.get("response", {}).get("status"),
                            "failure": item.get("_failureText"),
                        }
                    )
        if name.endswith(".trace"):
            for line in archive.read(name).decode().splitlines():
                item = json.loads(line)
                if item.get("type") in ("console", "event") and (
                    "error" in str(item).lower()
                ):
                    print(str(item)[:1000])
