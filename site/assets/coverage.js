/* Coverage matrix: typology x control family, counts of linked controls only */
(async function(){
'use strict';
const {h,nice,cap,getJSON,loadIndex,L,usedIn,plural,sig}=FC;
const $=id=>document.getElementById(id);
let X;try{X=await loadIndex()}catch(e){return FC.fail(e)}
const {T,C,DOM,data,FAMS}=X;
const cell={};data.typologies.forEach(t=>{cell[t.id]={};t.ctls.forEach(c=>{const f=C[c].family;(cell[t.id][f]=cell[t.id][f]||[]).push(c)})});
const bucket=n=>n===0?0:n===1?1:n===2?2:n<=4?3:n<=7?4:5;
let dom='',tq='',sel=null,lastBtn=null;
const wrap=$('mxwrap'),panel=$('mpanel'),holder=$('mxholder');
$('dom').innerHTML='<option value="">All domains</option>'+data.domains.map(d=>`<option value="${d.id}">${h(d.label)}</option>`).join('');
$('dom').onchange=e=>{dom=e.target.value;renderMatrix()};
$('tq').oninput=e=>{tq=e.target.value.toLowerCase().trim();renderMatrix()};
function renderMatrix(){
 const ts=data.typologies.filter(t=>(!dom||t.domain===dom)&&(!tq||(t.name+' '+t.id).toLowerCase().includes(tq)));
 const head=`<th class="corner" scope="col">Typology (${ts.length})</th>`+FAMS.map(f=>`<th scope="col"><button type="button" data-fam="${f}" aria-pressed="${!!sel&&sel.k==='f'&&sel.id===f}" title="${h(cap(f))}: all controls in this family">${h(cap(f))}</button></th>`).join('');
 let body='',last='';
 for(const t of ts){if(t.domain!==last){last=t.domain;body+=`<tr class="dom"><th colspan="${FAMS.length+1}" scope="colgroup">${h(DOM[t.domain])}</th></tr>`}
  body+=`<tr><th class="row" scope="row"><button type="button" data-typ="${t.id}" aria-pressed="${!!sel&&sel.k==='t'&&sel.id===t.id}" title="${h(t.name)}">${h(t.name)}</button></th>`+FAMS.map(f=>{const n=(cell[t.id][f]||[]).length;return `<td><button type="button" data-c="${t.id}|${f}" data-v="${bucket(n)}" aria-pressed="${!!sel&&sel.k==='c'&&sel.id===t.id+'|'+f}" aria-label="${h(t.name)}, ${h(cap(f))}: ${plural(n,'linked control','linked controls')}">${n||''}</button></td>`}).join('')+'</tr>'}
 const sc=holder.querySelector('.scroll'),x=sc?sc.scrollLeft:0,y=sc?sc.scrollTop:0;
 holder.innerHTML=ts.length?`<div class="scroll" tabindex="0" role="region" aria-label="Typology by control family matrix. Scroll to see more."><table class="mx"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`:'<div class="empty">No typologies match.</div>';
 const s2=holder.querySelector('.scroll');if(s2){s2.scrollLeft=x;s2.scrollTop=y}
 $('mcount').textContent=`${ts.length} typologies x ${FAMS.length} control families`}
holder.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.c)pick('c',b.dataset.c,b);else if(b.dataset.typ)pick('t',b.dataset.typ,b);else if(b.dataset.fam)pick('f',b.dataset.fam,b)});
function pick(k,id,btn){sel={k,id};lastBtn=btn;renderMatrix();const nb=holder.querySelector('[aria-pressed="true"]');if(nb){lastBtn=nb;nb.focus({preventScroll:true})}renderPanel()}
const ctlItem=(id,extra)=>{const c=C[id];return `<div class="item"><a href="${L.ctl(id)}">${h(c.name)}</a> <span class="m">${id}</span><div class="m">${h(c.type)} | ${h(cap(c.family))} | ${usedIn(c.nTyp)}</div>${extra||''}</div>`};
let ptok=0;
async function renderPanel(){
 const my=++ptok;
 if(!sel){panel.hidden=true;wrap.classList.remove('open');return}
 wrap.classList.add('open');panel.hidden=false;
 let html='<button type="button" class="btn sm close" id="mx-x">Close</button>';
 if(sel.k==='c'){const[tid,f]=sel.id.split('|'),t=T[tid],ids=cell[tid][f]||[];
  html+=`<h2 id="ph" tabindex="-1">${h(t.name)}</h2><div class="note">${h(cap(f))}: ${plural(ids.length,'linked control','linked controls')}</div><h3>Controls in this cell</h3><div id="cl">${ids.length?ids.map(id=>ctlItem(id)).join(''):'<p class="note">No controls from this family are linked in this typology. That is a fact about the data, not necessarily a gap.</p>'}</div><p><a class="btn" href="${L.typ(tid)}">Open typology page</a> <button type="button" class="btn" data-typ="${tid}">Typology summary</button></p>`;
  panel.innerHTML=html;wirePanel();
  if(ids.length){const d=await getJSON(`data/typologies/${tid}.json`);if(my!==ptok)return;
   $('cl').innerHTML=ids.map(id=>{const inds=d.indicators.filter(i=>i.controls.includes(id));return ctlItem(id,`<div class="m">Applied to ${inds.length} of ${d.indicators.length} indicators: ${inds.map(i=>h(i.name)).join('; ')}</div>`)}).join('')}
  return}
 if(sel.k==='t'){const t=T[sel.id];
  html+=`<h2 id="ph" tabindex="-1">${h(t.name)}</h2><div class="note">${t.id} | ${h(DOM[t.domain])} | ${t.sectors.map(cap).join(', ')}</div><p>${h(t.desc)}</p><h3>Linked controls by family (${t.nCtl})</h3><table class="l">${FAMS.filter(f=>cell[t.id][f]).map(f=>`<tr><td><button type="button" class="linkbtn" data-c="${t.id}|${f}">${h(cap(f))}</button></td><td>${cell[t.id][f].length}</td></tr>`).join('')}</table><p style="margin-top:12px"><a class="btn" href="${L.typ(t.id)}">Open typology page</a></p>`}
 if(sel.k==='f'){const cs=data.controls.filter(c=>c.family===sel.id).sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name));
  html+=`<h2 id="ph" tabindex="-1">${h(cap(sel.id))}</h2><div class="note">${plural(cs.length,'control','controls')} in this family, most reused first</div><h3>Controls</h3>${cs.map(c=>ctlItem(c.id)).join('')}`}
 panel.innerHTML=html;wirePanel()}
function wirePanel(){
 $('mx-x').onclick=()=>{sel=null;renderPanel();renderMatrix();if(lastBtn&&document.body.contains(lastBtn))lastBtn.focus()};
 panel.querySelectorAll('[data-typ]').forEach(b=>b.onclick=()=>{sel={k:'t',id:b.dataset.typ};renderMatrix();renderPanel()});
 panel.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{sel={k:'c',id:b.dataset.c};renderMatrix();renderPanel()});
 const ph=$('ph');if(ph&&matchMedia('(max-width:900px)').matches)ph.focus({preventScroll:true})}
addEventListener('keydown',e=>{if(e.key==='Escape'&&sel){$('mx-x')&&$('mx-x').click()}});
renderMatrix();
})();
