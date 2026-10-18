"""Explicit public smoke verification for the authorized named-room deployment."""

import argparse
import json
from pathlib import Path
from time import perf_counter

import httpx
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect


def verify(website, signaling):
    origin = website.rstrip("/")
    endpoint = signaling.rstrip("/") + "/v2"
    result = {
        "website": origin,
        "signaling": endpoint,
        "scope": "public HTTPS/WSS service checks",
        "physical_cross_network_verified": False,
    }
    with httpx.Client(
        trust_env=False, timeout=80, headers={"Origin": origin}
    ) as client:
        metadata = client.get(origin + "/DEPLOYMENT_INFO.json").json()
        assert metadata["revision"] == "workspace-v3-20261016"
        assert metadata.get("integrityGuard") is True
        assert metadata.get("recipientDeliveryLedger") is True
        assert metadata.get("autoSelectNewMembers") is True
        assert metadata.get("opticalProtocol") == 3
        assert metadata.get("opticalRecovery") is True
        assert metadata.get("hostRoomControls") is True
        assert metadata.get("membershipRevocationEvent") is True
        assert metadata.get("negotiationGeneration") is True
        assert metadata.get("textReceipts") is True
        assert metadata.get("productDesign") == "navy-teal-20261018"
        assert metadata["signaling"].rstrip("/") == signaling.rstrip("/")
        health = client.get(endpoint + "/health")
        health.raise_for_status()
        assert health.json()["protocol"] == 2
        assert health.json().get("hostControls") is True
        assert health.json().get("membershipRevocationEvent") is True
        assert health.json().get("negotiationGeneration") is True
        assert health.json().get("manualInvitationRefresh") is True
        assert health.json()["revision"] == metadata["revision"]
        assert health.json()["state"] == "single-instance-memory"
        assert health.json()["invitationRotationSeconds"] == 600
        assert health.json()["idleRoomSeconds"] == 3600
        assert health.json()["maxRoomSeconds"] == 86400
        preflight = client.options(
            endpoint + "/rooms",
            headers={
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert preflight.headers["access-control-allow-origin"] == origin
        started = perf_counter()
        response = client.post(endpoint + "/rooms", json={"name": "Verification PC"})
        result["room_create_https_seconds"] = round(perf_counter() - started, 3)
        response.raise_for_status()
        owner = response.json()
        try:
            response = client.post(
                endpoint + "/rooms/" + owner["code"] + "/join",
                json={"name": "Verification Peer"},
            )
            response.raise_for_status()
            member = response.json()
            url = endpoint.replace("https:", "wss:") + "/rooms/" + owner["room"] + "/ws"
            with connect(url, origin=origin, proxy=None, open_timeout=30) as a:
                a.send(owner["token"])
                assert json.loads(a.recv(timeout=10))["type"] == "members"
                with connect(url, origin=origin, proxy=None, open_timeout=30) as b:
                    b.send(member["token"])
                    roster = json.loads(b.recv(timeout=10))
                    assert len(roster["members"]) == 2 and all(
                        m["online"] for m in roster["members"]
                    )
                    assert owner["token"] not in json.dumps(roster) and member[
                        "token"
                    ] not in json.dumps(roster)
                    a.recv(timeout=10)
                    b.send(
                        json.dumps(
                            {"type": "rename", "name": "Renamed verification peer"}
                        )
                    )
                    assert json.loads(a.recv(timeout=10))["event"] == "renamed"
                    b.recv(timeout=10)
                    a.send(
                        json.dumps(
                            {
                                "type": "offer",
                                "to": member["member"],
                                "sdp": "metadata-only-smoke",
                            }
                        )
                    )
                    assert json.loads(b.recv(timeout=10))["from"] == owner["member"]
                    a.send(json.dumps({"type": "lock", "locked": True}))
                    assert json.loads(a.recv(timeout=10))["locked"] is True
                    b.recv(timeout=10)
                    assert (
                        client.post(
                            endpoint + "/rooms/" + owner["code"] + "/join",
                            json={"name": "Locked probe"},
                        ).status_code
                        == 423
                    )
                    path = endpoint + "/rooms/" + owner["room"]
                    auth = {"Authorization": "Bearer " + owner["token"]}
                    guest = {"Authorization": "Bearer " + member["token"]}
                    assert (
                        client.post(path + "/invitation", headers=guest).status_code
                        == 403
                    )
                    refreshed = client.post(path + "/invitation", headers=auth)
                    refreshed.raise_for_status()
                    code = refreshed.json()["code"]
                    assert code != owner["code"] and refreshed.json()["locked"]
                    assert json.loads(a.recv(timeout=10))["code"] == code
                    assert json.loads(b.recv(timeout=10))["code"] == code
                    assert (
                        client.post(
                            endpoint + "/rooms/" + owner["code"] + "/join",
                            json={"name": "Old invitation"},
                        ).status_code
                        == 404
                    )
                    assert (
                        client.post(
                            endpoint + "/rooms/" + code + "/join",
                            json={"name": "Locked new invitation"},
                        ).status_code
                        == 423
                    )
                    target = path + "/members/" + member["member"]
                    assert client.delete(target, headers=guest).status_code == 403
                    removed = client.delete(target, headers=auth)
                    removed.raise_for_status()
                    assert len(json.loads(a.recv(timeout=10))["members"]) == 1
                    assert json.loads(b.recv(timeout=10))["type"] == "removed"
                    try:
                        b.recv(timeout=30)
                        raise AssertionError("Removed socket remained open")
                    except ConnectionClosed as closed:
                        assert closed.rcvd.code == 4003
                    assert client.get(path + "/ice", headers=guest).status_code == 403
            result.update(
                frontend_revision=metadata["revision"],
                integrity_guard=True,
                recipient_delivery_ledger=True,
                auto_select_new_members=True,
                optical_protocol=3,
                optical_recovery=True,
                backend_revision=health.json()["revision"],
                exact_origin_cors=True,
                automatic_authorized_join=True,
                websocket_members=True,
                rename_broadcast=True,
                addressed_signaling=True,
                creator_lock=True,
                host_refresh_preserves_lock=True,
                old_invitation_revoked=True,
                guest_admin_denied=True,
                host_kick_revokes_token_and_socket=True,
                product_design=metadata["productDesign"],
                text_receipt_capability=True,
                credentials_excluded_from_roster=True,
            )
        finally:
            response = client.delete(
                endpoint + "/rooms/" + owner["room"] + "/membership",
                headers={"Authorization": "Bearer " + owner["token"]},
            )
            assert response.status_code == 200
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--website", required=True)
    parser.add_argument("--signaling", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    content = json.dumps(verify(args.website, args.signaling), indent=2) + "\n"
    if args.output:
        args.output.write_text(content, encoding="utf-8")
    print(content)


if __name__ == "__main__":
    main()
