export interface TxEntry { enabled: boolean; type: string }

export interface Combo { value_from: string; value_to: string }

/** Per-environment NAV server overrides (host/company/soap_path/routing_code differ per env). */
export interface EnvNavConfig {
  host: string;
  company: string;
  soap_path: string;
  routing_code: string;
  port?: string;
  username?: string;
  soap_port?: string;
  protocol?: string;
}

/** SAP BTP Integration Suite inputs — used by Steps 1 (App Creation) and 2 (Value Mapping). */
export interface BtpInput {
  /** BTP API Management host, e.g. https://apim-management.cfapps.us21.hana.ondemand.com */
  apiHost: string;
  /** OAuth2 token endpoint for BTP Integration Suite */
  tokenUrl: string;
  /** OAuth2 Client ID (from Service Key) */
  clientId: string;
  /** OAuth2 Client Secret (from Service Key) */
  clientSecret: string;
  /** Integration Suite base URL for Value Mapping artifact */
  suiteBaseUrl: string;
  /** BTP product name to assign to the new application */
  productName: string;
  /** Quota plan (rate-limit tier) */
  quotaPlan: string;
  /** D3 approver email for the BTP app approval workflow */
  d3ApproverEmail: string;
  /** Value Mapping artifact ID in Integration Suite */
  valuemapArtifactId: string;
  /** Value Mapping package ID in Integration Suite */
  valuemapPackageId: string;
}

/** Solace inputs — used by Steps 3 (Event Portal), 4 (Queue Patch), 5 (Git). */
export interface SolaceInput {
  /** Solace Event Portal API token */
  epApiToken: string;
  /** Enum object ID for 3PL partner enum in Event Portal */
  enumId: string;
  /** Event object ID to add a new version for the new country */
  eventId: string;
  /** Producer application ID in Event Portal (used for API calls) */
  producerAppId: string;
  /** Producer application display name (used in new version displayName) */
  producerAppName: string;
  /** Consumer application ID in Event Portal (used for API calls) */
  consumerAppId: string;
  /** Consumer application display name (used in new version displayName) */
  consumerAppName: string;
  /** Solace Environment ID for queue binding */
  environmentId: string;
  /** Solace Broker ID for queue binding */
  brokerId: string;
  /** Solace SEMP v2 management host */
  sempHost: string;
  /** Solace SEMP management port (default: 943) */
  sempPort: string;
  /** Solace SEMP admin username */
  sempUsername: string;
  /** Solace SEMP admin password */
  sempPassword: string;
  /** VPN name for UAT environment */
  vpnNameUat: string;
  /** VPN name for PROD environment */
  vpnNameProd: string;
  /** Queue name to add subscription topic to */
  queueName: string;
  /** Subscription topics to add to the queue (one per line in UI) */
  subscriptionTopics: string[];
  /** ISO region code override, e.g. "eu-west-1" (optional) */
  regionIso?: string;
}

/** GitHub / notification inputs — used by Steps 5 (Solace Git), 6 (Mule Branch), 9 (PR + Notify). */
export interface GitHubInput {
  /** GitHub Personal Access Token with repo write permissions */
  githubPat: string;
  /** Solace GitHub org/owner */
  solaceRepoOwner: string;
  /** Solace repository name */
  solaceRepoName: string;
  /** Solace base branch to branch from (default: dev) */
  solaceBaseBranch: string;
  /** Path to input.json inside the Solace repo */
  solaceInputJsonPath: string;
  /** MuleSoft GitHub org/owner */
  muleRepoOwner: string;
  /** MuleSoft repository name */
  muleRepoName: string;
  /** MuleSoft base branch (default: dev) */
  muleBaseBranch: string;
  /** GitHub handle for PR reviewer */
  muleReviewerHandle: string;
  /** Reviewer email for PR notification */
  reviewerEmail: string;
  /** How to send the PR notification */
  notificationChannel: 'email' | 'teams' | 'slack';
  teamsWebhookUrl?: string;
  slackWebhookUrl?: string;
  smtpHost?: string;
  smtpFrom?: string;
}

export interface OnboardingInput {
  partner_comment: string;
  /** Full YAML key, e.g. "france" — used as the nav block key in all YAMLs. */
  country_key: string;
  /** Short routing code, e.g. "fr" — added to navision.validCountriesList and navision.instance. */
  country_code: string;
  created_by: string;

  /** DEV nav server details (also used for app.yaml base nav block). */
  nav: {
    protocol: string;
    host: string;
    port: string;
    username: string;
    domain: string;
    company: string;
    service: string;
    soap_port: string;
    soap_path: string;
    routing_code: string;
    use_common_cert: boolean;
    transaction_types: Record<string, TxEntry>;
  };
  /** TST-specific nav overrides — if present, tst.yaml gets patched. */
  nav_tst?: EnvNavConfig;
  /** PROD-specific nav overrides — if present, prod.yaml gets patched. */
  nav_prod?: EnvNavConfig;

  translation: {
    receiver_name: string;
    message_types: string[];
    source_destination_combinations: Combo[];
    uom_mappings: Combo[];
  };

  /** SAP BTP config — optional; activates Steps 1+2 in orchestration. */
  btp?: BtpInput;
  /** Solace config — optional; activates Steps 3+4+5 in orchestration. */
  solace?: SolaceInput;
  /** GitHub / notification config — optional; activates Steps 5+6+9 in orchestration. */
  github?: GitHubInput;
}

export interface TranslationRow {
  ReceiverName: string;
  MessageType: string;
  TranslationSchema: string;
  TranslationName: string;
  ValueFrom: string;
  ValueTo: string;
  'Created By': string;
  'Modified By': string;
  Modified: string;
  'Item Type': string;
  Path: string;
}

export interface RunResult {
  run_id: string;
  country_key: string;
  country_code: string;
  nav_host: string;
  nav_company: string;
  routing_code: string;
  tx_enabled: string[];
  receiver_name: string;
  /** DEV nav block appended. */
  yaml_block: string;
  /** app.yaml nav block. Present when app.yaml was found. */
  app_yaml_block?: string;
  /** TST nav block. Present when nav_tst provided and tst.yaml found. */
  tst_yaml_block?: string;
  /** PROD nav block. Present when nav_prod provided and prod.yaml found. */
  prod_yaml_block?: string;
  translation_rows: TranslationRow[];
  created_at: string;
}

/** Result returned by a single tool endpoint (POST /api/tools/*). */
export interface ToolResult {
  step: number;
  stepKey: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  /** run_id if tool produced downloadable output */
  run_id?: string;
  data?: Record<string, unknown>;
}
