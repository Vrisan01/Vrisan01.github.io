// Stockroom: inventory manager using Firebase Authentication + Cloud Firestore.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const url = l => l ? (/^https?:\/\//i.test(l) ? l : 'https://' + l) : '';

// ---------- state ----------
let U = '', D = null, ref = null, tab = 'inv', mode = 'in', step = 1, count = 3, names = [], chain = Promise.resolve();
const isLow = i => D.warnOn && i.warn && i.qty <= i.threshold;

const note = m => {
  const n = $('#note'); n.textContent = m; n.hidden = false;
  clearTimeout(note.t); note.t = setTimeout(() => n.hidden = true, 5000);
};

// Saves the whole inventory to this user's Firestore document (users/<uid>).
const save = () => {
  chain = chain.then(() => setDoc(ref, D)).catch(() => note('Couldn’t save your last change. Check your connection and try again.'));
};

function gate(msg, title) {
  $('#root').innerHTML = `<main class="center"><div class="card auth"><div class="logo">▦</div><h1>${title || 'Stockroom'}</h1><p class="mute">${msg}</p></div></main>`;
}
function render() { !D.setup ? setupView() : appView(); }

// ---------- firebase ----------
if (firebaseConfig.apiKey.startsWith('PASTE')) {
  gate('Add your Firebase settings to firebase-config.js, then reload this page.', 'Firebase isn’t set up yet');
} else {
  const app = initializeApp(firebaseConfig);
  window.auth = getAuth(app);
  window.db = getFirestore(app);
  onAuthStateChanged(auth, async user => {
    if (!user) { U = ''; D = null; ref = null; mode = 'in'; step = 1; authView(); return; }
    U = user.email; ref = doc(db, 'users', user.uid);
    gate('Loading your inventory…');
    try { const snap = await getDoc(ref); D = snap.exists() ? snap.data() : null; }
    catch (e) { gate('We couldn’t load your inventory. Reload the page to try again.', 'Couldn’t load'); return; }
    D = D || { setup: false, warnOn: true, items: [] };
    D.items = D.items || [];
    tab = 'inv'; render();
    if (D.setup) showWarn(D.items.filter(isLow));
  });
}

const authMsg = c => ({
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/email-already-in-use': 'That email already has an account. Log in instead.',
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.'
}[c] || 'Something went wrong. Try again.');

function authView() {
  const su = mode === 'up';
  $('#root').innerHTML = `<main class="center"><div class="card auth"><div class="logo">▦</div>
  <h1>${su ? 'Create your account' : 'Welcome back'}</h1>
  <p class="mute">${su ? 'Sign up to start tracking your inventory.' : 'Log in to see your inventory.'}</p>
  <label>Email<input id="u" type="email" autocomplete="email"></label>
  <label>Password<input id="p" type="password" autocomplete="${su ? 'new-password' : 'current-password'}"></label>
  <p class="err" id="err" role="alert"></p>
  <button class="btn full" id="go" style="margin-top:6px">${su ? 'Create account' : 'Log in'}</button>
  <p class="sw">${su ? 'Already have an account?' : 'New here?'} <button class="link" id="sw">${su ? 'Log in' : 'Create an account'}</button></p></div></main>`;
  const go = async () => {
    const e = $('#u').value.trim(), p = $('#p').value, er = $('#err'), btn = $('#go');
    if (!e || !p) { er.textContent = 'Enter your email and a password.'; return; }
    btn.disabled = true; er.textContent = '';
    try { su ? await createUserWithEmailAndPassword(auth, e, p) : await signInWithEmailAndPassword(auth, e, p); }
    catch (x) { er.textContent = authMsg(x.code); btn.disabled = false; }
  };
  $('#go').onclick = go;
  $('#root').onkeydown = ev => { if (ev.key === 'Enter') go(); };
  $('#sw').onclick = () => { mode = su ? 'in' : 'up'; authView(); };
  $('#u').focus();
}

// ---------- setup, inventory, settings, warnings ----------
function setupView(){
  const r=$('#root');r.onkeydown=null;
  if(step===1){
    r.innerHTML=`<main class="center"><div class="card auth"><div class="logo">▦</div><h1>Let’s set up your stock</h1>
    <p class="mute">How many types of items do you keep track of?</p>
    <label>Number of item types<input id="n" type="number" min="1" max="50" value="${count}"></label>
    <button class="btn full" id="nx">Continue</button></div></main>`;
    const nx=()=>{count=Math.min(50,Math.max(1,parseInt($('#n').value)||1));step=2;setupView()};
    $('#nx').onclick=nx;r.onkeydown=e=>{if(e.key==='Enter')nx()};$('#n').focus();
  }else{
    r.innerHTML=`<main class="center"><div class="card auth"><h1>Name your items</h1>
    <p class="mute">You can rename them any time in Settings.</p>
    <div class="names">${Array.from({length:count},(_,i)=>`<label>Item ${i+1}<input class="nm" placeholder="e.g. Printer paper" value="${esc(names[i]||'')}"></label>`).join('')}</div>
    <div class="actions"><button class="btn ghost" id="bk">Back</button><button class="btn" id="fin">Start tracking</button></div></div></main>`;
    const grab=()=>names=[...document.querySelectorAll('.nm')].map(x=>x.value.trim());
    $('#bk').onclick=()=>{grab();step=1;setupView()};
    $('#fin').onclick=()=>{grab();
      D.items=names.map((n,i)=>({id:uid(),name:n||'Item '+(i+1),qty:0,threshold:5,warn:true,link:''}));
      D.setup=true;save();names=[];step=1;render()};
    const f=document.querySelector('.nm');f&&f.focus();
  }
}

function appView(){
  $('#root').onkeydown=null;
  $('#root').innerHTML=`<header class="top"><div class="brand"><div class="logo">▦</div>Stockroom</div>
  <nav><button data-t="inv" class="${tab==='inv'?'on':''}">Inventory</button><button data-t="set" class="${tab==='set'?'on':''}">Settings</button></nav>
  <div class="who"><span>${esc(U)}</span><button class="link" id="lo">Log out</button></div></header>
  <main class="wrap" id="view"></main>`;
  $('#lo').onclick=()=>signOut(auth);
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;appView()});
  tab==='inv'?invView():setView();
}

function invView(){
  const n=D.items.filter(isLow).length,v=$('#view');
  v.innerHTML=`<div class="head"><div><h1>Inventory</h1><p class="mute">${D.items.length} item type${D.items.length===1?'':'s'}${n?` · ${n} running low`:''}</p></div></div>
  ${D.items.length?`<ul class="list">${D.items.map(i=>{const low=isLow(i),u=url(i.link);
    return `<li class="row ${low?'low':''}" data-id="${i.id}"><div class="nm"><strong>${esc(i.name)}</strong>
    <span class="chip ${low||i.qty===0?'bad':'ok'}">${i.qty===0?'Out of stock':low?'Low stock':'In stock'}</span>${D.warnOn&&i.warn?`<span class="small">Alert at ${i.threshold} or fewer</span>`:''}</div>
    <div class="qty"><button class="sq" data-a="-" aria-label="Decrease ${esc(i.name)}">−</button><input type="number" min="0" value="${i.qty}" data-a="set" aria-label="${esc(i.name)} quantity"><button class="sq" data-a="+" aria-label="Increase ${esc(i.name)}">+</button></div>
    ${u?`<a class="buy" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Buy more</a>`:''}</li>`}).join('')}</ul>`
  :`<div class="card empty">No items yet. Add some in Settings.</div>`}`;
  const setQty=(id,q)=>{const i=D.items.find(x=>x.id===id),old=i.qty;i.qty=Math.max(0,Math.floor(q)||0);save();
    const was=document.activeElement&&document.activeElement.dataset.a;invView();
    if(i.qty<old&&isLow(i))showWarn([i])};
  v.onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const id=b.closest('.row').dataset.id,i=D.items.find(x=>x.id===id);setQty(id,i.qty+(b.dataset.a==='+'?1:-1))};
  v.onchange=e=>{const t=e.target;if(t.dataset.a==='set')setQty(t.closest('.row').dataset.id,parseInt(t.value))};
}

function setView(){
  const v=$('#view');
  v.innerHTML=`<div class="head"><div><h1>Settings</h1><p class="mute">Rename items, set low-stock alerts and add purchase links.</p></div></div>
  <div class="card" style="margin-bottom:14px"><div class="sec"><div><h2>Low-stock warnings</h2><p class="mute">Show a pop-up when an item drops to its alert level.</p></div>
  <label class="chk" style="margin:0"><input type="checkbox" id="wo" ${D.warnOn?'checked':''}>Warnings on</label></div></div>
  <div class="set">${D.items.map(i=>`<div class="card" data-id="${i.id}"><label style="margin-top:0">Item name<input data-f="name" value="${esc(i.name)}"></label>
  <div class="grid2"><label>Alert when quantity is at or below<input type="number" min="0" data-f="threshold" value="${i.threshold}"></label>
  <label>Link to buy more<input data-f="link" placeholder="https://store.example.com/item" value="${esc(i.link)}"></label></div>
  <div class="sec"><label class="chk"><input type="checkbox" data-f="warn" ${i.warn?'checked':''}>Warn me about this item</label><button class="rm" data-rm>Remove item</button></div></div>`).join('')}</div>
  <button class="btn" id="add">Add item</button>`;
  $('#wo').onchange=e=>{D.warnOn=e.target.checked;save()};
  $('#add').onclick=()=>{D.items.push({id:uid(),name:'New item',qty:0,threshold:5,warn:true,link:''});save();setView();const c=document.querySelectorAll('[data-f=name]');c[c.length-1].select()};
  v.onchange=e=>{const t=e.target,f=t.dataset.f;if(!f)return;const i=D.items.find(x=>x.id===t.closest('.card').dataset.id);
    i[f]=f==='warn'?t.checked:f==='threshold'?Math.max(0,parseInt(t.value)||0):f==='name'?(t.value.trim()||i.name):t.value.trim();
    if(f==='name')t.value=i.name;save()};
  v.onclick=e=>{const b=e.target.closest('[data-rm]');if(!b)return;
    if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Click again to confirm';return}
    const id=b.closest('.card').dataset.id;D.items=D.items.filter(x=>x.id!==id);save();setView()};
}

function showWarn(list){
  if(!list||!list.length)return;
  const m=$('#modal');
  m.innerHTML=`<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="mt"><div class="ico">!</div>
  <h2 id="mt">${list.length>1?'Several items are running low':'Running low on '+esc(list[0].name)}</h2>
  <p class="mute">${list.length>1?'These items are at or below their alert level.':'This item is at or below its alert level.'}</p>
  <ul>${list.map(i=>{const u=url(i.link);return `<li><div><strong>${esc(i.name)}</strong><div class="small">${i.qty} left · alert at ${i.threshold}</div></div>${u?`<a class="buy" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Buy more</a>`:''}</li>`}).join('')}</ul>
  <button class="btn full" id="ok">Got it</button></div>`;
  m.hidden=false;const close=()=>{m.hidden=true};
  $('#ok').onclick=close;$('#ok').focus();m.onclick=e=>{if(e.target===m)close()};
  document.onkeydown=e=>{if(e.key==='Escape')close()};
}

