/**
 * 3PL Inbound Onboarding Orchestrator (TypeScript)
 * ==================================================
 * Runs all automation steps in sequence.
 *
 * Integration config (BTP, Solace, GitHub) is read from:
 *   1. input.btp / input.solace / input.github  — user-provided via the UI form
 *   2. Environment variables                     — server-level fallback for deployed instances
 *
 * Step status:
 *   1  BTP Application Creation          [STUB — Parag Shende]
 *   2  BTP Value Mapping                 [STUB — Parag Shende]
 *   3  Solace Event Portal (5-call seq)  [STUB — Rohini Mondal]
 *   4  Solace Queue Subscription Patch   [STUB — Rohini Mondal]
 *   5  Solace Git / input.json           [STUB — Rohini Mondal + DevOps]
 *   6  MuleSoft Feature Branch           [STUB — Sravani Kare + DevOps]
 *   7  MuleSoft YAML Patch               [DONE]
 *   8  MuleSoft Translation Rows         [DONE]
 *   9  MuleSoft PR + Notify              [STUB — Sravani Kare]
 *  10  SharePoint / Manual Review Gate   [MANUAL]
 */

import type { OnboardingInput, RunResult } from "./types";

import { run as runStep1 } from "./steps/step1-btp-app";
import { run as runStep2 } from "./steps/step2-btp-valuemap";
import { run as runStep3 } from "./steps/step3-solace-portal";
import { run as runStep4 } from "./steps/step4-solace-queue";
import { run as runStep5 } from "./steps/step5-solace-git";
import { run as runStep6 } from "./steps/step6-mule-branch";
import { run as runStep9 } from "./steps/step9-mule-pr";
import {
  buildYamlBlock, buildYamlBlockForEnv,
  patchYaml, patchValidCountriesList, patchNavisionInstance,
  buildTranslationRows, buildCsv,
} from "./core";
import { ensureOutputRoot, saveRunFiles, buildExcelBuffer, getDefaultYamlPath, getEnvYamlPath } from "./fileStore";
import { v4 as uuidv4 } from "uuid";
import { statSync, readFileSync } from "fs";
import { TX_CODE_ORDER } from "./constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepStatus = "ok" | "skipped" | "error" | "manual";

export interface StepOutcome {
  step: string;
  status: StepStatus;
  detail?: string;
}

export interface OrchestrationResult {
  runId: string;
  success: boolean;
  steps: StepOutcome[];
  btpClientId: string;
  muleFeatureBranch: string;
  prUrl: string;
  runResult?: RunResult;
  errors: string[];
}

// ── Orchestration state ───────────────────────────────────────────────────────

interface State {
  btpClientId: string;
  solaceEnumVersionId: string;
  solaceEventVersionId: string;
  muleFeatureBranch: string;
  yamlDiffSummary: string;
  translationRowCount: number;
}

function emptyState(): State {
  return {
    btpClientId: "",
    solaceEnumVersionId: "",
    solaceEventVersionId: "",
    muleFeatureBranch: "",
    yamlDiffSummary: "",
    translationRowCount: 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Prefer input field value, fall back to env var, then default. */
function cfg(inputVal: string | undefined, envKey: string, fallback = ""): string {
  return (inputVal && inputVal.trim()) ? inputVal.trim() : (process.env[envKey] ?? fallback);
}

async function safeRun<T>(
  stepName: string,
  fn: () => Promise<T>,
  outcomes: StepOutcome[]
): Promise<T | null> {
  try {
    const result = await fn();
    outcomes.push({ step: stepName, status: "ok" });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTodo = msg.includes("not yet implemented") || msg.includes("not implemented");
    outcomes.push({
      step: stepName,
      status: isTodo ? "skipped" : "error",
      detail: msg.split("\n")[0],
    });
    return null;
  }
}

function readYamlSafe(filePath: string): string {
  const stats = statSync(filePath);
  if (stats.size > 10 * 1024 * 1024) throw new Error("Source YAML file too large");
  return readFileSync(filePath, "utf-8");
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function orchestrate(input: OnboardingInput): Promise<OrchestrationResult> {
  const runId = uuidv4();
  const outcomes: StepOutcome[] = [];
  const errors: string[] = [];
  const state = emptyState();

  // Derive integration config: user-supplied fields take priority over env vars
  const btp   = input.btp;
  const solace = input.solace;
  const gh     = input.github;

  // ── Step 1: BTP Application Creation ─────────────────────────────────────
  const step1Result = await safeRun("Step 1 — BTP App Creation", () =>
    runStep1({
      apiHost:        cfg(btp?.apiHost,        "BTP_API_HOST"),
      tokenUrl:       cfg(btp?.tokenUrl,       "BTP_TOKEN_URL"),
      clientId:       cfg(btp?.clientId,       "BTP_CLIENT_ID"),
      clientSecret:   cfg(btp?.clientSecret,   "BTP_CLIENT_SECRET"),
      productName:    cfg(btp?.productName,    "BTP_PRODUCT_NAME"),
      quotaPlan:      cfg(btp?.quotaPlan,      "BTP_QUOTA_PLAN"),
      d3ApproverEmail: cfg(btp?.d3ApproverEmail, "BTP_D3_APPROVER_EMAIL"),
      appName:        `3pl-${input.translation?.receiver_name ?? input.country_key}`,
      appDescription: `3PL onboarding for ${input.country_key}`,
      partnerId:      input.translation?.receiver_name ?? "",
      countryCode:    input.country_key,
    }), outcomes
  );
  if (step1Result) state.btpClientId = step1Result.clientId;

  // ── Step 2: BTP Value Mapping ─────────────────────────────────────────────
  await safeRun("Step 2 — BTP Value Mapping", () =>
    runStep2({
      baseUrl:           cfg(btp?.suiteBaseUrl,         "BTP_SUITE_BASE_URL", "https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com"),
      tokenUrl:          cfg(btp?.tokenUrl,              "BTP_TOKEN_URL"),
      clientId:          cfg(btp?.clientId,              "BTP_CLIENT_ID"),
      clientSecret:      cfg(btp?.clientSecret,          "BTP_CLIENT_SECRET"),
      artifactId:        cfg(btp?.valuemapArtifactId,    "BTP_VALUEMAP_ARTIFACT_ID"),
      packageId:         cfg(btp?.valuemapPackageId,     "BTP_VALUEMAP_PACKAGE_ID"),
      partnerId:         state.btpClientId || (input.translation?.receiver_name ?? ""),
      countryCode:       input.country_key,
      mappingEntries:    [],
    }), outcomes
  );

  // ── Step 3: Solace Event Portal ───────────────────────────────────────────
  const step3Result = await safeRun("Step 3 — Solace Event Portal", () =>
    runStep3({
      apiBase:         "https://api.solace.dev",
      apiToken:        cfg(solace?.epApiToken,      "SOLACE_EP_API_TOKEN"),
      enumId:          cfg(solace?.enumId,           "SOLACE_ENUM_ID"),
      eventId:         cfg(solace?.eventId,          "SOLACE_EVENT_ID"),
      producerAppId:   cfg(solace?.producerAppId,    "SOLACE_PRODUCER_APP_ID"),
      producerAppName: cfg(solace?.producerAppName,  "SOLACE_PRODUCER_APP_NAME"),
      consumerAppId:   cfg(solace?.consumerAppId,    "SOLACE_CONSUMER_APP_ID"),
      consumerAppName: cfg(solace?.consumerAppName,  "SOLACE_CONSUMER_APP_NAME"),
      environmentId:   cfg(solace?.environmentId,   "SOLACE_ENVIRONMENT_ID"),
      brokerId:        cfg(solace?.brokerId,         "SOLACE_BROKER_ID"),
      countryCode:     input.country_key,
      regionIso:       solace?.regionIso ?? "",
      partnerId:       state.btpClientId || (input.translation?.receiver_name ?? ""),
      subscriptionTopics: solace?.subscriptionTopics ?? [],
    }), outcomes
  );
  if (step3Result) {
    state.solaceEnumVersionId = step3Result.enumVersionId;
    state.solaceEventVersionId = step3Result.eventVersionId;
  }

  // ── Step 4: Solace Queue Subscription Patch ───────────────────────────────
  await safeRun("Step 4 — Solace Queue Patch", () =>
    runStep4({
      sempHost:     cfg(solace?.sempHost,     "SOLACE_SEMP_HOST"),
      sempPort:     cfg(solace?.sempPort,     "SOLACE_SEMP_PORT", "943"),
      sempUsername: cfg(solace?.sempUsername, "SOLACE_SEMP_USERNAME"),
      sempPassword: cfg(solace?.sempPassword, "SOLACE_SEMP_PASSWORD"),
      vpnNameUat:   cfg(solace?.vpnNameUat,   "SOLACE_VPN_UAT"),
      vpnNameProd:  cfg(solace?.vpnNameProd,  "SOLACE_VPN_PROD"),
      queueName:    cfg(solace?.queueName,    "SOLACE_QUEUE_NAME"),
      newTopics:    solace?.subscriptionTopics ?? [],
      partnerId:    state.btpClientId || (input.translation?.receiver_name ?? ""),
    }), outcomes
  );

  // ── Step 5: Solace Git / input.json ──────────────────────────────────────
  await safeRun("Step 5 — Solace Git / input.json", () =>
    runStep5({
      githubApiBase:      "https://api.github.com",
      repoOwner:          cfg(gh?.solaceRepoOwner,     "SOLACE_GITHUB_REPO_OWNER"),
      repoName:           cfg(gh?.solaceRepoName,      "SOLACE_GITHUB_REPO_NAME"),
      baseBranch:         cfg(gh?.solaceBaseBranch,    "SOLACE_GITHUB_BASE_BRANCH", "dev"),
      githubPat:          cfg(gh?.githubPat,           "GITHUB_PAT"),
      inputJsonPath:      cfg(gh?.solaceInputJsonPath,  "SOLACE_INPUT_JSON_PATH"),
      countryCode:        input.country_key,
      partnerId:          state.btpClientId || (input.translation?.receiver_name ?? ""),
      subscriptionTopics: solace?.subscriptionTopics ?? [],
      enumVersionId:      state.solaceEnumVersionId,
      eventVersionId:     state.solaceEventVersionId,
    }), outcomes
  );

  // ── Step 6: MuleSoft Feature Branch ──────────────────────────────────────
  const step6Result = await safeRun("Step 6 — Mule Feature Branch", () =>
    runStep6({
      githubApiBase: "https://api.github.com",
      repoOwner:     cfg(gh?.muleRepoOwner,   "MULE_GITHUB_REPO_OWNER"),
      repoName:      cfg(gh?.muleRepoName,    "MULE_GITHUB_REPO_NAME"),
      baseBranch:    cfg(gh?.muleBaseBranch,  "MULE_GITHUB_BASE_BRANCH", "dev"),
      githubPat:     cfg(gh?.githubPat,       "GITHUB_PAT"),
      branchPrefix:  "feature/3pl-onboard",
      partnerId:     state.btpClientId || (input.translation?.receiver_name ?? ""),
      countryCode:   input.country_key,
    }), outcomes
  );
  if (step6Result) state.muleFeatureBranch = step6Result.branchName;

  // ── Steps 7 + 8: YAML Patch + Translation Rows ───────────────────────────
  let runResult: RunResult | undefined;
  try {
    const devBlock  = buildYamlBlock(input);
    const tstBlock  = input.nav_tst  ? buildYamlBlockForEnv(input, input.nav_tst)  : null;
    const prodBlock = input.nav_prod ? buildYamlBlockForEnv(input, input.nav_prod) : null;

    // Patch dev.yaml
    const devYamlPath = getDefaultYamlPath();
    let patchedDev = patchYaml(readYamlSafe(devYamlPath), input.country_key, devBlock);

    // Patch app.yaml (3-pass)
    let patchedApp: string | undefined;
    const appYamlPath = getEnvYamlPath("app");
    if (appYamlPath) {
      let yaml = readYamlSafe(appYamlPath);
      yaml = patchValidCountriesList(yaml, input.country_code);
      yaml = patchNavisionInstance(yaml, input.country_code, input.country_key);
      patchedApp = patchYaml(yaml, input.country_key, devBlock);
    }

    // Patch tst.yaml
    let patchedTst: string | undefined;
    const tstYamlPath = getEnvYamlPath("tst");
    if (tstBlock && tstYamlPath) {
      patchedTst = patchYaml(readYamlSafe(tstYamlPath), input.country_key, tstBlock);
    }

    // Patch prod.yaml
    let patchedProd: string | undefined;
    const prodYamlPath = getEnvYamlPath("prod");
    if (prodBlock && prodYamlPath) {
      patchedProd = patchYaml(readYamlSafe(prodYamlPath), input.country_key, prodBlock);
    }

    // Translation rows + Excel/CSV
    const rows        = buildTranslationRows(input);
    const excelBuffer = await buildExcelBuffer(rows);
    const csvContent  = buildCsv(rows);

    const txEnabled = TX_CODE_ORDER.filter(c => input.nav.transaction_types[c]?.enabled);

    runResult = {
      run_id:           runId,
      country_key:      input.country_key,
      country_code:     input.country_code,
      nav_host:         input.nav.host,
      nav_company:      input.nav.company,
      routing_code:     input.nav.routing_code,
      tx_enabled:       txEnabled,
      receiver_name:    input.translation.receiver_name,
      yaml_block:       devBlock,
      ...(patchedApp  && { app_yaml_block:  devBlock }),
      ...(tstBlock     && { tst_yaml_block:  tstBlock }),
      ...(prodBlock    && { prod_yaml_block: prodBlock }),
      translation_rows: rows,
      created_at:       new Date().toISOString(),
    };

    state.yamlDiffSummary     = devBlock;
    state.translationRowCount = rows.length;

    ensureOutputRoot();
    saveRunFiles(runId, runResult, patchedDev, excelBuffer as Buffer, csvContent, patchedApp, patchedTst, patchedProd);

    outcomes.push({ step: "Step 7 — Mule YAML Patch",   status: "ok" });
    outcomes.push({ step: "Step 8 — Translation Rows",  status: "ok", detail: `${rows.length} rows` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    outcomes.push({ step: "Step 7 — Mule YAML Patch",  status: "error", detail: msg });
    outcomes.push({ step: "Step 8 — Translation Rows", status: "error" });
  }

  // ── Step 9: MuleSoft PR + Notification ───────────────────────────────────
  let prUrl = "";
  const step9Result = await safeRun("Step 9 — Mule PR + Notify", () =>
    runStep9({
      githubApiBase:        "https://api.github.com",
      repoOwner:            cfg(gh?.muleRepoOwner,        "MULE_GITHUB_REPO_OWNER"),
      repoName:             cfg(gh?.muleRepoName,         "MULE_GITHUB_REPO_NAME"),
      githubPat:            cfg(gh?.githubPat,            "GITHUB_PAT"),
      baseBranch:           cfg(gh?.muleBaseBranch,       "MULE_GITHUB_BASE_BRANCH", "dev"),
      reviewerGithubHandle: cfg(gh?.muleReviewerHandle,   "MULE_REVIEWER_GITHUB_HANDLE"),
      prLabel:              "3pl-onboarding",
      notificationChannel:  (cfg(gh?.notificationChannel, "NOTIFICATION_CHANNEL", "email")) as "email" | "teams" | "slack",
      reviewerEmail:        cfg(gh?.reviewerEmail,        "REVIEWER_EMAIL"),
      smtpHost:             cfg(gh?.smtpHost,             "SMTP_HOST"),
      smtpFrom:             cfg(gh?.smtpFrom,             "SMTP_FROM"),
      teamsWebhookUrl:      cfg(gh?.teamsWebhookUrl,      "TEAMS_WEBHOOK_URL"),
      slackWebhookUrl:      cfg(gh?.slackWebhookUrl,      "SLACK_WEBHOOK_URL"),
      featureBranch:        state.muleFeatureBranch,
      countryKey:           input.country_key,
      partnerId:            state.btpClientId || (input.translation?.receiver_name ?? ""),
      yamlDiffSummary:      state.yamlDiffSummary,
      translationRowCount:  state.translationRowCount,
    }), outcomes
  );
  if (step9Result) prUrl = step9Result.prUrl;

  // ── Step 10: Manual gate ──────────────────────────────────────────────────
  outcomes.push({
    step:   "Step 10 — SharePoint / Manual Review",
    status: "manual",
    detail: "Upload translation XLSX to SharePoint TranslationData_TST list",
  });

  const overallSuccess =
    outcomes.every(o => o.status !== "error") && errors.length === 0;

  return {
    runId,
    success: overallSuccess,
    steps:   outcomes,
    btpClientId:       state.btpClientId,
    muleFeatureBranch: state.muleFeatureBranch,
    prUrl,
    runResult,
    errors,
  };
}
