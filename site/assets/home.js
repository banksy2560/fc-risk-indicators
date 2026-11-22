/* Home: dashboard computed from the full index. */
(async function(){
'use strict';
const {$,esc,MARK,KIND,tag,sig,aiTag}=FC;
let x;try{x=await FC.load()}catch(e){return}
const {d,L,T,I,C}=x,lab=FC.lab,N=d.counts;
$('#stats').innerHTML=[['t','Typologies',N.typologies,'Criminal methods, each owned once','typologies'],['i','Indicators',N.indicators,'Observable signals with signal strength','indicators'],['c','Controls',N.controls,'Reusable measures, linked many-to-many','controls']]
 .map(([k,l,n,s,p])=>`<a class="stat ${KIND[k].cls}" href="${p}"><span class="n">${n}</span><span class="l">${l}<span class="s">${s}</span></span>${MARK[k]}</a>`).join('');
$('#quick').innerHTML='<span class="eyebrow">Try</span>'+['ML-MULE','FR-APP','CY-MIXER','ML-TBML','SANC-CRYPTO'].filter(id=>T[id]).map(id=>`<a href="relationships#t=${id}">${esc(T[id].name)}</a>`).join('');
const mx=Math.max(...d.domains.map(v=>v.n));
$('#domains').innerHTML=d.domains.map(v=>`<li><a class="hb" href="typologies#m=t&domain=${v.id}"><span class="lbl">${esc(v.label)}</span><span class="tr" role="presentation"><span class="fl" style="width:${v.n/mx*100}%"></span></span><span class="v">${v.n}</span></a></li>`).join('');
// insights
const single=d.indicators.filter(i=>i.used===1).length;
const noPrev=d.indicators.filter(i=>!i.ctls.some(c=>C[c].type==='preventive')).length;
const noDet=d.indicators.filter(i=>!i.ctls.some(c=>C[c].type==='detective')).length;
const tagged=d.typologies.filter(t=>FC.DIMS.some(s=>t.exp[s].length)).length;
const partial=d.typologies.filter(t=>FC.DIMS.some(s=>!t.exp[s].length));
const partialXC=partial.filter(t=>t.domain==='cross_cutting').length;
const fewest=[...d.typologies].sort((a,b)=>a.nCtl-b.nCtl||a.name.localeCompare(b.name)).slice(0,5);
const sev={};d.indicators.forEach(i=>sev[i.sev]=(sev[i.sev]||0)+1);
$('#insights').innerHTML=`
<div class="i"><span class="big">${Math.round(single/N.indicators*100)}%</span><p><strong>${single} of ${N.indicators} indicators</strong> appear in only one typology. The other ${N.indicators-single} are shared, so one review improves several typologies at once.</p></div>
<div class="i"><span class="big">${noPrev}</span><p>indicators have <strong>no preventive control</strong> linked in any typology; <strong>${noDet}</strong> have no detective control. Candidate gaps in the library, not in any institution.</p></div>
<div class="i"><span class="big">${tagged}</span><p>of ${N.typologies} typologies carry <strong>AI-inferred exposure tags</strong>; <strong>0</strong> are human-reviewed. ${partial.length} leave at least one dimension empty (${partialXC} of them cross-cutting, where empty means applies across all). ${aiTag}</p></div>
<div><p class="eyebrow" style="margin-bottom:6px">Fewest linked controls</p><ul class="bars">${fewest.map(f=>`<li><a class="hb neu" href="relationships#t=${f.id}" style="grid-template-columns:1fr 3.5ch"><span class="lbl">${esc(f.name)}</span><span class="v">${f.nCtl}</span></a></li>`).join('')}</ul></div>`;
// categories
const cat={};d.indicators.forEach(i=>cat[i.cat]=(cat[i.cat]||0)+1);const cmax=Math.max(...Object.values(cat));
$('#cat').innerHTML=Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<li><a class="hb ind" href="indicators#m=i&cat=${k}"><span class="lbl">${esc(lab('cat',k))}</span><span class="tr" role="presentation"><span class="fl" style="width:${v/cmax*100}%"></span></span><span class="v">${v}</span></a></li>`).join('');
// most reused
const rk=(items,k,n)=>items.slice(0,5).map(x=>`<li class="${KIND[k].cls}"><a data-k="${k}" href="${KIND[k].page}#${x.id}">${tag(k)}<span class="nm" style="display:block;margin-top:3px">${esc(x.name)}</span><span class="sub"><span class="mono">${x.id}</span>${k==='i'?' · '+sig(x.sev):' · '+lab('ctype',x.type)}</span></a><span class="cnt">${n(x)}<small>typologies</small></span></li>`).join('');
$('#topI').innerHTML=rk([...d.indicators].sort((a,b)=>b.used-a.used||a.name.localeCompare(b.name)),'i',v=>v.used);
$('#topC').innerHTML=rk([...d.controls].sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name)),'c',v=>v.nTyp);
// recently added: first git commit that added each typology file (real data; omitted if unavailable)
const withDates=d.typologies.filter(t=>t.added);
if(withDates.length===d.typologies.length){
 const rec=[...withDates].sort((a,b)=>b.added.localeCompare(a.added)||a.name.localeCompare(b.name));
 const top=rec.slice(0,5),batch=rec.filter(t=>t.ac===rec[0].ac).length,cm=d.commits[rec[0].ac];
 $('#recent').innerHTML=top.map(t=>`<li class="c-t"><a data-k="t" href="typologies#${t.id}">${tag('t')}<span class="nm" style="display:block;margin-top:3px">${esc(t.name)}</span><span class="sub">${t.nInd} indicators &middot; draft, unreviewed</span></a><span class="cnt" style="color:var(--ink-2)"><small class="recent-date">${t.added.slice(0,10)}</small></span></li>`).join('');
 $('#recentnote').innerHTML=`Dates are when each typology file was first committed to the repository (git), not a review or publication date. Latest commit <span class="mono">${esc(rec[0].ac)}</span> added ${batch} typologies: ${esc(cm.subject)}.`;
 $('#recentcard').hidden=false;
}
})();
