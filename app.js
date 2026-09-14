import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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


const CAT_ICONS = {'פותחים קופסא':'&#127183;','בין השורות':'&#128214;','דייט על קלף':'&#128149;','המיוחדים שלנו':'&#127873;'};
const PLACEHOLDERS = {'פותחים קופסא':'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfg48</text></svg>','בין השורות':'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfkJY8L3RleHQ+PC9zdmc+','דייט על קלף':'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfmIk8L3RleHQ+PC9zdmc+','המיוחדים שלנו':'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfmrs8L3RleHQ+PC9zdmc+'};

let items=[], loans=[], selectedItem=null, catFilter='הכל', editId=null, editImgData='', modalItem=null;
let loanSort={col:'date',dir:'desc'};

// ── LOAD DATA ──
async function loadItems(){
  const snap = await getDocs(collection(db,'items'));
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

let allItemsLoaded=false;

async function loadItemsPage(reset=false){
  if(reset){allItemsLoaded=false;cachedSample=[];}
  if(allItemsLoaded)return;
  const cats=['פותחים קופסא','בין השורות','דייט על קלף','המיוחדים שלנו'];
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
async function loadLoans(){
  const snap = await getDocs(collection(db,'loans'));
  loans = snap.docs.map(d=>{const data=d.data();return {id:d.id,...data};});
}

// ── AVAILABILITY ──
function isAvailable(item){
  return loans.some(l=>l.itemId===item.id&&l.status==='פעיל') ? 'tk' : 'av';
}
function statusLabel(s){return s==='av'?'פנוי להשאלה':'כרגע אצל זוג מאושר אחר ♥';}

// ── PAGES ──
function showPage(p){
  ['home','about','admin'].forEach(x=>document.getElementById('page-'+x).classList.toggle('hidden',x!==p));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));
  const nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('on');
  // Track page view in Analytics
  const pageNames={'home':'דף ראשי','about':'אודות','admin':'ניהול'};
  if(typeof gtag!=='undefined') gtag('event','page_view',{page_title:pageNames[p]||p,page_location:window.location.href+'#'+p});
}

// ── FILTERS ──
function setFilter(val){
  catFilter=cleanCat(val)||val;
  currentPage=1;cachedSample=[];
  document.querySelectorAll('.fb-cat').forEach(b=>b.classList.remove('on'));
  document.getElementById('filter-'+(val==='הכל'?'all':val==='פותחים קופסא'?'cat1':val==='בין השורות'?'cat2':val==='דייט על קלף'?'cat3':'cat4')).classList.add('on');
  renderGrid();
}

// ── GRID ──
function getSmartSample(items){
  // First 8: 2 from each category, then rest randomly
  const cats=['פותחים קופסא','בין השורות','דייט על קלף','המיוחדים שלנו'];
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

function renderGrid(){
  const grid=document.getElementById('items-grid');
  const pgDiv=document.getElementById('pagination');
  
  let pool;
  if(catFilter==='הכל'){
    // Smart order: ensure all categories represented
    const cats=['פותחים קופסא','בין השורות','דייט על קלף','המיוחדים שלנו'];
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
  
  if(!pool.length){
    grid.innerHTML='<div class="empty"><div class="ei">&#128269;</div>לא נמצאו פריטים</div>';
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
        <button class="bbtn" ${st!=='av'?'disabled':''} data-borrow="${item.id}">${st==='av'?'השאלה ←':'כרגע אצל זוג מאושר אחר ♥'}</button>
      </div></div>`;
  }).join('');
  
  grid.querySelectorAll('[data-borrow]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openBorrowFromCard(btn.dataset.borrow);}));
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
  if(item.cat==='המיוחדים שלנו'){
    if(item.kitWe) ks.innerHTML+=`<div class="kit-section"><h4>&#9989; אנחנו כבר דאגנו ל...</h4><p style="white-space:pre-line">${esc(item.kitWe)}</p></div>`;
    if(item.kitYou) ks.innerHTML+=`<div class="kit-section orange"><h4>&#127968; עוד קצת השקעה מהבית</h4><p style="white-space:pre-line">${esc(item.kitYou)}</p></div>`;
  }
  const btn=document.getElementById('modal-borrow-btn');
  btn.disabled=st!=='av';
  btn.innerHTML=st==='av'?'השאלה &#128154;':'לא זמין כעת';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
  // Track view
  updateDoc(doc(db,'items',item.id),{views:(item.views||0)+1}).catch(()=>{});
  item.views=(item.views||0)+1;
}

// ── BORROW ──
function showSection(sec){
  if(sec&&typeof gtag!=='undefined') gtag('event',sec==='borrow'?'borrow_start':'return_start');
  document.getElementById('section-borrow').classList.toggle('hidden',sec!=='borrow');
  document.getElementById('section-return').classList.toggle('hidden',sec!=='return');
  document.getElementById('action-sec').scrollIntoView({behavior:'smooth'});
  if(sec==='borrow'){
    renderBorrowGrid();
    document.getElementById('borrow-form-wrap').classList.add('hidden');
    document.getElementById('borrow-success').classList.add('hidden');
    document.getElementById('borrow-items-grid').classList.remove('hidden');
  }
  if(sec==='return'){
    document.getElementById('r-phone').value='';
    document.getElementById('r-loans-list').classList.add('hidden');
    document.getElementById('r-not-found').classList.add('hidden');
    document.getElementById('r-success').classList.add('hidden');
  }
}

function renderBorrowGrid(query=''){
  const grid=document.getElementById('borrow-items-grid');
  const q=(query||'').trim().toLowerCase();const available=items.filter(i=>isAvailable(i)==='av'&&(!q||i.name.toLowerCase().includes(q)||(i.cat||'').toLowerCase().includes(q)||(i.desc||'').toLowerCase().includes(q)));
  if(!available.length){grid.innerHTML='<div class="empty"><div class="ei">&#128149;</div>כל הפריטים מושאלים כרגע</div>';return;}
  grid.innerHTML=available.map(item=>{
    const img=item.img||PLACEHOLDERS[item.cat]||'';
    return `<div class="borrow-card" data-bid="${item.id}">
      <img class="bc-img" src="${img}" alt="${esc(item.name)}" loading="lazy" onerror="this.style.display='none'"/>
      <div class="bc-name">${esc(item.name)}</div>
      <div class="bc-cat">${esc(item.cat)}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-bid]').forEach(c=>c.addEventListener('click',()=>selectBorrowItem(c.dataset.bid)));
}

function openBorrowFromCard(id){
  showSection('borrow');
  setTimeout(()=>selectBorrowItem(id),100);
}

function selectBorrowItem(id){
  selectedItem=items.find(i=>i.id===id);if(!selectedItem)return;
  document.getElementById('preview-icon').innerHTML=CAT_ICONS[selectedItem.cat]||'';
  document.getElementById('preview-name').textContent=selectedItem.name;
  document.getElementById('preview-desc').textContent=selectedItem.desc||'';
  document.getElementById('f-name').value='';
  document.getElementById('f-phone').value='';
  document.getElementById('f-confirm').checked=false;
  const sbtn=document.getElementById('btn-submit-borrow');
  sbtn.disabled=false;
  sbtn.textContent='סימון לקיחה \u{1F499}';
  document.getElementById('borrow-items-grid').classList.add('hidden');
  document.getElementById('borrow-form-wrap').classList.remove('hidden');
  document.getElementById('borrow-success').classList.add('hidden');
  // Hide search when item selected
  const searchWrap=document.getElementById('borrow-search-wrap');
  if(searchWrap) searchWrap.style.display='none';
}

async function submitBorrow(){
  const name=document.getElementById('f-name').value.trim();
  const phone=document.getElementById('f-phone').value.trim();
  const confirm=document.getElementById('f-confirm').checked;
  if(!name||!phone){alert('יש למלא שם וטלפון');return;}
  if(!confirm){alert('יש לאשר את התנאים');return;}
  // Prevent duplicate - check if already borrowed this item
  const alreadyBorrowed=loans.some(l=>l.itemId===selectedItem.id&&l.status==='פעיל');
  if(alreadyBorrowed){alert('הפריט כבר מושאל!');return;}
  // Disable button while submitting
  const btn=document.getElementById('btn-submit-borrow');
  btn.disabled=true;
  btn.textContent='שולח...';
  try{
    const loanData={itemId:selectedItem.id,item:selectedItem.name,name,phone,date:new Date().toLocaleDateString('he-IL'),timestamp:new Date().toISOString(),status:'פעיל',seen:false};
    const ref=await addDoc(collection(db,'loans'),loanData);
    loans.push({id:ref.id,...loanData});
    // Track borrow count
    const borrowedItem=items.find(i=>i.id===loanData.itemId);
    if(borrowedItem){
      updateDoc(doc(db,'items',loanData.itemId),{borrows:(borrowedItem.borrows||0)+1}).catch(()=>{});
      borrowedItem.borrows=(borrowedItem.borrows||0)+1;
    }
    renderGrid();
    document.getElementById('borrow-form-wrap').classList.add('hidden');
    document.getElementById('borrow-success').classList.remove('hidden');
    renderAdminLoans();renderNotifications();
    notifyTelegram(loanData);
  // Send notification via SW (works on Android)
  if(Notification.permission==='granted' && 'serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(reg=>{
      reg.showNotification('השאלה חדשה ♥',{
        body: name + ' לקח/ה את ' + selectedItem.name,
        icon: 'logo.gif',
        dir: 'rtl',
        vibrate: [200,100,200]
      });
    }).catch(()=>{});
  }
  }catch(e){
    alert('שגיאה בשמירה, נסה שוב');
    btn.disabled=false;
    btn.textContent='סימון לקיחה &#128149;';
  }
}

// ── RETURN ──
function lookupLoans(){
  const phone=document.getElementById('r-phone').value.trim().replace(/[^0-9]/g,'');
  if(phone.length<9){document.getElementById('r-loans-list').classList.add('hidden');document.getElementById('r-not-found').classList.add('hidden');return;}
  const active=loans.filter(l=>l.phone&&l.phone.replace(/[^0-9]/g,'').includes(phone)&&l.status==='פעיל');
  if(!active.length){document.getElementById('r-loans-list').classList.add('hidden');document.getElementById('r-not-found').classList.remove('hidden');return;}
  document.getElementById('r-not-found').classList.add('hidden');
  document.getElementById('r-loans-list').classList.remove('hidden');
  document.getElementById('r-items').innerHTML=active.map(l=>`
    <div class="r-loan-item">
      <div><div class="r-loan-name">${esc(l.item)}</div><div class="r-loan-date">נלקח ב: ${esc(l.date||'')}</div></div>
      <button class="r-return-btn" data-lid="${l.id}">סימון החזרה &#9996;</button>
    </div>`).join('');
  document.getElementById('r-items').querySelectorAll('[data-lid]').forEach(btn=>btn.addEventListener('click',()=>confirmReturn(btn.dataset.lid)));
}

async function confirmReturn(loanId){
  const returnedTimestamp=new Date().toISOString();
  await updateDoc(doc(db,'loans',loanId),{status:'הוחזר',returnedTimestamp});
  loans=loans.map(l=>l.id===loanId?{...l,status:'הוחזר',returnedTimestamp}:l);
  renderGrid();
  document.getElementById('r-loans-list').classList.add('hidden');
  document.getElementById('r-success').classList.remove('hidden');
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
    startPolling();
    Promise.all([loadLoans(), loadItems()]).then(()=>{renderAdminLoans();renderNotifications();renderAdminItems();});
    if(Notification&&Notification.permission==='default') Notification.requestPermission();
  }catch(e){
    document.getElementById('admin-err').style.display='block';
  }finally{
    btn.disabled=false;
  }
}

function setAdminTab(tab){
  ['notif','loans','items','stats'].forEach(t=>{
    document.getElementById('admin-'+t).classList.toggle('hidden',t!==tab);
    document.getElementById('tab-'+t).classList.toggle('on',t===tab);
  });
  if(tab==='notif') renderNotifications();
  if(tab==='stats') renderStats();
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
  el.innerHTML=sortedLoans().map(l=>`
    <div class="lrow">
      <span class="lid" style="font-weight:700;color:var(--teal);font-size:.8rem">${l.id.slice(-4)}</span>
      <span style="font-weight:600;font-size:.84rem">${esc(l.item)}</span>
      <span class="sbadge ${l.status==='פעיל'?'act':'ret'}">${esc(l.status)}</span>
      <span style="color:var(--text-mid);font-size:.78rem;grid-column:2">${esc(l.name)} &middot; ${esc(l.phone)} &middot; ${esc(l.date||'')}</span>
      ${l.status==='פעיל'?`<button class="retbtn" data-lid="${l.id}">החזיר</button>`:''}
      <button class="delbtn" data-del="${l.id}" style="font-size:.72rem;padding:.22rem .55rem">מחק</button>
    </div>`).join('');
  el.querySelectorAll('[data-lid]').forEach(btn=>btn.addEventListener('click',async()=>{
    const returnedTimestamp=new Date().toISOString();
    await updateDoc(doc(db,'loans',btn.dataset.lid),{status:'הוחזר',returnedTimestamp});
    loans=loans.map(l=>l.id===btn.dataset.lid?{...l,status:'הוחזר',returnedTimestamp}:l);
    renderAdminLoans();renderGrid();
  }));
  el.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('למחוק השאלה זו מההיסטוריה?'))return;
    await deleteDoc(doc(db,'loans',btn.dataset.del));
    loans=loans.filter(l=>l.id!==btn.dataset.del);
    renderAdminLoans();renderNotifications();
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
let lastLoanCount=0, pollingInterval=null;
function startPolling(){
  if(pollingInterval)return;
  pollingInterval=setInterval(async()=>{
    await loadLoans();
    const unseen=loans.filter(l=>!l.seen&&l.status==='פעיל');
    if(unseen.length>lastLoanCount){
      if(Notification&&Notification.permission==='granted'){
        unseen.slice(lastLoanCount).forEach(l=>{
          new Notification('השאלה חדשה',{body:l.name+' לקח את '+l.item});
        });
      }
      renderNotifications();renderAdminLoans();
    }
    lastLoanCount=unseen.length;
  },30000);
}
function stopPolling(){if(pollingInterval){clearInterval(pollingInterval);pollingInterval=null;}}
async function clearAllNotifications(){
  if(!confirm('למחוק את כל ההתראות?'))return;
  const unseen=loans.filter(l=>!l.seen);
  await Promise.all(unseen.map(l=>updateDoc(doc(db,'loans',l.id),{seen:true})));
  loans=loans.map(l=>({...l,seen:true}));
  renderNotifications();
}
function renderNotifications(){
  const unseen=loans.filter(l=>!l.seen&&l.status==='פעיל');
  const badge=document.getElementById('notif-badge');
  if(unseen.length){badge.textContent=unseen.length;badge.classList.remove('hidden');}
  else badge.classList.add('hidden');
  const list=document.getElementById('notif-list');
  if(!list)return;
  if(!unseen.length){list.innerHTML='<div class="empty" style="padding:1.5rem"><div class="ei">&#128235;</div>אין התראות חדשות</div>';return;}
  list.innerHTML=unseen.map(l=>`
    <div class="notif-item">
      <div style="font-size:1.5rem">&#128149;</div>
      <div class="notif-body"><strong>${esc(l.name)}</strong> לקח את <strong>${esc(l.item)}</strong><div class="notif-date">${esc(l.date||'')} &middot; ${esc(l.phone)}</div></div>
      <button class="notif-seen" data-nid="${l.id}">&#10003;</button>
    </div>`).join('');
  list.querySelectorAll('[data-nid]').forEach(btn=>btn.addEventListener('click',async()=>{
    await updateDoc(doc(db,'loans',btn.dataset.nid),{seen:true});
    loans=loans.map(l=>l.id===btn.dataset.nid?{...l,seen:true}:l);
    renderNotifications();
  }));
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
    await deleteDoc(doc(db,'items',btn.dataset.did));
    items=items.filter(i=>i.id!==btn.dataset.did);
    renderAdminItems();renderGrid();
  }));
  list.querySelectorAll('[data-mlid]').forEach(btn=>btn.addEventListener('click',async()=>{
    const item=items.find(i=>i.id===btn.dataset.mlid);
    if(!item)return;
    if(isAvailable(item)!=='av'){
      // Mark as returned
      const activeLoan=loans.find(l=>l.itemId===item.id&&l.status==='פעיל'&&l.manual);
      if(activeLoan){
        if(!confirm('לסמן כהוחזר?'))return;
        const returnedTimestamp=new Date().toISOString();
        await updateDoc(doc(db,'loans',activeLoan.id),{status:'הוחזר',returnedTimestamp});
        loans=loans.map(l=>l.id===activeLoan.id?{...l,status:'הוחזר',returnedTimestamp}:l);
        renderAdminItems();renderGrid();renderAdminLoans();
      }
      return;
    }
    const name=prompt('שם מי שלקח:');
    if(!name)return;
    const loanData={itemId:item.id,item:item.name,name,phone:'מנהל',date:new Date().toLocaleDateString('he-IL'),timestamp:new Date().toISOString(),status:'פעיל',seen:true,manual:true};
    const ref=await addDoc(collection(db,'loans'),loanData);
    loans.push({id:ref.id,...loanData});
    renderAdminItems();renderGrid();renderAdminLoans();
    notifyTelegram(loanData);
  }));
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
  const item=isNew?{id:'-1',name:'',cat:'פותחים קופסא',desc:'',img:'',kitWe:'',kitYou:''}:items.find(i=>i.id===id);
  if(!item)return;
  editId=id; editImgData=item.img||'';
  document.getElementById('edit-title').textContent=isNew?'הוספת פריט חדש':'עריכת פריט';
  const saveBtn=document.getElementById('edit-save-btn');
  saveBtn.disabled=false;
  saveBtn.textContent=isNew?'הוסף לקטלוג +':'שמירה ✓';
  document.getElementById('edit-name').value=item.name||'';
  document.getElementById('edit-cat').value=item.cat||'פותחים קופסא';
  document.getElementById('edit-desc').value=item.desc||'';
  document.getElementById('edit-kitwe').value=item.kitWe||'';
  document.getElementById('edit-kityou').value=item.kitYou||'';
  document.getElementById('edit-kit-fields').classList.toggle('hidden',item.cat!=='המיוחדים שלנו');
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
      const ref=await addDoc(collection(db,'items'),data);
      items.push({id:ref.id,...data});
    }else{
      await updateDoc(doc(db,'items',editId),data);
      items=items.map(i=>i.id===editId?{id:editId,...data}:i);
    }
    closeEdit();renderAdminItems();renderGrid();
  }catch(e){
    alert('שגיאה בשמירה, נסה שוב');
    btn.disabled=false;
    btn.textContent=editId==='-1'?'הוסף לקטלוג +':'שמירה ✓';
  }
}


// ── EVENT LISTENERS ──
document.getElementById('nav-home-brand')?.addEventListener('click',e=>{e.preventDefault();showPage('home');window.scrollTo({top:0,behavior:'smooth'});});

document.getElementById('nav-catalog-btn')?.addEventListener('click',()=>{showPage('home');setTimeout(()=>document.getElementById('cat-sec').scrollIntoView({behavior:'smooth'}),100);});
document.getElementById('nav-about')?.addEventListener('click',()=>showPage('about'));
document.getElementById('nav-borrow-btn')?.addEventListener('click',()=>{showPage('home');showSection('borrow');});
document.getElementById('nav-return-btn')?.addEventListener('click',()=>{showPage('home');showSection('return');});
document.getElementById('btn-to-catalog')?.addEventListener('click',()=>document.getElementById('how-sec').scrollIntoView({behavior:'smooth'}));
document.getElementById('btn-borrow-main')?.addEventListener('click',()=>showSection('borrow'));
document.getElementById('btn-return-main')?.addEventListener('click',()=>showSection('return'));
document.getElementById('link-borrow')?.addEventListener('click',()=>showSection('borrow'));
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

document.getElementById('btn-submit-borrow')?.addEventListener('click',submitBorrow);
document.getElementById('borrow-search')?.addEventListener('input',e=>renderBorrowGrid(e.target.value));
document.getElementById('borrow-search')?.addEventListener('input',e=>renderBorrowGrid(e.target.value));
document.getElementById('btn-cancel-borrow')?.addEventListener('click',()=>showSection(null));
document.getElementById('btn-change-item')?.addEventListener('click',()=>{
  document.getElementById('borrow-form-wrap').classList.add('hidden');
  document.getElementById('borrow-items-grid').classList.remove('hidden');
  const searchWrap=document.getElementById('borrow-search-wrap');
  if(searchWrap) searchWrap.style.display='';
  renderBorrowGrid();
});
document.getElementById('btn-change-item')?.addEventListener('click',()=>{
  document.getElementById('borrow-form-wrap').classList.add('hidden');
  document.getElementById('borrow-items-grid').classList.remove('hidden');
  const searchWrap=document.getElementById('borrow-search-wrap');
  if(searchWrap) searchWrap.style.display='';
  renderBorrowGrid();
});
document.getElementById('btn-back-from-borrow')?.addEventListener('click',()=>showSection(null));
document.getElementById('btn-lookup-return')?.addEventListener('click',lookupLoans);
document.getElementById('btn-cancel-return')?.addEventListener('click',()=>showSection(null));
document.getElementById('btn-back-from-return')?.addEventListener('click',()=>showSection(null));
document.getElementById('modal-overlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('modal-overlay')){document.getElementById('modal-overlay').classList.add('hidden');document.body.style.overflow='';} });
document.getElementById('modal-close-btn')?.addEventListener('click',()=>{document.getElementById('modal-overlay').classList.add('hidden');document.body.style.overflow='';});
document.getElementById('modal-borrow-btn')?.addEventListener('click',()=>{if(!modalItem||isAvailable(modalItem)!=='av')return;document.getElementById('modal-overlay').classList.add('hidden');document.body.style.overflow='';openBorrowFromCard(modalItem.id);});
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
document.getElementById('edit-cat')?.addEventListener('change',()=>{document.getElementById('edit-kit-fields').classList.toggle('hidden',document.getElementById('edit-cat').value!=='המיוחדים שלנו');});
document.querySelectorAll('#filters .fb-cat').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const map={'filter-all':'הכל','filter-cat1':'פותחים קופסא','filter-cat2':'בין השורות','filter-cat3':'דייט על קלף','filter-cat4':'המיוחדים שלנו'};
    setFilter(map[btn.id]||'הכל');
  });
});

// ── INIT ──
async function init(){
  document.getElementById('items-grid').innerHTML='<div class="empty"><div class="ei">&#8987;</div>טוען...</div>';
  try{
    await Promise.all([loadItems(), loadLoans()]);
  }catch(e){
    document.getElementById('items-grid').innerHTML='<div class="empty"><div class="ei">&#9888;</div>שגיאה בטעינה. רענן את הדף.</div>';
    console.error(e);
  }
}
document.getElementById('admin-search')?.addEventListener('input',()=>renderAdminItems());
document.getElementById('admin-cat-filter')?.addEventListener('change',()=>renderAdminItems());
init();
