from unittest.mock import patch

from starlette.requests import Request

from services.request_security import RateLimit, client_ip


def request(peer, forwarded):
    return Request(
        {
            "type": "http",
            "client": (peer, 1234),
            "headers": [(b"x-forwarded-for", forwarded.encode())],
        }
    )


def test_forwarded_ip_requires_explicit_trusted_peer_and_single_address():
    with patch.dict("os.environ", {"FLOWDROP_TRUSTED_PROXIES": "10.0.0.0/24"}):
        assert client_ip(request("192.168.1.2", "1.2.3.4")) == "192.168.1.2"
        assert client_ip(request("10.0.0.2", "1.2.3.4")) == "1.2.3.4"
        assert client_ip(request("10.0.0.2", "1.2.3.4, 5.6.7.8")) == "10.0.0.2"


def test_rate_limit_capacity_does_not_clear_existing_limits():
    limiter = RateLimit(count=1, capacity=1)
    assert limiter.allow("a")
    assert not limiter.allow("a")
    assert not limiter.allow("b")
    assert not limiter.allow("a")
