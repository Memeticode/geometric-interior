/**
 * Builds the index.html viewer from spread.json.
 *
 * Usage:
 *   node workflows/tarot-prediction/build-index.mjs [--input spread.json]
 *
 * Reads output/spread.json and writes output/index.html.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const spreadPath = resolve(inputIdx >= 0 && args[inputIdx + 1]
    ? args[inputIdx + 1]
    : join(__dirname, 'output', 'spread.json'));
const outputDir = dirname(spreadPath);

const spread = JSON.parse(readFileSync(spreadPath, 'utf-8'));

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cardHtml(card) {
    const pos = String(card.position).padStart(2, '0');
    return `
    <article class="card">
      <div class="card-position">Card ${card.position}</div>
      <h2 class="card-title">${esc(card.title || card.name)}</h2>
      <div class="card-seed">${esc(card.seedLabel)} <span class="serial">${esc(card.seedSerial)}</span></div>
      <img class="card-image" src="${esc(card.imageFile)}" alt="${esc(card.altText)}" loading="lazy">
      <p class="card-reading">${esc(card.reading)}</p>
    </article>`;
}

function altTextFooter(cards) {
    const items = cards
        .filter(c => c.altText)
        .map(c => `<p><strong>Card ${c.position}:</strong> ${esc(c.altText)}</p>`)
        .join('\n        ');
    return `
    <details class="alt-texts">
      <summary>Image descriptions</summary>
      <div class="alt-text-content">
        ${items}
      </div>
    </details>`;
}

const dateStr = spread.timestamp
    ? new Date(spread.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

const html = `<!doctype html>
<html lang="${esc(spread.language || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tarot Reading</title>
  <style>
    :root {
      --bg: #05040a;
      --surface: #0e0c18;
      --border: #1e1b30;
      --text: #ccc8e0;
      --muted: #6b6882;
      --accent: #8b7ec8;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: Georgia, 'Times New Roman', serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 3rem 2rem;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 4rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      font-size: 1.4rem;
      font-weight: 400;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 1.5rem;
    }
    .prompt {
      font-size: 1.5rem;
      font-style: italic;
      color: var(--text);
      line-height: 1.5;
      margin-bottom: 1rem;
    }
    .meta {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .card {
      margin-bottom: 5rem;
      text-align: center;
    }
    .card-position {
      color: var(--muted);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 0.3rem;
    }
    .card-title {
      font-size: 1.6rem;
      font-weight: 400;
      margin-bottom: 0.2rem;
    }
    .card-seed {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .card-seed .serial {
      color: var(--accent);
      font-family: 'Courier New', monospace;
    }
    .card-image {
      width: 100%;
      border-radius: 4px;
      display: block;
      margin: 0 auto 1.5rem;
    }
    .card-reading {
      font-style: italic;
      color: var(--text);
      line-height: 1.7;
      max-width: 600px;
      margin: 0 auto;
    }
    .alt-texts {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--muted);
    }
    .alt-texts summary {
      cursor: pointer;
      color: var(--muted);
    }
    .alt-text-content {
      margin-top: 1rem;
      line-height: 1.6;
    }
    .alt-text-content p {
      margin-bottom: 0.8rem;
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>Tarot Reading</h1>
    <p class="prompt">${esc(spread.prompt)}</p>
    <p class="meta">${spread.cards.length} card${spread.cards.length !== 1 ? 's' : ''}${dateStr ? ` &middot; ${esc(dateStr)}` : ''}</p>
  </header>

  <main>
${spread.cards.map(cardHtml).join('\n')}
  </main>

${altTextFooter(spread.cards)}
</body>
</html>
`;

const outPath = resolve(outputDir, 'index.html');
writeFileSync(outPath, html);
console.log(`Written: ${outPath}`);
