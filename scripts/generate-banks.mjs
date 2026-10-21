// Builds the bank list used by the account form from the `logos-bancos-br` package
// (Banco Central STR/Pix participant lists + Open Finance logos).
// Writes src/data/banks.json and copies the referenced logos to public/banks/.
// Usage: npm run banks   (re-run after updating the package)
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('logos-bancos-br/package.json'));
const { banks } = require('logos-bancos-br/data/bancos.json');
const { institutions } = require('logos-bancos-br/data/instituicoes-pix.json');

const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);
const UPPER = new Set(['s.a.', 's/a', 'sa', 'ltda', 'ltda.', 'dtvm', 'ctvm', 'cctvm', 'scfi', 'ip', 'cfi', 'cecm', 'ccla', 'bm', 'bdmg', 'brb']);

/** Official names come in upper case; make them readable without guessing brand names. */
function prettify(name) {
  if (name !== name.toUpperCase()) return name.trim();
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (UPPER.has(word) ? word.toUpperCase() : i > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/^Bco\b/, 'Banco');
}

/** Card brands people know better than the issuer's legal name, searchable in the picker. */
const ALIASES = {
  '001': ['Ourocard'],
  '237': ['Next', 'Bradescard', 'Elo'],
  '341': ['Itaucard', 'Hipercard', 'Credicard', 'Iti'],
  '033': ['Santander SX'],
  '104': ['Caixa Econômica Federal'],
  '358': ['Riachuelo'],
  '374': ['Renner'],
  '368': ['Atacadão', 'Carrefour'],
  '396': ['Magalu', 'Luiza'],
  '468': ['Porto Bank', 'Porto Seguro'],
  '290': ['PagSeguro'],
  '260': ['Nu', 'Roxinho'],
  '077': ['Banco Inter'],
  '336': ['C6'],
  '655': ['BV'],
  '623': ['Pan'],
};

const DISPLAY_OVERRIDES = { '468': 'Porto Bank' };

const rows = [];
const logos = new Set();
const add = (inst, id) => {
  if (!inst.name) return;
  const logo = inst.logo?.png ? inst.logo.png.split('/').pop().replace(/\.png$/, '') : null;
  if (logo) logos.add(logo);
  const name = DISPLAY_OVERRIDES[inst.compe] ?? inst.displayName ?? prettify(inst.name);
  const row = { id, name };
  if (logo) row.logo = logo;
  if (ALIASES[inst.compe]) row.aka = ALIASES[inst.compe];
  rows.push(row);
};
for (const bank of banks) if (bank.compe) add(bank, bank.compe);
// Pix-only institutions have no COMPE code; keep the well-known ones (curated display names).
for (const inst of institutions) if (!inst.compe && inst.displayName) add(inst, `ispb-${inst.ispb}`);
rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

writeFileSync(join(root, 'src/data/banks.json'), `${JSON.stringify(rows)}\n`);

const out = join(root, 'public/banks');
if (existsSync(out)) for (const file of readdirSync(out)) rmSync(join(out, file));
mkdirSync(out, { recursive: true });
for (const logo of logos) copyFileSync(join(pkgDir, 'logos/png', `${logo}.png`), join(out, `${logo}.png`));

console.log(`${rows.length} institutions, ${logos.size} logos → src/data/banks.json, public/banks/`);
