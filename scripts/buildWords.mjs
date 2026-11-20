/**
 * JACET8000 の Excel を data/words.generated.json に変換する。
 * Cloudflare Workers では実行時にファイルを読めないため、ビルド前（predev / prebuild）に実行して
 * 単語データをコードに同梱する。
 *
 * Usage: node scripts/buildWords.mjs
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCEL_PATH = path.join(root, 'JACET8000_意味ジャンル×レベル別.xlsx');
const SHEET_NAME = '単語リスト（ジャンル付き）';
const OUT_PATH = path.join(root, 'data', 'words.generated.json');

const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer' });
const ws = wb.Sheets[SHEET_NAME];
if (!ws) throw new Error(`Worksheet not found: ${SHEET_NAME}`);

const words = XLSX.utils.sheet_to_json(ws)
  .map(r => ({
    genre: String(r['ジャンル'] ?? ''),
    level: String(r['レベル'] ?? ''),
    rank: Number(r['順位'] ?? 0),
    word: String(r['単語'] ?? ''),
    pos: String(r['品詞'] ?? ''),
    translation: String(r['日本語訳'] ?? ''),
  }))
  .filter(w => w.word);

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(words));
console.log(`words: ${words.length} -> ${path.relative(root, OUT_PATH)}`);
