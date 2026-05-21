"""
Step 4 — Solace Queue Subscription Patch
==========================================
Status   : TODO
Owner    : Rohini Mondal (Solace Team)
Blocked on:
  - SEMP v2 API endpoint (confirm hostname + path with Rohini)
  - Auth method: Basic Auth (username/password) or Bearer token?
  - Name of the existing queue to patch
  - VPN name (UAT + PROD)
  - Snapshot of existing subscriptions (to validate before PATCH)
  - Confirmation: does PATCH append-only or overwrite? (CRITICAL)

What to do when unblocked:
  1. Ask Rohini for SEMP endpoint, auth credentials, queue name, VPN name
  2. GET existing queue subscriptions → snapshot for safety check
  3. Confirm PATCH appends (does not overwrite) existing subscriptions
  4. Test in sandbox before wiring into automation
  5. Replace NotImplementedError with real SEMP calls

SEMP v2 REST API (likely endpoint — TODO: confirm with Rohini):
  GET  /SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions
  POST /SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions

Contact: Rohini Mondal — SEMP endpoint, auth, queue name, VPN, subscription snapshot
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests
# from requests.auth import HTTPBasicAuth


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class SolaceQueueConfig:
    """Fill in from Rohini Mondal once she confirms SEMP details."""

    # TODO: SEMP broker host — Rohini to confirm (likely internal hostname)
    semp_host: str = ""           # TODO: e.g. "https://broker.internal.effem.com"
    semp_port: str = "943"        # TODO: confirm SEMP REST port with Rohini

    # TODO: auth — Basic Auth (username/password) or Bearer token? Rohini to confirm
    semp_username: str = ""       # TODO: SEMP admin username
    semp_password: str = ""       # TODO: SEMP admin password (store in Key Vault)

    # TODO: VPN + queue details — Rohini to confirm
    vpn_name_uat: str = ""        # TODO: e.g. "marsuat-saz-use2-glb03"
    vpn_name_prod: str = ""       # TODO: e.g. "marsprd-saz-use2-glb03"
    queue_name: str = ""          # TODO: existing queue to append subscription to

    # New subscription — from onboarding input
    new_subscription_topic: str = ""   # e.g. "mars/3pl/{partnerID}/>"
    partner_id: str = ""               # BTP ClientID

    # Safety flag
    target_env: str = "uat"            # "uat" or "prod"


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class SolaceQueueResult:
    success: bool
    existing_subs_snapshot: list = field(default_factory=list)
    new_sub_added: bool = False
    error: Optional[str] = None


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _get_existing_subscriptions(config: SolaceQueueConfig, vpn: str) -> list:
    """
    TODO: GET current subscriptions on the queue.
    Used as safety snapshot before any write operation.

    SEMP endpoint (TODO: confirm with Rohini):
    GET {semp_host}:{semp_port}/SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions
    """
    # TODO:
    # url = f"{config.semp_host}:{config.semp_port}/SEMP/v2/config/msgVpns/{vpn}/queues/{config.queue_name}/subscriptions"
    # response = requests.get(url, auth=HTTPBasicAuth(config.semp_username, config.semp_password))
    # response.raise_for_status()
    # return response.json().get("data", [])
    raise NotImplementedError("GET queue subscriptions — SEMP endpoint + auth needed from Rohini Mondal")


def _add_subscription(config: SolaceQueueConfig, vpn: str, snapshot: list) -> dict:
    """
    TODO: POST new subscription to the queue.

    Safety check: verify the new topic is not already in the snapshot.

    SEMP endpoint (TODO: confirm with Rohini):
    POST {semp_host}:{semp_port}/SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions
    Body: {"subscriptionTopic": "<new_topic>"}

    CRITICAL: Confirm with Rohini that this POST appends only and does NOT
    remove any existing subscriptions.
    """
    existing_topics = [s.get("subscriptionTopic", "") for s in snapshot]
    if config.new_subscription_topic in existing_topics:
        raise ValueError(
            f"Subscription '{config.new_subscription_topic}' already exists on queue '{config.queue_name}'. "
            "No action taken."
        )
    # TODO:
    # url = f"{config.semp_host}:{config.semp_port}/SEMP/v2/config/msgVpns/{vpn}/queues/{config.queue_name}/subscriptions"
    # payload = {"subscriptionTopic": config.new_subscription_topic}
    # response = requests.post(url, json=payload, auth=HTTPBasicAuth(config.semp_username, config.semp_password))
    # response.raise_for_status()
    # return response.json()
    raise NotImplementedError("POST queue subscription — SEMP endpoint + payload confirmation needed from Rohini Mondal")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: SolaceQueueConfig) -> SolaceQueueResult:
    """
    Execute Step 4: Append new subscription topic to existing Solace queue.

    TODO: Implement when Rohini Mondal provides:
      - SEMP API hostname and port
      - Auth method (Basic / Bearer) + credentials
      - VPN name (UAT and PROD)
      - Queue name to patch
      - Existing subscription snapshot (for safety validation)
      - Written confirmation that POST appends (does not overwrite)

    Safety: always GET existing subs first, compare, only then POST the new one.
    """
    # TODO: Step 4 implementation
    # vpn      = config.vpn_name_uat if config.target_env == "uat" else config.vpn_name_prod
    # snapshot = _get_existing_subscriptions(config, vpn)
    # result   = _add_subscription(config, vpn, snapshot)
    # return SolaceQueueResult(success=True, existing_subs_snapshot=snapshot, new_sub_added=True)

    raise NotImplementedError(
        "Step 4 (Solace Queue Patch) not yet implemented.\n"
        "Blocked on: SEMP endpoint + auth + queue name + VPN name from Rohini Mondal."
    )
