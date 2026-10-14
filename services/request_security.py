"""Bounded abuse controls; forwarding headers are ignored unless explicitly trusted."""

import hashlib
import ipaddress
import os
import threading
import time


def client_ip(request):
    peer = request.client.host if request.client else "unknown"
    networks = [
        ipaddress.ip_network(value.strip())
        for value in os.getenv("FLOWDROP_TRUSTED_PROXIES", "").split(",")
        if value.strip()
    ]
    try:
        address = ipaddress.ip_address(peer)
        if any(address in network for network in networks):
            # The trusted edge must overwrite this header, never append user input.
            forwarded = request.headers.get("x-forwarded-for", "")
            if forwarded and "," not in forwarded:
                return str(ipaddress.ip_address(forwarded))
    except ValueError:
        pass
    return peer


class RateLimit:
    def __init__(self, count=300, seconds=60, capacity=10000):
        self.count, self.seconds, self.capacity = count, seconds, capacity
        self.entries = {}
        self.lock = threading.Lock()

    def allow(self, identity):
        now = time.monotonic()
        with self.lock:
            cutoff = now - self.seconds
            for key in list(self.entries):
                if self.entries[key][-1] <= cutoff:
                    del self.entries[key]
            if identity not in self.entries and len(self.entries) >= self.capacity:
                return False
            values = [
                stamp for stamp in self.entries.get(identity, []) if stamp > cutoff
            ]
            if len(values) >= self.count:
                return False
            self.entries[identity] = values + [now]
            return True


class RedisRateLimit:
    def __init__(self, url, namespace, count=300, seconds=60):
        from redis import Redis

        self.redis = Redis.from_url(url, socket_connect_timeout=3, socket_timeout=3)
        self.namespace, self.count, self.seconds = namespace, count, seconds

    def allow(self, identity):
        key = self.namespace + hashlib.sha256(identity.encode()).hexdigest()
        script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
        return self.redis.eval(script, 1, key, self.seconds) <= self.count


def rate_limiter(namespace, count=300, seconds=60):
    namespace = os.getenv("FLOWDROP_REDIS_NAMESPACE", "") + namespace
    url = os.getenv("REDIS_URL")
    return (
        RedisRateLimit(url, namespace, count, seconds)
        if url
        else RateLimit(count, seconds)
    )
