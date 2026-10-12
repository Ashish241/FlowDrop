import json
from pathlib import Path

from services.lan_server.app import Offer


def test_language_neutral_offer_contract_matches_runtime():
    contract = json.loads(Path("packages/protocol/transfer.schema.json").read_text())
    runtime = Offer.model_json_schema()
    assert set(contract["required"]) == set(runtime["required"])
    for name in contract["properties"]:
        for constraint, value in contract["properties"][name].items():
            assert runtime["properties"][name][constraint] == value
