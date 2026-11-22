/* Coverage matrix: typology x control family, counts of linked controls only (linkage, not effectiveness). */
(async function(){
'use strict';
const {$,esc,MARK,sig}=FC;
let x;try{x=await FC.load()}catch(e){return}
const {d,L,T,C}=x,FAMS=x.fams,lab=FC.lab;
const cell={};d.typologies.forEach(t=>{cell[t.id]={};t.ctls.forEach(c=>{const f=C[c].family;(cell[t.id][f]=cell[t.id][f]||[]).push(c)})});
const bucket=n=>n===0?0:n===1?1:n===2?2:n<=4?3:n<=7?4:5;
const plural=(n,a,b)=>n+' '+(n===1?a:b);
let dom='',tq='',sel=null,lastBtn=null;
const wrap=$('#mxwrap'),panel=$('#mpanel'),holder=$('#mxholder'),dback=$('#dback');
$('#dom').innerHTML='<option value="">All domains</option>'+d.domains.map(v=>`<option value="${v.id}">${esc(v.label)}</option>`).join('');
$('#dom').onchange=e=>{dom=e.target.value;renderMatrix()};
$('#tq').oninput=e=>{tq=e.target.value.toLowerCase().trim();renderMatrix()};
const pressed=(k,id)=>!!sel&&sel.k===k&&sel.id===id;
function renderMatrix(){
 const ts=d.typologies.filter(t=>(!dom||t.domain===dom)&&(!tq||(t.name+' '+t.id).toLowerCase().includes(tq)));
 const head=`<th class="corner" scope="col">Typology (${ts.length})</th>`+FAMS.map(f=>`<th scope="col"><button type="button" data-fam="${f}" aria-pressed="${pressed('f',f)}" title="${esc(L.family[f])}: all controls in this family">${esc(L.family[f])}</button></th>`).join('');
 let body='',last='';
 for(const t of ts){if(t.domain!==last){last=t.domain;body+=`<tr class="dom"><th colspan="${FAMS.length+1}" scope="colgroup">${esc(L.domain[t.domain])}</th></tr>`}
  body+=`<tr><th class="row" scope="row"><button type="button" data-typ="${t.id}" aria-pressed="${pressed('t',t.id)}" title="${esc(t.name)}">${esc(t.name)}</button></th>`+FAMS.map(f=>{const n=(cell[t.id][f]||[]).length;return `<td><button type="button" data-c="${t.id}|${f}" data-v="${bucket(n)}" aria-pressed="${pressed('c',t.id+'|'+f)}" aria-label="${esc(t.name)}, ${esc(L.family[f])}: ${plural(n,'linked control','linked controls')}">${n||''}</button></td>`}).join('')+'</tr>'}
 const sc=holder.querySelector('.scroll'),sx=sc?sc.scrollLeft:0,sy=sc?sc.scrollTop:0;
 holder.innerHTML=ts.length?`<div class="scroll" tabindex="0" role="region" aria-label="Typology by control family matrix. Scroll to see more."><table class="mx"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`:'<p class="empty">No typologies match.</p>';
 const s2=holder.querySelector('.scroll');if(s2){s2.scrollLeft=sx;s2.scrollTop=sy}
 $('#mcount').textContent=`${ts.length} typologies x ${FAMS.length} control families`;
}
holder.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.c)pick('c',b.dataset.c,b);else if(b.dataset.typ)pick('t',b.dataset.typ,b);else if(b.dataset.fam)pick('f',b.dataset.fam,b)});
function pick(k,id,btn){sel={k,id};lastBtn=btn.dataset.c?'[data-c="'+btn.dataset.c+'"]':btn.dataset.typ?'[data-typ="'+btn.dataset.typ+'"]':'[data-fam="'+btn.dataset.fam+'"]';renderMatrix();const nb=holder.querySelector('[aria-pressed="true"]');if(nb)nb.focus({preventScroll:true});renderPanel()}
const ctlItem=(id,extra)=>{const c=C[id];return `<div class="item"><a href="controls#${id}">${esc(c.name)}</a> <span class="mono">${id}</span><div class="m">${lab('ctype',c.type)} | ${esc(L.family[c.family])} | ${c.nTyp} typologies</div>${extra||''}</div>`};
let ptok=0;
async function renderPanel(){
 const my=++ptok;
 if(!sel){panel.hidden=true;wrap.classList.remove('open');dback.hidden=true;return}
 wrap.classList.add('open');panel.hidden=false;dback.hidden=!matchMedia('(max-width:1000px)').matches;
 let html='<button type="button" class="btn close" id="mx-x">Close</button>';
 if(sel.k==='c'){const[tid,f]=sel.id.split('|'),t=T[tid],ids=cell[tid][f]||[];
  html+=`<h2 id="ph" tabindex="-1">${esc(t.name)}</h2><div class="note">${esc(L.family[f])}: ${plural(ids.length,'linked control','linked controls')}</div><h3>Controls in this cell</h3><div id="cl">${ids.length?ids.map(id=>ctlItem(id)).join(''):'<p class="note">No controls from this family are linked in this typology. That is a fact about the data, not necessarily a gap.</p>'}</div><p style="margin-top:12px"><a class="btn" href="typologies#${tid}">Open typology record</a> <button type="button" class="btn" data-typ="${tid}">Typology summary</button></p>`;
  panel.innerHTML=html;wirePanel();
  if(ids.length){const det=await FC.getJSON(`data/typologies/${tid}.json`);if(my!==ptok)return;
   $('#cl').innerHTML=ids.map(id=>{const inds=det.indicators.filter(i=>i.controls.includes(id));return ctlItem(id,`<div class="m">Applied to ${inds.length} of ${det.indicators.length} indicators: ${inds.map(i=>esc(i.canon)).join('; ')}</div>`)}).join('')}
  return}
 if(sel.k==='t'){const t=T[sel.id];
  html+=`<h2 id="ph" tabindex="-1">${esc(t.name)}</h2><div class="note"><span class="mono">${t.id}</span> | ${esc(L.domain[t.domain])} | ${t.sectors.map(s=>esc(L.sector[s])).join(', ')}</div><p style="margin-top:8px">${esc(t.desc)}</p><h3>Linked controls by family (${t.nCtl})</h3><table class="l">${FAMS.filter(f=>cell[t.id][f]).map(f=>`<tr><td><button type="button" class="linkbtn" data-c="${t.id}|${f}">${esc(L.family[f])}</button></td><td>${cell[t.id][f].length}</td></tr>`).join('')}</table><p style="margin-top:12px"><a class="btn" href="typologies#${t.id}">Open typology record</a> <a class="btn" href="relationships#t=${t.id}">Relationship flow</a></p>`}
 if(sel.k==='f'){const cs=d.controls.filter(c=>c.family===sel.id).sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name));
  html+=`<h2 id="ph" tabindex="-1">${esc(L.family[sel.id])}</h2><div class="note">${plural(cs.length,'control','controls')} in this family, most reused first</div><h3>Controls</h3>${cs.map(c=>ctlItem(c.id)).join('')}`}
 panel.innerHTML=html;wirePanel();
}
function wirePanel(){
 $('#mx-x').onclick=closePanel;
 panel.querySelectorAll('[data-typ]').forEach(b=>b.onclick=()=>{sel={k:'t',id:b.dataset.typ};renderMatrix();renderPanel()});
 panel.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{sel={k:'c',id:b.dataset.c};renderMatrix();renderPanel()});
 const ph=$('#ph');if(ph&&matchMedia('(max-width:1000px)').matches)ph.focus({preventScroll:true});
}
function closePanel(){sel=null;renderPanel();renderMatrix();const b=lastBtn&&holder.querySelector(lastBtn);if(b)b.focus({preventScroll:true})}
dback.addEventListener('click',closePanel);
addEventListener('keydown',e=>{if(e.key==='Escape'&&sel&&!$('dialog.pal').open)closePanel()});
renderMatrix();
})();
