/**
 * JACET8000 Excel ファイルに「日本語訳」列を追加するスクリプト。
 * OpenAI GPT-4o-mini を使って 50 語ずつバッチ翻訳し、進捗を保存しながら処理する。
 * 中断しても PROGRESS_FILE を残しておけば再開可能。
 *
 * Usage: node scripts/addTranslations.mjs
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.join(__dirname, '..', 'JACET8000_意味ジャンル×レベル別.xlsx');
const SHEET_NAME = '単語リスト（ジャンル付き）';
const PROGRESS_FILE = path.join(__dirname, 'translation_progress.json');
const BATCH_SIZE = 50;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function translateBatch(words) {
  const prompt = `以下の英単語リストに対して、最も一般的な日本語訳を1つずつ答えてください。
品詞ごとに最も基本的な意味を使い、カタカナ語より漢字・ひらがなを優先してください。
JSON オブジェクト形式で返してください: {"word1": "訳1", "word2": "訳2", ...}

英単語: ${words.join(', ')}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  return JSON.parse(res.choices[0].message.content || '{}');
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY 環境変数が設定されていません。');
    process.exit(1);
  }

  const buf = fs.readFileSync(EXCEL_PATH);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json(ws);

  // 進捗の読み込み
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`進捗ファイル読み込み: ${Object.keys(progress).length} 件処理済み`);
  }

  // 未処理の単語を抽出（重複除去）
  const allWords = [...new Set(rows.map(r => String(r['単語'] ?? '')).filter(Boolean))];
  const todo = allWords.filter(w => !(w.toLowerCase() in progress));
  console.log(`合計 ${allWords.length} 語 / 未処理 ${todo.length} 語`);

  // バッチ処理
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    try {
      const result = await translateBatch(batch);
      batch.forEach(w => {
        progress[w.toLowerCase()] = result[w] || result[w.toLowerCase()] || '';
      });
    } catch (e) {
      console.error(`\nバッチ ${i}-${i + BATCH_SIZE} でエラー:`, e.message);
      // エラーがあっても進捗は保存して続行
    }

    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    const total = Object.keys(progress).length;
    process.stdout.write(`\r${total} / ${allWords.length} 語完了`);
  }

  console.log('\n\nExcel ファイルを更新中...');

  // 全行に日本語訳を付与して書き直す
  const updated = rows.map(r => ({
    ...r,
    '日本語訳': progress[String(r['単語'] ?? '').toLowerCase()] ?? '',
  }));

  const newWs = XLSX.utils.json_to_sheet(updated);
  wb.Sheets[SHEET_NAME] = newWs;
  XLSX.writeFile(wb, EXCEL_PATH);

  console.log('保存完了:', EXCEL_PATH);

  // 完了したら進捗ファイルを削除
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  console.log('完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
