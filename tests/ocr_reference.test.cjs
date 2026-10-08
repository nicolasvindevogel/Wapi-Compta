const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/v36_invoice_center.js'), 'utf8');
const start = source.indexOf('  function strictInvoiceExtract(');
const end = source.indexOf('\n  window.extractInvoiceFieldsV19=', start);
const context = vm.createContext({
  window: {WapiInvoiceDocument: require('../js/invoice_document.js')},
  previousStrictExtractor: (_text, file) => ({reference: file.replace(/\.pdf$/i, '')}),
});
vm.runInContext(source.slice(start, end), context);
const extract = (text, file) => context.strictInvoiceExtract(text, file);

test('OCR center preserves an explicit PDF invoice number matching the file stem', () => {
  const fields = extract('Facture n° AUDIT-20261008-OCR-01\nDate facture : 08/10/2026\nTotal TVAC : 12,10 EUR', 'AUDIT-20261008-OCR-01.pdf');
  assert.equal(fields.reference, 'AUDIT-20261008-OCR-01');
  assert.equal(fields.amount, 12.1);
  assert.ok(!fields.ocr_warnings.some(w => w.includes('nom du fichier')));
});

test('OCR center never promotes the legacy filename fallback without PDF evidence', () => {
  assert.equal(extract('Total TVAC : 12,10 EUR', 'AUDIT-20261008-OCR-01.pdf').reference, '');
});

test('OCR center preserves invoice number differing from file name', () => {
  assert.equal(extract('Invoice # INV-2026-15', 'scan.pdf').reference, 'INV-2026-15');
});
