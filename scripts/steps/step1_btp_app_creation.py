"""
Step 1 — BTP Application Creation
===================================
Status   : TODO
Owner    : Parag Shende (BTP Team)
Blocked on:
  - Decision: automate via API or keep manual (D3 approval gate must be resolved first)
  - API payload structure (BTP Team to confirm and share)
  - D3 approver identity + SLA for approval

What to do when unblocked:
  1. Get D3 decision: if approved for automation, proceed; otherwise mark as MANUAL permanently
  2. Ask Parag Shende for the POST payload schema for APIMgmt.Applications
  3. Confirm whether clientId is returned in the create-response or requires a follow-up GET
  4. Replace the NotImplementedError below with the real HTTP call

Known API base:
  https://apim-management-host/odata/1.0/data.svc/APIMgmt.Applications

Contact: Parag Shende — share Postman collection + payload + auth method
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests
# from requests.auth import HTTPBasicAuth


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class BtpAppConfig:
    """
    Fill in these values once Parag Shende confirms the API details.
    All fields marked TODO are currently unknown.
    """
    # TODO: BTP API host — confirm with Parag (currently placeholder)
    api_host: str = "https://apim-management-host"

    # TODO: authentication — OAuth2 client_credentials or Basic? Parag to confirm
    client_id: str = ""      # TODO: BTP service credential client_id
    client_secret: str = ""  # TODO: BTP service credential client_secret
    token_url: str = ""      # TODO: OAuth token endpoint (if OAuth2)

    # TODO: application fields — confirm exact field names with Parag Shende
    app_name: str = ""           # TODO: e.g. "3PL-SPL-France-App"
    app_description: str = ""    # TODO: free-text description
    product_name: str = ""       # TODO: SAP API product to bind to
    quota_plan: str = ""         # TODO: e.g. "standard" or "premium"

    # TODO: D3 approver — who receives the approval request?
    d3_approver_email: str = ""  # TODO: waiting on D3/iHub Team


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class BtpAppResult:
    success: bool
    # TODO: confirm what BTP returns — likely clientId in response body
    client_id: str = ""
    client_secret: str = ""          # TODO: returned in response or separate call?
    application_id: str = ""         # TODO: internal BTP app ID
    d3_approval_pending: bool = False
    error: Optional[str] = None
    raw_response: dict = field(default_factory=dict)


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _get_oauth_token(config: BtpAppConfig) -> str:
    """
    TODO: Implement OAuth2 token fetch.
    Parag Shende to confirm: client_credentials or password grant?
    """
    # TODO: POST config.token_url with client_id + client_secret
    raise NotImplementedError("OAuth token fetch not implemented — waiting on BTP auth details from Parag Shende")


def _create_application(token: str, config: BtpAppConfig) -> dict:
    """
    TODO: POST to APIMgmt.Applications to register the new 3PL application.
    Parag Shende to share the exact request payload and field names.

    Expected payload (TODO — confirm with Parag):
    {
        "d": {
            "Name": "<app_name>",
            "Description": "<app_description>",
            "ProductName": "<product_name>"
            // TODO: other fields?
        }
    }
    """
    # TODO: implement
    # url = f"{config.api_host}/odata/1.0/data.svc/APIMgmt.Applications"
    # headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # payload = { ... }  # TODO: get payload from Parag
    # response = requests.post(url, json=payload, headers=headers)
    # response.raise_for_status()
    # return response.json()
    raise NotImplementedError("Application creation not implemented — waiting on payload schema from Parag Shende")


def _trigger_d3_approval(application_id: str, config: BtpAppConfig) -> None:
    """
    TODO: Trigger D3 human-in-the-loop approval for the created application.
    Process to be defined by D3/iHub Team.
    """
    # TODO: notify D3 approver (email? BTP workflow? ServiceNow ticket?)
    raise NotImplementedError("D3 approval trigger not implemented — process TBD by D3/iHub Team")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: BtpAppConfig) -> BtpAppResult:
    """
    Execute Step 1: Create BTP Application + trigger D3 approval.

    TODO: Implement when Parag Shende provides:
      - POST payload schema for APIMgmt.Applications
      - Auth method (OAuth2 client_credentials vs Basic Auth)
      - Token endpoint URL
      - Confirmation that D3 approval gate can be automated

    TODO: Implement when D3/iHub Team defines:
      - How the approval notification is sent (email / workflow / ticket)
      - What the approval response looks like (webhook? polling?)
    """
    # TODO: Step 1 implementation
    # token  = _get_oauth_token(config)
    # result = _create_application(token, config)
    # _trigger_d3_approval(result["application_id"], config)
    # return BtpAppResult(success=True, client_id=result["clientId"], ...)

    raise NotImplementedError(
        "Step 1 (BTP App Creation) not yet implemented.\n"
        "Blocked on: D3 approval decision + API payload from Parag Shende.\n"
        "This step will be MANUAL until D3 approves API automation."
    )
