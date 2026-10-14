"""Private subprocess fixture for actual loopback HTTP measurements."""

import os

import uvicorn

from services.lan_server.app import create_app

if __name__ == "__main__":
    uvicorn.run(
        create_app(host_token=os.environ["FLOWDROP_BENCH_TOKEN"]),
        host="127.0.0.1",
        port=58768,
        log_level="error",
        access_log=False,
    )
