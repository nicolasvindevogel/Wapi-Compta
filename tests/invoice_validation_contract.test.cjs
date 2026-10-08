const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(repo, 'sql/058_v37_invoice_validation_gate.sql'), 'utf8');

test('migration appliquée 057 conservée byte-identique', () => {
  const expected = '9ca6a86ca3b887f4db34066d1d2d5b16495b30a5ab928f9643ffe7931c33d4f4';
  for (const file of ['057_v37_compta_serveur.sql', 'sql/057_v37_compta_serveur.sql']) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex'), expected);
  }
});

test('facture non validée interceptée avant création de lignes comptables', () => {
  const sync = sql.split('CREATE OR REPLACE FUNCTION public.wapi_v37_reconciliation')[0];
  const gate = sync.indexOf("IF v_status NOT IN ('validated','paid')");
  assert.ok(gate > 0 && gate < sync.indexOf('v_lines:=jsonb_build_array'));
  assert.match(sync.slice(gate), /RETURN public\.wapi_v37_deactivate_source_internal/);
});

test('rapprochement et backfill sélectionnent les mêmes factures validées', () => {
  for (const name of ['wapi_v37_reconciliation', 'wapi_v37_backfill_sources']) {
    const fn = sql.split(`CREATE OR REPLACE FUNCTION public.${name}`)[1].split('CREATE OR REPLACE FUNCTION')[0];
    assert.match(fn, /lower\(coalesce\(i\.status,''\)\) IN \('validated','paid'\)/);
    assert.doesNotMatch(fn, /i\.status,''\)\)<>'rejected'/);
  }
});

test('migration ne déclenche aucune réparation historique ni nouveau droit', () => {
  const outsideFunctions = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?END;\s*\$\$;/g, '');
  assert.doesNotMatch(outsideFunctions, /\b(DELETE|UPDATE|INSERT|TRUNCATE|GRANT|REVOKE|SELECT|PERFORM)\b/i);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
});
