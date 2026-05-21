import fs from 'fs';
import path from 'path';
import type { RunResult, TranslationRow } from './types';
import { TRANSLATION_COLUMNS } from './constants';
import { isValidRunId, safeResolvePath } from './security';

const OUTPUT_ROOT = path.join(process.cwd(), 'outputs');

export function ensureOutputRoot() {
  if (!fs.existsSync(OUTPUT_ROOT)) {
    fs.mkdirSync(OUTPUT_ROOT, { recursive: true, mode: 0o750 });
  }
}

export function runDir(runId: string): string | null {
  if (!isValidRunId(runId)) return null;
  const dir = path.join(OUTPUT_ROOT, runId);
  const safePath = safeResolvePath(OUTPUT_ROOT, runId);
  if (!safePath || safePath !== dir) return null;
  return dir;
}

export function saveRunFiles(
  runId: string,
  meta: RunResult,
  patchedYaml: string,
  excelBuffer: Buffer,
  csvContent: string,
  appPatchedYaml?: string,
  tstPatchedYaml?: string,
  prodPatchedYaml?: string,
) {
  const dir = runDir(runId);
  if (!dir) throw new Error('Invalid run ID format');

  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });

  fs.writeFileSync(path.join(dir, 'metadata.json'),       JSON.stringify(meta, null, 2), { mode: 0o640 });
  fs.writeFileSync(path.join(dir, 'patched.yaml'),         patchedYaml, { encoding: 'utf-8', mode: 0o640 });
  fs.writeFileSync(path.join(dir, 'translations.xlsx'),    excelBuffer, { mode: 0o640 });
  fs.writeFileSync(path.join(dir, 'translations.csv'),     csvContent,  { encoding: 'utf-8', mode: 0o640 });

  if (appPatchedYaml)  fs.writeFileSync(path.join(dir, 'app_patched.yaml'),  appPatchedYaml,  { encoding: 'utf-8', mode: 0o640 });
  if (tstPatchedYaml)  fs.writeFileSync(path.join(dir, 'tst_patched.yaml'),  tstPatchedYaml,  { encoding: 'utf-8', mode: 0o640 });
  if (prodPatchedYaml) fs.writeFileSync(path.join(dir, 'prod_patched.yaml'), prodPatchedYaml, { encoding: 'utf-8', mode: 0o640 });
}

export function loadRunMeta(runId: string): RunResult | null {
  const dir = runDir(runId);
  if (!dir) return null;

  const metaPath = path.join(dir, 'metadata.json');
  const safePath = safeResolvePath(dir, 'metadata.json');
  if (!safePath || safePath !== metaPath) return null;
  if (!fs.existsSync(metaPath)) return null;

  try {
    const content = fs.readFileSync(metaPath, 'utf-8');
    if (content.length > 1024 * 1024) throw new Error('Metadata file too large');
    return JSON.parse(content) as RunResult;
  } catch (error) {
    console.error('Error loading run metadata:', error);
    return null;
  }
}

const FILE_MAP: Record<string, string> = {
  'yaml':      'patched.yaml',
  'app-yaml':  'app_patched.yaml',
  'tst-yaml':  'tst_patched.yaml',
  'prod-yaml': 'prod_patched.yaml',
  'xlsx':      'translations.xlsx',
  'csv':       'translations.csv',
};

export function getFilePath(runId: string, type: string): string | null {
  const dir = runDir(runId);
  if (!dir) return null;

  const filename = FILE_MAP[type];
  if (!filename) return null;

  const filePath = path.join(dir, filename);
  const safePath = safeResolvePath(dir, filename);
  if (!safePath || safePath !== filePath) return null;

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return null;
  } catch {
    return null;
  }

  return filePath;
}

/** Returns path to a source YAML file in webapp/data/, or null if not found. */
export function getEnvYamlPath(env: 'dev' | 'tst' | 'prod' | 'app'): string | null {
  const name = env === 'dev' ? 'dev.yaml' : `${env}.yaml`;
  const candidates = [
    path.join(process.cwd(), 'data', name),
    path.join(process.cwd(), '..', 'config', name),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

export function getDefaultYamlPath(): string {
  const p = getEnvYamlPath('dev');
  if (p) return p;
  throw new Error('dev.yaml not found. Expected at webapp/data/dev.yaml or ../config/dev.yaml');
}

export async function buildExcelBuffer(rows: TranslationRow[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('New Translation Rows');

  ws.columns = TRANSLATION_COLUMNS.map(c => ({ header: c, key: c, width: c.length + 6 }));

  ws.getRow(1).eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(1).height = 20;

  rows.forEach((row, i) => {
    const r = ws.addRow(TRANSLATION_COLUMNS.map(c => (row as unknown as Record<string, string>)[c] ?? ''));
    const bg = i % 2 === 0 ? 'FFDDEEFF' : 'FFEEF5FF';
    r.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font      = { size: 9 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    r.height = 18;
  });

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}
