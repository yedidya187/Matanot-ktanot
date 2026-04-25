import { useState, useEffect, useRef } from "react";

// ─── DATA ───────────────────────────────────────────────────────────────────
const INITIAL_ITEMS = [
  { id: 1, name: "קשר טוב", category: "משחקים", audience: ["נשואים","מאורסים","יוצאים"], description: "משחק קלפים לשיחה עמוקה ומחברת", available: true, copies: 2 },
  { id: 2, name: "הפנס שלנו", category: "משחקים", audience: ["נשואים","מאורסים"], description: "שאלות שמאירות מה שביניכם", available: true, copies: 1 },
  { id: 3, name: "שאלות של אהבה", category: "משחקים", audience: ["יוצאים","מאורסים"], description: "36 שאלות לחיבור אמיתי", available: false, copies: 1 },
  { id: 4, name: "אהבה ביום יום", category: "משחקים", audience: ["נשואים"], description: "כרטיסיות לרגעים קטנים", available: true, copies: 3 },
  { id: 5, name: "5 שפות האהבה", category: "ספרים", audience: ["נשואים","מאורסים","יוצאים"], description: "גארי צ׳פמן — קלאסיקה זוגית", available: true, copies: 2 },
  { id: 6, name: "Hold Me Tight", category: "ספרים", audience: ["נשואים"], description: "ד״ר סו ג׳ונסון על קשר בטוח", available: true, copies: 1 },
  { id: 7, name: "מה שאתם לא אומרים", category: "ספרים", audience: ["נשואים","מאורסים"], description: "שיחות שמשנות מערכות יחסים", available: false, copies: 1 },
  { id: 8, name: "ערכת דייט בבית", category: "ערכות", audience: ["נשואים","מאורסים","יוצאים"], description: "אתגרים, רעיונות ורגעים משותפים", available: true, copies: 2 },
  { id: 9, name: "ערכת שבת זוגית", category: "ערכות", audience: ["נשואים","מאורסים"], description: "נרות, כרטיסיות ומדריך לשבת מיוחדת", available: true, copies: 1 },
  { id: 10, name: "Mystery Date Box", category: "ערכות", audience: ["יוצאים","מאורסים"], description: "ערכת הפתעה עם רמזים ומשימות", available: false, copies: 1 },
];

const ADMIN_PASS = "matanot2024";
const CATS = ["הכל", "משחקים", "ספרים", "ערכות"];
const AUDIENCES = ["הכל", "נשואים", "מאורסים", "יוצאים"];
const CAT_ICONS = { משחקים: "🃏", ספרים: "📖", ערכות: "🎁" };

// ─── LOGO WITH HEARTBEAT ─────────────────────────────────────────────────────
function LogoAnimation() {
  return (
    <>
      <style>{`
        @keyframes heartbeat {
          0%   { transform: translate(120px, 72px) scale(1); }
          14%  { transform: translate(120px, 72px) scale(1.22); }
          28%  { transform: translate(120px, 72px) scale(1); }
          42%  { transform: translate(120px, 72px) scale(1.14); }
          56%  { transform: translate(120px, 72px) scale(1); }
          100% { transform: translate(120px, 72px) scale(1); }
        }
        @keyframes heartglow {
          0%,56%,100% { filter: drop-shadow(0 0 0px rgba(91,175,142,0)); }
          14%          { filter: drop-shadow(0 0 7px rgba(91,175,142,0.55)); }
          42%          { filter: drop-shadow(0 0 4px rgba(91,175,142,0.35)); }
        }
        @keyframes logobreath {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.012); }
        }
        .logo-wrap {
          display: inline-block;
          animation: logobreath 4s ease-in-out infinite;
          transform-origin: center;
        }
        .heart-beat {
          transform-origin: 0 0;
          animation: heartbeat 1.6s ease-in-out infinite, heartglow 1.6s ease-in-out infinite;
        }
      `}</style>
      <div className="logo-wrap">
        <svg viewBox="0 0 240 215" width="200" height="180" style={{overflow:"visible"}}>
          {/* outer circles */}
          <circle cx="120" cy="105" r="100" fill="none" stroke="#5BAF8E" strokeWidth="1.4" opacity="0.45"/>
          <circle cx="120" cy="105" r="93" fill="none" stroke="#5BAF8E" strokeWidth="0.6" opacity="0.25"/>

          {/* LEFT cup */}
          <g>
            <path d="M66 138 Q73 126 82 119" fill="none" stroke="#5BAF8E" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M68 133 Q62 128 60 122 Q58 116 64 118" fill="none" stroke="#5BAF8E" strokeWidth="1.6" strokeLinecap="round"/>
            <rect x="74" y="92" width="28" height="30" rx="3.5" fill="#F5FBF8" stroke="#5BAF8E" strokeWidth="1.9"/>
            <path d="M102 100 Q112 100 112 107 Q112 114 102 114" fill="none" stroke="#5BAF8E" strokeWidth="1.9" strokeLinecap="round"/>
            <line x1="74" y1="122" x2="102" y2="122" stroke="#5BAF8E" strokeWidth="1.6"/>
            <path d="M77 122 Q76 128 78 131" fill="none" stroke="#5BAF8E" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M83 122 Q82 129 84 132" fill="none" stroke="#5BAF8E" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M89 122 Q88 129 90 132" fill="none" stroke="#5BAF8E" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M95 122 Q94 128 96 131" fill="none" stroke="#5BAF8E" strokeWidth="1.5" strokeLinecap="round"/>
          </g>

          {/* RIGHT cup */}
          <g>
            <path d="M174 138 Q167 126 158 119" fill="none" stroke="#9B8EC4" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M172 133 Q178 128 180 122 Q182 116 176 118" fill="none" stroke="#9B8EC4" strokeWidth="1.6" strokeLinecap="round"/>
            <rect x="138" y="92" width="28" height="30" rx="3.5" fill="#F8F5FC" stroke="#9B8EC4" strokeWidth="1.9"/>
            <path d="M138 100 Q128 100 128 107 Q128 114 138 114" fill="none" stroke="#9B8EC4" strokeWidth="1.9" strokeLinecap="round"/>
            <line x1="138" y1="122" x2="166" y2="122" stroke="#9B8EC4" strokeWidth="1.6"/>
            <path d="M145 122 Q146 128 144 131" fill="none" stroke="#9B8EC4" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M151 122 Q152 129 150 132" fill="none" stroke="#9B8EC4" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M157 122 Q158 129 156 132" fill="none" stroke="#9B8EC4" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M163 122 Q164 128 162 131" fill="none" stroke="#9B8EC4" strokeWidth="1.5" strokeLinecap="round"/>
          </g>

          {/* HEART — heartbeat animation */}
          <g className="heart-beat">
            <path d="M0,-9 C-1,-16 -12,-16 -12,-7 C-12,2 0,12 0,12 C0,12 12,2 12,-7 C12,-16 1,-16 0,-9 Z"
              fill="#5BAF8E"/>
            <line x1="-15" y1="-13" x2="-11" y2="-9" stroke="#5BAF8E" strokeWidth="1.6" strokeLinecap="round" opacity="0.65"/>
            <line x1="15" y1="-13" x2="11" y2="-9" stroke="#5BAF8E" strokeWidth="1.6" strokeLinecap="round" opacity="0.65"/>
            <line x1="0" y1="-18" x2="0" y2="-13" stroke="#5BAF8E" strokeWidth="1.6" strokeLinecap="round" opacity="0.65"/>
          </g>

          {/* brand text */}
          <text x="120" y="162" textAnchor="middle" fontFamily="'Frank Ruhl Libre',Georgia,serif" fontSize="21" fill="#3D7A62" fontWeight="700" letterSpacing="0.5">מתנות קטנות</text>
          <line x1="72" y1="169" x2="112" y2="169" stroke="#9B8EC4" strokeWidth="0.9" opacity="0.55"/>
          <path d="M120 166 C120 166 118 163 120 161 C122 163 120 166 120 166Z" fill="#9B8EC4" opacity="0.8"/>
          <line x1="128" y1="169" x2="168" y2="169" stroke="#9B8EC4" strokeWidth="0.9" opacity="0.55"/>
          <text x="120" y="181" textAnchor="middle" fontFamily="'Assistant',sans-serif" fontSize="9.8" fill="#8A8098" letterSpacing="0.4">גמ״ח לרגעים פשוטים ביחד</text>

          {/* bottom botanical */}
          <g transform="translate(120,198)" opacity="0.75">
            <path d="M-22 0 Q-17,-6 -10,0" fill="none" stroke="#9B8EC4" strokeWidth="1.3"/>
            <path d="M-17,-2 Q-13,-8 -7,-4" fill="none" stroke="#9B8EC4" strokeWidth="1" opacity="0.6"/>
            <path d="M22 0 Q17,-6 10,0" fill="none" stroke="#9B8EC4" strokeWidth="1.3"/>
            <path d="M17,-2 Q13,-8 7,-4" fill="none" stroke="#9B8EC4" strokeWidth="1" opacity="0.6"/>
            <path d="M0,-2 C0,-2 -2.5,-7 0,-10 C2.5,-7 0,-2 0,-2Z" fill="#5BAF8E"/>
          </g>
        </svg>
      </div>
    </>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [catFilter, setCatFilter] = useState("הכל");
  const [audFilter, setAudFilter] = useState("הכל");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState("home");
  const [borrowForm, setBorrowForm] = useState({ name:"", phone:"", from:"", to:"", note:"" });
  const [borrowStep, setBorrowStep] = useState("form");
  const [borrowId, setBorrowId] = useState(null);
  const [adminPass, setAdminPass] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminErr, setAdminErr] = useState("");
  const [adminTab, setAdminTab] = useState("loans");
  const [loans, setLoans] = useState([]);
  const [newItem, setNewItem] = useState({ name:"", category:"משחקים", audience:[], description:"", copies:1 });
  const [addedMsg, setAddedMsg] = useState("");
  const borrowRef = useRef(null);

  const filtered = items.filter(i =>
    (catFilter === "הכל" || i.category === catFilter) &&
    (audFilter === "הכל" || i.audience.includes(audFilter))
  );

  function handleBorrow(item) {
    setSelected(item);
    setBorrowForm({ name:"", phone:"", from:"", to:"", note:"" });
    setBorrowStep("form");
    setTimeout(() => borrowRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 80);
  }

  function submitBorrow() {
    if (!borrowForm.name || !borrowForm.phone || !borrowForm.from || !borrowForm.to) return;
    const id = "B" + String(loans.length + 1258).padStart(4,"0");
    setBorrowId(id);
    setLoans(prev => [...prev, { id, item:selected.name, ...borrowForm, status:"פעיל", date:new Date().toLocaleDateString("he-IL") }]);
    setItems(prev => prev.map(i => i.id === selected.id ? {...i, available:false} : i));
    setBorrowStep("success");
  }

  function addItem() {
    if (!newItem.name) return;
    setItems(prev => [...prev, { id:Date.now(), ...newItem, available:true }]);
    setNewItem({ name:"", category:"משחקים", audience:[], description:"", copies:1 });
    setAddedMsg("✓ הפריט נוסף בהצלחה!");
    setTimeout(() => setAddedMsg(""), 3000);
  }

  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)); }

  function returnLoan(loanId) {
    const loan = loans.find(l => l.id === loanId);
    const item = items.find(i => i.name === loan?.item);
    if (item) setItems(prev => prev.map(i => i.id === item.id ? {...i, available:true} : i));
    setLoans(prev => prev.map(l => l.id === loanId ? {...l, status:"הוחזר"} : l));
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const maxStr = (() => { const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().split("T")[0]; })();

  function tryAdminLogin() {
    if (adminPass === ADMIN_PASS) { setAdminAuthed(true); setAdminErr(""); }
    else setAdminErr("סיסמה שגויה, נסה שנית");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&family=Assistant:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --teal: #4A9E7E;
          --teal-dark: #3A7860;
          --teal-light: #EAF5F0;
          --teal-mid: #BEE0D4;
          --lav: #9B8EC4;
          --lav-light: #EDE9F7;
          --cream: #F4EDE0;
          --cream-warm: #EBE0CB;
          --paper: #FAF5EB;
          --text: #2A2620;
          --text-mid: #6A6055;
          --text-light: #9C9082;
          --border: #D8CEBA;
          --white: #FEFAF3;
        }
        html { direction:rtl; scroll-behavior:smooth; }
        body { background:var(--cream); font-family:'Assistant',sans-serif; color:var(--text); min-height:100vh; }

        .nav {
          background:var(--paper); border-bottom:1px solid var(--border);
          display:flex; align-items:center; justify-content:space-between;
          padding:0 2rem; height:62px; position:sticky; top:0; z-index:300;
          box-shadow:0 2px 14px rgba(58,120,96,.07);
        }
        .nav-brand {
          font-family:'Frank Ruhl Libre',serif; font-size:1.2rem;
          color:var(--teal-dark); font-weight:700; cursor:pointer;
          display:flex; align-items:center; gap:.4rem;
        }
        .nav-brand span { color:var(--lav); }
        .nav-links { display:flex; gap:.5rem; list-style:none; }
        .nav-btn {
          background:none; border:none; cursor:pointer;
          font-family:'Assistant',sans-serif; font-size:.93rem; color:var(--text-mid);
          padding:.35rem .7rem; border-radius:.4rem; transition:all .2s;
        }
        .nav-btn:hover,.nav-btn.on { color:var(--teal-dark); background:var(--teal-light); font-weight:600; }

        /* HERO */
        .hero {
          background:linear-gradient(155deg, var(--paper) 0%, var(--cream) 55%, var(--cream-warm) 100%);
          padding:3.5rem 1.5rem 3rem; text-align:center; position:relative; overflow:hidden;
        }
        .hero::before {
          content:''; position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(ellipse 65% 45% at 50% 5%, rgba(74,158,126,.09) 0%, transparent 70%);
        }
        .deco { position:absolute; opacity:.15; pointer-events:none; font-size:3.5rem; }
        .hero-tag {
          display:inline-block; background:rgba(74,158,126,.12);
          border:1px solid rgba(74,158,126,.28); color:var(--teal-dark);
          padding:.28rem .95rem; border-radius:2rem; font-size:.81rem; font-weight:700;
          margin-bottom:1.2rem; letter-spacing:.04em;
        }
        .hero h1 {
          font-family:'Frank Ruhl Libre',serif; font-size:clamp(1.75rem,4vw,2.7rem);
          color:var(--teal-dark); line-height:1.3; margin-bottom:.9rem;
        }
        .hero p {
          color:var(--text-mid); font-size:1.03rem; max-width:510px;
          margin:0 auto 2rem; line-height:1.8; font-weight:300;
        }
        .btn-hero {
          display:inline-block; background:var(--teal); color:#fff; border:none;
          padding:.82rem 2.2rem; border-radius:.6rem; font-family:'Assistant',sans-serif;
          font-size:1rem; font-weight:700; cursor:pointer; transition:all .22s;
          box-shadow:0 4px 18px rgba(74,158,126,.33);
        }
        .btn-hero:hover { background:var(--teal-dark); transform:translateY(-2px); }

        /* ABOUT STRIP */
        .about-strip {
          background:var(--teal-light); border-top:1px solid var(--teal-mid); border-bottom:1px solid var(--teal-mid);
          display:flex; justify-content:center; gap:2.5rem; flex-wrap:wrap;
          padding:2.5rem 1.5rem; text-align:center;
        }
        .about-item { max-width:185px; }
        .about-item .ai-icon { font-size:1.9rem; margin-bottom:.5rem; }
        .about-item strong { display:block; color:var(--teal-dark); font-weight:700; margin-bottom:.25rem; font-size:.97rem; }
        .about-item p { font-size:.84rem; color:var(--text-mid); line-height:1.55; font-weight:300; }

        /* CATALOG */
        .catalog { max-width:1080px; margin:0 auto; padding:3rem 1.5rem; }
        .cat-head {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem;
        }
        .cat-head h2 {
          font-family:'Frank Ruhl Libre',serif; font-size:1.55rem; color:var(--teal-dark);
        }
        .filters { display:flex; gap:.45rem; flex-wrap:wrap; align-items:center; }
        .fb {
          background:none; border:1.5px solid var(--border); padding:.38rem 1rem;
          border-radius:2rem; font-family:'Assistant',sans-serif; font-size:.86rem;
          color:var(--text-mid); cursor:pointer; transition:all .2s;
        }
        .fb:hover,.fb.on { border-color:var(--teal); color:var(--teal-dark); background:var(--teal-light); font-weight:600; }
        .fsep { width:1px; background:var(--border); height:24px; margin:0 .25rem; }

        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:1.2rem; }
        .card {
          background:var(--white); border:1px solid var(--border); border-radius:1rem;
          padding:1.4rem; transition:all .25s;
        }
        .card:hover { transform:translateY(-3px); box-shadow:0 8px 26px rgba(58,120,96,.11); border-color:var(--teal-mid); }
        .card.dim { opacity:.65; }
        .cbadge {
          display:inline-block; font-size:.73rem; font-weight:700; padding:.18rem .62rem;
          border-radius:2rem; background:var(--teal-light); color:var(--teal-dark); margin-bottom:.7rem;
        }
        .cname { font-family:'Frank Ruhl Libre',serif; font-size:1.07rem; color:var(--text); margin-bottom:.35rem; }
        .cdesc { font-size:.83rem; color:var(--text-mid); line-height:1.5; margin-bottom:.85rem; font-weight:300; }
        .atags { display:flex; gap:.3rem; flex-wrap:wrap; margin-bottom:.8rem; }
        .atag {
          font-size:.7rem; padding:.13rem .52rem; border-radius:2rem;
          background:var(--lav-light); color:var(--lav); font-weight:600;
        }
        .sdot {
          display:inline-flex; align-items:center; gap:.35rem;
          font-size:.77rem; font-weight:700; margin-bottom:.7rem;
        }
        .sdot::before { content:''; width:7px; height:7px; border-radius:50%; background:currentColor; display:inline-block; }
        .sdot.av { color:#2E8A58; }
        .sdot.tk { color:#A0602A; }
        .bbtn {
          width:100%; padding:.6rem; border-radius:.5rem; background:var(--teal); color:#fff;
          border:none; font-family:'Assistant',sans-serif; font-size:.89rem; font-weight:700; cursor:pointer; transition:background .2s;
        }
        .bbtn:hover { background:var(--teal-dark); }
        .bbtn:disabled { background:var(--cream-warm); color:var(--text-light); cursor:not-allowed; }

        /* BORROW SECTION */
        .bsec {
          background:var(--teal-light); border-top:1.5px solid var(--teal-mid); padding:3rem 1.5rem;
        }
        .binner { max-width:540px; margin:0 auto; }
        .binner h2 { font-family:'Frank Ruhl Libre',serif; font-size:1.45rem; color:var(--teal-dark); margin-bottom:.35rem; }
        .binner .sub { color:var(--text-mid); font-size:.88rem; margin-bottom:1.5rem; }
        .bpreview {
          display:flex; align-items:center; gap:1rem; background:var(--white);
          border:1px solid var(--teal-mid); border-radius:.75rem; padding:1rem 1.25rem; margin-bottom:1.75rem;
        }
        .bpreview .bi { font-size:2rem; }
        .bpreview strong { font-family:'Frank Ruhl Libre',serif; font-size:1.05rem; color:var(--teal-dark); display:block; }
        .bpreview span { font-size:.83rem; color:var(--text-mid); }
        .frow { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }
        @media(max-width:500px){ .frow { grid-template-columns:1fr; } }
        .fg { margin-bottom:.95rem; }
        .fg label { display:block; font-size:.83rem; font-weight:700; color:var(--text); margin-bottom:.35rem; }
        .fg input,.fg textarea {
          width:100%; padding:.68rem .95rem;
          border:1.5px solid var(--border); border-radius:.5rem;
          font-family:'Assistant',sans-serif; font-size:.93rem; color:var(--text);
          background:var(--white); outline:none; direction:rtl; transition:border-color .2s;
        }
        .fg input:focus,.fg textarea:focus { border-color:var(--teal); }
        .fg textarea { resize:vertical; min-height:66px; }
        .dnote { font-size:.76rem; color:var(--text-light); margin-top:.28rem; }
        .sbtn {
          width:100%; padding:.88rem; background:var(--teal); color:#fff; border:none;
          border-radius:.6rem; font-family:'Assistant',sans-serif; font-size:.98rem; font-weight:700;
          cursor:pointer; transition:all .2s; box-shadow:0 4px 16px rgba(74,158,126,.28); margin-top:.4rem;
        }
        .sbtn:hover { background:var(--teal-dark); }
        .sbtn:disabled { background:var(--cream-warm); color:var(--text-light); cursor:not-allowed; box-shadow:none; }
        .clnk { text-align:center; margin-top:.9rem; }
        .clnk button { background:none; border:none; color:var(--text-light); font-size:.86rem; cursor:pointer; text-decoration:underline; font-family:'Assistant',sans-serif; }
        .bprompt { text-align:center; padding:2.5rem 1rem; color:var(--text-mid); }
        .bprompt .bp-icon { font-size:2.2rem; margin-bottom:.75rem; }

        /* SUCCESS */
        .sbox { text-align:center; padding:2rem 0; }
        .sbox .si { font-size:3.2rem; margin-bottom:1rem; }
        .sbox h3 { font-family:'Frank Ruhl Libre',serif; font-size:1.55rem; color:var(--teal-dark); margin-bottom:.5rem; }
        .sbox p { color:var(--text-mid); font-size:.93rem; line-height:1.75; }
        .sbox .sid { font-weight:700; color:var(--teal); font-size:1.05rem; }

        /* FOOTER */
        .footer {
          background:var(--teal-dark); color:rgba(255,255,255,.6);
          text-align:center; padding:2.5rem 1.5rem; font-size:.84rem;
        }
        .footer strong { color:#fff; font-family:'Frank Ruhl Libre',serif; font-size:1.05rem; display:block; margin-bottom:.4rem; }
        .fbot { margin-top:.8rem; font-size:1.1rem; opacity:.45; }

        /* ADMIN */
        .admin-wrap { max-width:860px; margin:0 auto; padding:3rem 1.5rem; }
        .admin-login-box { max-width:340px; margin:4rem auto; text-align:center; }
        .admin-login-box h2 { font-family:'Frank Ruhl Libre',serif; font-size:1.45rem; color:var(--teal-dark); margin-bottom:.4rem; }
        .admin-login-box p { color:var(--text-mid); font-size:.88rem; margin-bottom:1.75rem; }
        .atabs { display:flex; gap:.4rem; margin-bottom:1.75rem; background:var(--white); padding:.38rem; border-radius:.7rem; border:1px solid var(--border); width:fit-content; }
        .atab {
          padding:.5rem 1.4rem; border-radius:.5rem; border:none;
          font-family:'Assistant',sans-serif; font-size:.92rem; cursor:pointer;
          transition:all .2s; background:none; color:var(--text-mid);
        }
        .atab.on { background:var(--teal); color:#fff; font-weight:700; }
        .asec { background:var(--white); border:1px solid var(--border); border-radius:1rem; padding:1.6rem; margin-bottom:1.4rem; }
        .asec h3 { font-family:'Frank Ruhl Libre',serif; font-size:1.15rem; color:var(--teal-dark); margin-bottom:1.1rem; }
        .lrow {
          display:flex; align-items:center; gap:.7rem; flex-wrap:wrap;
          padding:.7rem .95rem; background:var(--cream); border:1px solid var(--border);
          border-radius:.5rem; margin-bottom:.45rem; font-size:.86rem;
        }
        .lrow .lid { font-weight:700; color:var(--teal); min-width:58px; font-size:.85rem; }
        .lrow .lname { flex:1; font-weight:600; }
        .lrow .linfo { color:var(--text-mid); font-size:.8rem; }
        .sbadge { font-size:.72rem; font-weight:700; padding:.18rem .6rem; border-radius:2rem; }
        .sbadge.act { background:rgba(74,158,126,.14); color:#2A7A50; }
        .sbadge.ret { background:rgba(155,142,196,.14); color:#6252A2; }
        .retbtn {
          padding:.3rem .8rem; border-radius:.4rem; font-size:.78rem; font-weight:700;
          border:1.5px solid var(--teal); color:var(--teal); background:none; cursor:pointer; transition:all .2s;
        }
        .retbtn:hover { background:var(--teal); color:#fff; }
        .addform { display:flex; flex-direction:column; gap:.8rem; }
        .addrow { display:grid; grid-template-columns:1fr 1fr; gap:.8rem; }
        @media(max-width:500px){ .addrow { grid-template-columns:1fr; } }
        .fsel {
          width:100%; padding:.66rem .95rem; border:1.5px solid var(--border); border-radius:.5rem;
          font-family:'Assistant',sans-serif; font-size:.93rem; color:var(--text);
          background:var(--white); outline:none; direction:rtl;
        }
        .fsel:focus { border-color:var(--teal); }
        .auchk { display:flex; gap:.9rem; flex-wrap:wrap; margin-top:.25rem; }
        .auchk label { display:flex; align-items:center; gap:.35rem; font-size:.88rem; cursor:pointer; }
        .auchk input[type=checkbox] { accent-color:var(--teal); width:15px; height:15px; }
        .addbtn {
          padding:.72rem 1.8rem; background:var(--teal); color:#fff; border:none;
          border-radius:.55rem; font-family:'Assistant',sans-serif; font-size:.93rem; font-weight:700;
          cursor:pointer; transition:all .2s; align-self:flex-start;
        }
        .addbtn:hover { background:var(--teal-dark); }
        .addflash { color:#2A7A50; font-weight:700; font-size:.88rem; padding:.4rem 0; }
        .iadmin { display:flex; flex-direction:column; gap:.4rem; margin-top:.9rem; }
        .irow {
          display:flex; align-items:center; gap:.7rem; padding:.6rem .95rem;
          background:var(--cream); border:1px solid var(--border); border-radius:.5rem; font-size:.86rem;
        }
        .irow .in { flex:1; font-weight:600; }
        .irow .ic { color:var(--text-mid); font-size:.78rem; }
        .delbtn {
          padding:.28rem .72rem; border-radius:.4rem; font-size:.78rem; font-weight:700;
          border:1.5px solid #C87055; color:#C87055; background:none; cursor:pointer; transition:all .2s;
        }
        .delbtn:hover { background:#C87055; color:#fff; }
        .empty { text-align:center; padding:2.5rem; color:var(--text-light); }
        .empty .ei { font-size:2.2rem; margin-bottom:.75rem; }
        @media(max-width:600px){ .about-strip{flex-direction:column;align-items:center;gap:2rem;} .cat-head{flex-direction:column;} }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand" onClick={() => setPage("home")}>
          <span style={{color:"var(--teal)"}}>♥</span> מתנות <span>קטנות</span>
        </div>
        <ul className="nav-links">
          <li><button className={`nav-btn${page==="home"?" on":""}`} onClick={() => setPage("home")}>ראשי</button></li>
          <li><button className="nav-btn" onClick={() => { setPage("home"); setTimeout(() => borrowRef.current?.scrollIntoView({behavior:"smooth"}),100); }}>השאלה</button></li>
          <li><button className={`nav-btn${page==="admin"?" on":""}`} onClick={() => setPage("admin")}>ניהול</button></li>
        </ul>
      </nav>

      {/* ══ HOME ══ */}
      {page === "home" && <>

        {/* HERO */}
        <section className="hero">
          <div className="deco" style={{top:"1.5rem",left:"2rem",transform:"rotate(-18deg)"}}>🌿</div>
          <div className="deco" style={{bottom:"2rem",right:"1.5rem",transform:"rotate(14deg)",fontSize:"3rem"}}>🍃</div>
          <div style={{marginBottom:"1.5rem"}}>
            <LogoAnimation />
          </div>
          <div className="hero-tag">💚 גמ״ח ביישוב מצפה יריחו</div>
          <h1>רגעים פשוטים<br/>ביחד</h1>
          <p>השאלת משחקי זוגיות, ספרים וערכות לדייטים — בחינם, מתוך אמון ואהבה לכל הזוגות שרוצים ליצור רגעים יחד.</p>
          <button className="btn-hero" onClick={() => document.getElementById("cat-sec")?.scrollIntoView({behavior:"smooth"})}>
            לקטלוג המשחקים ↓
          </button>
        </section>

        {/* ABOUT */}
        <div className="about-strip">
          {[
            {icon:"♻️",t:"חינם לגמרי",d:"ללא תשלום, ללא חשבון — רק רצון טוב"},
            {icon:"🗓️",t:"השאלה ביומן",d:"בוחרים תאריכים, עד שבוע אחד"},
            {icon:"🤝",t:"מבוסס אמון",d:"קהילה שדואגת לציוד ומחזירה בזמן"},
            {icon:"🌱",t:"מצפה יריחו",d:"גמ״ח שכונתי לכל הזוגות ביישוב"},
          ].map(a => (
            <div className="about-item" key={a.t}>
              <div className="ai-icon">{a.icon}</div>
              <strong>{a.t}</strong>
              <p>{a.d}</p>
            </div>
          ))}
        </div>

        {/* CATALOG */}
        <section className="catalog" id="cat-sec">
          <div className="cat-head">
            <h2>♥ המשחקים שלנו</h2>
            <div className="filters">
              {CATS.map(c => <button key={c} className={`fb${catFilter===c?" on":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
              <div className="fsep"/>
              {AUDIENCES.map(a => <button key={a} className={`fb${audFilter===a?" on":""}`} onClick={()=>setAudFilter(a)}>{a}</button>)}
            </div>
          </div>

          {filtered.length === 0
            ? <div className="empty"><div className="ei">🔍</div>לא נמצאו פריטים בסינון זה</div>
            : <div className="grid">
              {filtered.map(item => (
                <div key={item.id} className={`card${!item.available?" dim":""}`}>
                  <div className="cbadge">{CAT_ICONS[item.category]} {item.category}</div>
                  <div className="cname">{item.name}</div>
                  <div className="cdesc">{item.description}</div>
                  <div className="atags">{item.audience.map(a => <span key={a} className="atag">{a}</span>)}</div>
                  <div className={`sdot${item.available?" av":" tk"}`}>{item.available?"פנוי להשאלה":"מושאל כעת"}</div>
                  <button className="bbtn" disabled={!item.available} onClick={()=>handleBorrow(item)}>
                    {item.available ? "השאלה ←" : "לא זמין"}
                  </button>
                </div>
              ))}
            </div>
          }
        </section>

        {/* BORROW */}
        <div className="bsec" ref={borrowRef}>
          <div className="binner">
            {!selected && borrowStep !== "success"
              ? <div className="bprompt">
                  <div className="bp-icon">☕</div>
                  <p>בחרו פריט מהקטלוג למעלה כדי לעבור להשאלה</p>
                </div>
              : borrowStep === "success"
              ? <div className="sbox">
                  <div className="si">🎉</div>
                  <h3>ההשאלה אושרה!</h3>
                  <p>מספר בקשה: <span className="sid">{borrowId}</span></p>
                  <p style={{marginTop:".7rem"}}>ניצור איתכם קשר לתיאום האיסוף.<br/>שיהיו לכם רגעים יפים ביחד 💚</p>
                  <div style={{marginTop:"1.75rem"}}>
                    <button className="btn-hero" onClick={()=>{setSelected(null);setBorrowStep("form");}}>חזרה לקטלוג</button>
                  </div>
                </div>
              : <>
                  <h2>טופס השאלה</h2>
                  <div className="sub">ממלאים פרטים ובוחרים תאריכים — עד שבוע אחד</div>

                  <div className="bpreview">
                    <div className="bi">{CAT_ICONS[selected.category]}</div>
                    <div><strong>{selected.name}</strong><span>{selected.description}</span></div>
                  </div>

                  <div className="frow">
                    <div className="fg">
                      <label>שם פרטי</label>
                      <input value={borrowForm.name} onChange={e=>setBorrowForm({...borrowForm,name:e.target.value})} placeholder="שם פרטי"/>
                    </div>
                    <div className="fg">
                      <label>טלפון</label>
                      <input value={borrowForm.phone} onChange={e=>setBorrowForm({...borrowForm,phone:e.target.value})} placeholder="05X-XXXXXXX" type="tel"/>
                    </div>
                  </div>
                  <div className="frow">
                    <div className="fg">
                      <label>תאריך איסוף</label>
                      <input type="date" min={todayStr} max={maxStr} value={borrowForm.from} onChange={e=>setBorrowForm({...borrowForm,from:e.target.value})}/>
                    </div>
                    <div className="fg">
                      <label>תאריך החזרה</label>
                      <input type="date" min={borrowForm.from||todayStr} max={maxStr} value={borrowForm.to} onChange={e=>setBorrowForm({...borrowForm,to:e.target.value})}/>
                      <div className="dnote">מקסימום שבוע אחד</div>
                    </div>
                  </div>
                  <div className="fg">
                    <label>הערה (לא חובה)</label>
                    <textarea value={borrowForm.note} onChange={e=>setBorrowForm({...borrowForm,note:e.target.value})} placeholder="כל פרט שחשוב לדעת..."/>
                  </div>
                  <button className="sbtn"
                    disabled={!borrowForm.name||!borrowForm.phone||!borrowForm.from||!borrowForm.to}
                    onClick={submitBorrow}>
                    שליחת בקשה 💚
                  </button>
                  <div className="clnk"><button onClick={()=>setSelected(null)}>ביטול</button></div>
                </>
            }
          </div>
        </div>

        {/* FOOTER */}
        <footer className="footer">
          <strong>מתנות קטנות</strong>
          גמ״ח לרגעים פשוטים ביחד · מצפה יריחו · השאלה חינמית
          <div className="fbot">🌿 ♥ 🌿</div>
        </footer>
      </>}

      {/* ══ ADMIN ══ */}
      {page === "admin" && (
        <div className="admin-wrap">
          {!adminAuthed
            ? <div className="admin-login-box">
                <h2>🔒 כניסה לניהול</h2>
                <p>אזור מנהלים בלבד</p>
                <div className="fg">
                  <label>סיסמה</label>
                  <input type="password" value={adminPass}
                    onChange={e=>setAdminPass(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&tryAdminLogin()}
                    placeholder="הכנס סיסמה"/>
                </div>
                {adminErr && <p style={{color:"#B05030",fontSize:".83rem",marginBottom:".7rem"}}>{adminErr}</p>}
                <button className="btn-hero" style={{width:"100%"}} onClick={tryAdminLogin}>כניסה</button>
              </div>
            : <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.75rem",flexWrap:"wrap",gap:"1rem"}}>
                  <h1 style={{fontFamily:"'Frank Ruhl Libre',serif",fontSize:"1.5rem",color:"var(--teal-dark)"}}>לוח ניהול</h1>
                  <button style={{background:"none",border:"1px solid var(--border)",padding:".38rem .95rem",borderRadius:".45rem",cursor:"pointer",color:"var(--text-mid)",fontFamily:"'Assistant',sans-serif",fontSize:".88rem"}}
                    onClick={()=>{setAdminAuthed(false);setAdminPass("");}}>
                    התנתקות
                  </button>
                </div>

                <div className="atabs">
                  <button className={`atab${adminTab==="loans"?" on":""}`} onClick={()=>setAdminTab("loans")}>📋 השאלות</button>
                  <button className={`atab${adminTab==="items"?" on":""}`} onClick={()=>setAdminTab("items")}>🎲 פריטים</button>
                </div>

                {adminTab === "loans" && (
                  <div className="asec">
                    <h3>ניהול השאלות ({loans.length})</h3>
                    {loans.length === 0
                      ? <div className="empty"><div className="ei">📭</div>אין השאלות עדיין</div>
                      : loans.map(l => (
                        <div className="lrow" key={l.id}>
                          <span className="lid">{l.id}</span>
                          <span className="lname">{l.item}</span>
                          <span className="linfo">{l.name} · {l.phone}</span>
                          <span className="linfo">{l.from} – {l.to}</span>
                          <span className={`sbadge${l.status==="פעיל"?" act":" ret"}`}>{l.status}</span>
                          {l.status==="פעיל" && <button className="retbtn" onClick={()=>returnLoan(l.id)}>סמן כהוחזר</button>}
                        </div>
                      ))
                    }
                  </div>
                )}

                {adminTab === "items" && <>
                  <div className="asec">
                    <h3>➕ הוספת פריט</h3>
                    {addedMsg && <div className="addflash">{addedMsg}</div>}
                    <div className="addform">
                      <div className="addrow">
                        <div className="fg" style={{margin:0}}>
                          <label>שם הפריט</label>
                          <input value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})} placeholder="שם המשחק / ספר / ערכה"/>
                        </div>
                        <div className="fg" style={{margin:0}}>
                          <label>קטגוריה</label>
                          <select className="fsel" value={newItem.category} onChange={e=>setNewItem({...newItem,category:e.target.value})}>
                            <option>משחקים</option><option>ספרים</option><option>ערכות</option>
                          </select>
                        </div>
                      </div>
                      <div className="fg" style={{margin:0}}>
                        <label>תיאור</label>
                        <input value={newItem.description} onChange={e=>setNewItem({...newItem,description:e.target.value})} placeholder="תיאור קצר..."/>
                      </div>
                      <div className="fg" style={{margin:0}}>
                        <label>מתאים ל:</label>
                        <div className="auchk">
                          {["נשואים","מאורסים","יוצאים"].map(a=>(
                            <label key={a}>
                              <input type="checkbox" checked={newItem.audience.includes(a)}
                                onChange={e=>setNewItem({...newItem,audience:e.target.checked?[...newItem.audience,a]:newItem.audience.filter(x=>x!==a)})}/>
                              {a}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="fg" style={{margin:0,maxWidth:"140px"}}>
                        <label>עותקים</label>
                        <input type="number" min={1} value={newItem.copies} onChange={e=>setNewItem({...newItem,copies:+e.target.value})}/>
                      </div>
                      <button className="addbtn" onClick={addItem}>הוסף לקטלוג ←</button>
                    </div>
                  </div>

                  <div className="asec">
                    <h3>📦 כל הפריטים ({items.length})</h3>
                    <div className="iadmin">
                      {items.map(item => (
                        <div className="irow" key={item.id}>
                          <span>{CAT_ICONS[item.category]}</span>
                          <span className="in">{item.name}</span>
                          <span className="ic">{item.category}</span>
                          <span className={`sbadge${item.available?" act":" ret"}`}>{item.available?"פנוי":"מושאל"}</span>
                          <button className="delbtn" onClick={()=>removeItem(item.id)}>הסר</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>}
              </>
          }
        </div>
      )}
    </>
  );
}
