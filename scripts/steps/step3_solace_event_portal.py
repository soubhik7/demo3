"""
Step 3 — Solace Event Portal Design (5-call sequence)
======================================================
Status   : TODO
Owner    : Rohini Mondal (Solace Team)
Blocked on:
  - Solace Event Portal API token / OAuth credentials
  - IDs of existing Enum, Event, Producer App, Consumer App objects
  - Postman collection for the 5-step sequence
  - Sandbox/dev Event Portal environment for testing

What to do when unblocked:
  1. Ask Rohini for API token + object IDs (Enum ID, Event ID, Producer App ID, Consumer App ID)
  2. Test each GET call to retrieve current versions before POST
  3. Test each POST call with a new version containing the new country code
  4. Test Dev Promotion Request
  5. Replace NotImplementedErrors below with real HTTP calls

API reference: https://api.solace.dev/cloud/reference

5-step sequence:
  1. GET Enumeration     → POST new Enum version     (add new country code)
  2. GET Event           → POST new Event version    (uses new Enum version)
  3. GET Producer App    → POST new Producer App version + config
  4. GET Consumer App    → POST new Consumer App version + subscriptions
  5. GET Event Brokers   → POST Dev Promotion Request

Contact: Rohini Mondal — API token, object IDs, Postman collection
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class SolaceEventPortalConfig:
    """
    Fill in from Rohini Mondal once she shares the API credentials and object IDs.
    """
    # TODO: Solace Cloud API base URL — confirm with Rohini
    api_base: str = "https://api.solace.dev/cloud"

    # TODO: API token — Rohini Mondal to provide (bearer token or API key?)
    api_token: str = ""

    # TODO: existing object IDs — Rohini to share (GET calls below will retrieve these)
    enum_id: str = ""          # TODO: ID of the Enumeration object in Event Portal
    event_id: str = ""         # TODO: ID of the Event object
    producer_app_id: str = ""  # TODO: ID of the Producer Application
    consumer_app_id: str = ""  # TODO: ID of the Consumer Application

    # TODO: environment/broker details — Rohini to confirm
    environment_id: str = ""   # TODO: Solace Cloud environment/service ID
    broker_id: str = ""        # TODO: model event broker ID for promotion request

    # Values from onboarding input
    country_code: str = ""     # ISO country code (e.g. "FR")
    region_iso: str = ""       # ISO region (e.g. "EU")
    partner_id: str = ""       # BTP ClientID from Step 1/2
    subscription_topics: list = field(default_factory=list)  # new topic strings


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class SolaceEventPortalResult:
    success: bool
    enum_version_created: bool = False
    event_version_created: bool = False
    producer_app_version_created: bool = False
    consumer_app_version_created: bool = False
    dev_promotion_requested: bool = False
    error: Optional[str] = None
    raw_responses: dict = field(default_factory=dict)


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _headers(config: SolaceEventPortalConfig) -> dict:
    # TODO: confirm auth header format with Rohini (Bearer token or API key header?)
    return {"Authorization": f"Bearer {config.api_token}", "Content-Type": "application/json"}


def _get_enum_version(config: SolaceEventPortalConfig) -> dict:
    """TODO: GET current Enum version to use as base for new version."""
    # TODO: GET {api_base}/architecture/enumerations/{enum_id}/versions?latest=true
    raise NotImplementedError("GET Enum version — API token + enum_id needed from Rohini Mondal")


def _post_enum_version(current_version: dict, config: SolaceEventPortalConfig) -> dict:
    """
    TODO: POST new Enum version adding the new country code.

    Payload: copy current version, append new country code to enum values.
    TODO: confirm payload schema with Rohini / Solace API docs.
    """
    # TODO: POST {api_base}/architecture/enumerations/{enum_id}/versions
    raise NotImplementedError("POST Enum version — payload schema TBD, Rohini Mondal to confirm")


def _get_event_version(config: SolaceEventPortalConfig) -> dict:
    """TODO: GET current Event version."""
    # TODO: GET {api_base}/architecture/events/{event_id}/versions?latest=true
    raise NotImplementedError("GET Event version — event_id needed from Rohini Mondal")


def _post_event_version(current_version: dict, new_enum_version: dict, config: SolaceEventPortalConfig) -> dict:
    """TODO: POST new Event version referencing the new Enum version."""
    # TODO: POST {api_base}/architecture/events/{event_id}/versions
    raise NotImplementedError("POST Event version — payload schema TBD, Rohini Mondal to confirm")


def _get_producer_app_version(config: SolaceEventPortalConfig) -> dict:
    """TODO: GET current Producer App version."""
    # TODO: GET {api_base}/architecture/applications/{producer_app_id}/versions?latest=true
    raise NotImplementedError("GET Producer App version — producer_app_id needed from Rohini Mondal")


def _post_producer_app_version(current_version: dict, new_event_version: dict, config: SolaceEventPortalConfig) -> dict:
    """TODO: POST new Producer App version producing the new Event version."""
    # TODO: POST {api_base}/architecture/applications/{producer_app_id}/versions
    raise NotImplementedError("POST Producer App version — payload schema TBD, Rohini Mondal to confirm")


def _get_consumer_app_version(config: SolaceEventPortalConfig) -> dict:
    """TODO: GET current Consumer App version."""
    # TODO: GET {api_base}/architecture/applications/{consumer_app_id}/versions?latest=true
    raise NotImplementedError("GET Consumer App version — consumer_app_id needed from Rohini Mondal")


def _post_consumer_app_version(current_version: dict, new_event_version: dict, config: SolaceEventPortalConfig) -> dict:
    """
    TODO: POST new Consumer App version consuming new Event + new subscription topics.
    This is the call that adds the new subscription rules to the Consumer App.
    """
    # TODO: POST {api_base}/architecture/applications/{consumer_app_id}/versions
    raise NotImplementedError("POST Consumer App version — payload schema TBD, Rohini Mondal to confirm")


def _post_dev_promotion_request(config: SolaceEventPortalConfig) -> dict:
    """
    TODO: POST Dev Promotion Request to promote new versions to the dev broker.
    Requires: list of basic info for all model event brokers (GET first).
    TODO: confirm promotion request payload with Rohini.
    """
    # TODO: GET {api_base}/deployments/eventBrokers  (list brokers)
    # TODO: POST {api_base}/deployments/applicationPromotions
    raise NotImplementedError("Dev Promotion Request — broker_id + payload schema needed from Rohini Mondal")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: SolaceEventPortalConfig) -> SolaceEventPortalResult:
    """
    Execute Step 3: 5-step Solace Event Portal design sequence.

    TODO: Implement when Rohini Mondal provides:
      - API token / OAuth credentials for Solace Cloud API
      - Enum ID, Event ID, Producer App ID, Consumer App ID
      - Postman collection showing the 5-step sequence
      - Sandbox Event Portal environment for testing

    Call sequence (all sequential — each step uses output of previous):
      get_enum  → post_enum  → get_event  → post_event
      → get_producer → post_producer → get_consumer → post_consumer
      → post_dev_promotion
    """
    # TODO: Step 3 implementation
    # enum_v    = _get_enum_version(config)
    # new_enum  = _post_enum_version(enum_v, config)
    # event_v   = _get_event_version(config)
    # new_event = _post_event_version(event_v, new_enum, config)
    # prod_v    = _get_producer_app_version(config)
    # new_prod  = _post_producer_app_version(prod_v, new_event, config)
    # cons_v    = _get_consumer_app_version(config)
    # new_cons  = _post_consumer_app_version(cons_v, new_event, config)
    # promo     = _post_dev_promotion_request(config)
    # return SolaceEventPortalResult(success=True, ...)

    raise NotImplementedError(
        "Step 3 (Solace Event Portal) not yet implemented.\n"
        "Blocked on: API token + object IDs + Postman collection from Rohini Mondal."
    )
