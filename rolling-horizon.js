(function(){
'use strict';
const KEY='FAMILY_OPS_DASHBOARD_STATE_V1';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
let refreshTimer=null;

function readState(){
  try{
    const local=JSON.parse(localStorage.getItem(KEY)||'null');
    if(local&&Array.isArray(local.transactions))return local;
  }catch(e){}
  try{
    const embedded=$('#embedded-state');
    if(embedded)return JSON.parse(embedded.textContent||'{}');
  }catch(e){}
  return{};
}
function txDate(t){return t?.forecastDate||t?.date||''}
function amount(t){return t?.actualAmount!==null&&t?.actualAmount!==''&&Number.isFinite(Number(t?.actualAmount))?Number(t.actualAmount):Number(t?.amount||0)}
function included(t,mode){return !!t?.[mode==='downside'?'includeDownside':mode==='recovery'?'includeRecovery':'includeBase']}
function currentAsOf(state){return state?.settings?.currentCashBreakdown?.asOf||state?.settings?.asOfDate||state?.period?.start||new Date().toISOString().slice(0,10)}
function currentCash(state){
  const b=state?.settings?.currentCashBreakdown||{};
  const parts=['usaaAvailable','chaseArrtAvailable','physicalCash','paypalCash','otherAvailable'];
  if(parts.some(k=>b[k]!==undefined&&b[k]!==null))return parts.reduce((s,k)=>s+Number(b[k]||0),0);
  return Number(state?.settings?.currentAccessibleCash||state?.settings?.openingBalance||0);
}
function addDays(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function monthKey(ds){return String(ds||'').slice(0,7)}
function monthStart(key){return new Date(key+'-01T12:00:00')}
function nextMonth(d){return new Date(d.getFullYear(),d.getMonth()+1,1,12,0,0)}
function horizonEnd(state){
  const asOf=currentAsOf(state),dates=[state?.period?.end].filter(Boolean);
  (state.transactions||[]).forEach(t=>{const d=txDate(t);if(d&&d>=asOf)dates.push(d)});
  return dates.sort().slice(-1)[0]||asOf;
}
function runningCash(state){
  const mode=state?.settings?.forecastMode||'base',asOf=currentAsOf(state);let bal=currentCash(state);const cash={};
  (state.transactions||[]).filter(t=>t?.id!=='open'&&t?.paymentStatus!=='paid'&&included(t,mode)&&txDate(t)>=asOf).slice().sort((a,b)=>txDate(a).localeCompare(txDate(b))||(a.kind==='income'?-1:1)).forEach(t=>{
    const change=t.kind==='income'?amount(t):t.kind==='transfer'?0:-amount(t);bal+=change;cash[txDate(t)]=bal;
  });
  return cash;
}
function eventHtml(t){
  const prefix=t.kind==='income'?'+':t.kind==='transfer'?'↔ ':'-';
  const cls=t.paymentStatus==='paid'?'paid':t.paymentStatus==='conditional'?'conditional':t.paymentStatus==='hold'?'hold':t.kind;
  return`<div class="event ${esc(cls)}" data-rh-tx="${esc(t.id)}"><span>${esc(t.name)}</span> <strong>${prefix}${money(amount(t))}</strong></div>`;
}
function monthBlock(state,key,cash){
  const first=monthStart(key),y=first.getFullYear(),m=first.getMonth(),offset=first.getDay(),days=new Date(y,m+1,0).getDate(),cells=Math.ceil((offset+days)/7)*7;
  const title=first.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  let grid=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="calhead">${x}</div>`).join('');
  for(let i=0;i<cells;i++){
    const d=new Date(y,m,1-offset+i,12,0,0),ds=d.toISOString().slice(0,10),outside=d.getMonth()!==m;
    const items=(state.transactions||[]).filter(t=>t?.id!=='open'&&txDate(t)===ds);
    let events=items.map(eventHtml).join('');
    if(cash[ds]!==undefined)events+=`<div class="event cash">After day: ${money(cash[ds])} available</div>`;
    grid+=`<div class="calday ${outside?'outside':''}"><div class="daynum">${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>${events}</div>`;
  }
  return`<section class="horizon-month"><h3>${esc(title)}</h3><div class="horizon-month-grid">${grid}</div></section>`;
}
function renderCalendar(state){
  const desktop=$('#calendarGrid'),agenda=$('#calendarAgenda');if(!desktop||!agenda)return;
  const asOf=currentAsOf(state),end=horizonEnd(state),cash=runningCash(state),months=[];
  let cursor=monthStart(monthKey(asOf)),last=monthStart(monthKey(end));
  while(cursor<=last&&months.length<18){months.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`);cursor=nextMonth(cursor)}
  desktop.className='horizon-calendar-list';desktop.innerHTML=months.map(k=>monthBlock(state,k,cash)).join('');
  let a='';for(let ds=asOf;ds<=end;ds=addDays(ds,1)){
    const items=(state.transactions||[]).filter(t=>t?.id!=='open'&&txDate(t)===ds);if(!items.length&&cash[ds]===undefined)continue;
    const d=new Date(ds+'T12:00:00');a+=`<div class="agenda-day"><div class="agenda-date"><strong>${d.toLocaleDateString('en-US',{weekday:'short'})}</strong><span>${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div><div class="agenda-events">${items.map(eventHtml).join('')}${cash[ds]!==undefined?`<div class="agenda-cash">After day <strong>${money(cash[ds])}</strong> available</div>`:''}</div></div>`;
  }
  agenda.innerHTML=a||'<p class="small">No calendar activity inside the current rolling horizon.</p>';
  [...desktop.querySelectorAll('[data-rh-tx]'),...agenda.querySelectorAll('[data-rh-tx]')].forEach(el=>el.onclick=()=>jumpToCashPlan(el.dataset.rhTx));
  const desktopHelp=$('.desktop-calendar-help'),mobileHelp=$('.mobile-calendar-help');
  if(desktopHelp)desktopHelp.textContent=`Rolling horizon: ${new Date(asOf+'T12:00:00').toLocaleDateString()} through ${new Date(end+'T12:00:00').toLocaleDateString()}. Tap an event to jump to the Cash Plan.`;
  if(mobileHelp)mobileHelp.textContent=`Upcoming activity is shown as one continuous agenda through ${new Date(end+'T12:00:00').toLocaleDateString()}.`;
}
function jumpToCashPlan(id){
  const tab=[...document.querySelectorAll('.tab')].find(x=>x.dataset.tab==='cashplan');if(tab)tab.click();
  setTimeout(()=>document.querySelector(`[data-row="${CSS.escape(id)}"],[data-card="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),60);
}
function patchOverview(state){
  const labels=[...document.querySelectorAll('#kpis .label')];const endLabel=labels.find(x=>x.textContent.trim()==='End-of-period cash');if(endLabel)endLabel.textContent='End-of-horizon cash';
  const endCard=endLabel?.closest('.card');const end=horizonEnd(state);if(endCard){const small=endCard.querySelector('.small');if(small)small.textContent=`Through ${new Date(end+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} before unmodeled items`;}
  renderNextSeven(state);
}
function renderNextSeven(state){
  const box=$('#next7');if(!box)return;const asOf=currentAsOf(state),end=addDays(asOf,7),mode=state?.settings?.forecastMode||'base';
  const items=(state.transactions||[]).filter(t=>t?.id!=='open'&&t?.paymentStatus!=='paid'&&included(t,mode)&&txDate(t)>=asOf&&txDate(t)<=end).slice().sort((a,b)=>txDate(a).localeCompare(txDate(b))).slice(0,8);
  box.innerHTML=items.map(t=>`<div class="task compact-task"><span class="tag ${esc(t.paymentStatus)}">${esc(t.paymentStatus)}</span><div><strong>${new Date(txDate(t)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${esc(t.name)}</strong><div class="small">${esc(t.owner)} | ${t.kind==='transfer'?'Transfer ':''}${money(amount(t))}</div></div><span></span></div>`).join('')||'<p class="small">No modeled activity in the next seven days.</p>';
}
function injectStyles(){if($('#rollingHorizonStyles'))return;const style=document.createElement('style');style.id='rollingHorizonStyles';style.textContent=`
.horizon-calendar-list{display:flex;flex-direction:column;gap:18px}.horizon-month{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.horizon-month h3{margin:0;padding:10px 12px;background:#eef4fa;color:var(--navy);font-size:17px}.horizon-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.horizon-month-grid .calhead{border-bottom:1px solid var(--line)}
@media(max-width:850px){.horizon-calendar-list{display:none}.calendar-agenda{display:block}}
@media(min-width:851px){.horizon-calendar-list{display:flex}.calendar-agenda{display:none!important}}
@media print{.horizon-calendar-list{display:flex!important}.calendar-agenda{display:none!important}}
`;document.head.appendChild(style)}
function refresh(){const state=readState();if(!Array.isArray(state.transactions))return;injectStyles();renderCalendar(state);patchOverview(state)}
function schedule(delay=40){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,delay)}
function init(){
  refresh();
  const status=$('#saveStatus');if(status)new MutationObserver(()=>{if(/^Saved/.test(status.textContent||''))schedule(30)}).observe(status,{childList:true,subtree:true,characterData:true});
  window.addEventListener('storage',e=>{if(e.key===KEY)schedule(30)});
  window.addEventListener('resize',()=>schedule(80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(30)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
