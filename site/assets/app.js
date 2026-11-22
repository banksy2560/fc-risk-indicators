/* Shared helpers: theme, nav state, data loading, link and tag builders */
(function(){
'use strict';
const root=document.documentElement;
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice=s=>{s=String(s||'').replace(/_/g,' ');return s};
const cap=s=>{s=nice(s);return s.charAt(0).toUpperCase()+s.slice(1)};

// theme: follows system unless an explicit choice is stored
function isDark(){return root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches}
function paintThemeBtn(){const b=document.getElementById('theme');if(!b)return;const d=isDark();b.setAttribute('aria-label','Switch to '+(d?'light':'dark')+' theme');b.title='Switch to '+(d?'light':'dark')+' theme'}
document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('theme');
  if(b){b.addEventListener('click',()=>{const n=isDark()?'light':'dark';root.dataset.theme=n;try{localStorage.setItem('fcri-theme',n)}catch(e){}paintThemeBtn()});paintThemeBtn()}
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',paintThemeBtn);
  const page=document.body.dataset.page;const key=page==='index'?'search':(page==='controls'||page==='indicators')?'typologies':page;
  document.querySelectorAll('.nav a').forEach(a=>{if(a.dataset.nav===key)a.setAttribute('aria-current','page')});
  // sticky offset for in-page sticky elements
  const top=document.getElementById('top');
  const setTop=()=>{const sticky=getComputedStyle(top).position==='sticky';root.style.setProperty('--top',sticky?top.offsetHeight+'px':'0px')};
  setTop();addEventListener('resize',setTop);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(setTop);
});

// data
const cache={};
function getJSON(path){
  if(!cache[path])cache[path]=fetch(path).then(r=>{if(!r.ok)throw new Error(path+' '+r.status);return r.json()}).catch(e=>{
    const n=document.getElementById('nofetch');if(n){n.hidden=false}
    if(location.protocol==='file:'){const m=document.getElementById('main');if(m)m.innerHTML=''}
    throw e});
  return cache[path];
}
let idx=null;
async function loadIndex(){
  if(idx)return idx;
  const d=await getJSON('data/index.json');
  const o={data:d,T:{},I:{},C:{},DOM:Object.fromEntries(d.domains.map(x=>[x.id,x.label]))};
  d.typologies.forEach(t=>o.T[t.id]=t);d.indicators.forEach(i=>o.I[i.id]=i);d.controls.forEach(c=>o.C[c.id]=c);
  o.FAMS=[...new Set(d.controls.map(c=>c.family))].sort();
  return idx=o;
}

const SIG_TITLE='Indicative signal strength only. Not a risk rating and never combined into a score.';
const sig=s=>s?`<span class="tag sig sig-${h(s)}" title="${SIG_TITLE}">signal: ${h(s)}</span>`:'';
const TAGS={
  'agent-reviewed':'An AI agent searched for it and found a matching real document. Not confirmed by a human; verify before relying on it.',
  'corrected, agent-reviewed':'The original title, year or publisher was wrong and was corrected by an AI agent. Not confirmed by a human.',
  'corrected, checked':'Corrected and checked by search. Not confirmed by a human; verify before relying on it.',
  'unverified':'Not confirmed by search; written from model knowledge.',
  'corrected, unverified':'Corrected from model knowledge; not confirmed by search.',
  'too vague, unverified':'Names a body or topic but not a specific document.',
  'replacement suggested, unverified':'The original could not be found; a nearest real document is suggested.',
  'untagged':'No citation status recorded.'};
const citeTag=t=>`<span class="cite ${/unverified|untagged/.test(t)?'warn':''}" title="${h(TAGS[t]||'Citation status')}">${h(t)}</span>`;
const L={typ:id=>'typologies#'+id,ctl:id=>'controls#'+id,ind:id=>'indicators#'+id};
const plural=(n,a,b)=>n+' '+(n===1?a:b);
const usedIn=n=>'used in '+plural(n,'typology','typologies');

window.FC={h,nice,cap,getJSON,loadIndex,sig,citeTag,TAGS,L,plural,usedIn,isDark,
  fail(e){console.error(e);const m=document.getElementById('main');if(m&&!m.querySelector('.callout'))m.insertAdjacentHTML('afterbegin','<div class="wrap"><div class="callout warn" role="alert">Could not load data. Please reload, or serve the site over HTTP.</div></div>')}};
})();
