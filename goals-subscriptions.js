(function(){
'use strict';
const KEY='FAMILY_OPS_DASHBOARD_STATE_V1';
const RETURN_KEY='WFOS_RETURN_TAB';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
const STATUSES=['Active','Cancel Pending','Needs Confirmation','Planned','Canceled'];

function embeddedState(){try{return JSON.parse($('#embedded-state')?.textContent||'{}')}catch(e){return{}}}
function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||embeddedState()}catch(e){return embeddedState()}}
function updaterName(s){return $('#updatedBy')?.value.trim()||s.lastUpdatedBy||'Unknown'}
function persist(s,returnTab){s.goals=Array.isArray(s.goals)?s.goals:[];s.subscriptions=Array.isArray(s.subscriptions)?s.subscriptions:[];s.lastUpdated=new Date().toISOString();s.lastUpdatedBy=updaterName(s);localStorage.setItem(KEY,JSON.stringify(s));sessionStorage.setItem(RETURN_KEY,returnTab);location.reload()}
function statusKey(v){return String(v||'').trim().toLowerCase()}
function countsInRisk(v){const k=statusKey(v);return k==='active'||k==='cancel pending'}
function isCancelPending(v){return statusKey(v)==='cancel pending'}
function isNeedsConfirmation(v){return statusKey(v)==='needs confirmation'}
function annualSavings(sub){const monthly=Number(sub.monthlyEquivalent||0),annual=Number(sub.annualPrice||0);return annual>0?Math.max(0,monthly*12-annual):Number(sub.annualSavings||0)}

function goalCard(g){return `<article class="ops-item goal-item" data-goal="${esc(g.id)}">
  <div class="ops-item-main">
    <div class="field"><label>Goal</label><input data-gf="name" value="${esc(g.name||'')}"></div>
    <div class="field"><label>Status</label><input data-gf="status" value="${esc(g.status||'Active')}"></div>
    <div class="field ops-note"><label>Note</label><textarea data-gf="note" placeholder="Why this matters, current thinking, or next meaningful step...">${esc(g.note||'')}</textarea></div>
  </div>
  <div class="actions ops-row-actions"><button class="btn primary save-goal">Save</button><button class="btn danger delete-goal">Delete</button></div>
</article>`}

function renderGoals(){
  const box=$('#goalsList');if(!box)return;const s=readState(),goals=Array.isArray(s.goals)?s.goals:[];
  $('#goalCount').textContent=goals.length?`${goals.length} goal${goals.length===1?'':'s'} in the private state`:'No goals loaded';
  box.innerHTML=goals.map(goalCard).join('')||'<div class="empty-state"><strong>No goals loaded.</strong><div class="small">Import the private CURRENT JSON or add a goal here. The public repository contains no family goals.</div></div>';
  box.querySelectorAll('[data-goal]').forEach(row=>{
    row.querySelector('.save-goal').onclick=()=>{const st=readState(),g=(st.goals||[]).find(x=>x.id===row.dataset.goal);if(!g)return;row.querySelectorAll('[data-gf]').forEach(el=>g[el.dataset.gf]=el.value.trim());persist(st,'goals')};
    row.querySelector('.delete-goal').onclick=()=>{if(!confirm('Delete this goal from the private JSON on this device?'))return;const st=readState();st.goals=(st.goals||[]).filter(x=>x.id!==row.dataset.goal);persist(st,'goals')};
  });
}

function addGoal(){const name=prompt('Goal name');if(!name)return;const status=prompt('Status','Active')||'Active',note=prompt('Note / why it matters','')||'';const s=readState();s.goals=Array.isArray(s.goals)?s.goals:[];s.goals.push({id:uid('goal'),name:name.trim(),status:status.trim(),note:note.trim()});persist(s,'goals')}

function subscriptionEditor(sub){const savings=annualSavings(sub);return `<article class="ops-item subscription-item" data-sub="${esc(sub.id)}">
  <div class="subscription-summary">
    <div><strong>${esc(sub.name||'Unnamed subscription')}</strong><div class="small">${esc(sub.category||'Uncategorized')} · ${esc(sub.draftDay||'Draft day unknown')}</div></div>
    <div class="subscription-money">${money(sub.monthlyEquivalent||0)}<span>/mo</span></div>
  </div>
  <div class="subscription-meta"><span class="tag ${statusKey(sub.status).replace(/\s+/g,'-')}">${esc(sub.status||'Needs Confirmation')}</span>${savings>0?`<span class="annual-save">Annual option could save ${money(savings)}/yr</span>`:''}</div>
  <details><summary>Details / edit</summary>
    <div class="ops-form-grid">
      <div class="field"><label>Name</label><input data-sf="name" value="${esc(sub.name||'')}"></div>
      <div class="field"><label>Category</label><input data-sf="category" value="${esc(sub.category||'')}"></div>
      <div class="field"><label>Monthly equivalent</label><input type="number" step="0.01" data-sf="monthlyEquivalent" value="${Number(sub.monthlyEquivalent||0).toFixed(2)}"></div>
      <div class="field"><label>Draft day / rule</label><input data-sf="draftDay" value="${esc(sub.draftDay||'')}"></div>
      <div class="field"><label>Billing frequency</label><input data-sf="billingFrequency" value="${esc(sub.billingFrequency||'Monthly')}"></div>
      <div class="field"><label>Status</label><select data-sf="status">${STATUSES.map(x=>`<option ${statusKey(sub.status)===statusKey(x)?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Annual price (optional)</label><input type="number" step="0.01" data-sf="annualPrice" value="${sub.annualPrice===undefined||sub.annualPrice===null?'':Number(sub.annualPrice).toFixed(2)}"></div>
      <div class="field ops-note"><label>Notes</label><textarea data-sf="notes">${esc(sub.notes||'')}</textarea></div>
    </div>
    <div class="actions ops-row-actions"><button class="btn primary save-sub">Save</button><button class="btn danger delete-sub">Delete</button></div>
  </details>
</article>`}

function renderSubscriptions(){
  const box=$('#subscriptionGroups');if(!box)return;const s=readState(),subs=Array.isArray(s.subscriptions)?s.subscriptions:[];
  const risk=subs.filter(x=>countsInRisk(x.status)),riskTotal=risk.reduce((n,x)=>n+Number(x.monthlyEquivalent||0),0),cancelTotal=subs.filter(x=>isCancelPending(x.status)).reduce((n,x)=>n+Number(x.monthlyEquivalent||0),0),needs=subs.filter(x=>isNeedsConfirmation(x.status)).length;
  $('#subscriptionKpis').innerHTML=`<div class="card"><div class="label">Current recurring risk</div><div class="value">${money(riskTotal)}</div><div class="small">Active + Cancel Pending</div></div><div class="card"><div class="label">Cancel-pending savings</div><div class="value goodtext">${money(cancelTotal)}</div><div class="small">Monthly savings after confirmed cancellation</div></div><div class="card"><div class="label">Active-risk items</div><div class="value">${risk.length}</div><div class="small">Includes cancel-pending until confirmed</div></div><div class="card"><div class="label">Needs confirmation</div><div class="value">${needs}</div><div class="small">Shown but excluded from recurring-risk total unless status changes</div></div>`;
  const cats=[...new Set(subs.map(x=>x.category||'Uncategorized'))].sort((a,b)=>a.localeCompare(b));
  box.innerHTML=cats.map(cat=>{const items=subs.filter(x=>(x.category||'Uncategorized')===cat),total=items.filter(x=>countsInRisk(x.status)).reduce((n,x)=>n+Number(x.monthlyEquivalent||0),0);return `<section class="subscription-group"><div class="subscription-group-head"><div><h3>${esc(cat)}</h3><div class="small">${items.length} item${items.length===1?'':'s'}</div></div><strong>${money(total)}/mo risk</strong></div>${items.map(subscriptionEditor).join('')}</section>`}).join('')||'<div class="empty-state"><strong>No subscriptions loaded.</strong><div class="small">Import the private CURRENT JSON or add a subscription here. The public repository contains no subscription records.</div></div>';
  box.querySelectorAll('[data-sub]').forEach(row=>{
    row.querySelector('.save-sub').onclick=()=>{const st=readState(),sub=(st.subscriptions||[]).find(x=>x.id===row.dataset.sub);if(!sub)return;row.querySelectorAll('[data-sf]').forEach(el=>{const f=el.dataset.sf;sub[f]=['monthlyEquivalent','annualPrice'].includes(f)?(el.value===''?null:Number(el.value)):el.value.trim()});sub.annualSavings=annualSavings(sub);persist(st,'subscriptions')};
    row.querySelector('.delete-sub').onclick=()=>{if(!confirm('Delete this subscription record from the private JSON on this device?'))return;const st=readState();st.subscriptions=(st.subscriptions||[]).filter(x=>x.id!==row.dataset.sub);persist(st,'subscriptions')};
  });
}

function addSubscription(){const name=prompt('Subscription / recurring service name');if(!name)return;const category=prompt('Category','Other')||'Other',amount=Number(prompt('Monthly-equivalent cost','0')||0),draftDay=prompt('Draft day / rule','')||'',status=prompt('Status: Active, Cancel Pending, Needs Confirmation, Planned, or Canceled','Active')||'Active';const s=readState();s.subscriptions=Array.isArray(s.subscriptions)?s.subscriptions:[];s.subscriptions.push({id:uid('sub'),name:name.trim(),category:category.trim(),monthlyEquivalent:amount,draftDay:draftDay.trim(),billingFrequency:'Monthly',status:status.trim(),notes:'',annualPrice:null,annualSavings:0});persist(s,'subscriptions')}

function renderAll(){renderGoals();renderSubscriptions()}

$('#addGoalBtn')?.addEventListener('click',addGoal);
$('#addSubscriptionBtn')?.addEventListener('click',addSubscription);
document.querySelectorAll('.tab[data-tab="goals"],.tab[data-tab="subscriptions"]').forEach(t=>t.addEventListener('click',()=>setTimeout(renderAll,0)));
window.addEventListener('pageshow',renderAll);
renderAll();
const back=sessionStorage.getItem(RETURN_KEY);if(back){sessionStorage.removeItem(RETURN_KEY);setTimeout(()=>document.querySelector(`.tab[data-tab="${back}"]`)?.click(),0)}
})();
