(function(){
'use strict';
const KEY='FAMILY_OPS_DASHBOARD_STATE_V1', $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o)), embedded=JSON.parse($('#embedded-state').textContent);
let state=load(), dirty=false, timer;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Number(x.revision)>=Number(embedded.revision))return normalizeState(x)}catch(e){}return normalizeState(clone(embedded))}
function normalizeState(x){x=x||{};x.settings=x.settings||{};x.tasks=Array.isArray(x.tasks)?x.tasks:[];x.transactions=Array.isArray(x.transactions)?x.transactions:[];x.unknowns=Array.isArray(x.unknowns)?x.unknowns:[];x.notes=Array.isArray(x.notes)?x.notes:[];x.budgets=Array.isArray(x.budgets)?x.budgets:[];x.tasks.forEach(t=>{if(t.notes===undefined||t.notes===null)t.notes=''});if((x.settings.currentAccessibleCash===undefined||x.settings.currentAccessibleCash===null)&&x.settings.currentCashBreakdown&&x.settings.currentCashBreakdown.total!==undefined)x.settings.currentAccessibleCash=Number(x.settings.currentCashBreakdown.total||0);return x}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const cap=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
const iso=()=>new Date().toISOString();
const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
function dateLabel(s){if(!s)return'';return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function owners(){const explicit=state.ownerNames||{};const found=[];[...(state.tasks||[]),...(state.transactions||[])].forEach(x=>{const o=x.owner;if(o&&o!=='Joint'&&!found.includes(o)&&o!=='ARRT Ventures')found.push(o)});return[explicit.primary||found[0]||'Tony',explicit.secondary||found[1]||'Rachel']}
function amt(t){return t.actualAmount!==null&&t.actualAmount!==''&&!Number.isNaN(Number(t.actualAmount))?Number(t.actualAmount):Number(t.amount||0)}
function txDate(t){return t.forecastDate||t.date}
function included(t,mode){if(t.id==='open')return true;return !!t[mode==='downside'?'includeDownside':mode==='recovery'?'includeRecovery':'includeBase']}
function rollingMode(){return state.settings&&state.settings.currentAccessibleCash!==null&&state.settings.currentAccessibleCash!==undefined&&!Number.isNaN(Number(state.settings.currentAccessibleCash))}
function currentCash(){return rollingMode()?Number(state.settings.currentAccessibleCash||0):Number(state.settings?.openingBalance||0)}
function currentAsOf(){return state.settings?.currentCashBreakdown?.asOf||state.settings?.asOfDate||new Date().toISOString().slice(0,10)}
function probableIncoming(days=7){if(!rollingMode())return 0;const start=new Date(currentAsOf()+'T12:00:00'),end=new Date(start);end.setDate(end.getDate()+days);return (state.transactions||[]).filter(t=>t.id!=='open'&&t.kind==='income'&&t.paymentStatus!=='paid'&&t.cashStatus==='probable').filter(t=>{const d=new Date(txDate(t)+'T12:00:00');return d>=start&&d<=end}).reduce((s,t)=>s+amt(t),0)}
function calc(mode=state.settings.forecastMode){
  if(!rollingMode()){
    let bal=0,low=Infinity,lowDate='';
    const rows=(state.transactions||[]).filter(t=>included(t,mode)).slice().sort((a,b)=>txDate(a).localeCompare(txDate(b))||(a.kind==='income'?-1:1));
    const out=[];
    rows.forEach(t=>{const change=t.id==='open'?amt(t):(t.kind==='income'?amt(t):-amt(t));bal=t.id==='open'?amt(t):bal+change;if(bal<low){low=bal;lowDate=txDate(t)}out.push({t,change,balance:bal})});
    if(low===Infinity){low=0;lowDate=''}
    return{rows:out,low,lowDate,end:bal,start:Number(state.settings?.openingBalance||0),asOf:state.period?.start||''};
  }
  const asOf=currentAsOf(),start=currentCash();
  let bal=start,low=start,lowDate=asOf;
  const rows=(state.transactions||[]).filter(t=>t.id!=='open'&&t.paymentStatus!=='paid'&&included(t,mode)&&txDate(t)>=asOf).slice().sort((a,b)=>txDate(a).localeCompare(txDate(b))||(a.kind==='income'?-1:1));
  const out=[];
  rows.forEach(t=>{const change=t.kind==='income'?amt(t):-amt(t);bal+=change;if(bal<low){low=bal;lowDate=txDate(t)}out.push({t,change,balance:bal})});
  return{rows:out,low,lowDate,end:bal,start,asOf};
}
function mark(){dirty=true;$('#saveStatus').textContent='Unsaved local changes';clearTimeout(timer);timer=setTimeout(()=>save(false),500)}
function touch(){state.revision=Number(state.revision||0)+1;state.lastUpdated=iso();state.lastUpdatedBy=$('#updatedBy').value.trim()||state.lastUpdatedBy||'Unknown'}
function syncSettings(){state.settings=state.settings||{};state.settings.currentAccessibleCash=Number($('#currentCash').value||0);state.settings.cashFloor=Number($('#cashFloor').value||0);state.settings.forecastMode=$('#forecastMode').value;state.lastUpdatedBy=$('#updatedBy').value.trim()||state.lastUpdatedBy;if(state.settings.currentCashBreakdown)state.settings.currentCashBreakdown.total=state.settings.currentAccessibleCash}
function save(increment=true){syncSettings();if(increment)touch();localStorage.setItem(KEY,JSON.stringify(state));dirty=false;renderStatus();if(increment)renderAll()}
function renderStatus(){const d=new Date(state.lastUpdated||Date.now());$('#saveStatus').textContent='Saved on this device';$('#revisionStatus').textContent='Revision '+Number(state.revision||0);$('#updatedStatus').textContent='Updated '+d.toLocaleString();$('#modeStatus').textContent=cap(state.settings.forecastMode)+' forecast'}
function renderSettings(){$('#currentCash').value=currentCash();$('#cashFloor').value=Number(state.settings.cashFloor||0);$('#forecastMode').value=state.settings.forecastMode||'base';$('#updatedBy').value=state.lastUpdatedBy==='Not set'?'':state.lastUpdatedBy||''}
function renderOverview(){
  const c=calc(),floor=Number(state.settings.cashFloor||0),done=(state.tasks||[]).filter(t=>t.done).length,btotal=(state.budgets||[]).reduce((s,b)=>s+Number(b.amount||0),0),prob=probableIncoming(7);
  const cashSub=rollingMode()?`USAA + protected Chase/ARRT + cash${prob?` | Probable next 7 days: ${money(prob)}`:''}`:'Legacy period starting balance';
  $('#kpis').innerHTML=`<div class="card"><div class="label">Current accessible cash</div><div class="value">${money(c.start)}</div><div class="small">${cashSub}</div></div><div class="card"><div class="label">Lowest projected cash</div><div class="value ${c.low<floor?'dangertext':'goodtext'}">${money(c.low)}</div><div class="small">${dateLabel(c.lowDate)} in ${cap(state.settings.forecastMode)} mode</div></div><div class="card"><div class="label">End-of-period cash</div><div class="value">${money(c.end)}</div><div class="small">Before unmodeled items</div></div><div class="card"><div class="label">Task progress</div><div class="value">${done}/${(state.tasks||[]).length}</div><div class="small">Household budget ${money(btotal)}</div></div>`;
  $('#warningBox').innerHTML=c.low<floor?`<div class="callout danger"><strong>Cash-floor warning:</strong> The forecast reaches ${money(c.low)} on ${dateLabel(c.lowDate)}, below the ${money(floor)} floor.</div>`:`<div class="callout good"><strong>Forecast check:</strong> The selected plan remains above the ${money(floor)} cash floor. Probable income is shown separately unless included in the selected scenario.</div>`;
  const upcoming=(state.transactions||[]).filter(t=>t.id!=='open'&&t.paymentStatus!=='paid'&&included(t,state.settings.forecastMode)&&(!rollingMode()||txDate(t)>=currentAsOf())).sort((a,b)=>txDate(a).localeCompare(txDate(b))).slice(0,8);
  $('#next7').innerHTML=upcoming.map(t=>`<div class="task compact-task"><span class="tag ${esc(t.paymentStatus)}">${esc(t.paymentStatus)}</span><div><strong>${dateLabel(txDate(t))} - ${esc(t.name)}</strong><div class="small">${esc(t.owner)} | ${money(amt(t))}</div></div><span></span></div>`).join('')||'<p>No upcoming items. Import the private JSON to load the plan.</p>';
  $('#openItems').innerHTML=(state.unknowns||[]).slice(0,8).map(u=>`<div class="task compact-task"><span class="tag unknown">OPEN</span><div><strong>${esc(u.item)} - ${esc(u.amount)}</strong><div class="small">${esc(u.owner)}: ${esc(u.action)}</div></div><span></span></div>`).join('')||'<p>No unconfirmed items recorded.</p>';
}
function calendarEvent(t){return`<div class="event ${t.paymentStatus==='paid'?'paid':t.paymentStatus==='conditional'?'conditional':t.paymentStatus==='hold'?'hold':t.kind}" data-tx="${esc(t.id)}"><span>${esc(t.name)}</span> <strong>${t.kind==='income'?'+':'-'}${money(amt(t))}</strong></div>`}
function bindCalendarJumps(root){root.querySelectorAll('[data-tx]').forEach(e=>e.onclick=()=>{tab('cashplan');setTimeout(()=>document.querySelector(`[data-row="${CSS.escape(e.dataset.tx)}"],[data-card="${CSS.escape(e.dataset.tx)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),50)})}
function renderCalendar(){
  const desktop=$('#calendarGrid'),agenda=$('#calendarAgenda'),start=new Date((state.period?.start||new Date().toISOString().slice(0,7)+'-01')+'T12:00:00'),y=start.getFullYear(),m=start.getMonth(),first=new Date(y,m,1),offset=first.getDay(),cells=Math.ceil((offset+new Date(y,m+1,0).getDate())/7)*7,c=calc(),cash={};
  c.rows.forEach(r=>cash[txDate(r.t)]=r.balance);
  let h=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="calhead">${x}</div>`).join('');
  for(let i=0;i<cells;i++){
    const d=new Date(y,m,1-offset+i),ds=d.toISOString().slice(0,10),outside=d.getMonth()!==m;
    let ev=(state.transactions||[]).filter(t=>t.id!=='open'&&txDate(t)===ds).map(calendarEvent).join('');
    if(cash[ds]!==undefined)ev+=`<div class="event cash">After day: ${money(cash[ds])} available</div>`;
    h+=`<div class="calday ${outside?'outside':''}"><div class="daynum">${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>${ev}</div>`;
  }
  desktop.innerHTML=h;
  let a='';
  const days=new Date(y,m+1,0).getDate();
  for(let day=1;day<=days;day++){
    const d=new Date(y,m,day),ds=d.toISOString().slice(0,10),items=(state.transactions||[]).filter(t=>t.id!=='open'&&txDate(t)===ds);
    if(!items.length&&cash[ds]===undefined)continue;
    a+=`<div class="agenda-day"><div class="agenda-date"><strong>${d.toLocaleDateString('en-US',{weekday:'short'})}</strong><span>${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div><div class="agenda-events">${items.map(calendarEvent).join('')}${cash[ds]!==undefined?`<div class="agenda-cash">After day <strong>${money(cash[ds])}</strong> available</div>`:''}</div></div>`;
  }
  agenda.innerHTML=a||'<p class="small">No calendar activity for this period.</p>';
  bindCalendarJumps(desktop);bindCalendarJumps(agenda);
}
function txItems(){return (state.transactions||[]).filter(t=>t.id!=='open')}
function bindTxEditors(root){root.querySelectorAll('[data-f]').forEach(el=>el.onchange=e=>{const t=state.transactions.find(x=>x.id===e.target.dataset.id),f=e.target.dataset.f;if(!t||!f)return;t[f]=e.target.type==='checkbox'?e.target.checked:['amount','actualAmount'].includes(f)?(e.target.value===''?null:Number(e.target.value)):e.target.value;if(f==='paymentStatus'&&t[f]==='paid'&&t.actualAmount===null)t.actualAmount=t.amount;mark();renderOverview();renderCalendar();renderRunning();if(root.id==='cashCards')renderCashCards()})}
function renderCashCards(){
  const box=$('#cashCards'),[a,b]=owners(),opts=[a,b,'Joint'],statuses=['authorized','conditional','hold','planned','unknown','paid'];
  box.innerHTML=txItems().slice().sort((a,b)=>txDate(a).localeCompare(txDate(b))).map(t=>`<article class="cashcard" data-card="${esc(t.id)}"><div class="cashcard-top"><div><div class="cashcard-date">${dateLabel(txDate(t))}</div><strong>${esc(t.name)}</strong><div class="small">${esc(t.owner)}${t.forecastDate&&t.forecastDate!==t.date?` | due ${dateLabel(t.date)}`:''}</div></div><div class="cashcard-amount ${t.kind==='income'?'money-positive':'money-negative'}">${t.kind==='income'?'+':'-'}${money(amt(t))}</div></div><div class="cashcard-actions"><span class="tag ${esc(t.paymentStatus)}">${cap(t.paymentStatus)}</span>${t.paymentStatus!=='paid'?`<button class="btn good markpaid" data-id="${esc(t.id)}">Mark paid</button>`:''}</div><details><summary>Details / edit</summary><div class="cashcard-fields"><label>Date<input type="date" data-f="date" data-id="${esc(t.id)}" value="${esc(t.date)}"></label><label>Owner<select data-f="owner" data-id="${esc(t.id)}">${opts.map(x=>`<option ${t.owner===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Status<select data-f="paymentStatus" data-id="${esc(t.id)}">${statuses.map(x=>`<option value="${x}" ${t.paymentStatus===x?'selected':''}>${cap(x)}</option>`).join('')}</select></label><label>Planned<input type="number" step="0.01" data-f="amount" data-id="${esc(t.id)}" value="${Number(t.amount||0).toFixed(2)}"></label><label>Actual<input type="number" step="0.01" data-f="actualAmount" data-id="${esc(t.id)}" value="${t.actualAmount===null?'':Number(t.actualAmount).toFixed(2)}"></label><label class="cashcard-notes">Notes<input data-f="notes" data-id="${esc(t.id)}" value="${esc(t.notes||'')}"></label></div><div class="scenario-row"><label><input type="checkbox" data-f="includeBase" data-id="${esc(t.id)}" ${t.includeBase?'checked':''}> Base</label><label><input type="checkbox" data-f="includeDownside" data-id="${esc(t.id)}" ${t.includeDownside?'checked':''}> Downside</label><label><input type="checkbox" data-f="includeRecovery" data-id="${esc(t.id)}" ${t.includeRecovery?'checked':''}> Recovery</label></div></details></article>`).join('')||'<p>No cash-plan items.</p>';
  bindTxEditors(box);
  box.querySelectorAll('.markpaid').forEach(btn=>btn.onclick=()=>{const t=state.transactions.find(x=>x.id===btn.dataset.id);if(!t)return;t.paymentStatus='paid';if(t.actualAmount===null)t.actualAmount=t.amount;mark();renderAll()});
}
function renderTransactions(){
  const [a,b]=owners(),opts=[a,b,'Joint'],statuses=['authorized','conditional','hold','planned','unknown','paid'],items=txItems();
  $('#txBody').innerHTML=items.map(t=>`<tr data-row="${esc(t.id)}"><td><input type="date" data-f="date" data-id="${esc(t.id)}" value="${esc(t.date)}"></td><td><input data-f="name" data-id="${esc(t.id)}" value="${esc(t.name)}"></td><td><select data-f="owner" data-id="${esc(t.id)}">${opts.map(x=>`<option ${t.owner===x?'selected':''}>${esc(x)}</option>`).join('')}</select></td><td><select data-f="kind" data-id="${esc(t.id)}"><option value="expense" ${t.kind==='expense'?'selected':''}>Expense</option><option value="income" ${t.kind==='income'?'selected':''}>Income</option></select></td><td><select data-f="paymentStatus" data-id="${esc(t.id)}">${statuses.map(x=>`<option value="${x}" ${t.paymentStatus===x?'selected':''}>${cap(x)}</option>`).join('')}</select></td><td><input class="num" type="number" step="0.01" data-f="amount" data-id="${esc(t.id)}" value="${Number(t.amount||0).toFixed(2)}"></td><td><input class="num" type="number" step="0.01" data-f="actualAmount" data-id="${esc(t.id)}" value="${t.actualAmount===null?'':Number(t.actualAmount).toFixed(2)}"></td>${['includeBase','includeDownside','includeRecovery'].map(f=>`<td><input type="checkbox" data-f="${f}" data-id="${esc(t.id)}" ${t[f]?'checked':''}></td>`).join('')}<td><input data-f="notes" data-id="${esc(t.id)}" value="${esc(t.notes||'')}"></td><td><button class="btn danger deltx" data-id="${esc(t.id)}">x</button></td></tr>`).join('');
  bindTxEditors($('#txBody'));
  $('#txBody').querySelectorAll('.deltx').forEach(x=>x.onclick=()=>{if(confirm('Delete this cash-plan item?')){state.transactions=state.transactions.filter(t=>t.id!==x.dataset.id);mark();renderAll()}});
  renderCashCards();
}
function renderRunning(){$('#runningBody').innerHTML=calc().rows.map(r=>`<tr><td>${dateLabel(txDate(r.t))}</td><td>${esc(r.t.name)}</td><td><span class="tag ${esc(r.t.paymentStatus)}">${esc(r.t.paymentStatus)}</span></td><td class="num ${r.change>=0?'money-positive':'money-negative'}">${r.change>=0?'+':''}${money(r.change)}</td><td class="num">${money(r.balance)}</td></tr>`).join('')||`<tr><td>${dateLabel(currentAsOf())}</td><td>Current accessible cash</td><td><span class="tag paid">Current</span></td><td class="num">-</td><td class="num">${money(currentCash())}</td></tr>`}
function renderBudgets(){$('#budgetRows').innerHTML=(state.budgets||[]).map(b=>{const rem=Number(b.amount||0)-Number(b.spent||0);return`<div class="budgetrow" data-budget="${esc(b.id)}"><div class="wide"><strong>${esc(b.name)}</strong><div class="small">${esc(b.note||'')}</div></div><div class="field"><label>Budget</label><input type="number" step="0.01" data-bf="amount" value="${Number(b.amount||0).toFixed(2)}"></div><div class="field"><label>Spent</label><input type="number" step="0.01" data-bf="spent" value="${Number(b.spent||0).toFixed(2)}"></div><div><strong class="${rem<0?'dangertext':'goodtext'}">${money(rem)} remaining</strong></div></div>`}).join('')||'<p>No budgets loaded.</p>';$('#budgetRows').querySelectorAll('input').forEach(el=>el.onchange=e=>{const row=e.target.closest('[data-budget]'),b=state.budgets.find(x=>x.id===row.dataset.budget);b[e.target.dataset.bf]=Number(e.target.value||0);mark();renderBudgets();renderOverview()})}
function renderTasks(){
  const [a,b]=owners();
  $('#owner1Tab').textContent=a;$('#owner2Tab').textContent=b;$('#owner1Title').textContent=a+"'s To-Do List";$('#owner2Title').textContent=b+"'s To-Do List";
  renderTaskOwner(a,'#owner1Tasks','#owner1Progress','#owner1ProgressText');
  renderTaskOwner(b,'#owner2Tasks','#owner2Progress','#owner2ProgressText');
}
function renderTaskOwner(owner,sel,progressSel,textSel){
  const list=(state.tasks||[]).filter(t=>t.owner===owner),done=list.filter(t=>t.done).length,total=list.length,p=total?Math.round(done/total*100):0,box=$(sel);
  $(progressSel).style.width=p+'%';$(textSel).textContent=`${done} of ${total} tasks complete (${p}%)`;
  box.innerHTML=list.map(t=>`<div class="task task-with-note ${t.done?'done':''}" data-task="${esc(t.id)}"><input class="task-check" type="checkbox" ${t.done?'checked':''}><div class="taskbody"><div class="tasktext">${esc(t.text)}</div><label class="task-note-label">Notes / update<textarea class="task-note" placeholder="Add details, outcome, phone call notes, confirmation number, or next step...">${esc(t.notes||'')}</textarea></label></div><button class="task-delete" title="Delete task">x</button></div>`).join('')||'<p class="small">No tasks.</p>';
  box.querySelectorAll('.task').forEach(row=>{
    const task=()=>state.tasks.find(x=>x.id===row.dataset.task);
    row.querySelector('.task-check').onchange=e=>{const t=task();if(!t)return;t.done=e.target.checked;mark();renderTasks();renderOverview()};
    row.querySelector('.task-note').oninput=e=>{const t=task();if(!t)return;t.notes=e.target.value;mark()};
    row.querySelector('.task-delete').onclick=()=>{if(confirm('Delete this task?')){state.tasks=state.tasks.filter(x=>x.id!==row.dataset.task);mark();renderTasks();renderOverview()}};
  });
}
function renderNotes(){$('#notesList').innerHTML=(state.notes||[]).slice().sort((a,b)=>String(b.time).localeCompare(String(a.time))).map(n=>`<div class="noteitem"><strong>${esc(n.author)}</strong> <span class="small">${new Date(n.time).toLocaleString()}</span><div>${esc(n.text)}</div></div>`).join('')||'<p>No updates yet.</p>'}
function renderUnknowns(){$('#unknownBody').innerHTML=(state.unknowns||[]).map(u=>`<tr><td>${esc(u.item)}</td><td>${esc(u.amount)}</td><td>${esc(u.owner)}</td><td>${esc(u.action)}</td></tr>`).join('')}
function renderAll(){renderSettings();renderOverview();renderCalendar();renderTransactions();renderRunning();renderBudgets();renderTasks();renderNotes();renderUnknowns();renderStatus()}
function addTx(){const d=prompt('Date (YYYY-MM-DD)',new Date().toISOString().slice(0,10)),name=d&&prompt('Item name');if(!name)return;const amount=Number(prompt('Amount','0')||0),[o]=owners();state.transactions.push({id:uid('tx'),date:d,name,owner:o,category:'Other',kind:'expense',amount,actualAmount:null,cashStatus:'',paymentStatus:'unknown',includeBase:true,includeDownside:true,includeRecovery:true,autopay:false,notes:''});mark();renderAll()}
function addTask(owner){const text=prompt(`New task for ${owner}`);if(!text)return;const notes=prompt('Optional notes / details','')||'';state.tasks=state.tasks||[];state.tasks.push({id:uid('task'),owner,text,notes,done:false});mark();renderTasks();renderOverview()}
function addNote(){const text=$('#noteText').value.trim();if(!text)return;state.notes=state.notes||[];state.notes.push({id:uid('note'),time:iso(),author:$('#noteAuthor').value.trim()||state.lastUpdatedBy||'Unknown',text});$('#noteText').value='';mark();renderNotes()}
function blobDownload(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function exportState(share=false){touch();localStorage.setItem(KEY,JSON.stringify(state));renderAll();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),file=new File([blob],'WFOS_CURRENT_STATE.json',{type:'application/json'});if(share&&navigator.share&&navigator.canShare?.({files:[file]})){navigator.share({title:'Family Ops Current State',files:[file]}).catch(()=>{});return}blobDownload(blob,'WFOS_CURRENT_STATE.json')}
async function shareStateText(){
  touch();localStorage.setItem(KEY,JSON.stringify(state));renderAll();
  const text=JSON.stringify(state,null,2);
  if(navigator.share){
    try{await navigator.share({title:'Family Ops Current State',text});return}catch(e){if(e&&e.name==='AbortError')return}
  }
  try{await navigator.clipboard.writeText(text);alert('JSON copied as text. Paste it into Messages.')}catch(e){alert('Could not open text sharing. Use Download JSON or copy the JSON from another device.')}
}
function cleanJsonText(text){return String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim()}
function acceptImportedState(x,sourceLabel){if(!x||!x.schemaVersion||!Array.isArray(x.transactions))throw Error('Not a compatible Family Ops state');x=normalizeState(x);const l=Number(state.revision||0),n=Number(x.revision||0);if(n<=l&&!confirm(`${sourceLabel} is revision ${n}; this device has revision ${l}. Replace local state?`))return false;state=x;localStorage.setItem(KEY,JSON.stringify(state));dirty=false;renderAll();alert(`Imported revision ${state.revision||0}.`);return true}
function importText(raw,sourceLabel='Pasted JSON'){try{const cleaned=cleanJsonText(raw);if(!cleaned)throw Error('Nothing was pasted');const x=JSON.parse(cleaned);return acceptImportedState(x,sourceLabel)}catch(e){alert('Could not import: '+e.message);return false}}
function importState(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);acceptImportedState(x,'Incoming file')}catch(e){alert('Could not import: '+e.message)}};r.readAsText(file)}
function summary(){const c=calc(),[a,b]=owners(),items=(state.transactions||[]).filter(t=>t.id!=='open'&&t.paymentStatus!=='paid'&&included(t,state.settings.forecastMode)&&(!rollingMode()||txDate(t)>=currentAsOf())).sort((x,y)=>txDate(x).localeCompare(txDate(y))).slice(0,18),tasks=o=>(state.tasks||[]).filter(t=>t.owner===o&&!t.done).slice(0,12),taskList=o=>tasks(o).map(t=>`<li><strong>${esc(t.text)}</strong>${t.notes?`<div><em>Note:</em> ${esc(t.notes)}</div>`:''}</li>`).join('')||'<li>No open tasks.</li>';return`<h1>Family Operations Update</h1><p><strong>Updated:</strong> ${new Date(state.lastUpdated).toLocaleString()} by ${esc(state.lastUpdatedBy)}</p><h2>Cash Outlook</h2><ul><li>Current accessible cash: <strong>${money(c.start)}</strong></li>${probableIncoming(7)?`<li>Probable incoming next 7 days: <strong>${money(probableIncoming(7))}</strong></li>`:''}<li>Low point: <strong>${money(c.low)}</strong> on ${dateLabel(c.lowDate)}</li><li>End cash: <strong>${money(c.end)}</strong></li></ul><h2>Upcoming Items</h2><ul>${items.map(t=>`<li>${dateLabel(txDate(t))}: <strong>${esc(t.name)}</strong> ${t.kind==='income'?'+':'-'}${money(amt(t))}</li>`).join('')}</ul><h2>${esc(a)}</h2><ul>${taskList(a)}</ul><h2>${esc(b)}</h2><ul>${taskList(b)}</ul>`}
function showSummary(){$('#summaryContent').innerHTML=summary();$('#summaryModal').classList.remove('hidden')}
async function copySummary(rich){const html=summary(),div=document.createElement('div');div.innerHTML=html;const text=div.innerText;try{if(rich&&window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);else await navigator.clipboard.writeText(text);alert('Summary copied.')}catch(e){showSummary();const range=document.createRange();range.selectNodeContents($('#summaryContent'));const sel=getSelection();sel.removeAllRanges();sel.addRange(range)}}
function tab(id){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));$$('.section').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo({top:0,behavior:'smooth'})}
$$('.tab').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
$('#saveBtn').onclick=()=>save(true);$('#shareTextBtn').onclick=shareStateText;$('#shareBtn').onclick=()=>exportState(true);$('#exportBtn').onclick=()=>exportState(false);$('#copyBtn').onclick=showSummary;$('#closeSummary').onclick=()=>$('#summaryModal').classList.add('hidden');$('#copyRichBtn').onclick=()=>copySummary(true);$('#copyPlainBtn').onclick=()=>copySummary(false);$('#addTxBtn').onclick=addTx;$('#sortTxBtn').onclick=()=>{state.transactions.sort((a,b)=>txDate(a).localeCompare(txDate(b)));mark();renderTransactions();renderRunning()};$('#addOwner1TaskBtn').onclick=()=>addTask(owners()[0]);$('#addOwner2TaskBtn').onclick=()=>addTask(owners()[1]);$('#addNoteBtn').onclick=addNote;$('#resetBtn').onclick=()=>{if(confirm('Clear this browser copy and return to the blank application shell?')){localStorage.removeItem(KEY);state=normalizeState(clone(embedded));renderAll()}};$('#importFile').onchange=e=>{if(e.target.files[0])importState(e.target.files[0]);e.target.value=''};$('#importPasteBtn').onclick=()=>{if(importText($('#pasteJson').value))$('#pasteJson').value=''};$('#clearPasteBtn').onclick=()=>{$('#pasteJson').value=''};['currentCash','cashFloor','forecastMode','updatedBy'].forEach(id=>$('#'+id).onchange=()=>{syncSettings();mark();renderOverview();renderCalendar();renderRunning();renderStatus()});addEventListener('beforeunload',()=>{if(dirty){syncSettings();localStorage.setItem(KEY,JSON.stringify(state))}});addEventListener('resize',()=>renderCalendar());renderAll();
})();
