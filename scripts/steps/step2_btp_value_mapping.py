"""
Step 2 — BTP Value Mapping (Upsert → Save Version → Deploy)
=============================================================
Status   : TODO
Owner    : Parag Shende (BTP Team)
Blocked on:
  - Postman collection + sample payloads for all 3 API calls
  - Service Instance + Service Key for BTP API access (who provisions?)
  - Confirmation that 3PL ValueMapping entries are EDITABLE after initial config
    (CRITICAL: if locked, this step cannot be automated at all)

What to do when unblocked:
  1. Ask Parag Shende to share Postman collection with sample payloads
  2. Provision Service Instance and extract the Service Key JSON
  3. Test the 3 API calls in DEV before wiring into automation
  4. Replace NotImplementedErrors below with real HTTP calls

Known API endpoints (BTP Integration Suite DEV):
  Upsert entry   : POST .../api/v1/UpsertValMaps
  Save version   : POST .../api/v1/ValueMappingDesigntimeArtifactSaveAsVersion
  Deploy         : POST .../api/v1/DeployValueMappingsDesigntimeArtifact

Base host: https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com

Contact: Parag Shende — test APIs, share Postman collection + Service Key
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class BtpValueMappingConfig:
    """
    Fill in from the BTP Service Key JSON once Parag provisions it.
    The Service Key is a JSON file downloaded from BTP cockpit.
    """
    # TODO: extract from Service Key JSON — Parag Shende to provision
    base_url: str = "https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com"
    token_url: str = ""      # TODO: from Service Key → "url" + "/oauth/token"
    client_id: str = ""      # TODO: from Service Key → "clientid"
    client_secret: str = ""  # TODO: from Service Key → "clientsecret"

    # TODO: ValueMapping artifact details — confirm with Parag Shende
    artifact_id: str = ""    # TODO: the ValueMapping artifact ID in Integration Suite
    package_id: str = ""     # TODO: the Integration Package that contains the ValueMapping

    # Value to insert — these come from the onboarding input JSON
    partner_id: str = ""     # = BTP ClientID from Step 1
    country_code: str = ""
    source_value: str = ""   # TODO: confirm field semantics with Parag
    target_value: str = ""   # TODO: confirm field semantics with Parag


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class BtpValueMappingResult:
    success: bool
    upserted: bool = False
    version_saved: bool = False
    deployed: bool = False
    error: Optional[str] = None
    raw_responses: dict = field(default_factory=dict)


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _get_oauth_token(config: BtpValueMappingConfig) -> str:
    """
    TODO: Fetch OAuth2 bearer token using client_credentials grant.
    Credentials come from the BTP Service Key JSON.
    """
    # TODO:
    # response = requests.post(
    #     config.token_url,
    #     data={"grant_type": "client_credentials"},
    #     auth=(config.client_id, config.client_secret),
    # )
    # response.raise_for_status()
    # return response.json()["access_token"]
    raise NotImplementedError("Token fetch not implemented — Service Key needed from Parag Shende")


def _upsert_value_mapping(token: str, config: BtpValueMappingConfig) -> dict:
    """
    TODO: POST to UpsertValMaps to insert the new 3PL partner entry.

    Payload structure (TODO — confirm with Parag Shende via Postman collection):
    {
        "ArtifactId": "<artifact_id>",
        "PackageId":  "<package_id>",
        "SourceAgency": "...",   // TODO: confirm field names
        "TargetAgency": "...",
        "SourceValue":  "<source_value>",
        "TargetValue":  "<target_value>"
    }
    """
    # TODO: implement
    # url = f"{config.base_url}/api/v1/UpsertValMaps"
    # headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # payload = { ... }  # TODO: get from Parag's Postman collection
    # response = requests.post(url, json=payload, headers=headers)
    # response.raise_for_status()
    # return response.json()
    raise NotImplementedError("UpsertValMaps not implemented — payload schema needed from Parag Shende")


def _save_version(token: str, config: BtpValueMappingConfig) -> dict:
    """
    TODO: POST to SaveAsVersion to create a new deployable version.

    Payload structure (TODO — confirm with Parag):
    {
        "ArtifactId": "<artifact_id>",
        "PackageId":  "<package_id>",
        "SaveAsVersion": "..."  // TODO: increment logic?
    }
    """
    # TODO: implement
    raise NotImplementedError("SaveAsVersion not implemented — payload schema needed from Parag Shende")


def _deploy_value_mapping(token: str, config: BtpValueMappingConfig) -> dict:
    """
    TODO: POST to DeployValueMappingsDesigntimeArtifact to push to runtime.

    Payload structure (TODO — confirm with Parag):
    {
        "ArtifactId": "<artifact_id>",
        "PackageId":  "<package_id>"
    }

    NOTE: Confirm with Parag — is there a polling mechanism to check deploy status?
    """
    # TODO: implement
    raise NotImplementedError("Deploy not implemented — payload schema needed from Parag Shende")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: BtpValueMappingConfig) -> BtpValueMappingResult:
    """
    Execute Step 2: Upsert ValueMapping entry → Save new version → Deploy.

    TODO: Implement when Parag Shende provides:
      - Postman collection with sample payloads for all 3 API calls
      - BTP Service Instance + Service Key JSON
      - Artifact ID and Package ID of the 3PL ValueMapping

    CRITICAL TODO: Confirm with Parag that 3PL ValueMapping entries CAN be
    edited after initial configuration. If entries are locked, this entire
    step must remain manual.
    """
    # TODO: Step 2 implementation sequence:
    # token  = _get_oauth_token(config)
    # result1 = _upsert_value_mapping(token, config)
    # result2 = _save_version(token, config)
    # result3 = _deploy_value_mapping(token, config)
    # return BtpValueMappingResult(success=True, upserted=True, version_saved=True, deployed=True)

    raise NotImplementedError(
        "Step 2 (BTP ValueMapping) not yet implemented.\n"
        "Blocked on: Postman collection + Service Key from Parag Shende.\n"
        "CRITICAL: Confirm 3PL ValueMapping entries are editable before implementing."
    )
