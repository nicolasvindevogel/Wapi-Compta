const {test}=require('node:test');
const assert=require('node:assert/strict');
const doc=require('../js/invoice_document.js');

const cases=[
  ['FR standard','Facture n° F-2026-101\nDate facture : 08/09/2026\nÉchéance : 08/10/2026\nTotal HTVA : 1.000,00 EUR\nTotal TVA : 210,00 EUR\nTotal TVAC : 1.210,00 EUR',{amount:1210,date:'2026-09-08',due_date:'2026-10-08',reference:'F-2026-101',amount_check:'consistent'}],
  ['NL','Factuurnummer: 2026/123\nFactuurdatum 8-9-2026\nVervaldatum 8-10-2026\nTotaal excl. BTW 100,00\nBTW bedrag 21,00\nTotaal incl. BTW 121,00',{amount:121,date:'2026-09-08',due_date:'2026-10-08',reference:'2026/123'}],
  ['EN','Invoice # INV-123\nInvoice date: 2026-09-08\nDue date: 2026-10-08\nInvoice total EUR 1,234.56',{amount:1234.56,date:'2026-09-08',due_date:'2026-10-08'}],
  ['dates spelled','Facture du 8 septembre 2026\nÉchéance 8 octobre 2026\nTotal TTC 121,00',{date:'2026-09-08',due_date:'2026-10-08'}],
  ['columns','Date facture    Échéance\n08/09/2026    08/10/2026\nTotal HTVA    Total TVA    Total TVAC\n100,00    21,00    121,00',{date:'2026-09-08',due_date:'2026-10-08',amount:121,amount_check:'consistent'}],
  ['same row','Date facture 08/09/2026  Échéance 08/10/2026\nTotal HTVA 100,00  Total TVA 21,00  Total TVAC 121,00',{amount:121,date:'2026-09-08',due_date:'2026-10-08'}],
  ['integer','Montant TVAC : 121 EUR',{amount:121}],
  ['integer without currency','Total TTC : 121',{amount:121}],
  ['spaced thousands','Total TVAC : 12\u202f345,67 €',{amount:12345.67}],
  ['deposit','Total TVAC : 121,00\nAcompte payé : 50,00\nSolde à payer : 71,00',{amount:121}],
  ['tax reconstruction','Total HTVA 100,00\nTotal TVA 21,00',{amount:121,amount_check:'calculated'}],
  ['no arbitrary date','Échéance 08/10/2026\nLivraison 08/09/2026',{date:'',due_date:'2026-10-08'}],
  ['delivery date is not invoice date','Date de livraison 08/09/2026\nPayment date 01/10/2026',{date:''}],
  ['consumption is not money','Total consommation 1.234,56 kWh',{amount:''}],
  ['invalid calendar date','Date facture : 31/02/2026',{date:''}],
  ['leap year','Date facture : 29/02/2024',{date:'2024-02-29'}],
  ['non leap year','Date facture : 29/02/2026',{date:''}],
  ['identifiers not totals','IBAN BE12 1234 5678 9012\nTVA BE 0123.456.789\nCommunication +++123/4567/89012+++\nClient 1234567\nDate facture 08.09.2026',{amount:''}],
  ['date after total label','Total TVAC : 08.09.2026',{amount:''}],
  ['rate not amount','Total TVA 21 %\nTotal TVAC 121,00',{amount:121,vat_amount:''}],
  ['mixed VAT','TVA 6 % 6,00\nTVA 21 % 21,00\nTotal HTVA 200,00\nTotal TVA 27,00\nTotal TVAC 227,00',{amount:227,vat_rate:'',vat_amount:27}],
  ['credit retained','Note de crédit\nTotal TVAC -121,00',{amount:-121}],
  ['repeated page total','Total TVAC 121,00\n\f\nTotal TVAC 121,00',{amount:121,amount_check:'detected'}],
  ['conflicting invoices','Total TVAC 121,00\n\f\nTotal TVAC 242,00',{amount_check:'review'}],
  ['arithmetic mismatch','Total HTVA 100,00\nTotal TVA 21,00\nTotal TVAC 150,00',{amount_check:'mismatch'}],
  ['labels on preceding line','Numéro de facture\nF-2026-002\nDate facture\n08/09/2026\nMontant à payer\n121,00 EUR',{reference:'F-2026-002',date:'2026-09-08',amount:121}],
  ['broken PDF labels','N�ro de facture\nPROX-2026-0914\nDate facture 14/09/2026\nTotal TVAC 119,79 EUR',{reference:'PROX-2026-0914',date:'2026-09-14',amount:119.79}],
  ['date and amount glued by PDF stream','Total TVAC 14/09/2026 119,79 EUR',{amount:119.79}],
  ['year is not part of amount','Total TVAC 2026 119,79 EUR',{amount:119.79}],
  ['filename is never invoice number','Date facture 14/09/2026\nTotal TVAC 119,79 EUR',{reference:''}],
];
for(const [name,text,expected] of cases)test(name,()=>{const actual=doc.extract(text);for(const [k,v] of Object.entries(expected))assert.equal(actual[k],v,`${k}: ${JSON.stringify(actual)}`);});
test('inconsistent and ambiguous fields are flagged',()=>{
  assert.match(doc.extract(cases.find(c=>c[0]==='deposit')[1]).ocr_warnings.join(' '),/solde/);
  assert.match(doc.extract('Date facture 01/09/2026\nDate facture 02/09/2026').ocr_warnings.join(' '),/Plusieurs dates/);
  assert.match(doc.extract('Date facture 08/09/2026\nÉchéance 01/09/2026').ocr_warnings.join(' '),/précède/);
});
test('PDF coordinates restore rows from column-oriented text stream',()=>{
  const it=(str,x,y,width=90)=>({str,transform:[10,0,0,10,x,y],width,height:10});
  const items=[it('Date facture',20,700),it('Échéance',20,675),it('Total TVAC',20,650),it('08/09/2026',250,700),it('08/10/2026',250,675),it('121,00 EUR',250,650)];
  const fields=doc.extract(doc.textFromItems(items));
  assert.equal(fields.amount,121);assert.equal(fields.date,'2026-09-08');assert.equal(fields.due_date,'2026-10-08');
});
test('reanalysis updates automatic fields and preserves manual corrections, including cleared fields',()=>{
  const next=doc.mergeAnalysis({amount:100,date:'2026-09-01',reference:'OLD',due_date:'2026-10-01'},
    {amount:123,date:'2026-09-01',reference:'MANUAL',due_date:null,copro_id:'c1',account_id:'a1'},
    {amount:150,date:'2026-09-08',reference:'NEW',due_date:'2026-10-08',account_id:'a2'});
  assert.equal(next.amount,123);assert.equal(next.date,'2026-09-08');assert.equal(next.reference,'MANUAL');assert.equal(next.due_date,null);assert.equal(next.account_id,'a1');
});
