/** Step metadata registry — single source of truth for step info displayed in UI and API. */

export type StepStatus = 'implemented' | 'stub' | 'manual';
export type InputSection = 'nav' | 'translation' | 'btp' | 'solace' | 'github';

export interface StepDef {
  id: number;
  /** URL-safe key used in tool endpoint path: /api/tools/{key} */
  key: string;
  name: string;
  description: string;
  owner: string;
  status: StepStatus;
  /** Endpoint that runs this step standalone, or null for manual steps. */
  toolEndpoint: string | null;
  /** Which input sections this step consumes. */
  requiresInput: InputSection[];
  /** Human-readable description of what's blocking implementation (stub steps only). */
  blockedOn?: string;
}

export const STEP_REGISTRY: StepDef[] = [
  {
    id: 1,
    key: 'btp-app',
    name: 'BTP Application Creation',
    description: 'Creates a new application in SAP API Management and triggers D3 approval workflow. Returns the BTP ClientID used by downstream steps.',
    owner: 'Parag Shende',
    status: 'stub',
    toolEndpoint: '/api/tools/btp-app',
    requiresInput: ['btp', 'translation'],
    blockedOn: 'POST payload schema + OAuth2 Service Key credentials from Parag Shende; D3 approval mechanism and approver identity TBD',
  },
  {
    id: 2,
    key: 'btp-valuemap',
    name: 'BTP Value Mapping',
    description: 'Adds partner entries to the Integration Suite Value Mapping artifact for the new 3PL country.',
    owner: 'Parag Shende',
    status: 'stub',
    toolEndpoint: '/api/tools/btp-valuemap',
    requiresInput: ['btp', 'translation'],
    blockedOn: 'Value Mapping entry schema to confirm with Parag Shende; depends on BTP ClientID from Step 1',
  },
  {
    id: 3,
    key: 'solace-portal',
    name: 'Solace Event Portal',
    description: 'Adds new enum value + event version + app bindings to Solace Event Portal for the new country routing.',
    owner: 'Rohini Mondal',
    status: 'stub',
    toolEndpoint: '/api/tools/solace-portal',
    requiresInput: ['solace', 'translation'],
    blockedOn: 'Solace EP API token + object IDs (enum, event, apps, environment, broker) from Rohini Mondal',
  },
  {
    id: 4,
    key: 'solace-queue',
    name: 'Solace Queue Subscription Patch',
    description: 'Adds a new topic subscription to the existing 3PL queue on Solace broker (both UAT and PROD VPNs).',
    owner: 'Rohini Mondal',
    status: 'stub',
    toolEndpoint: '/api/tools/solace-queue',
    requiresInput: ['solace', 'translation'],
    blockedOn: 'SEMP v2 credentials (host/port/username/password) + VPN names + queue name from Rohini Mondal',
  },
  {
    id: 5,
    key: 'solace-git',
    name: 'Solace Git / input.json',
    description: 'Creates a feature branch in the Solace config repo and patches input.json with new country+partner bindings.',
    owner: 'Rohini Mondal / DevOps',
    status: 'stub',
    toolEndpoint: '/api/tools/solace-git',
    requiresInput: ['solace', 'github', 'translation'],
    blockedOn: 'GitHub PAT with Solace repo write access; input.json schema to confirm with Rohini Mondal',
  },
  {
    id: 6,
    key: 'mule-branch',
    name: 'MuleSoft Feature Branch',
    description: 'Creates a new feature branch in the MuleSoft GitHub repository from the base dev branch.',
    owner: 'Sravani Kare / DevOps',
    status: 'stub',
    toolEndpoint: '/api/tools/mule-branch',
    requiresInput: ['github'],
    blockedOn: 'GitHub PAT with MuleSoft repo write access from Sravani Kare + DevOps',
  },
  {
    id: 7,
    key: 'yaml-patch',
    name: 'MuleSoft YAML Patch',
    description: 'Patches app.yaml (3-pass: validCountriesList + navision.instance + nav block), dev.yaml, and optionally tst.yaml and prod.yaml.',
    owner: 'EOS Automation',
    status: 'implemented',
    toolEndpoint: '/api/tools/yaml-patch',
    requiresInput: ['nav', 'translation'],
  },
  {
    id: 8,
    key: 'translation',
    name: 'MuleSoft Translation Rows',
    description: 'Generates SharePoint Translation Table rows (Excel + CSV) for the new 3PL partner.',
    owner: 'EOS Automation',
    status: 'implemented',
    toolEndpoint: '/api/tools/translation',
    requiresInput: ['nav', 'translation'],
  },
  {
    id: 9,
    key: 'mule-pr',
    name: 'MuleSoft PR + Notify',
    description: 'Commits patched YAMLs to the feature branch, raises a PR against the base branch, and notifies the reviewer via email/Teams/Slack.',
    owner: 'Sravani Kare',
    status: 'stub',
    toolEndpoint: '/api/tools/mule-pr',
    requiresInput: ['github', 'nav'],
    blockedOn: 'GitHub PAT + reviewer handle from Sravani Kare; notification channel (email/Teams/Slack) config TBD',
  },
  {
    id: 10,
    key: 'sharepoint-review',
    name: 'SharePoint / Manual Review Gate',
    description: 'Upload the generated Translation Excel to the SharePoint TranslationData_TST list and notify the business reviewer. This step is always manual.',
    owner: 'Business / Operations Team',
    status: 'manual',
    toolEndpoint: null,
    requiresInput: ['translation'],
  },
];

/** Look up a step definition by its URL key. */
export function getStepByKey(key: string): StepDef | undefined {
  return STEP_REGISTRY.find(s => s.key === key);
}

/** Look up a step definition by step number. */
export function getStepById(id: number): StepDef | undefined {
  return STEP_REGISTRY.find(s => s.id === id);
}
