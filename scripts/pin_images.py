"""Resolve public registry manifests; pins do not imply container/security verification."""

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path

import httpx


def main():
    files = [
        Path("compose.yaml"),
        Path("compose.integration.yaml"),
        *Path("infrastructure/docker").glob("*.Dockerfile"),
    ]
    replacements = {}
    resolved = {}
    blocked = {}
    with httpx.Client(timeout=30) as client:
        for path in files:
            for image in re.findall(
                r"(?:image:\s*|FROM\s+)([\w./:@-]+)", path.read_text()
            ):
                if image in replacements:
                    continue
                base = image.split("@")[0]
                if base in resolved:
                    replacements[image] = resolved[base]
                    continue
                repo, tag = base.rsplit(":", 1)
                if repo.startswith("minio/"):
                    blocked[image] = (
                        "Legacy-only profile: official community downloads unavailable and public registry rejected access; not release supported"
                    )
                    continue
                if "/" not in repo:
                    repo = "library/" + repo
                auth = client.get(
                    "https://auth.docker.io/token",
                    params={
                        "service": "registry.docker.io",
                        "scope": f"repository:{repo}:pull",
                    },
                )
                auth.raise_for_status()
                response = client.get(
                    f"https://registry-1.docker.io/v2/{repo}/manifests/{tag}",
                    headers={
                        "Authorization": "Bearer " + auth.json()["token"],
                        "Accept": "application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json",
                    },
                )
                response.raise_for_status()
                digest = "sha256:" + hashlib.sha256(response.content).hexdigest()
                if response.headers.get("Docker-Content-Digest") != digest:
                    raise RuntimeError("Registry digest mismatch")
                resolved[base] = base + "@" + digest
                replacements[image] = resolved[base]
    for path in files:
        source = path.read_text()
        for image, pinned in replacements.items():
            source = re.sub(
                r"(?<![\w./:-])" + re.escape(image) + r"(?![\w.@:-])", pinned, source
            )
        path.write_text(source)
    Path("docs/CONTAINER_PINS.json").write_text(
        json.dumps(
            {
                "resolved_utc": datetime.now(UTC).isoformat(),
                "scope": "Public manifest digest verification only; container builds/runs blocked by missing engine. Legacy MinIO profile unsupported.",
                "images": resolved,
                "blocked_legacy_images": blocked,
            },
            indent=2,
        )
    )
    print(
        f"Pinned {len(replacements)} public image manifests after digest verification."
    )


if __name__ == "__main__":
    main()
