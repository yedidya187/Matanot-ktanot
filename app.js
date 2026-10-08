import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, runTransaction, increment, writeBatch, query, where, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { BRANCH_IDS, CATEGORIES, KIT_CATEGORY, WA_TEXT } from './shared.js';
import { branchPageHtml } from './branch-page.js';

const firebaseConfig = {
  apiKey: "AIzaSyC0ErwzHBOVTsuKp-rdc15lKMoZ70T93Jw",
  authDomain: "matanot-ktanot-e6d5f.firebaseapp.com",
  projectId: "matanot-ktanot-e6d5f",
  storageBucket: "matanot-ktanot-e6d5f.firebasestorage.app",
  messagingSenderId: "1012453447392",
  appId: "1:1012453447392:web:5d040bc205b1a0651e6285"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// One fixed admin account created once in Firebase Console → Authentication.
// The password box in the UI stays the same; only the actual check moves
// from "compare to a string in this file" to real server-side verification.
const ADMIN_EMAIL = 'admin@matanot-ktanot.local';
// Paste the "Web app URL" you get after deploying the Google Apps Script
// (see setup instructions) between the quotes below. Leave empty ('') to
// keep Telegram notifications off.
const TELEGRAM_WEBHOOK_URL = '';
function notifyTelegram(loanData){
  if(!TELEGRAM_WEBHOOK_URL) return;
  fetch(TELEGRAM_WEBHOOK_URL,{
    method:'POST',
    mode:'no-cors', // Apps Script web apps don't return CORS headers; we don't need to read the response
    headers:{'Content-Type':'text/plain'}, // avoids a CORS preflight request
    body:JSON.stringify({name:loanData.name,phone:loanData.phone,item:loanData.item,date:loanData.date})
  }).catch(()=>{}); // best-effort only - a failed notification should never block borrowing
}
function cleanCat(cat){
  if(!cat)return '';
  return cat.replace(/[^\u0000-\u05FF\s\-]/gu,'').trim();
}
// Escapes any value before it is inserted into innerHTML, so data typed by
// visitors (borrower name/phone) or stored in Firestore can never be
// interpreted as HTML/JS by the browser (prevents stored XSS).
function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Always logs the real Firebase error (code + full object) to the console for
// diagnosis, and returns a Hebrew message for alert() that doesn't guess at a
// cause we can't actually confirm (e.g. "check your connection" when it's
// really a permission-denied) - just states the fact and what to do.
function logAndMessage(e, fallback){
  console.error('Firebase error:', e && e.code, e);
  return fallback;
}


// Which branch this page is. Each branch html file sets <body data-branch=...>.
// Every query, every new document and all per-device local storage is scoped
// by this value (localStorage is per-origin, so the keys carry the branch).
const BRANCH = document.body.dataset.branch;
if (!BRANCH_IDS.includes(BRANCH)) {
  document.body.textContent = 'הדף לא נמצא';
  throw new Error('Unknown branch: ' + BRANCH);
}
// The page markup is identical for every branch and lives in branch-page.js.
document.body.insertAdjacentHTML('afterbegin', branchPageHtml());
const MY_LOANS_KEY = `mtk_myLoans_${BRANCH}`;
const MSG_RATE_KEY = `mtk_msgRate_${BRANCH}`;
const MSG_RATE_LIMIT = 10; // max messages per device per day - client-side only, see firestore.rules
const MSG_RATE_WINDOW_MS = 24*60*60*1000;

// Random, unguessable per-loan "proof of ownership" token. Generated in the
// borrower's own browser at borrow time, stored only in that browser's
// localStorage and inside the loan document itself. Returning the item later
// means re-submitting this same value - Firestore rules check it matches
// what's already on the document, without the browser ever needing to read
// loans back (loans read is closed to the public - see report.md section 2).
function genToken(){
  if(window.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g,'');
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── LOCAL "MY LOANS" STORAGE (device-based self-return) ──
function getMyLoans(){
  try{ return JSON.parse(localStorage.getItem(MY_LOANS_KEY)||'[]'); }catch(e){ return []; }
}
function saveMyLoans(list){
  try{ localStorage.setItem(MY_LOANS_KEY, JSON.stringify(list)); }
  catch(e){ /* storage unavailable (private browsing etc) - self-return list just won't persist */ }
}
function addMyLoan(entry){ const list=getMyLoans(); list.push(entry); saveMyLoans(list); }
function removeMyLoan(loanId){ saveMyLoans(getMyLoans().filter(l=>l.loanId!==loanId)); }

const CAT_ICONS = Object.fromEntries(CATEGORIES.map(c => [c.name, c.icon]));
const PLACEHOLDERS = Object.fromEntries(CATEGORIES.map(c => [c.name, c.placeholder]));
const CAT_NAMES = CATEGORIES.map(c => c.name);

let basket=[], basketOpen=false, pageName='home', searchRaw='', searchQuery='';
let items=[], loans=[], messages=[], reviews=[], catFilter='הכל', editId=null, editImgData='', modalItem=null;
let loanSort={col:'date',dir:'desc'};

// ── LOAD DATA ──
async function loadItems(){
  const snap = await getDocs(query(collection(db,'items'),where('branch','==',BRANCH)));
  // First: load without images for fast render
  items = snap.docs.map(d=>{
    const data=d.data();
    return {id:d.id,...data,img:''};
  });
  renderGrid();
  // Then: load with images in background
  items = snap.docs.map(d=>({id:d.id,...d.data()}));
  cachedSample=[];
  renderGrid();
}

// Re-reads this branch's items without reshuffling the catalog (loadItems()
// is for the first load). Used by the admin panel's refreshes.
async function refreshItems(){
  const snap = await getDocs(query(collection(db,'items'),where('branch','==',BRANCH)));
  items = snap.docs.map(d=>({id:d.id,...d.data()}));
  const byId=new Map(items.map(i=>[i.id,i]));
  cachedSample=cachedSample.map(i=>byId.get(i.id)).filter(Boolean);
  const known=new Set(cachedSample.map(i=>i.id));
  items.forEach(i=>{if(!known.has(i.id))cachedSample.push(i);});
  renderGrid();
}

let allItemsLoaded=false;

async function loadItemsPage(reset=false){
  if(reset){allItemsLoaded=false;cachedSample=[];}
  if(allItemsLoaded)return;
  const cats=CAT_NAMES;
  const shownIds=new Set(cachedSample.map(i=>i.id));
  const newItems=[];
  for(const cat of cats){
    const unshown=items.filter(i=>cleanCat(i.cat)===cat&&!shownIds.has(i.id));
    const shuffled=[...unshown].sort(()=>Math.random()-.5);
    newItems.push(...shuffled.slice(0,2));
  }
  if(newItems.length<8){
    const used=new Set([...shownIds,...newItems.map(i=>i.id)]);
    const rest=items.filter(i=>!used.has(i.id)).sort(()=>Math.random()-.5);
    newItems.push(...rest.slice(0,8-newItems.length));
  }
  cachedSample=[...cachedSample,...newItems.sort(()=>Math.random()-.5)];
  if(cachedSample.length>=items.length)allItemsLoaded=true;
}
// Admin-only from here on: loans read is closed to the public (see
// firestore.rules) - this only succeeds once an admin is signed in.
async function loadLoans(){
  const snap = await getDocs(query(collection(db,'loans'),where('branch','==',BRANCH)));
  loans = snap.docs.map(d=>{const data=d.data();return {id:d.id,...data};});
}
// Admin-only too - the new "messages" collection (see firestore.rules).
async function loadMessages(){
  const snap = await getDocs(query(collection(db,'messages'),where('branch','==',BRANCH)));
  messages = snap.docs.map(d=>({id:d.id,...d.data()}));
}
// Admin-only too - the new "reviews" collection (see firestore.rules).
async function loadReviews(){
  const snap = await getDocs(query(collection(db,'reviews'),where('branch','==',BRANCH)));
  reviews = snap.docs.map(d=>({id:d.id,...d.data()}));
}

// ── AVAILABILITY ──
// Lives directly on the item document now (no public read of `loans` at
// all). Missing field (before the one-time migration runs) is treated as
// available - see the migration section and the testing checklist.
function isAvailable(item){
  return item.available===false ? 'tk' : 'av';
}
function statusLabel(s){return s==='av'?'פנוי להשאלה':'כרגע אצל זוג מאושר אחר ♥';}

// ── PAGES ──
function showPage(p){
  pageName=p;updateBasketUI();
  ['home','about','admin'].forEach(x=>document.getElementById('page-'+x).classList.toggle('hidden',x!==p));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));
  const nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('on');
  // Track page view in Analytics
  const pageNames={'home':'דף ראשי','about':'אודות','admin':'ניהול'};
  if(typeof gtag!=='undefined') gtag('event','page_view',{page_title:pageNames[p]||p,page_location:window.location.href+'#'+p,branch:BRANCH});
}

// ── FILTERS ──
function setFilter(val){
  catFilter=cleanCat(val)||val;
  currentPage=1;cachedSample=[];
  document.querySelectorAll('.fb-cat').forEach(b=>b.classList.toggle('on',b.dataset.cat===val));
  renderGrid();
}

// ── GRID ──
function getSmartSample(items){
  // First 8: 2 from each category, then rest randomly
  const cats=CAT_NAMES;
  const first=[];
  const rest=[];
  cats.forEach(cat=>{
    const catItems=[...items.filter(i=>i.cat===cat)].sort(()=>Math.random()-.5);
    first.push(...catItems.slice(0,2));
    rest.push(...catItems.slice(2));
  });
  return [...first.sort(()=>Math.random()-.5), ...rest.sort(()=>Math.random()-.5)];
}

let cachedSample=[];

let currentPage=1;
const PAGE_SIZE=8;

// Instant search over the items already in memory: name and description,
// combined with the category filter. No request to the server.
const normSearch=s=>String(s||'').toLowerCase().trim();
const matchesSearch=(i,q)=>normSearch(i.name).includes(q)||normSearch(i.desc).includes(q);
function setSearch(raw){
  searchRaw=raw;searchQuery=normSearch(raw);
  currentPage=1;
  renderGrid();
}
function renderGrid(){
  const grid=document.getElementById('items-grid');
  const pgDiv=document.getElementById('pagination');
  
  let pool;
  if(catFilter==='הכל'){
    // Smart order: ensure all categories represented
    const cats=CAT_NAMES;
    if(cachedSample.length===0){
      const first=[];
      cats.forEach(cat=>{
        const ci=items.filter(i=>cleanCat(i.cat)===cat).sort(()=>Math.random()-.5);
        first.push(...ci.slice(0,2));
      });
      const usedIds=new Set(first.map(i=>i.id));
      const rest=items.filter(i=>!usedIds.has(i.id)).sort(()=>Math.random()-.5);
      cachedSample=[...first.sort(()=>Math.random()-.5),...rest];
    }
    pool=cachedSample;
  }else{
    pool=items.filter(i=>cleanCat(i.cat)===catFilter);
  }
  
  if(searchQuery)pool=pool.filter(i=>matchesSearch(i,searchQuery));

  if(!pool.length){
    grid.innerHTML=searchQuery
      ?`<div class="empty"><div class="ei">&#128269;</div>לא נמצאו פריטים שמתאימים ל-"${esc(searchRaw.trim())}"${catFilter!=='הכל'?' בקטגוריה הזו':''}.<br/><button class="fb-cat" id="btn-clear-search" style="margin-top:.9rem">ניקוי החיפוש</button></div>`
      :'<div class="empty"><div class="ei">&#128269;</div>לא נמצאו פריטים</div>';
    document.getElementById('btn-clear-search')?.addEventListener('click',()=>{document.getElementById('catalog-search').value='';setSearch('');});
    pgDiv.style.display='none';
    return;
  }
  
  const totalPages=Math.ceil(pool.length/PAGE_SIZE);
  if(currentPage>totalPages)currentPage=1;
  const start=(currentPage-1)*PAGE_SIZE;
  const toShow=pool.slice(start,start+PAGE_SIZE);
  
  grid.innerHTML=toShow.map((item,idx)=>{
    const st=isAvailable(item);
    const img=item.img||PLACEHOLDERS[item.cat]||'';
    return `<div class="card ${st!=='av'?'dim':''}" style="animation-delay:${idx*0.05}s" data-id="${item.id}">
      <img class="card-img" src="${img}" alt="${esc(item.name)}" loading="lazy" onerror="this.style.display='none'"/>
      <div class="card-body">
        <div class="cbadge">${CAT_ICONS[cleanCat(item.cat)]||''} ${esc(cleanCat(item.cat))}</div>
        <div class="cname">${esc(item.name)}</div>
        <div class="cdesc">${esc(item.desc||'')}</div>
        <div class="sdot ${st}">${statusLabel(st)}</div>
        ${st==='av'?`<button class="bbtn bbtn-add${basket.includes(item.id)?' on':''}" data-add="${item.id}">${basket.includes(item.id)?ADD_ON_LABEL:ADD_LABEL}</button>`:'<button class="bbtn" disabled>כרגע אצל זוג מאושר אחר ♥</button>'}
      </div></div>`;
  }).join('');
  
  grid.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();toggleBasket(btn.dataset.add);}));
  grid.querySelectorAll('[data-id]').forEach(card=>card.addEventListener('click',()=>openModal(card.dataset.id)));
  
  // Pagination buttons
  if(totalPages<=1){pgDiv.style.display='none';return;}
  pgDiv.style.display='flex';
  pgDiv.innerHTML='';
  for(let i=1;i<=totalPages;i++){
    const btn=document.createElement('button');
    btn.className='page-btn'+(i===currentPage?' on':'');
    btn.textContent=i;
    btn.addEventListener('click',()=>{currentPage=i;renderGrid();document.getElementById('cat-sec').scrollIntoView({behavior:'smooth'});});
    pgDiv.appendChild(btn);
  }
}

// ── MODAL ──
function openModal(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  modalItem=item;
  const st=isAvailable(item);
  document.getElementById('modal-img').src=item.img||PLACEHOLDERS[item.cat]||'';
  document.getElementById('modal-badge').innerHTML=(CAT_ICONS[item.cat]||'')+' '+esc(item.cat);
  document.getElementById('modal-name').textContent=item.name;
  document.getElementById('modal-desc').textContent=item.desc||'';
  const ks=document.getElementById('modal-kit-sections');
  ks.innerHTML='';
  if(item.cat===KIT_CATEGORY){
    if(item.kitWe) ks.innerHTML+=`<div class="kit-section"><h4>&#9989; אנחנו כבר דאגנו ל...</h4><p style="white-space:pre-line">${esc(item.kitWe)}</p></div>`;
    if(item.kitYou) ks.innerHTML+=`<div class="kit-section orange"><h4>&#127968; עוד קצת השקעה מהבית</h4><p style="white-space:pre-line">${esc(item.kitYou)}</p></div>`;
  }
  syncModalBtn();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
  // Track view - best-effort background telemetry, not a user-initiated
  // action the visitor is waiting on, so a failure stays silent to them
  // (unlike borrow/return/message actions below) and only logs for devs.
  updateDoc(doc(db,'items',item.id),{views:increment(1)}).catch(e=>console.warn('view count update failed',e));
  item.views=(item.views||0)+1;
}

// ── BORROW ──
function showSection(sec){
  if(sec&&typeof gtag!=='undefined') gtag('event',sec==='borrow'?'borrow_start':'return_start',{branch:BRANCH});
  document.getElementById('section-borrow').classList.toggle('hidden',sec!=='borrow');
  document.getElementById('section-return').classList.toggle('hidden',sec!=='return');
  document.getElementById('action-sec').scrollIntoView({behavior:'smooth'});
  basketOpen=false;
  updateBasketUI();
  if(sec==='borrow'){
    document.getElementById('basket-wrap').classList.add('hidden');
    document.getElementById('borrow-result').innerHTML='';
    document.getElementById('borrow-success').classList.add('hidden');
  }
  if(sec==='return'){
    document.getElementById('basket-wrap').classList.add('hidden');
    document.getElementById('r-return-success').classList.add('hidden');
    document.getElementById('r-feedback-box').classList.add('hidden');
    placeReviewBox(document.getElementById('r-return-success'));
    document.getElementById('rv-text').value='';
    document.getElementById('m-form').classList.remove('hidden');
    document.getElementById('m-success').classList.add('hidden');
    document.getElementById('m-name').value='';
    document.getElementById('m-phone').value='';
    document.getElementById('m-message').value='';
    renderMyLoans();
  }
}

// ── BORROW (the only way to borrow) ──
// Items are collected with "הוסף להשאלה", shown as a thin strip at the bottom
// of the screen, and borrowed together in one form. Each item still gets its
// own loan document (so returns stay per item), all sharing one groupId.
const ADD_LABEL='הוסף להשאלה', ADD_ON_LABEL='✓ נבחר (הסר)';
function toggleBasket(id){
  const it=items.find(i=>i.id===id);
  if(basket.includes(id))basket=basket.filter(x=>x!==id);
  else if(it&&isAvailable(it)==='av')basket.push(id);
  updateBasketUI();
}
function syncModalBtn(){
  if(!modalItem)return;
  const btn=document.getElementById('modal-borrow-btn');
  const av=isAvailable(modalItem)==='av';
  btn.disabled=!av;
  btn.textContent=!av?'לא זמין כעת':basket.includes(modalItem.id)?ADD_ON_LABEL:ADD_LABEL;
}
function updateBasketUI(){
  // an item taken in the meantime (e.g. borrowed on its own) can't stay selected
  basket=basket.filter(id=>{const it=items.find(i=>i.id===id);return it&&isAvailable(it)==='av';});
  document.querySelectorAll('[data-add]').forEach(b=>{
    const on=basket.includes(b.dataset.add);
    b.classList.toggle('on',on);
    b.textContent=on?ADD_ON_LABEL:ADD_LABEL;
  });
  syncModalBtn();
  const bar=document.getElementById('basket-bar');
  if(!bar)return;
  const show=basket.length>0&&pageName==='home'&&!basketOpen;
  bar.classList.toggle('hidden',!show);
  document.body.classList.toggle('has-basket',show);
  if(show)bar.textContent=basket.length===1?'נבחר פריט אחד להשאלה · לחצו להמשך':`נבחרו ${basket.length} פריטים להשאלה · לחצו להמשך`;
}
function renderBasketList(){
  const list=document.getElementById('basket-list');
  list.innerHTML=basket.map(id=>{
    const it=items.find(i=>i.id===id);
    return it?`<div class="basket-row"><span class="bn">${esc(it.name)}</span><button data-brm="${it.id}">הסר</button></div>`:'';
  }).join('');
  list.querySelectorAll('[data-brm]').forEach(b=>b.addEventListener('click',()=>{
    basket=basket.filter(x=>x!==b.dataset.brm);
    if(!basket.length){showSection('borrow');return;}
    renderBasketList();updateBasketUI();
  }));
}
// Menu button / links: the catalog is where items are chosen. Already chosen
// something? Go straight to the form.
function goBorrow(){
  showPage('home');
  if(basket.length){openBasketForm();return;}
  setTimeout(()=>document.getElementById('cat-sec').scrollIntoView({behavior:'smooth'}),50);
}
function openBasketForm(){
  if(!basket.length)return;
  showSection('borrow');
  document.getElementById('borrow-success').classList.add('hidden');
  document.getElementById('basket-wrap').classList.remove('hidden');
  document.getElementById('bk-confirm').checked=false;
  const btn=document.getElementById('btn-submit-basket');btn.disabled=false;btn.textContent='סימון לקיחה \u{1F499}';
  renderBasketList();
  basketOpen=true;updateBasketUI();
}
async function submitBasket(){
  const name=document.getElementById('bk-name').value.trim();
  const phone=document.getElementById('bk-phone').value.trim();
  if(!name||!phone){alert('יש למלא שם וטלפון');return;}
  if(!document.getElementById('bk-confirm').checked){alert('יש לאשר את התנאים');return;}
  const chosen=basket.map(id=>items.find(i=>i.id===id)).filter(Boolean);
  if(!chosen.length){alert('לא נבחרו פריטים.');return;}
  const btn=document.getElementById('btn-submit-basket');
  btn.disabled=true;btn.textContent='שולח...';
  const now=new Date();
  const shared={name,phone,date:now.toLocaleDateString('he-IL'),timestamp:now.toISOString(),status:'פעיל',seen:false,branch:BRANCH,groupId:genToken()};
  const prepared=chosen.map(it=>({it,itemRef:doc(db,'items',it.id),loanRef:doc(collection(db,'loans')),returnToken:genToken()}));
  try{
    // One transaction. An item that was taken in the meantime is skipped and
    // reported; the others are still recorded.
    const {ok,blocked}=await runTransaction(db,async(tx)=>{
      const snaps=await Promise.all(prepared.map(p=>tx.get(p.itemRef)));
      const ok=[],blocked=[];
      snaps.forEach((snap,i)=>{
        if(!snap.exists()||snap.data().available===false)blocked.push(prepared[i]);else ok.push(prepared[i]);
      });
      ok.forEach(p=>{
        tx.update(p.itemRef,{available:false,borrows:increment(1)});
        tx.set(p.loanRef,{itemId:p.it.id,item:p.it.name,...shared,returnToken:p.returnToken});
      });
      return {ok,blocked};
    });
    ok.forEach(p=>{
      p.it.available=false;
      addMyLoan({loanId:p.loanRef.id,itemId:p.it.id,itemName:p.it.name,date:shared.date,returnToken:p.returnToken,groupId:shared.groupId});
    });
    blocked.forEach(p=>{p.it.available=false;});
    basket=[];
    renderGrid();
    const blockedNames=blocked.map(p=>'"'+p.it.name+'"').join(', ');
    if(!ok.length){
      alert((blocked.length===1?'הפריט שבחרתם כבר נלקח':'הפריטים שבחרתם כבר נלקחו')+' על ידי מישהו אחר ולא נרשם: '+blockedNames+'. רעננו את הדף ובחרו פריטים אחרים.');
      showSection('borrow');
      return;
    }
    showSection('borrow');
    document.getElementById('borrow-result').innerHTML=
      `<p style="font-weight:700;color:var(--teal-dark)">נרשמו ${ok.length} ${ok.length===1?'פריט':'פריטים'}</p>`+
      (blocked.length?`<p style="color:#B05030;margin-top:.4rem">${blocked.length===1?'הפריט הבא לא היה זמין ולא נרשם':'הפריטים הבאים לא היו זמינים ולא נרשמו'}: ${esc(blockedNames)}</p>`:'');
    document.getElementById('borrow-success').classList.remove('hidden');
    notifyTelegram({...shared,item:ok.map(p=>p.it.name).join(', ')});
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&'serviceWorker' in navigator){
      navigator.serviceWorker.ready.then(reg=>{
        reg.showNotification('השאלה חדשה ♥',{body:name+' לקח/ה '+ok.length+' פריטים',icon:'logo.gif',dir:'rtl',vibrate:[200,100,200]});
      }).catch(()=>{});
    }
  }catch(e){
    alert(logAndMessage(e,'שגיאה בשמירת ההשאלה. נסו שוב בעוד רגע, ואם זה נמשך פנו למנהל.'));
    btn.disabled=false;btn.textContent='סימון לקיחה \u{1F499}';
  }
}

// ── RETURN (device-based - see report.md section 2, option ב) ──
function renderMyLoans(){
  const wrap=document.getElementById('r-my-loans');
  const list=getMyLoans();
  if(!list.length){wrap.classList.add('hidden');document.getElementById('r-items').innerHTML='';return;}
  wrap.classList.remove('hidden');
  document.getElementById('r-items').innerHTML=list.map(l=>`
    <div class="r-loan-item">
      <div><div class="r-loan-name">${esc(l.itemName)}</div><div class="r-loan-date">נלקח ב: ${esc(l.date||'')}</div></div>
      <button class="r-return-btn" data-lid="${l.loanId}">סימון החזרה &#9996;</button>
    </div>`).join('');
  document.getElementById('r-items').querySelectorAll('[data-lid]').forEach(btn=>btn.addEventListener('click',()=>confirmReturn(btn.dataset.lid)));
}

async function confirmReturn(loanId){
  const entry=getMyLoans().find(l=>l.loanId===loanId);
  if(!entry){alert('לא נמצאה רשומת השאלה כזו במכשיר הזה.');return;}
  const btn=document.querySelector(`#r-items [data-lid="${loanId}"]`);
  if(btn){btn.disabled=true;btn.textContent='מסמן...';}
  try{
    const batch=writeBatch(db);
    // seen:false - flags this as a fresh event for the admin notification
    // bell (see renderNotifications/startPolling), same mechanism as a new
    // borrow. Admin-initiated returns elsewhere deliberately leave `seen`
    // untouched - the admin already knows about their own action.
    batch.update(doc(db,'loans',loanId),{status:'הוחזר',returnedTimestamp:new Date().toISOString(),returnToken:entry.returnToken,seen:false});
    batch.update(doc(db,'items',entry.itemId),{available:true});
    await batch.commit();
    // Only remove the local record once the return has actually succeeded
    // in the database - never on failure, or the visitor loses the only
    // way to retry/self-return this loan from this device.
    removeMyLoan(loanId);
    const it=items.find(i=>i.id===entry.itemId);if(it)it.available=true;
    renderGrid();
    renderMyLoans();
    document.getElementById('r-return-success').classList.remove('hidden');
    showReviewBoxAfter(document.getElementById('r-return-success'));
    // Best-effort local notification - only fires
    // if this exact browser happens to have notification permission granted
    // (in practice: an admin testing/returning from their own device). The
    // real cross-device delivery to the admin is startPolling()'s 30s check.
    if(Notification.permission==='granted' && 'serviceWorker' in navigator){
      navigator.serviceWorker.ready.then(reg=>{
        reg.showNotification('החזרה ✌',{
          body: entry.itemName + ' הוחזר',
          icon: 'logo.gif',
          dir: 'rtl',
          vibrate: [200,100,200]
        });
      }).catch(()=>{});
    }
  }catch(e){
    // permission-denied here is still just a failure (rules not deployed
    // yet, a genuinely stale/already-returned loan, a token mismatch, or
    // something else) - never guess which, and never treat it as handled.
    alert(logAndMessage(e,'שגיאה בסימון ההחזרה. נסו שוב בעוד רגע, ואם זה נמשך פנו למנהל.'));
    if(btn){btn.disabled=false;btn.textContent='סימון החזרה ✌';}
  }
}

// ── MESSAGES (contact admins - always available under the return screen) ──
function canSendMsg(){
  try{
    const rec=JSON.parse(localStorage.getItem(MSG_RATE_KEY)||'null')||{count:0,windowStart:0};
    if(Date.now()-rec.windowStart>MSG_RATE_WINDOW_MS)return true;
    return rec.count<MSG_RATE_LIMIT;
  }catch(e){return true;}
}
function recordMsgSent(){
  try{
    const now=Date.now();
    let rec=JSON.parse(localStorage.getItem(MSG_RATE_KEY)||'null')||{count:0,windowStart:now};
    if(now-rec.windowStart>MSG_RATE_WINDOW_MS)rec={count:0,windowStart:now};
    rec.count++;
    localStorage.setItem(MSG_RATE_KEY,JSON.stringify(rec));
  }catch(e){/* soft limit only - see firestore.rules comment on /messages */}
}
async function sendMessage(){
  const name=document.getElementById('m-name').value.trim();
  const phone=document.getElementById('m-phone').value.trim();
  const message=document.getElementById('m-message').value.trim();
  if(!name||!phone){alert('יש למלא שם וטלפון');return;}
  if(!message){alert('יש לכתוב הודעה');return;}
  if(!canSendMsg()){alert('הגעתם למגבלת ההודעות היומית. אם זה דחוף, כתבו לנו בוואטסאפ.');return;}
  const btn=document.getElementById('btn-send-msg');
  btn.disabled=true;btn.textContent='שולח...';
  try{
    await addDoc(collection(db,'messages'),{name,phone,message,timestamp:new Date().toISOString(),seen:false,branch:BRANCH});
    recordMsgSent();
    document.getElementById('m-name').value='';
    document.getElementById('m-phone').value='';
    document.getElementById('m-message').value='';
    // The form is replaced (not just followed) by the success message and
    // the review box, same as after a return through the system.
    document.getElementById('m-form').classList.add('hidden');
    document.getElementById('m-success').classList.remove('hidden');
    showReviewBoxAfter(document.getElementById('m-success'));
  }catch(e){
    alert(logAndMessage(e,'שגיאה בשליחת ההודעה. נסו שוב בעוד רגע, ואם זה נמשך פנו למנהל.'));
  }finally{
    btn.disabled=false;btn.textContent='שליחת הודעה ✉';
  }
}

// ── FEEDBACK (general review, shown after a successful return or message) ──
// One review box in the DOM, moved to sit right under whichever success
// message the visitor just got.
function placeReviewBox(anchor){anchor.after(document.getElementById('r-feedback-box'));}
function showReviewBoxAfter(anchor){
  placeReviewBox(anchor);
  document.getElementById('rv-text').value='';
  document.getElementById('r-feedback-box').classList.remove('hidden');
}
function skipReview(){
  document.getElementById('r-feedback-box').classList.add('hidden');
}
async function sendReview(){
  const message=document.getElementById('rv-text').value.trim();
  if(!message){skipReview();return;} // optional - nothing typed is the same as skipping
  const btn=document.getElementById('btn-send-review');
  btn.disabled=true;btn.textContent='שולח...';
  try{
    await addDoc(collection(db,'reviews'),{message,timestamp:new Date().toISOString(),seen:false,branch:BRANCH});
    document.getElementById('r-feedback-box').classList.add('hidden');
  }catch(e){
    alert(logAndMessage(e,'שגיאה בשליחת הביקורת. נסו שוב בעוד רגע.'));
  }finally{
    btn.disabled=false;btn.textContent='שליחה';
  }
}

// ── ADMIN ──
async function tryLogin(){
  const pass=document.getElementById('admin-pass-input').value;
  const btn=document.getElementById('btn-login');
  btn.disabled=true;
  try{
    // Verified by Firebase Auth on the server, not by comparing strings
    // in this file — this is what actually protects the write/delete
    // operations below, together with the Firestore security rules.
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass);
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    document.getElementById('admin-err').style.display='none';
    document.getElementById('admin-pass-input').value='';
    // Register service worker and request push permission
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').then(reg=>{
        if(Notification.permission==='default'){
          Notification.requestPermission().then(p=>{
            if(p==='granted') console.log('התראות אושרו!');
          });
        }
      });
    }
    if(Notification&&Notification.permission==='default')Notification.requestPermission();
    if(!document.querySelector('link[rel=manifest]')){
      // Install-as-app is for admins only: public pages carry no manifest.
      const m=document.createElement('link');m.rel='manifest';m.href='manifest-'+BRANCH+'.json';document.head.appendChild(m);
    }
    startPolling();
    Promise.all([loadLoans(), loadItems(), loadMessages(), loadReviews()]).then(()=>{
      // Start the push counters from what's already on screen, so the first
      // poll doesn't re-announce messages/reviews the admin is looking at.
      lastMsgCount=unseenMessages().length;lastReviewCount=unseenReviews().length;
      renderAllAdmin();renderAdminItems();
    });
    if(Notification&&Notification.permission==='default') Notification.requestPermission();
  }catch(e){
    document.getElementById('admin-err').style.display='block';
  }finally{
    btn.disabled=false;
  }
}

let adminTab='notif';
// Which data each admin tab shows, so opening it always starts from the
// database and not from what was loaded at sign-in.
const ADMIN_TAB_LOADERS={
  notif:()=>Promise.all([loadLoans(),loadMessages(),loadReviews()]),
  loans:()=>loadLoans(),
  items:()=>Promise.all([refreshItems(),loadLoans()]),
  stats:()=>Promise.all([refreshItems(),loadLoans()]),
  messages:()=>loadMessages(),
  reviews:()=>loadReviews()
};
function renderAdminData(){
  renderAllAdmin();renderAdminItems();
  if(adminTab==='stats')renderStats();
}
async function refreshAdminTab(tab){
  const load=ADMIN_TAB_LOADERS[tab];
  if(!load)return;
  try{
    await load();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בריענון הנתונים. ייתכן שמוצג מידע לא עדכני.'));
    return;
  }
  if(adminTab===tab)renderAdminData();
}
function setAdminTab(tab){
  adminTab=tab;
  ['notif','loans','items','stats','messages','reviews','settings'].forEach(t=>{
    document.getElementById('admin-'+t).classList.toggle('hidden',t!==tab);
    document.getElementById('tab-'+t).classList.toggle('on',t===tab);
  });
  if(tab==='notif') renderNotifications();
  if(tab==='stats') renderStats();
  if(tab==='messages') renderAdminMessages();
  if(tab==='reviews') renderAdminReviews();
  if(tab==='settings') fillSettingsForm();
  if(tab==='items') initCopyTool();
  refreshAdminTab(tab);
}

function sortedLoans(){
  const {col,dir}=loanSort;
  const mult=dir==='asc'?1:-1;
  return [...loans].sort((a,b)=>{
    let av,bv;
    if(col==='date'){av=a.timestamp||a.date||'';bv=b.timestamp||b.date||'';}
    else if(col==='status'){av=a.status||'';bv=b.status||'';}
    else{av=(a.item||'').toLowerCase();bv=(b.item||'').toLowerCase();}
    if(av<bv)return -1*mult;
    if(av>bv)return 1*mult;
    return 0;
  });
}
function updateSortArrows(){
  ['date','status'].forEach(c=>{
    const arrow=document.getElementById('sort-arrow-'+c);
    const head=document.querySelector(`[data-sortcol="${c}"]`);
    if(!arrow||!head)return;
    if(loanSort.col===c){
      arrow.textContent=loanSort.dir==='asc'?'▲':'▼';
      head.classList.add('sort-on');
    }else{
      arrow.textContent='';
      head.classList.remove('sort-on');
    }
  });
}
function renderAdminLoans(){
  const el=document.getElementById('loans-list');
  document.getElementById('loans-title').textContent=`ניהול השאלות (${loans.length})`;
  updateSortArrows();
  if(!loans.length){el.innerHTML='<div class="empty"><div class="ei">&#128237;</div>אין השאלות עדיין</div>';return;}
  const groupSize={};loans.forEach(l=>{if(l.groupId)groupSize[l.groupId]=(groupSize[l.groupId]||0)+1;});
  const hue=g=>[...g].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,7);
  el.innerHTML=sortedLoans().map(l=>`
    <div class="lrow"${l.groupId&&groupSize[l.groupId]>1?` style="border-inline-start:4px solid hsl(${hue(l.groupId)} 55% 55%)"`:''}>
      <span class="lid" style="font-weight:700;color:var(--teal);font-size:.8rem">${l.id.slice(-4)}</span>
      <span style="font-weight:600;font-size:.84rem">${esc(l.item)}</span>
      <span class="sbadge ${l.status==='פעיל'?'act':'ret'}">${esc(l.status)}</span>
      <span style="color:var(--text-mid);font-size:.78rem;grid-column:2">${esc(l.name)} &middot; ${esc(l.phone)} &middot; ${esc(l.date||'')}${l.groupId&&groupSize[l.groupId]>1?`<span class="grp-badge" title="הפריטים האלה נלקחו יחד באותה השאלה">&#128279; השאלה משותפת · ${groupSize[l.groupId]} פריטים</span>`:''}</span>
      ${l.status==='פעיל'?`<button class="retbtn" data-lid="${l.id}">החזיר</button>`:''}
      <button class="delbtn" data-del="${l.id}" style="font-size:.72rem;padding:.22rem .55rem">מחק</button>
    </div>`).join('');
  el.querySelectorAll('[data-lid]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const loan=loans.find(l=>l.id===btn.dataset.lid);
    try{
      const returnedTimestamp=new Date().toISOString();
      const batch=writeBatch(db);
      batch.update(doc(db,'loans',btn.dataset.lid),{status:'הוחזר',returnedTimestamp});
      if(loan)batch.update(doc(db,'items',loan.itemId),{available:true});
      await batch.commit();
      loans=loans.map(l=>l.id===btn.dataset.lid?{...l,status:'הוחזר',returnedTimestamp}:l);
      if(loan){const it=items.find(i=>i.id===loan.itemId);if(it)it.available=true;}
      renderAdminLoans();renderGrid();renderAdminItems();
    }catch(e){
      alert(logAndMessage(e,'שגיאה בסימון ההחזרה. נסה שוב.'));
      btn.disabled=false;
    }
  }));
  el.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('למחוק השאלה זו מההיסטוריה?'))return;
    const loan=loans.find(l=>l.id===btn.dataset.del);
    try{
      const batch=writeBatch(db);
      batch.delete(doc(db,'loans',btn.dataset.del));
      if(loan&&loan.status==='פעיל')batch.update(doc(db,'items',loan.itemId),{available:true});
      await batch.commit();
      loans=loans.filter(l=>l.id!==btn.dataset.del);
      if(loan&&loan.status==='פעיל'){const it=items.find(i=>i.id===loan.itemId);if(it)it.available=true;}
      renderAdminLoans();renderNotifications();renderGrid();renderAdminItems();
    }catch(e){
      alert(logAndMessage(e,'שגיאה במחיקת ההשאלה. נסה שוב.'));
    }
  }));
}
document.querySelectorAll('.lhead [data-sortcol]').forEach(head=>{
  head.addEventListener('click',()=>{
    const col=head.dataset.sortcol;
    if(loanSort.col===col) loanSort.dir=loanSort.dir==='asc'?'desc':'asc';
    else loanSort={col,dir:'desc'};
    renderAdminLoans();
  });
});

// ── ADMIN POLLING ──
let lastLoanCount=0, lastMsgCount=0, lastReviewCount=0, pollingInterval=null;
// Old reviews written before the `seen` field existed have it undefined -
// only an explicit false counts as a new, unread review.
const unseenLoans=()=>loans.filter(l=>!l.seen);
// One notification per group of items borrowed (or returned) together.
function groupedLoanNotifs(){
  const groups=[],byKey=new Map();
  unseenLoans().forEach(l=>{
    const key=l.groupId?l.groupId+'|'+l.status:l.id;
    let g=byKey.get(key);
    if(!g){g={key,status:l.status,name:l.name,phone:l.phone,date:l.date,loans:[]};byKey.set(key,g);groups.push(g);}
    g.loans.push(l);
  });
  return groups;
}
const unseenMessages=()=>messages.filter(m=>!m.seen);
const unseenReviews=()=>reviews.filter(r=>r.seen===false);
function renderAllAdmin(){renderNotifications();renderAdminLoans();renderAdminMessages();renderAdminReviews();}
function startPolling(){
  if(pollingInterval)return;
  pollingInterval=setInterval(async()=>{
    try{
      await Promise.all([loadLoans(),loadMessages(),loadReviews(),refreshItems()]);
    }catch(e){
      console.warn('admin poll failed',e);
      return;
    }
    // Unseen loans cover BOTH a new borrow (status='פעיל') and a return
    // (status='הוחזר', including self-return) - see the `seen:false` write in
    // confirmReturn()/submitBasket().
    const unseen=groupedLoanNotifs(), newMsgs=unseenMessages(), newReviews=unseenReviews();
    const canPush=typeof Notification!=='undefined'&&Notification.permission==='granted';
    if(canPush){
      if(unseen.length>lastLoanCount){
        unseen.slice(lastLoanCount).forEach(g=>{
          const isReturn=g.status==='הוחזר';
          new Notification(isReturn?'החזרה':'השאלה חדשה',{body:g.name+(isReturn?' החזיר/ה ':' לקח/ה ')+loanGroupText(g)});
        });
      }
      if(newMsgs.length>lastMsgCount){
        newMsgs.slice(lastMsgCount).forEach(m=>{
          new Notification('הודעה חדשה - דורשת טיפול',{body:m.name+': '+(m.message||''),requireInteraction:true});
        });
      }
      if(newReviews.length>lastReviewCount){
        newReviews.slice(lastReviewCount).forEach(r=>{
          new Notification('ביקורת חדשה',{body:r.message||''});
        });
      }
    }
    lastLoanCount=unseen.length;lastMsgCount=newMsgs.length;lastReviewCount=newReviews.length;
    renderAdminData();
  },30000);
}
function stopPolling(){if(pollingInterval){clearInterval(pollingInterval);pollingInterval=null;}}
async function clearAllNotifications(){
  if(!confirm('למחוק את כל ההתראות?'))return;
  try{
    const batch=writeBatch(db);
    unseenLoans().forEach(l=>batch.update(doc(db,'loans',l.id),{seen:true}));
    unseenMessages().forEach(m=>batch.update(doc(db,'messages',m.id),{seen:true}));
    unseenReviews().forEach(r=>batch.update(doc(db,'reviews',r.id),{seen:true}));
    await batch.commit();
    loans=loans.map(l=>({...l,seen:true}));
    messages=messages.map(m=>({...m,seen:true}));
    reviews=reviews.map(r=>r.seen===false?{...r,seen:true}:r);
    renderAllAdmin();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בעדכון ההתראות. נסה שוב.'));
  }
}
async function markSeen(col,idList){
  const ids=String(idList).split(',');
  try{
    if(ids.length===1)await updateDoc(doc(db,col,ids[0]),{seen:true});
    else{
      const b=writeBatch(db);
      ids.forEach(x=>b.update(doc(db,col,x),{seen:true}));
      await b.commit();
    }
    const set=new Set(ids);
    const mark=arr=>arr.map(x=>set.has(x.id)?{...x,seen:true}:x);
    if(col==='loans')loans=mark(loans);
    else if(col==='messages')messages=mark(messages);
    else reviews=mark(reviews);
    renderAllAdmin();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בסימון ההתראה כנקראה.'));
  }
}
// One list for everything that needs the admin's attention. Messages come
// first and are visually loud: a message may be a report of a return that
// needs handling, not just an FYI.
// "X" for one item, "3 פריטים: A, B, C" for several
function loanGroupText(g){
  return g.loans.length===1?'את '+g.loans[0].item:g.loans.length+' פריטים: '+g.loans.map(l=>l.item).join(', ');
}
function renderNotifications(){
  const nMsgs=unseenMessages().sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  const nLoans=groupedLoanNotifs();
  const nReviews=unseenReviews().sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  const total=nMsgs.length+nLoans.length+nReviews.length;
  const badge=document.getElementById('notif-badge');
  if(total){badge.textContent=total;badge.classList.remove('hidden');}
  else badge.classList.add('hidden');
  const list=document.getElementById('notif-list');
  if(!list)return;
  if(!total){list.innerHTML='<div class="empty" style="padding:1.5rem"><div class="ei">&#128235;</div>אין התראות חדשות</div>';return;}
  const when=ts=>ts?new Date(ts).toLocaleString('he-IL'):'';
  const msgHtml=nMsgs.map(m=>`
    <div class="notif-item urgent">
      <div style="font-size:1.8rem">&#9888;</div>
      <div class="notif-body"><strong>הודעה חדשה</strong><span class="notif-tag">דורש טיפול</span><br/><strong>${esc(m.name)}</strong> &middot; ${esc(m.phone)}<div style="margin-top:.3rem;white-space:pre-line">${esc(m.message||'')}</div><div class="notif-date">${esc(when(m.timestamp))}</div></div>
      <button class="notif-seen" data-ncol="messages" data-nid="${m.id}">&#10003;</button>
    </div>`).join('');
  const loanHtml=nLoans.map(g=>{
    const isReturn=g.status==='הוחזר';
    return `
    <div class="notif-item">
      <div style="font-size:1.5rem">${isReturn?'&#9996;':'&#128149;'}</div>
      <div class="notif-body"><strong>${esc(g.name)}</strong> ${isReturn?'החזיר/ה':'לקח/ה'} <strong>${esc(loanGroupText(g))}</strong><div class="notif-date">${esc(g.date||'')} &middot; ${esc(g.phone)}</div></div>
      <button class="notif-seen" data-ncol="loans" data-nid="${g.loans.map(l=>l.id).join(',')}">&#10003;</button>
    </div>`;
  }).join('');
  const reviewHtml=nReviews.map(r=>`
    <div class="notif-item">
      <div style="font-size:1.5rem">&#127775;</div>
      <div class="notif-body"><strong>ביקורת חדשה</strong><div style="margin-top:.3rem;white-space:pre-line">${esc(r.message||'')}</div><div class="notif-date">${esc(when(r.timestamp))}</div></div>
      <button class="notif-seen" data-ncol="reviews" data-nid="${r.id}">&#10003;</button>
    </div>`).join('');
  list.innerHTML=msgHtml+loanHtml+reviewHtml;
  list.querySelectorAll('[data-nid]').forEach(btn=>btn.addEventListener('click',()=>markSeen(btn.dataset.ncol,btn.dataset.nid)));
}

// ── ADMIN MESSAGES ──
function renderAdminMessages(){
  const unseen=messages.filter(m=>!m.seen);
  const badge=document.getElementById('messages-badge');
  if(badge){if(unseen.length){badge.textContent=unseen.length;badge.classList.remove('hidden');}else badge.classList.add('hidden');}
  const list=document.getElementById('messages-list');
  if(!list)return;
  if(!messages.length){list.innerHTML='<div class="empty"><div class="ei">&#9993;</div>אין הודעות עדיין</div>';return;}
  const sorted=[...messages].sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  list.innerHTML=sorted.map(m=>`
    <div class="notif-item">
      <div style="font-size:1.5rem">&#9993;</div>
      <div class="notif-body"><strong>${esc(m.name)}</strong> &middot; ${esc(m.phone)}<div class="notif-date">${esc(m.message||'')}</div><div class="notif-date">${esc(m.timestamp?new Date(m.timestamp).toLocaleString('he-IL'):'')}</div></div>
      ${!m.seen?`<button class="notif-seen" data-mid="${m.id}">&#10003;</button>`:''}
    </div>`).join('');
  list.querySelectorAll('[data-mid]').forEach(btn=>btn.addEventListener('click',()=>markSeen('messages',btn.dataset.mid)));
}
async function clearAllMessages(){
  if(!confirm('לסמן את כל ההודעות כנקראו?'))return;
  try{
    const unseen=messages.filter(m=>!m.seen);
    const batch=writeBatch(db);
    unseen.forEach(m=>batch.update(doc(db,'messages',m.id),{seen:true}));
    await batch.commit();
    messages=messages.map(m=>({...m,seen:true}));
    renderAllAdmin();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בעדכון ההודעות. נסה שוב.'));
  }
}

// ── ADMIN REVIEWS ── (anonymous, general feedback)
function renderAdminReviews(){
  const badge=document.getElementById('reviews-badge');
  const unseen=unseenReviews();
  if(badge){if(unseen.length){badge.textContent=unseen.length;badge.classList.remove('hidden');}else badge.classList.add('hidden');}
  const list=document.getElementById('reviews-list');
  if(!list)return;
  if(!reviews.length){list.innerHTML='<div class="empty"><div class="ei">&#127775;</div>אין ביקורות עדיין</div>';return;}
  const sorted=[...reviews].sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  list.innerHTML=sorted.map(r=>`
    <div class="notif-item">
      <div style="font-size:1.5rem">&#127775;</div>
      <div class="notif-body">${esc(r.message||'')}<div class="notif-date">${esc(r.timestamp?new Date(r.timestamp).toLocaleString('he-IL'):'')}</div></div>
      ${r.seen===false?`<button class="notif-seen" data-rid="${r.id}">&#10003;</button>`:''}
    </div>`).join('');
  list.querySelectorAll('[data-rid]').forEach(btn=>btn.addEventListener('click',()=>markSeen('reviews',btn.dataset.rid)));
}

function renderAdminItems(){
  const searchEl=document.getElementById('admin-search');
  const catEl=document.getElementById('admin-cat-filter');
  const q=(searchEl?searchEl.value:'').toLowerCase().trim();
  const catF=catEl?catEl.value:'';
  const filtered=items.filter(i=>{
    const matchCat=!catF||cleanCat(i.cat)===catF;
    const matchQ=!q||i.name.toLowerCase().includes(q)||(i.desc||'').toLowerCase().includes(q);
    return matchCat&&matchQ;
  });
  document.getElementById('items-title').textContent=`פריטים (${filtered.length}/${items.length})`;
  const list=document.getElementById('items-admin-list');
  list.innerHTML=filtered.map(item=>{
    const img=item.img||PLACEHOLDERS[item.cat]||'';
    const st=isAvailable(item);
    return `<div class="irow">
      <img class="ithumb" src="${img}" alt="${esc(item.name)}" onerror="this.style.display='none'"/>
      <span class="in" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${esc(item.name)}</span>
      <span class="sbadge ${st==='av'?'act':'ret'}">${statusLabel(st)}</span>
      <button class="editbtn" data-eid="${item.id}">עריכה</button>
      <button class="loanbtn" data-mlid="${item.id}" style="padding:.26rem .7rem;border-radius:.4rem;font-size:.76rem;font-weight:700;border:1.5px solid ${isAvailable(item)==='av'?'var(--lav)':'var(--teal-mid)'};color:${isAvailable(item)==='av'?'var(--lav)':'var(--teal-dark)'};background:none;cursor:pointer;white-space:nowrap">${isAvailable(item)==='av'?'📌':'✓'}</button>
      <button class="delbtn" data-did="${item.id}">הסר</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-eid]').forEach(btn=>btn.addEventListener('click',()=>openEdit(btn.dataset.eid)));
  list.querySelectorAll('[data-did]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('להסיר את הפריט?'))return;
    try{
      await deleteDoc(doc(db,'items',btn.dataset.did));
      items=items.filter(i=>i.id!==btn.dataset.did);
      renderAdminItems();renderGrid();
    }catch(e){
      alert(logAndMessage(e,'שגיאה בהסרת הפריט. נסה שוב.'));
    }
  }));
  list.querySelectorAll('[data-mlid]').forEach(btn=>btn.addEventListener('click',async()=>{
    const item=items.find(i=>i.id===btn.dataset.mlid);
    if(!item)return;
    if(isAvailable(item)!=='av'){
      // Mark as returned
      // Any active loan on this item - borrowed through the site or added by hand.
      const activeLoan=loans.find(l=>l.itemId===item.id&&l.status==='פעיל');
      if(!activeLoan){
        alert('לא נמצאה השאלה פעילה עבור "'+item.name+'", למרות שהפריט מסומן כלא זמין. כדאי לבדוק בטאב "השאלות".');
        return;
      }
      if(!confirm('להחזיר את "'+item.name+'" מ-'+(activeLoan.name||'השואל')+'?'))return;
      try{
        const returnedTimestamp=new Date().toISOString();
        const batch=writeBatch(db);
        batch.update(doc(db,'loans',activeLoan.id),{status:'הוחזר',returnedTimestamp});
        batch.update(doc(db,'items',item.id),{available:true});
        await batch.commit();
        loans=loans.map(l=>l.id===activeLoan.id?{...l,status:'הוחזר',returnedTimestamp}:l);
        item.available=true;
        renderAdminItems();renderGrid();renderAdminLoans();
      }catch(e){
        alert(logAndMessage(e,'שגיאה בסימון ההחזרה. נסה שוב.'));
      }
      return;
    }
    const name=prompt('שם מי שלקח:');
    if(!name)return;
    try{
      const loanData={itemId:item.id,item:item.name,name,phone:'מנהל',date:new Date().toLocaleDateString('he-IL'),timestamp:new Date().toISOString(),status:'פעיל',seen:true,manual:true,branch:BRANCH};
      const loanRef=doc(collection(db,'loans'));
      const batch=writeBatch(db);
      batch.set(loanRef,loanData);
      batch.update(doc(db,'items',item.id),{available:false});
      await batch.commit();
      loans.push({id:loanRef.id,...loanData});
      item.available=false;
      renderAdminItems();renderGrid();renderAdminLoans();
      notifyTelegram(loanData);
    }catch(e){
      alert(logAndMessage(e,'שגיאה בשמירת ההשאלה הידנית. נסה שוב.'));
    }
  }));
}

// ── ONE-TIME AVAILABILITY MIGRATION ──
// Temporary admin tool: existing items have no `available` field yet. This
// shows exactly what it's about to write and waits for a second, explicit
// confirmation before touching Firestore. Delete this section (and its
// button in index.html) once the migration has been run in production.
let migrationPreview=null;
function previewAvailabilityMigration(){
  if(!items.length){alert('אין פריטים טעונים.');return;}
  const unavailable=items.filter(item=>loans.some(l=>l.itemId===item.id&&l.status==='פעיל'));
  migrationPreview={unavailableIds:new Set(unavailable.map(i=>i.id))};
  const box=document.getElementById('migration-box');
  box.innerHTML=`
    <p style="font-weight:700;margin-bottom:.5rem">המיגרציה תכתוב שדה זמינות ל-${items.length} פריטים. ${unavailable.length} מתוכם יסומנו "לא זמין":</p>
    ${unavailable.length?`<ul style="margin:0 0 1rem 1rem;padding:0 1rem 0 0">${unavailable.map(i=>`<li>${esc(i.name)}</li>`).join('')}</ul>`:'<p style="color:var(--text-mid);margin-bottom:1rem">(אף פריט לא יסומן כלא זמין)</p>'}
    <button class="sbtn" id="btn-confirm-migration">אשר וכתוב ל-Firestore</button>
  `;
  box.classList.remove('hidden');
  document.getElementById('btn-confirm-migration').addEventListener('click',runAvailabilityMigration);
}
async function runAvailabilityMigration(){
  if(!migrationPreview){alert('יש להריץ תצוגה מקדימה קודם.');return;}
  if(items.length>500){alert('יש יותר מ-500 פריטים - זה מעבר למגבלת batch אחד של Firestore. יש לפצל את המיגרציה, פנה למפתח.');return;}
  if(!confirm(`לכתוב שדה זמינות ל-${items.length} פריטים עכשיו? זה ידרוס ערך available קיים, אם יש.`))return;
  const box=document.getElementById('migration-box');
  try{
    const batch=writeBatch(db);
    items.forEach(item=>batch.update(doc(db,'items',item.id),{available:!migrationPreview.unavailableIds.has(item.id)}));
    await batch.commit();
    items.forEach(item=>{item.available=!migrationPreview.unavailableIds.has(item.id);});
    box.innerHTML=`<p>&#9989; המיגרציה הסתיימה. ${items.length} פריטים עודכנו.</p>`;
    migrationPreview=null;
    renderAdminItems();renderGrid();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בהרצת המיגרציה (אם זה כשל של הבאטש כולו, שום דבר לא נכתב). נסה שוב.'));
  }
}

// ── BRANCH SETTINGS ──
// Live values: the Firestore record branches/<id>, one per branch. BRANCH_SEED
// (shared.js) holds the same fields as built-in defaults: it is what the
// records are created from (admin button below) and the fallback if a record
// can't be read.
let branchSettings={};
const loadSeed=async()=>(await import('./branch-seed.js')).BRANCH_SEED;
const toIntlPhone=p=>'972'+String(p||'').replace(/\D/g,'').replace(/^0/,'');
async function loadBranchSettings(){
  try{
    const snap=await getDoc(doc(db,'branches',BRANCH));
    if(snap.exists())branchSettings=snap.data();
    else branchSettings=(await loadSeed())[BRANCH];
  }catch(e){
    console.warn('branch settings could not be read - using built-in defaults',e);
    branchSettings=(await loadSeed())[BRANCH];
  }
  applyBranchSettings();
}
function applyBranchSettings(){
  const s=branchSettings;
  const wa=s.whatsapp||toIntlPhone(s.phone);
  document.querySelectorAll('[data-wa]').forEach(a=>{a.href=`https://wa.me/${wa}?text=${encodeURIComponent(WA_TEXT)}`;a.target='_blank';});
  document.querySelectorAll('[data-donate]').forEach(a=>{a.href=s.donationUrl;a.target='_blank';});
  const waze=`https://waze.com/ul?q=${encodeURIComponent(s.wazeAddress||s.address)}&navigate=yes`;
  const where=(s.pickupNote?esc(s.pickupNote)+', ':'')+esc(s.address);
  document.getElementById('how-location').innerHTML=
    `פריטי הגמ"ח נמצאים ${where}.<br/>`+
    `<a class="wa-link" href="${waze}" target="_blank" rel="noopener">&#129517; ניווט בוויז</a>`+
    (s.phone?` <a class="wa-link" href="tel:${esc(s.phone)}">&#128222; ${esc(s.phone)}</a>`:'');
  document.getElementById('success-location').innerHTML=`${where}.`;
}

// One-time admin tool: creates the branches/<id> records from BRANCH_SEED.
// Preview first, write only after a second confirmation, and never overwrite
// a record that already exists (so later edits are safe). Delete this section
// and its button once the records exist.
let branchSeedPlan=null;
async function previewBranchSeed(){
  const box=document.getElementById('branch-seed-box');
  box.classList.remove('hidden');
  box.textContent='בודק אילו רשומות כבר קיימות...';
  try{
    const BRANCH_SEED=await loadSeed();
    const existing={};
    for(const id of BRANCH_IDS)existing[id]=(await getDoc(doc(db,'branches',id))).exists();
    branchSeedPlan=BRANCH_IDS.filter(id=>!existing[id]);
    box.innerHTML=`
      <p style="font-weight:700;margin-bottom:.5rem">הגדרות סניפים:</p>
      <ul style="margin:0 0 1rem 1rem;padding:0 1rem 0 0">
        ${BRANCH_IDS.map(id=>`<li><strong>${esc(id)}</strong> - ${esc(BRANCH_SEED[id].address)}, ${esc(BRANCH_SEED[id].phone)} - ${existing[id]?'כבר קיימת (לא תשתנה)':'<strong>תיווצר</strong>'}</li>`).join('')}
      </ul>
      ${branchSeedPlan.length?`<button class="sbtn" id="btn-confirm-branch-seed">אשר וצור ${branchSeedPlan.length} רשומות</button>`:'<p style="color:var(--text-mid)">כל הרשומות כבר קיימות - אין מה ליצור.</p>'}`;
    document.getElementById('btn-confirm-branch-seed')?.addEventListener('click',runBranchSeed);
  }catch(e){
    box.classList.add('hidden');
    alert(logAndMessage(e,'שגיאה בבדיקת הגדרות הסניפים. נסה שוב.'));
  }
}
async function runBranchSeed(){
  if(!branchSeedPlan||!branchSeedPlan.length)return;
  if(!confirm(`ליצור ${branchSeedPlan.length} רשומות הגדרות סניף עכשיו?`))return;
  const box=document.getElementById('branch-seed-box');
  try{
    const BRANCH_SEED=await loadSeed();
    const batch=writeBatch(db);
    branchSeedPlan.forEach(id=>batch.set(doc(db,'branches',id),BRANCH_SEED[id]));
    await batch.commit();
    box.innerHTML=`<p>&#9989; נוצרו ${branchSeedPlan.length} רשומות.</p>`;
    branchSeedPlan=null;
  }catch(e){
    alert(logAndMessage(e,'שגיאה ביצירת הגדרות הסניפים. נסה שוב.'));
  }
}

// ── BRANCH SETTINGS EDITOR (admin tab "הגדרות הסניף") ──
// Reads and writes only this page's branch record: branches/<BRANCH>.
const SETTINGS_FIELDS={address:'bs-address',wazeAddress:'bs-waze',phone:'bs-phone',whatsapp:'bs-whatsapp',donationUrl:'bs-donate',pickupNote:'bs-pickup'};
function setSettingsStatus(msg,ok){
  const el=document.getElementById('bs-status');
  el.textContent=msg;
  el.style.color=ok?'var(--teal-dark)':'#B05030';
}
async function fillSettingsForm(){
  setSettingsStatus('',true);
  let s=branchSettings,saved=true;
  try{
    const snap=await getDoc(doc(db,'branches',BRANCH));
    if(snap.exists())s=snap.data();else saved=false;
  }catch(e){
    alert(logAndMessage(e,'שגיאה בטעינת הגדרות הסניף. מוצגים הערכים הנוכחיים בעמוד.'));
  }
  Object.entries(SETTINGS_FIELDS).forEach(([k,id])=>{document.getElementById(id).value=s[k]||'';});
  document.getElementById('bs-note').textContent=saved?'':'הגדרות הסניף עדיין לא נשמרו במסד - מוצגים ערכי ברירת המחדל. שמירה תיצור את הרשומה.';
}
async function saveBranchSettings(){
  const v=id=>document.getElementById(id).value.trim();
  const address=v('bs-address'),phone=v('bs-phone'),donationUrl=v('bs-donate');
  if(!address){alert('יש למלא כתובת');return;}
  if(!/^[0-9+\-\s()]{7,20}$/.test(phone)){alert('יש למלא מספר טלפון תקין');return;}
  if(!/^https:\/\/\S+$/i.test(donationUrl)){alert('קישור התרומה חייב להתחיל ב-https://');return;}
  const waRaw=v('bs-whatsapp').replace(/\D/g,'');
  const whatsapp=!waRaw?toIntlPhone(phone):waRaw.startsWith('0')?toIntlPhone(waRaw):waRaw;
  if(!/^\d{10,15}$/.test(whatsapp)){alert('מספר הוואטסאפ לא תקין');return;}
  const data={address,wazeAddress:v('bs-waze'),phone,whatsapp,donationUrl,pickupNote:v('bs-pickup')};
  const btn=document.getElementById('btn-save-settings');
  btn.disabled=true;setSettingsStatus('שומר...',true);
  try{
    await setDoc(doc(db,'branches',BRANCH),data,{merge:true});
    branchSettings={...branchSettings,...data};
    applyBranchSettings();
    document.getElementById('bs-whatsapp').value=whatsapp;
    document.getElementById('bs-note').textContent='';
    setSettingsStatus('✓ ההגדרות נשמרו והעמוד עודכן',true);
  }catch(e){
    setSettingsStatus('',true);
    alert(logAndMessage(e,'שגיאה בשמירת ההגדרות. נסה שוב.'));
  }finally{
    btn.disabled=false;
  }
}

// ── COPY ITEMS FROM ANOTHER BRANCH (admin, items tab) ──
// Lists the chosen branch's items (queried by that branch), lets the admin tick
// the ones to copy and creates them here: name, description, category, image
// (plus the kit texts of the special category, which are part of the
// description). Counters start from zero, the copy is available and belongs
// to this branch.
let copySourceItems=[],copyRendered=false;
const normName=n=>String(n||'').trim().replace(/\s+/g,' ').toLowerCase();
const copyStatus=(msg,ok)=>{const el=document.getElementById('copy-status');el.textContent=msg;el.style.color=ok===false?'#B05030':'var(--teal-dark)';};
async function initCopyTool(){
  if(copyRendered)return;
  copyRendered=true;
  try{
    const {BRANCH_NAMES}=await import('./branch-seed.js');
    const sel=document.getElementById('copy-source');
    BRANCH_IDS.filter(id=>id!==BRANCH).forEach(id=>sel.add(new Option(BRANCH_NAMES[id]||id,id)));
  }catch(e){
    copyRendered=false;
    alert(logAndMessage(e,'שגיאה בטעינת רשימת הסניפים להעתקה.'));
  }
}
async function loadCopySource(){
  const id=document.getElementById('copy-source').value;
  const list=document.getElementById('copy-list');
  document.getElementById('copy-controls').classList.add('hidden');
  list.innerHTML='';copySourceItems=[];copyStatus('',true);
  if(!id)return;
  copyStatus('טוען פריטים...',true);
  try{
    const snap=await getDocs(query(collection(db,'items'),where('branch','==',id)));
    copySourceItems=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name),'he'));
    copyStatus(copySourceItems.length?'':'אין פריטים בסניף הזה.',true);
    renderCopyList();
  }catch(e){
    copyStatus('',true);
    alert(logAndMessage(e,'שגיאה בטעינת הפריטים מהסניף שנבחר. נסה שוב.'));
  }
}
function renderCopyList(){
  const list=document.getElementById('copy-list');
  const existing=new Set(items.map(i=>normName(i.name)));
  list.innerHTML=copySourceItems.map(it=>{
    const dup=existing.has(normName(it.name));
    const img=it.img||PLACEHOLDERS[it.cat]||'';
    return `<label class="copy-row${dup?' dup':''}">
      <input type="checkbox" data-cid="${it.id}" ${dup?'disabled':''} style="width:18px;height:18px;accent-color:var(--teal)"/>
      <img class="ithumb" src="${esc(img)}" alt="" onerror="this.style.display='none'"/>
      <span style="font-weight:600">${esc(it.name)}</span>
      <span class="ccat">${esc(cleanCat(it.cat))}</span>
      ${dup?'<span class="sbadge ret">כבר קיים</span>':''}
    </label>`;
  }).join('');
  document.getElementById('copy-controls').classList.toggle('hidden',!copySourceItems.length);
  document.getElementById('copy-all').checked=false;
  updateCopyCount();
}
const selectedCopyIds=()=>[...document.querySelectorAll('#copy-list input[data-cid]:checked')].map(i=>i.dataset.cid);
function updateCopyCount(){
  const n=selectedCopyIds().length;
  const btn=document.getElementById('btn-copy-items');
  btn.textContent=`העתק נבחרים (${n})`;
  btn.disabled=n===0;
}
async function copySelectedItems(){
  const ids=new Set(selectedCopyIds());
  const taken=new Set(items.map(i=>normName(i.name)));
  const chosen=[];let skipped=0;
  copySourceItems.filter(i=>ids.has(i.id)).forEach(i=>{
    const k=normName(i.name);
    if(taken.has(k)){skipped++;return;}
    taken.add(k);chosen.push(i);
  });
  if(!chosen.length){alert('אין פריטים חדשים להעתקה.');return;}
  const btn=document.getElementById('btn-copy-items');
  btn.disabled=true;copyStatus('מעתיק...',true);
  let copied=0;
  try{
    // A commit is limited to 500 writes and about 10MB, and items carry
    // their image inline - so cut batches by count AND by approximate size.
    let batch=writeBatch(db),count=0,bytes=0,pending=[];
    const flush=async()=>{
      if(!count)return;
      await batch.commit();
      pending.forEach(p=>items.push(p));
      copied+=count;
      batch=writeBatch(db);count=0;bytes=0;pending=[];
    };
    for(const it of chosen){
      const data={name:it.name,desc:it.desc||'',cat:it.cat,img:it.img||'',kitWe:it.kitWe||'',kitYou:it.kitYou||'',available:true,branch:BRANCH};
      const size=JSON.stringify(data).length;
      if(count>=400||(count&&bytes+size>6000000))await flush();
      const ref=doc(collection(db,'items'));
      batch.set(ref,data);
      pending.push({id:ref.id,...data});
      count++;bytes+=size;
    }
    await flush();
    copyStatus(`✓ הועתקו ${copied} פריטים`+(skipped?` (${skipped} דולגו - אותו שם כבר נבחר/קיים)`:''),true);
  }catch(e){
    copyStatus(copied?`הועתקו ${copied} פריטים לפני שהתרחשה שגיאה`:'',false);
    alert(logAndMessage(e,`שגיאה בהעתקת הפריטים. הועתקו ${copied} מתוך ${chosen.length}. אפשר ללחוץ שוב - פריטים שכבר הועתקו יסומנו "כבר קיים".`));
  }finally{
    renderAdminItems();renderGrid();renderCopyList();
  }
}

// ── DASHBOARD / STATS ──
function renderStats(){
  const el=document.getElementById('stats-content');
  if(!loans.length){el.innerHTML='<div class="asec"><div class="empty"><div class="ei">&#128202;</div>עדיין אין מספיק נתונים להצגת דשבורד</div></div>';return;}

  const total=loans.length;
  const active=loans.filter(l=>l.status==='פעיל').length;
  const returned=total-active;

  // Category breakdown (join loan -> item -> category)
  const itemCatById={};
  items.forEach(i=>{itemCatById[i.id]=cleanCat(i.cat)||'לא ידוע';});
  const byCat={};
  loans.forEach(l=>{
    const cat=itemCatById[l.itemId]||'לא ידוע';
    byCat[cat]=(byCat[cat]||0)+1;
  });
  const catEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const catMax=catEntries.length?catEntries[0][1]:1;

  // Most borrowed items
  const byItem={};
  loans.forEach(l=>{byItem[l.item]=(byItem[l.item]||0)+1;});
  const itemEntries=Object.entries(byItem).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const itemMax=itemEntries.length?itemEntries[0][1]:1;

  // Monthly trend - last 6 months
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({key:`${d.getFullYear()}-${d.getMonth()}`,label:d.toLocaleDateString('he-IL',{month:'short'}),count:0});
  }
  loans.forEach(l=>{
    const ts=l.timestamp?new Date(l.timestamp):null;
    if(!ts||isNaN(ts))return;
    const key=`${ts.getFullYear()}-${ts.getMonth()}`;
    const m=months.find(m=>m.key===key);
    if(m)m.count++;
  });
  const monthMax=Math.max(1,...months.map(m=>m.count));

  // Average loan duration (days) - only loans with both timestamps recorded
  const durations=loans.filter(l=>l.timestamp&&l.returnedTimestamp).map(l=>{
    const start=new Date(l.timestamp),end=new Date(l.returnedTimestamp);
    return (end-start)/(1000*60*60*24);
  }).filter(d=>d>=0);
  const avgDuration=durations.length?(durations.reduce((a,b)=>a+b,0)/durations.length):null;

  el.innerHTML=`
    <div class="stat-cards">
      <div class="stat-card"><div class="sv">${total}</div><div class="sl">סה"כ השאלות</div></div>
      <div class="stat-card"><div class="sv">${active}</div><div class="sl">השאלות פעילות כרגע</div></div>
      <div class="stat-card"><div class="sv">${returned}</div><div class="sl">הוחזרו</div></div>
      <div class="stat-card"><div class="sv">${avgDuration!==null?avgDuration.toFixed(1):'—'}</div><div class="sl">ימי השאלה בממוצע${avgDuration===null?' (אין עדיין נתונים)':''}</div></div>
    </div>
    <div class="asec">
      <h3>&#128200; השאלות לפי חודש (6 חודשים אחרונים)</h3>
      <div class="trend-chart">
        ${months.map(m=>`
          <div class="trend-bar">
            <div class="trend-bar-val">${m.count||''}</div>
            <div class="trend-bar-fill" style="height:${m.count?Math.max(6,(m.count/monthMax)*100):2}px"></div>
            <div class="trend-bar-label">${m.label}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="asec">
      <h3>&#127922; השאלות לפי קטגוריה</h3>
      ${catEntries.map(([cat,count])=>`
        <div class="bar-row">
          <div class="bar-label">${esc(cat)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(count/catMax)*100}%"></div></div>
          <div class="bar-val">${count}</div>
        </div>`).join('')}
    </div>
    <div class="asec">
      <h3>&#11088; הפריטים הכי מבוקשים</h3>
      ${itemEntries.map(([name,count])=>`
        <div class="bar-row">
          <div class="bar-label">${esc(name)}</div>
          <div class="bar-track"><div class="bar-fill lav" style="width:${(count/itemMax)*100}%"></div></div>
          <div class="bar-val">${count}</div>
        </div>`).join('')}
    </div>`;
}

// ── EDIT MODAL ──
window.openEdit=function openEdit(id){
  const isNew=id==='-1';
  const item=isNew?{id:'-1',name:'',cat:CAT_NAMES[0],desc:'',img:'',kitWe:'',kitYou:''}:items.find(i=>i.id===id);
  if(!item)return;
  editId=id; editImgData=item.img||'';
  document.getElementById('edit-title').textContent=isNew?'הוספת פריט חדש':'עריכת פריט';
  const saveBtn=document.getElementById('edit-save-btn');
  saveBtn.disabled=false;
  saveBtn.textContent=isNew?'הוסף לקטלוג +':'שמירה ✓';
  document.getElementById('edit-name').value=item.name||'';
  document.getElementById('edit-cat').value=item.cat||CAT_NAMES[0];
  document.getElementById('edit-desc').value=item.desc||'';
  document.getElementById('edit-kitwe').value=item.kitWe||'';
  document.getElementById('edit-kityou').value=item.kitYou||'';
  document.getElementById('edit-kit-fields').classList.toggle('hidden',item.cat!==KIT_CATEGORY);
  refreshEditImg();
  document.getElementById('edit-overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function refreshEditImg(){
  const img=document.getElementById('edit-img-el');
  const noimg=document.getElementById('edit-no-img');
  if(editImgData){img.src=editImgData;img.style.display='block';noimg.style.display='none';}
  else{img.style.display='none';noimg.style.display='flex';}
}

function closeEdit(){document.getElementById('edit-overlay').classList.add('hidden');document.body.style.overflow='';}

async function saveEdit(){
  const name=document.getElementById('edit-name').value.trim();
  if(!name){alert('יש להזין שם פריט');return;}
  const btn=document.getElementById('edit-save-btn');
  if(btn.disabled)return;
  btn.disabled=true;
  btn.textContent='שומר...';
  try{
    const cat=document.getElementById('edit-cat').value;
    const data={name,cat,desc:document.getElementById('edit-desc').value,img:editImgData,kitWe:document.getElementById('edit-kitwe').value,kitYou:document.getElementById('edit-kityou').value};
    if(editId==='-1'){
      // New item starts available - no active loan can exist for it yet.
      const ref=await addDoc(collection(db,'items'),{...data,available:true,branch:BRANCH});
      items.push({id:ref.id,...data,available:true,branch:BRANCH});
    }else{
      // Deliberately NOT touching `available`/`views`/`borrows` here - editing
      // name/description etc. must never reset an item's live availability.
      await updateDoc(doc(db,'items',editId),data);
      items=items.map(i=>i.id===editId?{...i,...data}:i);
    }
    closeEdit();renderAdminItems();renderGrid();
  }catch(e){
    alert(logAndMessage(e,'שגיאה בשמירה, נסה שוב'));
    btn.disabled=false;
    btn.textContent=editId==='-1'?'הוסף לקטלוג +':'שמירה ✓';
  }
}


// ── EVENT LISTENERS ──
document.getElementById('nav-home-brand')?.addEventListener('click',e=>{e.preventDefault();showPage('home');window.scrollTo({top:0,behavior:'smooth'});});

document.getElementById('nav-catalog-btn')?.addEventListener('click',()=>{showPage('home');setTimeout(()=>document.getElementById('cat-sec').scrollIntoView({behavior:'smooth'}),100);});
document.getElementById('nav-about')?.addEventListener('click',()=>showPage('about'));
document.getElementById('nav-borrow-btn')?.addEventListener('click',goBorrow);
document.getElementById('nav-return-btn')?.addEventListener('click',()=>{showPage('home');showSection('return');});
document.getElementById('btn-to-catalog')?.addEventListener('click',()=>document.getElementById('how-sec').scrollIntoView({behavior:'smooth'}));
document.getElementById('btn-borrow-main')?.addEventListener('click',goBorrow);
document.getElementById('btn-return-main')?.addEventListener('click',()=>showSection('return'));
document.getElementById('link-borrow')?.addEventListener('click',goBorrow);
document.getElementById('link-return')?.addEventListener('click',()=>showSection('return'));
document.getElementById('btn-admin')?.addEventListener('click',()=>showPage('admin'));
document.getElementById('btn-admin-about')?.addEventListener('click',()=>showPage('admin'));
document.getElementById('btn-login')?.addEventListener('click',tryLogin);
document.getElementById('admin-pass-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
document.getElementById('btn-enable-notif')?.addEventListener('click',async()=>{
  if(!('Notification' in window)){alert('הדפדפן לא תומך בהתראות');return;}
  const p=await Notification.requestPermission();
  if(p==='granted'){
    // Register SW and test
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.register('sw.js');
      await reg.showNotification('✅ התראות פועלות!',{body:'תקבל התראה על כל השאלה חדשה',icon:'logo.gif',dir:'rtl'});
    }else{
      new Notification('✅ התראות פועלות!',{body:'תקבל התראה על כל השאלה חדשה'});
    }
    document.getElementById('btn-enable-notif').textContent='✅ התראות פעילות';
  }else{
    alert('לא אושרו התראות. נסה להפעיל ידנית בהגדרות הדפדפן');
  }
});
document.getElementById('btn-logout')?.addEventListener('click',()=>{signOut(auth).catch(()=>{});stopPolling();document.getElementById('admin-login').classList.remove('hidden');document.getElementById('admin-panel').classList.add('hidden');document.getElementById('admin-pass-input').value='';showPage('home');});
document.getElementById('tab-notif')?.addEventListener('click',()=>setAdminTab('notif'));
document.getElementById('btn-clear-all-notif')?.addEventListener('click',clearAllNotifications);
document.getElementById('tab-loans')?.addEventListener('click',()=>setAdminTab('loans'));
document.getElementById('tab-items')?.addEventListener('click',()=>setAdminTab('items'));
document.getElementById('tab-stats')?.addEventListener('click',()=>setAdminTab('stats'));
document.getElementById('tab-messages')?.addEventListener('click',()=>setAdminTab('messages'));
document.getElementById('btn-clear-all-messages')?.addEventListener('click',clearAllMessages);
document.getElementById('tab-reviews')?.addEventListener('click',()=>setAdminTab('reviews'));
document.getElementById('tab-settings')?.addEventListener('click',()=>setAdminTab('settings'));
document.getElementById('btn-save-settings')?.addEventListener('click',saveBranchSettings);
document.getElementById('copy-source')?.addEventListener('change',loadCopySource);
document.getElementById('copy-list')?.addEventListener('change',updateCopyCount);
document.getElementById('copy-all')?.addEventListener('change',e=>{document.querySelectorAll('#copy-list input[data-cid]:not(:disabled)').forEach(c=>{c.checked=e.target.checked;});updateCopyCount();});
document.getElementById('btn-copy-items')?.addEventListener('click',copySelectedItems);
document.getElementById('btn-preview-migration')?.addEventListener('click',previewAvailabilityMigration);
document.getElementById('btn-seed-branches')?.addEventListener('click',previewBranchSeed);

document.getElementById('basket-bar')?.addEventListener('click',openBasketForm);
document.getElementById('basket-bar')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBasketForm();}});
document.getElementById('btn-submit-basket')?.addEventListener('click',submitBasket);
document.getElementById('btn-cancel-basket')?.addEventListener('click',()=>showSection(null));
document.getElementById('catalog-search')?.addEventListener('input',e=>setSearch(e.target.value));
document.getElementById('btn-back-from-borrow')?.addEventListener('click',()=>showSection(null));
document.getElementById('btn-send-msg')?.addEventListener('click',sendMessage);
document.getElementById('btn-send-review')?.addEventListener('click',sendReview);
document.getElementById('btn-skip-review')?.addEventListener('click',skipReview);
document.getElementById('btn-cancel-return')?.addEventListener('click',()=>showSection(null));
document.getElementById('modal-overlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('modal-overlay')){document.getElementById('modal-overlay').classList.add('hidden');document.body.style.overflow='';} });
document.getElementById('modal-close-btn')?.addEventListener('click',()=>{document.getElementById('modal-overlay').classList.add('hidden');document.body.style.overflow='';});
document.getElementById('modal-borrow-btn')?.addEventListener('click',()=>{if(modalItem)toggleBasket(modalItem.id);});
document.getElementById('edit-overlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('edit-overlay')){const n=document.getElementById('edit-name').value.trim();if(n){if(confirm('יש שינויים שלא נשמרו. לסגור?'))closeEdit();}else closeEdit();}});
document.getElementById('edit-close-btn')?.addEventListener('click',()=>{const n=document.getElementById('edit-name').value.trim();if(n){if(confirm('יש שינויים שלא נשמרו. לסגור?'))closeEdit();}else closeEdit();});
document.getElementById('edit-save-btn')?.addEventListener('click',saveEdit);
document.getElementById('btn-upload-img')?.addEventListener('click',()=>document.getElementById('edit-file-input').click());
document.getElementById('edit-file-input')?.addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const MAX=800;
      let w=img.width,h=img.height;
      if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      editImgData=canvas.toDataURL('image/jpeg',0.72);
      refreshEditImg();
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(f);
});
document.getElementById('btn-url-img')?.addEventListener('click',()=>{const u=prompt('הדבק קישור URL לתמונה:');if(u){editImgData=u;refreshEditImg();}});
document.getElementById('btn-clear-img')?.addEventListener('click',()=>{editImgData='';refreshEditImg();});
document.getElementById('edit-cat')?.addEventListener('change',()=>{document.getElementById('edit-kit-fields').classList.toggle('hidden',document.getElementById('edit-cat').value!==KIT_CATEGORY);});
document.querySelectorAll('#filters .fb-cat').forEach(btn=>{
  btn.addEventListener('click',()=>{
    setFilter(btn.dataset.cat||'הכל');
  });
});

// ── INIT ──
async function init(){
  document.getElementById('items-grid').innerHTML='<div class="empty"><div class="ei">&#8987;</div>טוען...</div>';
  try{
    // Public visitors never load `loans` at all anymore (see report.md) -
    // loans is only fetched after admin login, in tryLogin().
    await Promise.all([loadBranchSettings(), loadItems()]);
  }catch(e){
    document.getElementById('items-grid').innerHTML='<div class="empty"><div class="ei">&#9888;</div>שגיאה בטעינה. רענן את הדף.</div>';
    console.error(e);
  }
}
document.getElementById('admin-search')?.addEventListener('input',()=>renderAdminItems());
document.getElementById('admin-cat-filter')?.addEventListener('change',()=>renderAdminItems());
init();
