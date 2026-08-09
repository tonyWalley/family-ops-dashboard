(function(){
'use strict';
const KEY='FAMILY_OPS_DASHBOARD_STATE_V1';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=()=>new Date().toISOString();
const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);

function stateNow(){
  let x={};
  try{x=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  x.bankImportBatches=Array.isArray(x.bankImportBatches)?x.bankImportBatches:[];
  x.bankTransactions=Array.isArray(x.bankTransactions)?x.bankTransactions:[];
  x.bankCsvIntake=Array.isArray(x.bankCsvIntake)?x.bankCsvIntake:[];
  return x;
}
function updater(){return $('#updatedBy')?.value.trim()||stateNow().lastUpdatedBy||'Unknown'}
function normHeader(s){return String(s||'').replace(/^\uFEFF/,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function cleanText(v){return String(v??'').replace(/\s+/g,' ').trim()}
function parseAmount(v){
  if(v===null||v===undefined||String(v).trim()==='')return null;
  let s=String(v).trim(),neg=false;
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}
  s=s.replace(/[$,\s]/g,'').replace(/\+/g,'');
  const n=Number(s);if(!Number.isFinite(n))return null;return neg?-Math.abs(n):n;
}
function normalizeDate(v){
  const s=String(v||'').trim();if(!s)return null;
  let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(m){let y=m[3];if(y.length===2)y=(Number(y)>=70?'19':'20')+y;return`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`}
  const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
}
function parseCsv(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else quoted=false}else field+=c;continue}
    if(c==='"'){quoted=true;continue}
    if(c===','){row.push(field);field='';continue}
    if(c==='\n'){row.push(field);rows.push(row);row=[];field='';continue}
    if(c==='\r')continue;
    field+=c;
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  while(rows.length&&rows[0].every(v=>!String(v).trim()))rows.shift();
  if(rows.length<2)throw Error('The CSV does not contain a header and transaction rows.');
  const headers=rows.shift().map(h=>String(h||'').replace(/^\uFEFF/,'').trim());
  return{headers,records:rows.filter(r=>r.some(v=>String(v).trim())).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]??'');return o})};
}
function fieldMap(row){const map={};Object.keys(row).forEach(k=>map[normHeader(k)]=k);return map}
function pick(row,map,aliases){for(const a of aliases){const k=map[normHeader(a)];if(k!==undefined&&String(row[k]??'').trim()!=='')return row[k]}return''}
function nonEmptyFields(row){const out={};Object.entries(row).forEach(([k,v])=>{const s=String(v??'').trim();if(s!=='')out[k]=s});return out}
function sourceDefaults(source){
  if(source==='USAA')return{account:'Primary Checking'};
  if(source==='Chase')return{account:'ARRT Ventures Business Checking'};
  return{account:'PayPal'};
}
function normalizeRecord(source,account,row){
  const map=fieldMap(row);
  let posted='',trans='',description='',original='',sourceType='',sourceCategory='',status='',currency='',amount=null,sourceId='',referenceId='',balance=null,fee=null;
  if(source==='PayPal'){
    posted=pick(row,map,['Date','Completed Date']);trans=posted;
    description=pick(row,map,['Name','Item Title','Description']);original=pick(row,map,['Item Title','Subject','Note']);
    sourceType=pick(row,map,['Type']);sourceCategory=pick(row,map,['Item Title']);status=pick(row,map,['Status']);currency=pick(row,map,['Currency'])||'USD';
    amount=parseAmount(pick(row,map,['Net','Amount','Gross']));fee=parseAmount(pick(row,map,['Fee']));balance=parseAmount(pick(row,map,['Balance']));
    sourceId=pick(row,map,['Transaction ID','Transaction Id']);referenceId=pick(row,map,['Reference Txn ID','Reference Transaction ID']);
  }else if(source==='Chase'){
    posted=pick(row,map,['Posting Date','Post Date','Posted Date','Date']);trans=pick(row,map,['Transaction Date','Date'])||posted;
    description=pick(row,map,['Description','Merchant','Name']);original=pick(row,map,['Memo','Details','Original Description']);
    sourceType=pick(row,map,['Type','Details']);sourceCategory=pick(row,map,['Category']);status=pick(row,map,['Status']);currency='USD';
    amount=parseAmount(pick(row,map,['Amount']));if(amount===null){const debit=parseAmount(pick(row,map,['Debit'])),credit=parseAmount(pick(row,map,['Credit']));if(debit!==null)amount=-Math.abs(debit);else if(credit!==null)amount=Math.abs(credit)}
    balance=parseAmount(pick(row,map,['Balance']));sourceId=pick(row,map,['Transaction ID','Check or Slip #','Check or Slip Number']);
  }else{
    posted=pick(row,map,['Date','Posting Date','Post Date','Posted Date']);trans=pick(row,map,['Transaction Date','Date'])||posted;
    description=pick(row,map,['Description','Merchant','Name']);original=pick(row,map,['Original Description','Memo','Details']);
    sourceType=pick(row,map,['Type','Transaction Type']);sourceCategory=pick(row,map,['Category']);status=pick(row,map,['Status']);currency=pick(row,map,['Currency'])||'USD';
    amount=parseAmount(pick(row,map,['Amount']));if(amount===null){const debit=parseAmount(pick(row,map,['Debit'])),credit=parseAmount(pick(row,map,['Credit']));if(debit!==null)amount=-Math.abs(debit);else if(credit!==null)amount=Math.abs(credit)}
    balance=parseAmount(pick(row,map,['Balance']));sourceId=pick(row,map,['Transaction ID','Reference Number','Confirmation Number']);
  }
  const postedDate=normalizeDate(posted),transactionDate=normalizeDate(trans)||postedDate;
  if(amount===null)throw Error('Could not identify an amount column.');
  if(!postedDate&&!transactionDate)throw Error('Could not identify a transaction date column.');
  description=cleanText(description||original||sourceType||'Unknown transaction');original=cleanText(original);
  return{source,account,postedDate:postedDate||transactionDate,transactionDate:transactionDate||postedDate,description,originalDescription:original||null,amount,direction:amount<0?'debit':amount>0?'credit':'zero',currency:currency||'USD',sourceType:cleanText(sourceType)||null,sourceCategory:cleanText(sourceCategory)||null,status:cleanText(status)||null,sourceTransactionId:cleanText(sourceId)||null,referenceTransactionId:cleanText(referenceId)||null,balance,fee,sourceFields:nonEmptyFields(row)};
}
function hash32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
function fingerprintBase(t){return hash32([t.source,t.account,t.postedDate,t.transactionDate,t.amount.toFixed(2),cleanText(t.description).toLowerCase(),t.sourceType||'',t.sourceTransactionId||''].join('|'))}
function transactionKey(t){return t.fingerprint}
function reviewCounts(state,batchId){const tx=(state.bankTransactions||[]).filter(t=>t.importBatchId===batchId),pending=tx.filter(t=>t.reviewStatus==='needs_review').length,reviewed=tx.filter(t=>t.reviewStatus==='reviewed').length;return{count:tx.length,pending,reviewed}}
function humanDate(s){if(!s)return'';const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleString()}
function renderBatches(){
  const box=$('#bankImportBatchList');if(!box)return;const state=stateNow(),batches=(state.bankImportBatches||[]).slice().sort((a,b)=>String(b.importedAt).localeCompare(String(a.importedAt)));
  box.innerHTML=batches.map(b=>{const c=reviewCounts(state,b.id),sample=(state.bankTransactions||[]).filter(t=>t.importBatchId===b.id).slice(0,5);return`<details class="csv-item bank-batch"><summary><span class="tag ${c.pending?'conditional':'paid'}">${c.pending?'NEEDS REVIEW':'REVIEWED'}</span> <strong>${esc(b.source)} · ${esc(b.account)}</strong> <span class="small">${esc(b.fileName)} · ${b.newTransactions} new · ${b.duplicatesSkipped} duplicate${b.duplicatesSkipped===1?'':'s'} skipped</span></summary><div class="batch-body"><div class="small">Imported ${esc(humanDate(b.importedAt))} by ${esc(b.importedBy)} · ${esc(b.periodStart||'?')} to ${esc(b.periodEnd||'?')} · ${c.pending} pending / ${c.reviewed} reviewed</div><div class="batch-sample">${sample.map(t=>`<div><span>${esc(t.postedDate)}</span> <strong>${esc(t.description)}</strong> <span>${t.amount<0?'-':'+'}$${Math.abs(t.amount).toFixed(2)}</span></div>`).join('')}</div><div class="actions"><button class="btn danger remove-json-batch" data-id="${esc(b.id)}">Remove batch</button></div></div></details>`}).join('')||'<p class="small">No normalized bank batches are in the current JSON yet.</p>';
  box.querySelectorAll('.remove-json-batch').forEach(btn=>btn.onclick=e=>{e.preventDefault();removeBatch(btn.dataset.id)});
  const legacy=$('#legacyCsvNotice');if(legacy){const n=(state.bankCsvIntake||[]).length;legacy.textContent=n?`${n} legacy staged CSV metadata record${n===1?'':'s'} exist from the prior collection-only version. Re-import the original CSV files here to put transaction data into JSON.`:'';legacy.style.display=n?'block':'none'}
}
async function importFilesToJson(){
  const source=$('#bankCsvSource')?.value||'USAA',input=$('#bankCsvFile'),files=[...(input?.files||[])];if(!files.length)return alert('Choose at least one CSV file.');
  let state=stateNow();const account=cleanText($('#bankCsvAccount')?.value)||sourceDefaults(source).account,existing=new Set((state.bankTransactions||[]).map(transactionKey));let totalNew=0,totalDup=0,totalErrors=[];
  for(const file of files){
    try{
      const parsed=parseCsv(await file.text()),occurrences={},normalized=[];let skippedInvalid=0;
      for(const row of parsed.records){
        try{const t=normalizeRecord(source,account,row),base=fingerprintBase(t),occ=(occurrences[base]=(occurrences[base]||0)+1),fingerprint=`${source.toLowerCase()}_${base}_${occ}`;t.fingerprint=fingerprint;if(existing.has(fingerprint)){totalDup++;continue}existing.add(fingerprint);normalized.push(t)}catch(e){skippedInvalid++}
      }
      if(!normalized.length&&parsed.records.length)throw Error('No transaction rows could be normalized. Check that the correct bank source is selected.');
      const batchId=uid('batch'),dates=normalized.map(t=>t.postedDate).filter(Boolean).sort(),batch={id:batchId,source,account,fileName:file.name,fileSize:file.size,importedAt:iso(),importedBy:updater(),rowCount:parsed.records.length,newTransactions:normalized.length,duplicatesSkipped:parsed.records.length-normalized.length-skippedInvalid,invalidRowsSkipped:skippedInvalid,periodStart:dates[0]||null,periodEnd:dates[dates.length-1]||null,reviewStatus:'needs_review',schema:'wfos-bank-transaction-v1'};
      normalized.forEach(t=>state.bankTransactions.push({id:uid('banktx'),importBatchId:batchId,...t,reviewStatus:'needs_review',wfosCategory:null,subcategory:null,treatment:null,confidence:null,isTransfer:null,isBusiness:null,isRecurring:null,isDuplicate:false,duplicateOf:null,notes:'',reviewedBy:null,reviewedAt:null}));state.bankImportBatches.push(batch);totalNew+=normalized.length;totalDup+=batch.duplicatesSkipped;
    }catch(e){totalErrors.push(`${file.name}: ${e.message}`)}
  }
  state.revision=Number(state.revision||0)+1;state.lastUpdated=iso();state.lastUpdatedBy=updater();localStorage.setItem(KEY,JSON.stringify(state));if(input)input.value='';
  const msg=[`Imported ${totalNew} new bank transactions into the private JSON.`,`${totalDup} previously imported/duplicate rows were skipped.`,totalErrors.length?`Problems: ${totalErrors.join(' | ')}`:'','Nothing was added to the Cash Plan or budgets. The transactions remain needs_review until ChatGPT reviews them.'].filter(Boolean).join('\n\n');alert(msg);location.reload();
}
function removeBatch(id){
  if(!confirm('Remove this import batch and its normalized bank transactions from the JSON?'))return;const state=stateNow(),before=(state.bankTransactions||[]).length;state.bankTransactions=(state.bankTransactions||[]).filter(t=>t.importBatchId!==id);state.bankImportBatches=(state.bankImportBatches||[]).filter(b=>b.id!==id);state.revision=Number(state.revision||0)+1;state.lastUpdated=iso();state.lastUpdatedBy=updater();localStorage.setItem(KEY,JSON.stringify(state));alert(`Removed ${before-state.bankTransactions.length} normalized bank transactions.`);location.reload();
}
function prepareUi(){
  const oldStage=$('#stageBankCsvBtn');if(oldStage){const fresh=oldStage.cloneNode(true);fresh.textContent='Import CSV into JSON';oldStage.replaceWith(fresh);fresh.onclick=importFilesToJson}
  const oldShare=$('#shareAllCsvBtn');if(oldShare)oldShare.remove();
  const source=$('#bankCsvSource'),account=$('#bankCsvAccount');if(source&&account){source.onchange=()=>{account.value=sourceDefaults(source.value).account}}
  renderBatches();
  const hidden=$('#bankCsvList');if(hidden)hidden.style.display='none';
  if(hidden)new MutationObserver(()=>renderBatches()).observe(hidden,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepareUi);else prepareUi();
})();
