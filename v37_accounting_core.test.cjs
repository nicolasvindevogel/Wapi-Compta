const test = require('node:test');
const assert = require('node:assert/strict');
const { VERSION, pure } = require('../js/v37_accounting_core.js');

test('V37 exposes the expected version', () => {
  assert.equal(VERSION, '37.0.1');
});

test('balanced entry is detected in cents', () => {
  assert.equal(pure.isBalancedLines([
    {debit: 100.01, credit: 0},
    {debit: 0, credit: 100.01}
  ]), true);
  assert.equal(pure.isBalancedLines([
    {debit: 100, credit: 0},
    {debit: 0, credit: 99.99}
  ]), false);
});

test('balance totals keep debit and credit separate', () => {
  const totals = pure.balanceTotals([
    {debit: 150, credit: 25},
    {debit: 10, credit: 135}
  ]);
  assert.equal(totals.debit, 160);
  assert.equal(totals.credit, 160);
  assert.equal(totals.difference, 0);
});

test('report mode is opt-in and defaults to legacy', () => {
  assert.equal(pure.normalizeMode('server'), 'server');
  assert.equal(pure.normalizeMode('anything-else'), 'legacy');
  assert.equal(pure.normalizeMode(null), 'legacy');
});

test('fiscal year selection respects copro and selected year', () => {
  const years = [
    {id:'y1', copro_id:'c1', status:'closed'},
    {id:'y2', copro_id:'c1', status:'open'},
    {id:'y3', copro_id:'c2', status:'open'}
  ];
  assert.equal(pure.pickFiscalYear(years,'c1','y1').id, 'y1');
  assert.equal(pure.pickFiscalYear(years,'c1','').id, 'y2');
  assert.equal(pure.pickFiscalYear(years,'c2','').id, 'y3');
  assert.equal(pure.pickFiscalYear(years,'c9',''), null);
});
