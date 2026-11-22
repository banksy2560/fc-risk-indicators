/* Home: dashboard computed from the full index. */
(async function(){
'use strict';
const {$,esc,MARK,KIND,tag,sig,aiTag}=FC;
let x;try{x=await FC.load()}catch(e){return}
const {d,L,T,I,C}=x,lab=FC.lab,N=d.counts;
$('#stats').innerHTML=`<a href="typologies">${N.typologies} typologies</a>, <a href="indicators">${N.indicators} indicators</a> and <a href="controls">${N.controls} controls</a>, each linked to the others and to its sources. Draft content, not yet reviewed by experts.`;
const li=(href,label,n)=>`<li><a href="${href}"><span>${esc(label)}</span><span class="n">${n}</span></a></li>`;
$('#domains').innerHTML=[...d.domains].sort((a,b)=>b.n-a.n).map(v=>li(`typologies#m=t&domain=${v.id}`,v.label,v.n)).join('');
const cat={};d.indicators.forEach(i=>cat[i.cat]=(cat[i.cat]||0)+1);
$('#cat').innerHTML=Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>li(`indicators#m=i&cat=${k}`,lab('cat',k),v)).join('');
// most reused
const rk=(items,k,n)=>items.slice(0,5).map(x=>`<li class="${KIND[k].cls}"><a data-k="${k}" href="${KIND[k].page}#${x.id}"><span class="nm">${esc(x.name)}</span><span class="sub"><span class="mono">${x.id}</span>${k==='i'?' · '+sig(x.sev):' · '+lab('ctype',x.type)}</span></a><span class="cnt">${n(x)}<small>typologies</small></span></li>`).join('');
$('#topI').innerHTML=rk([...d.indicators].sort((a,b)=>b.used-a.used||a.name.localeCompare(b.name)),'i',v=>v.used);
$('#topC').innerHTML=rk([...d.controls].sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name)),'c',v=>v.nTyp);
// recently added: first git commit that added each typology file (real data; omitted if unavailable)
const withDates=d.typologies.filter(t=>t.added);
if(withDates.length===d.typologies.length){
 const rec=[...withDates].sort((a,b)=>b.added.localeCompare(a.added)||a.name.localeCompare(b.name));
 const top=rec.slice(0,5),batch=rec.filter(t=>t.ac===rec[0].ac).length,cm=d.commits[rec[0].ac];
 $('#recent').innerHTML=top.map(t=>`<li class="c-t"><a data-k="t" href="typologies#${t.id}"><span class="nm">${esc(t.name)}</span><span class="sub">${t.nInd} indicators &middot; draft, unreviewed</span></a><span class="cnt" style="color:var(--ink-2)"><small class="recent-date">${t.added.slice(0,10)}</small></span></li>`).join('');
 $('#recentnote').textContent='Dates show when each typology was first added to the library, not when it was reviewed.';
 $('#recentcard').hidden=false;
}
// one typology traced from indicators to controls
const rankSev={high:0,medium:1,low:2},EX=['ML-MULE','FR-APP','CY-MIXER','ML-TBML','SANC-CRYPTO'].filter(id=>T[id]),btEl=$('#bt');
function trace(id,anim=true){
 const t=T[id],inds=d.indicators.filter(i=>i.typs.includes(id)).sort((a,b)=>rankSev[a.sev]-rankSev[b.sev]||a.name.localeCompare(b.name)).slice(0,4),ct=t.ctls.map(c=>C[c]).filter(Boolean).slice(0,4);
 const node=(k,o,sub)=>`<a class="node ${KIND[k].cls}" href="${KIND[k].page}#${o.id}"><span class="h"><span class="nm">${esc(o.name)}</span></span><span class="sub"><span class="mono">${o.id}</span>${sub}</span></a>`;
 btEl.innerHTML=`<svg class="lines" id="blines" aria-hidden="true"></svg>
<div class="col c-i"><h3>${MARK.i} Indicators <span class="ct">${inds.length} of ${t.nInd}</span></h3><div class="nodes">${inds.map(o=>node('i',o,' '+sig(o.sev))).join('')}</div></div>
<div class="col c-t"><div class="typnode" id="tn"><span class="k">Typology <span class="mono">${t.id}</span></span><span class="nm">${esc(t.name)}</span><p>${esc(t.desc.split('. ')[0].replace(/\.$/,''))}.</p><div class="meta"><span>${t.nInd} indicators</span><span>${t.nCtl} controls</span><span>${t.nSrc} sources</span></div></div></div>
<div class="col c-c"><h3>${MARK.c} Controls <span class="ct">${ct.length} of ${t.nCtl}</span></h3><div class="nodes">${ct.map(o=>node('c',o,' &middot; '+lab('ctype',o.type))).join('')}</div></div>`;
 $('#btnote').innerHTML=`Showing the four highest-signal indicators and the first four controls linked to this typology. <a href="relationships#t=${id}">Open it in Relationships</a> to see all of them, plus exposure and evidence.`;
 document.querySelectorAll('#btpick button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
 requestAnimationFrame(()=>drawLines(anim));
}
function drawLines(anim){
 const svg=$('#blines'),tn=$('#tn');if(!svg||!tn)return;
 const flat=getComputedStyle(svg).display==='none',iN=[...btEl.querySelectorAll('.col.c-i .node')],cN=[...btEl.querySelectorAll('.col.c-c .node')];
 iN.forEach((n,k)=>n.dataset.n='i'+k);cN.forEach((n,k)=>n.dataset.n='c'+k);
 if(!flat){
  const fr=btEl.getBoundingClientRect(),tr=tn.getBoundingClientRect(),P=(r,s)=>({x:(s==='r'?r.right:r.left)-fr.left,y:r.top+r.height/2-fr.top});
  const cv=(a,b,c,n)=>{const dx=(b.x-a.x)/2;return `<path class="${c}" data-n="${n}" d="M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}"/>`};
  let h='';iN.forEach((n,k)=>{h+=cv(P(n.getBoundingClientRect(),'r'),P(tr,'l'),'hl','i'+k)});
  cN.forEach((n,k)=>{h+=cv(P(tr,'r'),P(n.getBoundingClientRect(),'l'),'hl2','c'+k)});svg.innerHTML=h}
 if(!anim)return;
 // signals arrive at the typology, then fan out to the controls
 FC.riseIn([tn],{dur:320});
 FC.riseIn(iN,{start:60,stagger:60});
 if(flat){btEl.classList.remove('go');void btEl.offsetWidth;btEl.classList.add('go');FC.riseIn(cN,{start:520,stagger:60});return}
 const t1=FC.drawThreads(svg,[...svg.querySelectorAll('path.hl')],{start:220,stagger:70});
 FC.riseIn(cN,{start:t1+40,stagger:70});
 FC.drawThreads(svg,[...svg.querySelectorAll('path.hl2')],{start:t1+80,stagger:70});
}
// hover or focus an item to follow its own thread
const lit=n=>{btEl.classList.toggle('hov',!!n);btEl.querySelectorAll('path.on,.node.on').forEach(e=>e.classList.remove('on'));
 if(n)btEl.querySelectorAll(`[data-n="${n}"]`).forEach(e=>e.classList.add('on'))};
btEl.addEventListener('pointerover',e=>{const n=e.target.closest('.node');lit(n&&n.dataset.n)});
btEl.addEventListener('pointerleave',()=>lit(null));
btEl.addEventListener('focusin',e=>{const n=e.target.closest('.node');lit(n&&n.dataset.n)});
btEl.addEventListener('focusout',()=>lit(null));
if(EX.length){
 $('#btpick').insertAdjacentHTML('beforeend',EX.map(id=>`<button type="button" data-id="${id}" aria-pressed="false">${esc(T[id].name)}</button>`).join(''));
 $('#btpick').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)trace(b.dataset.id)});
 // first trace plays when it scrolls into view, after the font has loaded
 const motion=!FC.calm()&&'IntersectionObserver' in window;
 if(motion)btEl.classList.add('pre');
 trace(EX[0],false);
 const ready=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
 ready.then(()=>{requestAnimationFrame(()=>drawLines(false));
  if(!motion)return;
  const io=new IntersectionObserver(es=>{if(!es.some(e=>e.isIntersecting))return;io.disconnect();btEl.classList.remove('pre');drawLines(true)},{threshold:.3});
  io.observe(btEl)});
 addEventListener('resize',()=>requestAnimationFrame(()=>drawLines(false)));
}else $('.bt').hidden=true;
})();
