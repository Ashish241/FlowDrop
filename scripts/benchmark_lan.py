"""In-process ASGI upload/assembly benchmark; NOT a network speed benchmark."""

import hashlib
import json
import platform
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

import psutil
from fastapi.testclient import TestClient

from services.lan_server.app import create_app


def main():
    process = psutil.Process()
    results = []
    block = bytes(range(256)) * 4096
    with TemporaryDirectory() as temporary:
        app = create_app(Path(temporary), "benchmark-host")
        with TestClient(app) as client:
            host = {"Authorization": "Bearer benchmark-host"}
            pair = client.post(
                "/api/pair",
                json={"code": app.state.pairing_code, "name": "Benchmark receiver"},
            ).json()
            phone = {"Authorization": "Bearer " + pair["token"]}
            client.post(f"/api/devices/{pair['id']}/approve", headers=host)

            def send(size):
                h = hashlib.sha256()
                for offset in range(0, size, len(block)):
                    h.update(block[: min(len(block), size - offset)])
                r = client.post(
                    "/api/transfers",
                    headers=host,
                    json={
                        "name": "benchmark.bin",
                        "size": size,
                        "recipient": pair["id"],
                        "sha256": h.hexdigest(),
                    },
                )
                r.raise_for_status()
                tid = r.json()["id"]
                path = "/api/transfers/" + tid
                client.post(path + "/accept", headers=phone).raise_for_status()
                for index, offset in enumerate(range(0, size, len(block))):
                    client.put(
                        path + f"/chunks/{index}",
                        headers=host,
                        content=block[: min(len(block), size - offset)],
                    ).raise_for_status()
                client.post(path + "/finish", headers=host).raise_for_status()
                client.delete(path, headers=host).raise_for_status()

            for size, count in [
                (0, 1),
                (65536, 1),
                (32 * 1048576, 1),
                (4 * 1048576, 4),
            ]:
                peak = [process.memory_info().rss]
                stop = threading.Event()

                def monitor(stop=stop, peak=peak):
                    while not stop.wait(0.005):
                        peak[0] = max(peak[0], process.memory_info().rss)

                thread = threading.Thread(target=monitor)
                thread.start()
                baseline = process.memory_info().rss
                cpu = process.cpu_times()
                start = time.perf_counter()
                try:
                    with ThreadPoolExecutor(max_workers=count) as pool:
                        list(pool.map(send, [size] * count))
                finally:
                    elapsed = time.perf_counter() - start
                    stop.set()
                    thread.join()
                after = process.cpu_times()
                cpu_seconds = after.user + after.system - cpu.user - cpu.system
                results.append(
                    {
                        "bytes_per_file": size,
                        "concurrent_files": count,
                        "elapsed_seconds": round(elapsed, 4),
                        "in_process_mib_per_second": round(
                            size * count / 1048576 / elapsed, 2
                        ),
                        "cpu_seconds": round(cpu_seconds, 4),
                        "peak_rss_mib": round(peak[0] / 1048576, 2),
                        "rss_growth_mib": round((peak[0] - baseline) / 1048576, 2),
                    }
                )
    report = {
        "scope": "Synthetic in-process ASGI upload, verification and cleanup. Includes test harness; excludes real network/download throughput. 5ms RSS sampling may miss brief peaks.",
        "platform": platform.platform(),
        "python": platform.python_version(),
        "results": results,
    }
    target = Path("docs/BENCHMARK_RESULTS.json")
    target.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
