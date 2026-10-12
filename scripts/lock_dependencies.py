"""Record this project's installed dependency closure, not unrelated user packages."""

import tomllib
from importlib import metadata
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

project = tomllib.loads(Path("pyproject.toml").read_text())["project"]
queue = [
    Requirement(raw)
    for raw in project["dependencies"]
    + project["optional-dependencies"]["dev"]
    + project["optional-dependencies"]["cloud"]
]
seen = set()
versions = {}
while queue:
    requirement = queue.pop()
    extras = requirement.extras or {""}
    if requirement.marker and not any(
        requirement.marker.evaluate({"extra": extra}) for extra in extras
    ):
        continue
    identity = (canonicalize_name(requirement.name), tuple(sorted(extras)))
    if identity in seen:
        continue
    seen.add(identity)
    distribution = metadata.distribution(requirement.name)
    versions[canonicalize_name(requirement.name)] = distribution.version
    for raw in distribution.requires or []:
        dependency = Requirement(raw)
        if not dependency.marker or any(
            dependency.marker.evaluate({"extra": extra}) for extra in extras
        ):
            queue.append(Requirement(str(dependency).split(";")[0]))
Path("requirements-windows.lock").write_text(
    "\n".join(f"{name}=={version}" for name, version in sorted(versions.items())) + "\n"
)
print(
    f"Recorded {len(versions)} project/runtime/development dependencies for this Windows environment."
)
