import { TX_CODE_ORDER, SHAREPOINT_PATH } from './constants';
import type { OnboardingInput, TranslationRow, EnvNavConfig } from './types';
import { sanitizeString, sanitizeCountryKey } from './security';

// ── YAML block generator ─────────────────────────────────────────────────────

export function buildYamlBlock(data: OnboardingInput): string {
  const { nav, country_key, partner_comment } = data;
  const lines: string[] = [];

  const safeCountryKey = sanitizeCountryKey(country_key);

  if (partner_comment?.trim()) {
    const safeComment = sanitizeString(partner_comment, 500)
      .replace(/[\r\n]/g, ' ')
      .replace(/[#]/g, '');
    if (safeComment) {
      lines.push(`# ${safeComment}`);
    }
  }

  lines.push(`${safeCountryKey}:`);

  const escapeYaml = (value: string): string => {
    if (!value) return '';
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  };

  lines.push(`   protocol: "${escapeYaml(nav.protocol)}"`);
  lines.push(`   host: "${escapeYaml(nav.host)}"`);
  lines.push(`   port: "${escapeYaml(nav.port)}"`);
  lines.push(`   username: "${escapeYaml(nav.username)}"`);
  lines.push(`   domain: "${escapeYaml(nav.domain)}"`);
  lines.push(`   company: "${escapeYaml(nav.company)}"`);
  lines.push(`   service: "${escapeYaml(nav.service)}"`);
  lines.push(`   soap.port: "${escapeYaml(nav.soap_port)}"`);
  lines.push(`   soap.path: "${escapeYaml(nav.soap_path)}"`);
  lines.push(`   routing.code: "${escapeYaml(nav.routing_code)}"`);
  lines.push(`   transactiontype:`);

  for (const code of TX_CODE_ORDER) {
    const entry = nav.transaction_types[code];
    if (entry?.enabled) {
      if (!/^[a-z0-9_]+$/.test(code)) continue;
      lines.push(`     ${code}: "${escapeYaml(entry.type)}"`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Builds a nav block using base data but with env-specific server details overlaid.
 * Used to generate TST/PROD nav blocks from the base OnboardingInput.
 */
export function buildYamlBlockForEnv(data: OnboardingInput, envNav: EnvNavConfig): string {
  return buildYamlBlock({
    ...data,
    nav: {
      ...data.nav,
      host: envNav.host,
      company: envNav.company,
      soap_path: envNav.soap_path,
      routing_code: envNav.routing_code,
      ...(envNav.port      ? { port: envNav.port }           : {}),
      ...(envNav.username  ? { username: envNav.username }   : {}),
      ...(envNav.soap_port ? { soap_port: envNav.soap_port } : {}),
      ...(envNav.protocol  ? { protocol: envNav.protocol }   : {}),
    },
  });
}

// ── YAML patcher — append nav block ─────────────────────────────────────────

export function patchYaml(original: string, countryKey: string, block: string): string {
  const safeCountryKey = sanitizeCountryKey(countryKey);
  const escapedKey = safeCountryKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}\\s*:`, 'm');

  if (pattern.test(original)) {
    throw new Error(
      `Country key '${safeCountryKey}' already exists in the YAML. Remove it first or choose a different key.`
    );
  }

  const sep = original.endsWith('\n') ? '\n' : '\n\n';
  return original + sep + block;
}

// ── YAML patcher — navision.validCountriesList (incremental) ─────────────────

/**
 * Appends a new country code to the navision.validCountriesList comma-separated string.
 * Silently returns the original YAML if the key is not found (app.yaml only feature).
 * Throws if the code is already present.
 */
export function patchValidCountriesList(yaml: string, countryCode: string): string {
  const safeCode = countryCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const pattern = /([ \t]*validCountriesList:\s*")([^"]+)(")/;
  const match = yaml.match(pattern);
  if (!match) return yaml; // section not present in this file — skip silently

  const existing = match[2].split(',').map(c => c.trim());
  if (existing.includes(safeCode)) {
    throw new Error(`Country code '${safeCode}' already exists in navision.validCountriesList.`);
  }
  return yaml.replace(pattern, `$1$2,${safeCode}$3`);
}

// ── YAML patcher — navision.instance (incremental) ───────────────────────────

/**
 * Appends a new `code: "country_key"` entry inside the navision.instance block.
 * Silently returns the original YAML if the instance block is not found.
 * Throws if the code is already present.
 */
export function patchNavisionInstance(yaml: string, countryCode: string, countryKey: string): string {
  const safeCode = countryCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeKey  = sanitizeCountryKey(countryKey);

  // Match the instance block: a line "  instance:" followed by 4-space-indented entries
  const pattern = /([ \t]+instance:\n)((?:[ \t]{4}[^\n]+\n)*)/;
  const match = yaml.match(pattern);
  if (!match) return yaml; // section not present in this file — skip silently

  const blockLines = match[2];
  const dupCheck = new RegExp(`^[ \\t]{4}${safeCode}:`, 'm');
  if (dupCheck.test(blockLines)) {
    throw new Error(`Country code '${safeCode}' already exists in navision.instance.`);
  }

  return yaml.replace(pattern, `$1$2    ${safeCode}: "${safeKey}"\n`);
}

// ── Translation row generator ─────────────────────────────────────────────────

export function buildTranslationRows(data: OnboardingInput): TranslationRow[] {
  const rows: TranslationRow[] = [];
  const { receiver_name, message_types, source_destination_combinations, uom_mappings } =
    data.translation;

  const now = new Date();
  const modified = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const createdBy = sanitizeString(data.created_by || 'Automation Script', 100);

  const base = {
    ReceiverName: sanitizeString(receiver_name, 100),
    TranslationSchema: 'INTERNAL_TO_EXTERNAL',
    'Created By': createdBy,
    'Modified By': createdBy,
    Modified: modified,
    'Item Type': 'Item',
    Path: SHAREPOINT_PATH,
  };

  for (const msgType of message_types) {
    const safeMsgType = sanitizeString(msgType, 50);

    for (const c of source_destination_combinations) {
      if (c.value_from && c.value_to) {
        rows.push({
          ...base,
          MessageType: safeMsgType,
          TranslationName: 'sourceDestinationCombination',
          ValueFrom: sanitizeString(c.value_from, 200),
          ValueTo: sanitizeString(c.value_to, 200),
        });
      }
    }

    for (const u of uom_mappings) {
      if (u.value_from && u.value_to) {
        rows.push({
          ...base,
          MessageType: safeMsgType,
          TranslationName: 'uom',
          ValueFrom: sanitizeString(u.value_from, 50),
          ValueTo: sanitizeString(u.value_to, 50),
        });
      }
    }
  }

  return rows;
}

// ── CSV generator ─────────────────────────────────────────────────────────────
import { TRANSLATION_COLUMNS } from './constants';

export function buildCsv(rows: TranslationRow[]): string {
  const escape = (v: string) => {
    const str = String(v);
    const cleaned = str.replace(/^[=+\-@\t\r]/g, '');
    return `"${cleaned.replace(/"/g, '""')}"`;
  };

  const header = TRANSLATION_COLUMNS.join(',');
  const dataRows = rows.map(r =>
    TRANSLATION_COLUMNS.map(c => escape((r as unknown as Record<string,string>)[c] ?? '')).join(',')
  );

  return [header, ...dataRows].join('\n');
}
