// PDF から文字を取り出す(学習指導要領の確認用)。使い方: node research/pdftext.mjs <pdf> <検索語>
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const [file, word] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), cMapUrl: 'node_modules/pdfjs-dist/cmaps/', cMapPacked: true }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const t = (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join('');
  if (t.includes(word)) console.log('--- page', p, '\n', t.slice(Math.max(0, t.indexOf(word) - 600), t.indexOf(word) + 900));
}
