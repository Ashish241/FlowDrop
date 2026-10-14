"""Actual loopback HTTP, bounded-memory generated data; not physical LAN throughput."""

import hashlib
import json
import os
import platform
import secrets
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx
import psutil


def main():
    token = secrets.token_urlsafe(32)
    block = bytes(range(256)) * 4096
    results = []
    with TemporaryDirectory() as storage:
        env = {**os.environ, "FLOWDROP_STORAGE": storage, "FLOWDROP_BENCH_TOKEN": token}
        process = subprocess.Popen(
            [sys.executable, "-m", "scripts.benchmark_host"],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        try:
            base = "http://127.0.0.1:58768/api"
            with httpx.Client(timeout=120) as client:
                for _ in range(100):
                    try:
                        client.get(base + "/health").raise_for_status()
                        break
                    except httpx.HTTPError:
                        if process.poll() is not None:
                            raise RuntimeError("Benchmark host failed to start")
                        time.sleep(0.1)
                host = {"Authorization": "Bearer " + token}
                code = client.get(base + "/session", headers=host).json()[
                    "pairing_code"
                ]
                receiver = client.post(
                    base + "/pair", json={"code": code, "name": "Benchmark receiver"}
                ).json()
                client.post(
                    base + "/devices/" + receiver["id"] + "/approve", headers=host
                ).raise_for_status()
                down = {"Authorization": "Bearer " + receiver["token"]}
            server = psutil.Process(process.pid)
            for mib, concurrency in [(1024, 1), (128, 4)]:
                peaks = {
                    "server": server.memory_info().rss,
                    "client": psutil.Process().memory_info().rss,
                }
                initial = dict(peaks)
                stop = threading.Event()

                def sample(stop=stop, peaks=peaks):
                    while not stop.wait(0.02):
                        peaks["server"] = max(peaks["server"], server.memory_info().rss)
                        peaks["client"] = max(
                            peaks["client"], psutil.Process().memory_info().rss
                        )

                sampler = threading.Thread(target=sample)
                sampler.start()
                cpu_start = server.cpu_times()
                started = time.perf_counter()

                def send(_, mib=mib):
                    hasher = hashlib.sha256()
                    for _ in range(mib):
                        hasher.update(block)
                    expected = hasher.hexdigest()
                    with httpx.Client(timeout=120) as client:
                        transfer = client.post(
                            base + "/transfers",
                            headers=host,
                            json={
                                "name": "network-benchmark.bin",
                                "size": mib * len(block),
                                "recipient": receiver["id"],
                                "sha256": expected,
                            },
                        ).json()
                        path = base + "/transfers/" + transfer["id"]
                        client.post(path + "/accept", headers=down).raise_for_status()
                        for index in range(mib):
                            client.put(
                                path + f"/chunks/{index}", headers=host, content=block
                            ).raise_for_status()
                        client.post(path + "/finish", headers=host).raise_for_status()
                        digest = hashlib.sha256()
                        with client.stream(
                            "GET", path + "/download", headers=down
                        ) as response:
                            response.raise_for_status()
                            for chunk in response.iter_bytes(65536):
                                digest.update(chunk)
                        assert digest.hexdigest() == expected
                        client.delete(path, headers=host).raise_for_status()

                try:
                    with ThreadPoolExecutor(max_workers=concurrency) as pool:
                        list(pool.map(send, range(concurrency)))
                finally:
                    stop.set()
                    sampler.join()
                elapsed = time.perf_counter() - started
                cpu_end = server.cpu_times()
                results.append(
                    {
                        "mib_per_file": mib,
                        "concurrency": concurrency,
                        "seconds": round(elapsed, 4),
                        "round_trip_mib_per_second": round(
                            2 * mib * concurrency / elapsed, 2
                        ),
                        "server_cpu_seconds": round(
                            cpu_end.user
                            + cpu_end.system
                            - cpu_start.user
                            - cpu_start.system,
                            4,
                        ),
                        "peak_rss_mib": {
                            key: round(value / 1048576, 2)
                            for key, value in peaks.items()
                        },
                        "rss_growth_mib": {
                            key: round((peaks[key] - initial[key]) / 1048576, 2)
                            for key in peaks
                        },
                        "download_stream_sha256_match": True,
                    }
                )
            Path("docs/NETWORK_BENCHMARK.json").write_text(
                json.dumps(
                    {
                        "scope": "Loopback TCP HTTP upload + assembly + streamed download + hashing + cleanup; generated 1 MiB block, not physical LAN or browser measurements; RSS sampled every 20ms",
                        "platform": platform.platform(),
                        "python": platform.python_version(),
                        "results": results,
                    },
                    indent=2,
                )
            )
            print(
                "Completed loopback HTTP benchmarks; all streamed download hashes matched."
            )
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
