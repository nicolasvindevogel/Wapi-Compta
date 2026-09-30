const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '057_v37_compta_serveur.sql'), 'utf8');

test('V37 migration contains central accounting tables', () => {
  for (const table of ['compta_accounting_entries','compta_accounting_lines','compta_accounting_counters','compta_accounting_sync_errors']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, 'i'));
  }
});

test('V37 exposes server balance, ledger and reconciliation RPCs', () => {
  for (const fn of ['wapi_v37_balance','wapi_v37_ledger','wapi_v37_journal_summary','wapi_v37_reconciliation','wapi_v37_backfill_sources']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`, 'i'));
  }
});

test('posted accounting is protected and corrected with reversal', () => {
  assert.match(sql, /Une écriture validée ne peut pas être supprimée/i);
  assert.match(sql, /wapi_v37_reverse_internal/i);
  assert.match(sql, /status='reversed'/i);
});

test('source synchronization errors are non-blocking and traceable', () => {
  assert.match(sql, /wapi_v37_log_sync_error/i);
  assert.match(sql, /trg_wapi_v37_invoice_sync/i);
  assert.match(sql, /trg_wapi_v37_owner_call_sync/i);
  assert.match(sql, /trg_wapi_v37_bank_tx_sync/i);
});
