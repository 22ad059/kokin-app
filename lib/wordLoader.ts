import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { WordEntry } from '@/types/study';

export type { WordEntry };

const EXCEL_FILE_NAME = 'JACET8000_意味ジャンル×レベル別.xlsx';
const SHEET_NAME = '単語リスト（ジャンル付き）';

let cache: WordEntry[] | null = null;

function findWorkbookPath(startDir = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(currentDir, EXCEL_FILE_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

export function loadWords(): WordEntry[] {
  if (cache) return cache;
  const filePath = findWorkbookPath();
  if (!filePath) throw new Error(`Excel file not found: ${EXCEL_FILE_NAME}`);

  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Worksheet not found: ${SHEET_NAME}`);

  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);
  cache = rows.map(r => ({
    genre: String(r['ジャンル'] ?? ''),
    level: String(r['レベル'] ?? ''),
    rank: Number(r['順位'] ?? 0),
    word: String(r['単語'] ?? ''),
    pos: String(r['品詞'] ?? ''),
    translation: String(r['日本語訳'] ?? ''),
  })).filter(w => w.word);
  return cache;
}

function findEntry(word: string): WordEntry | undefined {
  const words = loadWords();
  const lower = word.toLowerCase();
  return words.find(w => {
    const stored = w.word.toLowerCase();
    return stored === lower || stored.replace(/\s*\(.*\)$/, '').trim() === lower;
  });
}

export function lookupTranslation(word: string): string {
  return findEntry(word)?.translation || '';
}

export function lookupEntry(word: string): WordEntry | undefined {
  return findEntry(word);
}
