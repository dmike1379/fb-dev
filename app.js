/* ╔═══════════════════════════════════════════════════════════════════╗
   ║                  FAMILY BANK — app.js  v31.0                      ║
   ║  v31 adds: Phosphor icons (vendor/phosphor-sprite.svg), avatar    ║
   ║  system (emoji default + per-device photo), empty-state SVG       ║
   ║  illustrations, upgraded chore celebration.                       ║
   ║                                                                   ║
   ║  Sections:                                                        ║
   ║    1.  Configuration & defaults                                   ║
   ║    2.  Runtime state                                              ║
   ║    3.  Utilities                                                  ║
   ║    4.  Modal + toast + earned popup                               ║
   ║    5.  Cloud load & sync                                          ║
   ║    6.  Branding + balances + status                               ║
   ║    7.  Tabs + chore badges                                        ║
   ║    8.  Auth (login, logout, remember-me, child picker)            ║
   ║    9.  Child money actions                                        ║
   ║   10.  Parent adjust + allowance + rates                          ║
   ║   11.  Chores — schedule UI, per-day times, create/edit/approve   ║
   ║   12.  Chore checklist (child view)                               ║
   ║   13.  Savings goals                                              ║
   ║   14.  Loans                                                      ║
   ║   15.  History (ledger drawer)                                    ║
   ║   16.  Net Worth Chart (Chart.js)                                 ║
   ║   17.  Streaks                                                    ║
   ║   18.  Admin (PIN gate, user mgmt, settings save)                 ║
   ║   19.  Multi-select picker (children, tabs)                       ║
   ║   20.  PWA install + service worker auto-update                   ║
   ║   21.  Auto-logout timer                                          ║
   ║   22.  Init                                                       ║
   ╚═══════════════════════════════════════════════════════════════════╝ */

// ╔═══════════════════════════════════════════════════════════════════╗
// ║                    ★ CONFIGURATION ★                             ║
// ║   Edit this block to match your family. Most settings can also   ║
// ║   be changed in the in-app Admin panel after first run.          ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ── API URL — paste this from Apps Script Deploy → Manage Deployments ──
const API_URL = "https://script.google.com/macros/s/AKfycbyIqTRDvr826wFEZe2p77wevZM9MIMQwwr_O6l7OwpX3LjnxgKtMNAwcFXZXKqkNhWE/exec"; // ← v38 DEV URL (Strake Step 3 deployment). DEV ONLY — do not push to dfb.github.io (Linnea PROD).

// ── Bank identity ──
const CFG_BANK_NAME    = "Family Bank";
const CFG_BANK_TAGLINE = "Your money, your future.";

// ── Brand colors ──
const CFG_COLOR_PRIMARY   = "#2563eb";   // checking / buttons
const CFG_COLOR_SECONDARY = "#10b981";   // savings / deposits

// ── Timezone (display only) ──
const CFG_TIMEZONE = "GMT-5";

// ── Admin panel PIN (default — change in Admin panel after first run) ──
const CFG_ADMIN_PIN = "9999";

// ── Image paths (relative to repo root, or full https:// URLs) ──
const CFG_IMG_BANNER = "images/banner.png";
const CFG_IMG_LOGO   = "images/logo.png";
const CFG_IMG_ICON   = "images/icon.png";

// ── Version ──
const APP_VERSION = "38.3";   // v38.3 — fallback stamp only (version.json is authoritative)

// ╔═══════════════════════════════════════════════════════════════════╗
// ║         END OF CONFIGURATION — DO NOT EDIT BELOW THIS LINE       ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════════════════
// 0a. ICONS — central Phosphor map. Every UI icon in the app references
//     a semantic key here; to swap an icon, change one line.
//     Usage: icon('approve')  →  '<svg class="icon"><use href="..."/></svg>'
// ════════════════════════════════════════════════════════════════════
const ICONS = {
  // Actions
  approve:    "ph-check-circle",
  deny:       "ph-x-circle",
  check:      "ph-check",
  close:      "ph-x",
  add:        "ph-plus",
  edit:       "ph-pencil",
  trash:      "ph-trash",
  save:       "ph-floppy-disk",
  refresh:    "ph-arrows-clockwise",
  // Auth
  login:      "ph-sign-in",
  logout:     "ph-sign-out",
  lock:       "ph-lock",
  key:        "ph-key",
  // Money
  money:      "ph-money",
  dollar:     "ph-currency-dollar",
  checking:   "ph-money",
  savings:    "ph-piggy-bank",
  loan:       "ph-credit-card",
  deposit:    "ph-arrow-circle-down",
  withdraw:   "ph-arrow-circle-up",
  bank:       "ph-bank",
  // Content
  chores:     "ph-clipboard-text",
  history:    "ph-receipt",
  calendar:   "ph-calendar",
  chart:      "ph-chart-line-up",
  goal:       "ph-target",
  streak:     "ph-fire",
  milestone:  "ph-trophy",
  celebrate:  "ph-party-popper",
  sparkle:    "ph-sparkle",
  // Status
  pending:    "ph-hourglass",
  clock:      "ph-clock",
  warning:    "ph-warning",
  info:       "ph-info",
  email:      "ph-envelope",
  search:     "ph-magnifying-glass",
  hand:       "ph-hand",
  // People
  user:       "ph-user",
  users:      "ph-users",
  child:      "ph-baby",
  // System
  settings:   "ph-gear",
  image:      "ph-image",
  globe:      "ph-globe",
  timer:      "ph-timer",
  lightning:  "ph-lightning",
  // Arrows
  arrowRight: "ph-arrow-right",
  arrowLeft:  "ph-arrow-left",
  caretRight: "ph-caret-right",
  caretDown:  "ph-caret-down"
};

function icon(key, extraClass){
  const name = ICONS[key] || key; // allow direct ph-* keys too
  const cls  = "icon" + (extraClass ? " "+extraClass : "");
  return `<svg class="${cls}" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#${name}"/></svg>`;
}

// ════════════════════════════════════════════════════════════════════
// 0b. EMPTY-STATE ILLUSTRATIONS — inline SVG, duotone via CSS vars.
// ════════════════════════════════════════════════════════════════════
const ILLUSTRATIONS = {
  chores: () => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="120" cy="96" r="60" fill="var(--primary)" opacity=".08"/><circle cx="120" cy="96" r="44" fill="var(--primary)" opacity=".18"/><path d="M100 96 L116 112 L144 82" stroke="var(--primary)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><g fill="var(--secondary)" opacity=".8"><circle cx="52" cy="44" r="4"/><circle cx="192" cy="52" r="5"/><circle cx="44" cy="140" r="3"/><circle cx="200" cy="132" r="4"/></g><path d="M180 28 L184 36 L192 40 L184 44 L180 52 L176 44 L168 40 L176 36 Z" fill="var(--warning,#f59e0b)" opacity=".7"/><path d="M60 68 L62 72 L66 74 L62 76 L60 80 L58 76 L54 74 L58 72 Z" fill="var(--primary)" opacity=".5"/></svg>`,
  history: () => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="70" y="38" width="80" height="104" rx="6" fill="var(--primary)" opacity=".12"/><rect x="70" y="38" width="80" height="104" rx="6" stroke="var(--primary)" stroke-width="2.5" fill="none" opacity=".5"/><line x1="82" y1="62" x2="138" y2="62" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" opacity=".45"/><line x1="82" y1="80" x2="128" y2="80" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" opacity=".3"/><line x1="82" y1="98" x2="138" y2="98" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" opacity=".3"/><line x1="82" y1="116" x2="118" y2="116" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" opacity=".3"/><circle cx="156" cy="108" r="28" stroke="var(--secondary)" stroke-width="5" fill="white"/><line x1="176" y1="128" x2="196" y2="148" stroke="var(--secondary)" stroke-width="6" stroke-linecap="round"/></svg>`,
  goals:   () => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="110" cy="100" r="52" fill="var(--secondary)" opacity=".12"/><circle cx="110" cy="100" r="52" stroke="var(--secondary)" stroke-width="2.5" opacity=".4" fill="none"/><circle cx="110" cy="100" r="36" stroke="var(--secondary)" stroke-width="2.5" opacity=".55" fill="none"/><circle cx="110" cy="100" r="20" stroke="var(--secondary)" stroke-width="2.5" opacity=".7" fill="none"/><circle cx="110" cy="100" r="6" fill="var(--secondary)"/><path d="M140 70 L188 30" stroke="var(--primary)" stroke-width="5" stroke-linecap="round"/><path d="M175 30 L188 30 L188 43" stroke="var(--primary)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M140 70 L150 60 L150 80 Z" fill="var(--primary)"/></svg>`,
  loans:   () => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="120" cy="148" rx="72" ry="10" fill="var(--primary)" opacity=".08"/><ellipse cx="120" cy="138" rx="50" ry="10" fill="var(--primary)" opacity=".25"/><rect x="70" y="108" width="100" height="30" fill="var(--primary)" opacity=".45"/><ellipse cx="120" cy="108" rx="50" ry="10" fill="var(--primary)" opacity=".6"/><rect x="74" y="80" width="92" height="28" fill="var(--secondary)" opacity=".45"/><ellipse cx="120" cy="80" rx="46" ry="9" fill="var(--secondary)" opacity=".7"/><rect x="80" y="54" width="80" height="26" fill="var(--warning,#f59e0b)" opacity=".45"/><ellipse cx="120" cy="54" rx="40" ry="8" fill="var(--warning,#f59e0b)" opacity=".7"/><text x="120" y="60" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="DM Mono, monospace">$</text><text x="120" y="86" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="DM Mono, monospace">$</text><text x="120" y="114" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="DM Mono, monospace">$</text></svg>`,
  children:() => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="100" cy="70" r="24" fill="var(--primary)" opacity=".25"/><path d="M60 146 C60 122, 80 108, 100 108 C120 108, 140 122, 140 146 Z" fill="var(--primary)" opacity=".25"/><circle cx="170" cy="54" r="22" fill="var(--primary)" opacity=".15" stroke="var(--primary)" stroke-width="2.5" stroke-dasharray="4 4"/><circle cx="170" cy="108" r="20" fill="white" stroke="var(--secondary)" stroke-width="3"/><line x1="170" y1="100" x2="170" y2="116" stroke="var(--secondary)" stroke-width="3" stroke-linecap="round"/><line x1="162" y1="108" x2="178" y2="108" stroke="var(--secondary)" stroke-width="3" stroke-linecap="round"/></svg>`,
  chart:   () => `<svg class="illust" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="40" y1="150" x2="210" y2="150" stroke="var(--border,#e2e8f0)" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="30" x2="40" y2="150" stroke="var(--border,#e2e8f0)" stroke-width="2.5" stroke-linecap="round"/><rect x="60"  y="110" width="22" height="40" rx="3" fill="var(--primary)"   opacity=".5"/><rect x="96"  y="90"  width="22" height="60" rx="3" fill="var(--primary)"   opacity=".7"/><rect x="132" y="70"  width="22" height="80" rx="3" fill="var(--secondary)" opacity=".7"/><rect x="168" y="50"  width="22" height="100" rx="3" fill="var(--secondary)"/><path d="M71 100 L107 80 L143 60 L179 40" stroke="var(--warning,#f59e0b)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="179" cy="40" r="5" fill="var(--warning,#f59e0b)"/></svg>`
};

function emptyState(illustKey, msg, extraStyle){
  const svg = (ILLUSTRATIONS[illustKey] && ILLUSTRATIONS[illustKey]()) || "";
  const sty = extraStyle ? ` style="${extraStyle}"` : "";
  return `<div class="empty-state"${sty}>${svg}<div class="empty-msg">${msg}</div></div>`;
}

// ════════════════════════════════════════════════════════════════════
// 0c. AVATARS — emoji picker options + resolution helpers.
//     Per spec: device photo (localStorage) → synced emoji → fallback.
// ════════════════════════════════════════════════════════════════════
const AVATAR_EMOJIS = [
  "😀","😎","🤠","🥳","🤓","🦸","🧙","🧑‍🚀",
  "🐶","🐱","🐼","🦊","🐵","🦁","🐸","🐧",
  "🦄","🐙","🐢","🦖","🐝","🦋","🐳","🦈",
  "⭐","🌈","🌟","⚡","🔥","🎨","🎮","🎯"
];
const DEFAULT_AVATAR_PARENT = "😀";
const DEFAULT_AVATAR_CHILD  = "🐶";

function avatarPhotoKey(username){ return "fb_avatar_" + username; }

function getAvatarPhoto(username){
  if(!username) return null;
  try { return localStorage.getItem(avatarPhotoKey(username)) || null; } catch(e){ return null; }
}
function setAvatarPhoto(username, dataUrl){
  if(!username) return;
  try { localStorage.setItem(avatarPhotoKey(username), dataUrl); } catch(e){}
}
function clearAvatarPhoto(username){
  if(!username) return;
  try { localStorage.removeItem(avatarPhotoKey(username)); } catch(e){}
}

function getAvatarEmoji(username){
  if(!username) return DEFAULT_AVATAR_CHILD;
  const map = (state.config && state.config.avatars) || {};
  if(map[username]) return map[username];
  const role = state.roles && state.roles[username];
  return role === "parent" ? DEFAULT_AVATAR_PARENT : DEFAULT_AVATAR_CHILD;
}
function setAvatarEmoji(username, emoji){
  if(!state.config.avatars) state.config.avatars = {};
  state.config.avatars[username] = emoji;
}

/* Render an avatar chip. size: 'xs' | 'sm' | 'md' | 'lg'.
   Output is a <span class="avatar avatar-sm"> containing either an <img>
   or the emoji as text. */
function renderAvatar(username, size){
  size = size || "sm";
  const photo = getAvatarPhoto(username);
  if(photo){
    return `<span class="avatar avatar-${size} has-photo"><img src="${photo}" alt="" draggable="false"></span>`;
  }
  const emoji = getAvatarEmoji(username);
  return `<span class="avatar avatar-${size}"><span class="avatar-emoji">${emoji}</span></span>`;
}

/* Resize a File (from <input type="file">) to a 200x200 square PNG data URL.
   Center-crops. Returns a Promise. */
function resizeImageFileTo200(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width  - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 200, 200);
        try { resolve(canvas.toDataURL("image/jpeg", 0.85)); }
        catch(e){ reject(e); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════════════════════
// 1. DEFAULTS
// ════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  bankName:       CFG_BANK_NAME,
  tagline:        CFG_BANK_TAGLINE,
  colorPrimary:   CFG_COLOR_PRIMARY,
  colorSecondary: CFG_COLOR_SECONDARY,
  imgBanner:      CFG_IMG_BANNER,
  imgLogo:        CFG_IMG_LOGO,
  imgIcon:        CFG_IMG_ICON,
  timezone:       CFG_TIMEZONE,
  adminPin:       CFG_ADMIN_PIN,
  adminEmail:     "",            // v32.4: seeded in migration on first load
  emails:         {},
  avatars:        {},
  loginStats:     {},
  pendingUsers:   []             // v33.0: parent account signup requests awaiting admin decision
};

// v33.0 — Queue cap for signup requests
const SIGNUP_QUEUE_CAP = 20;

// ════════════════════════════════════════════════════════════════════
// 2. RUNTIME STATE
// ════════════════════════════════════════════════════════════════════
let state = {
  config:   {...DEFAULT_CONFIG},
  pins: {}, roles: {}, users: [],
  children: {},
  history:  {}
};
let currentUser         = null;   // logged-in username
let currentRole         = null;   // "child" | "parent"
let activeChild         = null;   // child being managed (parent view)
let pendingTransactions = [];
let editingLoanId       = null;  // v30.1
let modalCallback       = null;
let inactivityTimer     = null;
let inactivityWarnTimer = null;  // v34.2 — countdown warning before auto-logout
let inactivityCountdown = null;  // v34.2 — setInterval for countdown tick
let toastTimer          = null;
let choreFilter         = "today";
let nwFilterMonths      = 3;
let nwChartInstance     = null;   // Chart.js instance — destroyed/recreated on filter change
let pickerMode          = null;
let pickerSelected      = [];

// v33.0 — Wizard runtime state

// v33.0 — Proof photo buffer for pending chore submission (base64 data URL or null)
let pendingProofPhoto   = null;
let pendingProofChoreId = null;

// ════════════════════════════════════════════════════════════════════
// 3. UTILITIES
// ════════════════════════════════════════════════════════════════════
function fmt(v){
  // v38.2-6 — sign before the dollar sign: -$8.00, not $-8.00
  let n=parseFloat(v)||0;
  if(Math.abs(n)<0.005) n=0;   // float noise from repeated += (e.g. -2.7e-17) is $0.00, not -$0.00
  return (n<0?"-$":"$")+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
// v38.2-6 — ledger rows: server history dates arrive as Date.toString() text; show them short.
function fmtLedgerDate(raw){
  if(raw==null || raw==="") return "";   // new Date(null) is the 1970 epoch, not "blank"
  const d=new Date(raw);
  return isNaN(d) ? escapeHtml(String(raw==null?"":raw)) : fmtDate(d);
}
// v38.1 final (m-5) — escape user-typed text before it lands in innerHTML.
function escapeHtml(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function todayStr(){ return new Date().toISOString().split("T")[0]; }
function fmtDate(d){
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
       + " " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
}
function shadeColor(hex,pct){
  try{
    const n=parseInt((hex||"#2563eb").replace("#",""),16);
    const r=Math.max(0,Math.min(255,(n>>16)+Math.round(2.55*pct)));
    const g=Math.max(0,Math.min(255,((n>>8)&0xff)+Math.round(2.55*pct)));
    const b=Math.max(0,Math.min(255,(n&0xff)+Math.round(2.55*pct)));
    return "#"+[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("");
  }catch(e){ return "#1d4ed8"; }
}
function showFieldError(iId,mId,msg){
  const i=document.getElementById(iId), m=document.getElementById(mId);
  if(i) i.classList.add("input-error");
  if(m){ m.className="field-msg error"; m.textContent=msg; }
}
function clearFieldError(iId,mId){
  const i=document.getElementById(iId), m=document.getElementById(mId);
  if(i) i.classList.remove("input-error");
  if(m){ m.className="field-msg"; m.textContent=""; }
}
function getChildData(name){
  if(!state.children[name]){
    state.children[name]={balances:{checking:0,savings:0},rates:{checking:0,savings:0},autoDeposit:{checking:0,savings:0},chores:[]};
  }
  return state.children[name];
}
function getChildNames(){  return (state.users||[]).filter(u=>(state.roles||{})[u]==="child"); }
function getParentNames(){ return (state.users||[]).filter(u=>(state.roles||{})[u]==="parent"); }

function buildCalEventTitle(chore){
  return "🏦 "+chore.name+" — Earn $"+(parseFloat(chore.amount)||0).toFixed(2);
}

function choreRewardsEnabled(childName){
  const n=(state.config&&state.config.notify&&state.config.notify[childName||activeChild||currentUser])||{};
  return n.choreRewards!==false; // default ON
}

function getChildTabs(childName){
  const tabs = (state.config.tabs && state.config.tabs[childName]) || {};
  return {
    money:  tabs.money  !== false,  // default ON
    chores: tabs.chores !== false,  // default ON
    loans:  tabs.loans  === true    // default OFF
  };
}

// Migration — v1 flat structure → per-child
function migrateIfNeeded(){
  if(state.balances && !state.children["Linnea"]){
    const cn=getChildNames()[0]||"Linnea";
    state.children[cn]={
      balances:{...state.balances},
      rates:{...state.rates},
      autoDeposit:{...state.autoDeposit},
      chores:state.chores||[]
    };
    delete state.balances; delete state.rates; delete state.autoDeposit; delete state.chores;
  }
  // v32: migrate celebration sound from global config → per-user record.
  // Idempotent: only runs once, flagged on state.config.
  if(!state.config.celebrationMigrated_v32){
    if(!state.usersData) state.usersData = {};
    // state.users is an array of display names; mirror per-user settings
    // into state.usersData[name] objects so we have somewhere to live.
    (state.users||[]).forEach(u => {
      if(!state.usersData[u]) state.usersData[u] = {};
      if(state.usersData[u].celebrationSound === undefined){
        state.usersData[u].celebrationSound = true; // default ON for v32
      }
    });
    delete state.config.celebrationSound;
    state.config.celebrationMigrated_v32 = true;
  }
  // Build a convenience accessor — makes the playback site cleaner.
  if(!state.users_map) state.users_map = state.usersData || {};
}

// ════════════════════════════════════════════════════════════════════
// 4. MODAL + TOAST + EARNED POPUP
// ════════════════════════════════════════════════════════════════════
function openModal(opts){
  document.getElementById("modal-icon").textContent  = opts.icon  || "⚠️";
  document.getElementById("modal-title").textContent = opts.title || "Are you sure?";
  document.getElementById("modal-body").textContent  = opts.body  || "";
  const de=document.getElementById("modal-detail");
  if(opts.detail && Object.keys(opts.detail).length){
    de.innerHTML=Object.entries(opts.detail).map(([l,v])=>
      `<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${v}</span></div>`
    ).join("");
    de.classList.remove("hidden");
  } else { de.innerHTML=""; de.classList.add("hidden"); }
  const cb=document.getElementById("modal-confirm-btn");
  cb.textContent=opts.confirmText || "Confirm";
  cb.className="btn "+(opts.confirmClass || "btn-primary");
  document.getElementById("modal-btns").querySelector(".btn-ghost").style.display = opts.hideCancel ? "none" : "";
  modalCallback = opts.onConfirm || null;
  document.getElementById("modal-overlay").classList.add("open");
}
function openInputModal(opts){
  const de=document.getElementById("modal-detail");
  de.innerHTML=`<input type="${opts.inputType||"text"}" id="modal-dynamic-input" ${opts.inputAttrs||""} style="width:100%;margin-bottom:0;">`;
  de.classList.remove("hidden");
  document.getElementById("modal-icon").textContent=opts.icon||"✏️";
  document.getElementById("modal-title").textContent=opts.title||"";
  document.getElementById("modal-body").textContent=opts.body||"";
  const cb=document.getElementById("modal-confirm-btn");
  cb.textContent=opts.confirmText||"OK";
  cb.className="btn "+(opts.confirmClass||"btn-primary");
  document.getElementById("modal-btns").querySelector(".btn-ghost").style.display="";
  modalCallback = v => { if(opts.onConfirm) opts.onConfirm(v); };
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(()=>document.getElementById("modal-dynamic-input")?.focus(),200);
}
function closeModal(){ document.getElementById("modal-overlay").classList.remove("open"); modalCallback=null; }
function fireModalConfirm(){
  const v = document.getElementById("modal-dynamic-input")?.value ?? null;
  const cb = modalCallback;
  closeModal();
  if(typeof cb === "function") cb(v);
}
function handleOverlayClick(e){ if(e.target===document.getElementById("modal-overlay")) closeModal(); }

function showToast(msg,type="",dur=3200){
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.className="toast "+type+" show";
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),dur);
}

function showEarnedPopup(amount,choreName){
  const p=document.getElementById("earned-popup");
  document.getElementById("earned-popup-amount").textContent="+"+fmt(amount);
  document.getElementById("earned-popup-label").textContent='"'+choreName+'" submitted!';
  // Confetti burst — rebuilt every time
  let burst = p.querySelector(".confetti-burst");
  if(!burst){
    burst = document.createElement("div");
    burst.className = "confetti-burst";
    p.insertBefore(burst, p.firstChild);
  }
  burst.innerHTML = "";
  const colors = ["var(--primary)","var(--secondary)","#f59e0b","#ec4899","#8b5cf6","#06b6d4"];
  const pieces = 16;
  for(let i=0;i<pieces;i++){
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const angle = (360/pieces)*i + (Math.random()*20 - 10);
    const dist  = 70 + Math.random()*40;
    const rot   = Math.random()*540 - 270;
    piece.style.setProperty("--cx", Math.cos(angle*Math.PI/180)*dist + "px");
    piece.style.setProperty("--cy", Math.sin(angle*Math.PI/180)*dist + "px");
    piece.style.setProperty("--cr", rot + "deg");
    piece.style.background = colors[i % colors.length];
    burst.appendChild(piece);
  }
  p.classList.remove("show");
  // reflow so animation restarts cleanly
  void p.offsetWidth;
  p.classList.add("show");
  // v32: Per-user celebration sound. Default on. Reads from the *child whose
  // chore was completed* (activeChild in parent sessions, currentUser in child
  // sessions). Falls back to false only if the user record says so explicitly.
  const celebrateFor = activeChild || currentUser;
  const userRec = celebrateFor && state.usersData ? state.usersData[celebrateFor] : null;
  const celebOn = userRec ? (userRec.celebrationSound !== false) : true;
  if(celebOn){
    try { playCelebrationSound(); } catch(e){}
  }
  setTimeout(()=>p.classList.remove("show"),3000);
}

/* Quick ascending chime via WebAudio — no asset needed, respects user opt-in. */
function playCelebrationSound(){
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if(!Ctx) return;
  const ctx = new Ctx();
  const notes = [660, 880, 1100];   // E5, A5, C#6
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + i*0.10;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.30);
  });
  setTimeout(() => { try { ctx.close(); } catch(e){} }, 800);
}

// ════════════════════════════════════════════════════════════════════
// 5. CLOUD LOAD & SYNC
// ════════════════════════════════════════════════════════════════════
async function loadFromCloud(opts){
  opts = opts || {};
  // v38.3-1 (BUG-B) — a post-save reload carries the generation it was scheduled at;
  // if a newer local save exists by the time it runs or returns, it must not apply.
  if(opts.ifGen!==undefined && opts.ifGen!==_saveGen) return;
  setStatus("loading","Connecting to bank...");
  try{
    // v38 row-per-family — every GET must carry familyId. Read from localStorage.
    // If empty, the user has not yet been assigned to a family (signup/adminApprove
    // is Step 3) — server returns familyNotFound shape and the client can route
    // the user back to a setup screen.
    const familyId = (function(){ try { return localStorage.getItem("fb_familyId") || ""; } catch(_){ return ""; } })();
    const res=await fetch(API_URL+"?t="+Date.now()+"&familyId="+encodeURIComponent(familyId));
    const data=await res.json();
    if(opts.ifGen!==undefined){   // v38.3-1 (BUG-B) — post-save reload only
      if(opts.ifGen!==_saveGen){ setStatus("ready","Connected ✓"); return; }                       // newer save requested while this GET was in flight
      const _i = data && data._savedAt ? _postedStamps.indexOf(data._savedAt) : -1;                    // one of OUR older saves = CacheService lag — never apply
      if(_i !== -1 && _i !== _postedStamps.length-1){ setStatus("ready","Connected ✓"); return; }
    }
    // v38 Step 4 — familyNotFound = State A (no cache, first login) OR State C (stale cache).
    // State C silent recovery: a real cached familyId came back missing -> clear it.
    // Either way: present the non-cached (email) login. No toast, no error UX (D5 lock).
    if(data && data.status==="error" && data.reason==="familyNotFound"){
      if(familyId){ try{ localStorage.removeItem("fb_familyId"); }catch(_){} }
      renderLoginMode();
      setStatus("ready","Connected ✓");
      return;
    }
    if(data && (data.children || data.balances || data.pins)){
      state={
        ...state,
        ...data,
        config:{...DEFAULT_CONFIG, ...(data.config||{})},
        children:data.children||{},
        history:data.history||{}
      };
      if(!state.users || !state.users.length) state.users=Object.keys(state.pins||{});
      if(!state.roles || !Object.keys(state.roles).length){
        state.roles={};
        // v38.1 final (m-7) — no hardcoded name: parents are the parentChildren
        // map's keys when present; otherwise the first user (setup always created the parent first).
        const knownParents = Object.keys((state.config && state.config.parentChildren) || {});
        state.users.forEach((u,i)=>{ state.roles[u] = knownParents.length ? (knownParents.indexOf(u)!==-1 ? "parent" : "child") : (i===0 ? "parent" : "child"); });
      }
      if(!state.config.emails) state.config.emails={};
      if(!state.config.avatars) state.config.avatars={};
      if(!state.config.loginStats) state.config.loginStats={};
      // v33.0 — Ensure pendingUsers array exists on every load
      if(!Array.isArray(state.config.pendingUsers)) state.config.pendingUsers=[];
      // v33.1 — One-time migration: if the system has exactly one parent account
      // and that parent has no parentChildren assignment yet, seed them with every
      // existing child. Protects the original single-admin "Dad" setup from
      // suddenly seeing zero children after the empty-list fallback changed.
      try {
        if(!state.config.parentChildren) state.config.parentChildren = {};
        const parents = (state.users||[]).filter(u => (state.roles||{})[u] === "parent");
        if(parents.length === 1){
          const solo = parents[0];
          const kids = (state.users||[]).filter(u => (state.roles||{})[u] === "child");
          const existing = state.config.parentChildren[solo] || [];
          if(!existing.length && kids.length){
            state.config.parentChildren[solo] = kids.slice();
            // Persist the migration on next sync — don't sync here because
            // loadFromCloud runs before the user is logged in.
            state._needsSingleParentMigrationSave = true;
          }
        }
      } catch(e) { /* migration best-effort */ }
      // v38 Step 4 — removed hardcoded admin-email seed. Admin notification email
      // lives in the AdminConfig tab and is reached through admin routes (Step 5).
      migrateIfNeeded();
      pendingTransactions=[];
      applyBranding();
      renderLoginMode();        // v38 Step 4 — cached familyId present -> State B (name+PIN)
      restoreRememberedUser();
      setStatus("ready","Connected ✓");
    } else {
      setStatus("error","Unexpected data — check API URL");
    }
  } catch(err){
    setStatus("error","Could not connect");
    console.error("[FamilyBank]",err);
  }
}

// v34.0 — SYNC SERIALIZATION
// Two syncToCloud calls can race on Apps Script because POSTs don't serialize
// server-side. A fast cheap POST (e.g. "Login") can finish AFTER a big slow one
// (e.g. "Chore Submitted" with a proof photo) and overwrite the newer state.
// PARTIAL mitigation only — client-side:
//   Every syncToCloud awaits the previous one plus a small buffer before firing,
//   so SAME-CLIENT collisions never leave. The chain lives on the module-scope
//   variable below.
// NOT protected: cross-client races (two devices) and trigger-vs-user races.
// Payloads carry a _savedAt stamp, but Code.gs does NOT currently read or
// compare it — there is no server-side stale-write guard. (Audit C-1, 2026-07-02;
// server-side LockService + _savedAt compare scheduled for the cleanup phase.)
let _syncChain = Promise.resolve();
const SYNC_BUFFER_MS = 2000;
// v38.3-1 (BUG-B) — save generation. Taken at every syncToCloud() call and carried by that
// chain link; its post-save reload applies only when no newer save was requested meanwhile.
// Two taps a few seconds apart used to lose the second one.
let _saveGen = 0;
let _postedStamps = [];   // v38.3-1 — _savedAt stamps this client KNOWS landed (last 20); a reload never applies one of our own older ones

async function syncToCloud(action, opts){
  // Queue behind any in-flight sync. Each link awaits the previous one plus
  // a 2s server-processing buffer, then does its own fetch + optional reload.
  // v38.1 final — opts (chore wizard fan-out): {activeChild, extra, skipReload}.
  // Captured here so the payload built later in the chain still carries them.
  const myGen = ++_saveGen;   // v38.3-1 (BUG-B) — taken now, not when the link runs (audit #1)
  const prev = _syncChain;
  _syncChain = prev.then(async () => {
    await new Promise(r => setTimeout(r, SYNC_BUFFER_MS));
    return _doSyncToCloud(action, opts, myGen);
  }).catch(err => {
    // Don't let one failed sync poison the chain for subsequent calls
    console.error("[FamilyBank] sync chain link failed:", err);
  });
  return _syncChain;
}

async function _doSyncToCloud(action, opts, gen){
  opts = opts || {};
  if(gen===undefined) gen = _saveGen;   // direct callers (none today) behave as before
  renderBalances();
  // v38 row-per-family — every POST must carry familyId. Read from localStorage.
  // If empty, the POST is rejected server-side with familyNotFound shape.
  const familyId = (function(){ try { return localStorage.getItem("fb_familyId") || ""; } catch(_){ return ""; } })();
  const payload={
    ...state,
    familyId: familyId,
    tempTransactions:pendingTransactions,
    lastAction:action,
    activeChild: opts.activeChild || activeChild,   // v38.1 final — per-child fan-out override
    // _savedAt stamp. NOTE: Code.gs does NOT currently read or compare this —
    // there is no server-side stale-write guard (audit C-1, 2026-07-02). The
    // stamp is retained for the planned cleanup-phase fix (LockService on doPost
    // + real _savedAt compare). Until then this field is informational only.
    _savedAt: new Date().toISOString()
  };
  delete payload.history;
  // Strip transient calendar-helper keys — must NOT persist
  delete payload._deletedChoreId;
  delete payload._deletedChoreTitle;
  delete payload._approvedChoreId;
  delete payload._approvedChoreTitle;
  delete payload._approvedChoreSchedule;
  // v34.1 Item 12 — KEEP _editedChoreId on the outbound payload so Code.gs
  // syncCalendarEvent can target a single chore's calendar rebuild (the server
  // captures it BEFORE strip, so it never lands in saved state).
  // delete payload._editedChoreId;  ← removed intentionally
  // v38.1 final — transient keys handed in by the caller (e.g. _editedChoreId
  // from the chore wizard's edit commit). Merged at payload-build time, so they
  // ride the POST without ever touching state.
  if(opts.extra) Object.assign(payload, opts.extra);
  // v33.0 — Attach pending proof photo (if any) to chore submissions only
  const hasProofPhoto = (action === "Chore Submitted" && !!pendingProofPhoto);
  if(hasProofPhoto){
    payload.proofPhoto = pendingProofPhoto;
  }
  pendingTransactions=[];
  try{
    // v38 — opaque fetch mode removed (Apps Script doGet/doPost return JSON;
    // the client can now read response status and surface familyNotFound errors).
    let _resp = null, _parsed = null, _netErr = false;
    try{
      _resp = await fetch(API_URL,{method:"POST",body:JSON.stringify(payload)});
      // v38.1 S3 — read doPost's JSON reply so verified commits can gate on
      // {status:"ok"} (error shape: {status:"error", reason:...} Code.gs:503).
      try { _parsed = await _resp.json(); } catch(_){ _parsed = null; }
    }catch(_){ _netErr = true; }
    if(!(_parsed && _parsed.status==="ok")){
      if(_parsed && _parsed.status==="error"){
        // v38.1 final (M-1) — a save the server rejected is never silent.
        showToast("Save failed"+(_parsed.reason ? " ("+_parsed.reason+")" : "")+" — change may not have saved!","error",6000);
      } else {
        // v38.3-1 (BUG-A) — no usable reply: network error, the 404 HTML page Google's redirect
        // hop sometimes returns AFTER the script has saved, or doPost's {error} shape (thrown
        // after saveState). Ask the server instead of guessing: the saved state carries the
        // _savedAt stamp we just sent.
        const _serverErr = (_parsed && _parsed.error) ? String(_parsed.error) : "";
        const _landed = await _verifySaveLanded(payload._savedAt);
        if(_landed){
          _parsed = {status:"ok", verified:true};
          if(_serverErr) showToast("Saved, but the server reported: "+_serverErr,"error",6000);
        } else {
          const _why = _serverErr ? " ("+_serverErr+")" : (_netErr ? "" : (_resp && _resp.status && _resp.status!==200 ? " (HTTP "+_resp.status+")" : ""));
          showToast("Save failed"+_why+" — change may not have saved!","error",6000);
        }
      }
    }
    if(_parsed && _parsed.status==="ok"){   // v38.3-1 (BUG-B) — remember stamps known to be on the server (audit re-check #1)
      _postedStamps.push(payload._savedAt); if(_postedStamps.length>20) _postedStamps.shift();
    }
    // v33.0 — Clear photo buffer after a successful POST
    pendingProofPhoto = null;
    pendingProofChoreId = null;
    // v34.0 — Skip the reload roundtrip on proof-photo submissions. Apps Script
    // takes well over 1.8s to process a 200KB base64 payload, so the reload
    // was reading stale state and clobbering the just-submitted chore. State
    // we just sent is authoritative for the client; the monthly/chore triggers
    // will produce the server truth on schedule.
    if(!hasProofPhoto && !opts.skipReload){   // v38.1 final — fan-out legs skip the reload until the last one
      setTimeout(()=>loadFromCloud({ifGen:gen}), 1800);   // v38.3-1 (BUG-B) — applies only if this is still the newest save
    }
    return _parsed;   // v38.1 S3 — undefined when the save could not be confirmed
  } catch(err){
    showToast("Sync error — change may not have saved!","error",5000);
  }
}

// v38.3-1 (BUG-A) — did the last POST land? The server keeps the client's _savedAt stamp
// inside the family JSON, so a GET whose stamp is equal or newer proves the save. Three
// tries (2 s, 4 s, 8 s) because the same slow hop that lost the reply can lose the check;
// each GET is bounded to 15 s so a hung hop cannot pin the caller.
async function _verifySaveLanded(savedAt){
  if(!savedAt) return false;
  const familyId = (function(){ try { return localStorage.getItem("fb_familyId") || ""; } catch(_){ return ""; } })();
  const waits = [2000, 4000, 8000];
  for(let i=0;i<waits.length;i++){
    await new Promise(r=>setTimeout(r, waits[i]));
    let timer = null;
    try{
      const ctl = (typeof AbortController!=="undefined") ? new AbortController() : null;
      if(ctl) timer = setTimeout(()=>ctl.abort(), 15000);
      const res = await fetch(API_URL+"?t="+Date.now()+"&familyId="+encodeURIComponent(familyId)+"&verify=1", ctl ? {signal: ctl.signal} : undefined);
      const data = await res.json();
      if(data && data._savedAt && data._savedAt >= savedAt) return true;   // ours, or a later save that carried the same state
    }catch(_){ /* lost again — try once more */ }
    finally{ if(timer) clearTimeout(timer); }
  }
  return false;
}

function recordTransaction(user,note,amt){
  const child=activeChild||user;
  const entry={date:fmtDate(new Date()),user,note,amt,child};
  pendingTransactions.push(entry);
  if(!state.history[child]) state.history[child]=[];
  state.history[child].push(entry);
}

// ════════════════════════════════════════════════════════════════════
// 6. BRANDING + BALANCES + STATUS
// ════════════════════════════════════════════════════════════════════
function applyBranding(){
  const cfg=state.config;
  // v32.2: Null-guard these — the elements were removed from the login screen
  // in v32.1. Without guards, textContent on null threw and the error was
  // swallowed by loadFromCloud's catch, flipping status to "Could not connect"
  // even though all the data had already loaded correctly above the throw.
  const nameEl = document.getElementById("bank-name-display");
  if(nameEl) nameEl.textContent = cfg.bankName || CFG_BANK_NAME;
  const tagEl = document.getElementById("bank-tagline-display");
  if(tagEl) tagEl.textContent = cfg.tagline || CFG_BANK_TAGLINE;
  document.title = cfg.bankName || CFG_BANK_NAME;
  document.documentElement.style.setProperty("--primary",        cfg.colorPrimary   || CFG_COLOR_PRIMARY);
  document.documentElement.style.setProperty("--primary-dark",   shadeColor(cfg.colorPrimary   || CFG_COLOR_PRIMARY,   -20));
  document.documentElement.style.setProperty("--secondary",      cfg.colorSecondary || CFG_COLOR_SECONDARY);
  document.documentElement.style.setProperty("--secondary-dark", shadeColor(cfg.colorSecondary || CFG_COLOR_SECONDARY, -20));
  const bi=document.getElementById("banner-img"), li=document.getElementById("logo-img");
  if(cfg.imgBanner && bi){ bi.src=cfg.imgBanner; bi.style.display=""; }
  if(cfg.imgLogo   && li){ li.src=cfg.imgLogo;   li.style.display=""; }
}

function previewColor(which,val){
  if(which==="primary"){
    document.documentElement.style.setProperty("--primary",val);
    document.documentElement.style.setProperty("--primary-dark",shadeColor(val,-20));
  } else {
    document.documentElement.style.setProperty("--secondary",val);
    document.documentElement.style.setProperty("--secondary-dark",shadeColor(val,-20));
  }
}

function setStatus(type,text){
  document.getElementById("status-dot").className="status-dot "+type;
  document.getElementById("status-text").textContent=text;
  // Dismiss splash and reveal login form once connected (or errored)
  if(type==="ready" || type==="error"){
    const splash=document.getElementById("splash-screen");
    const form=document.getElementById("login-form-wrap");
    if(splash){ splash.style.opacity="0"; setTimeout(()=>splash.style.display="none",400); }
    if(form){ setTimeout(()=>{ form.style.opacity="1"; },200); }
    // Update splash bank name from loaded config
    const sbn=document.getElementById("splash-bank-name");
    const stag=document.getElementById("splash-tagline");
    const sst=document.getElementById("splash-status-text");
    if(sbn)  sbn.textContent  = state.config?.bankName || CFG_BANK_NAME;
    if(stag) stag.textContent = state.config?.tagline  || CFG_BANK_TAGLINE;
    if(sst)  sst.textContent  = type==="ready" ? "Connected ✓" : "Could not connect — check API URL";
  }
}

function renderBalances(){
  const child=activeChild||currentUser;
  const data=child ? getChildData(child) : {balances:{checking:0,savings:0},rates:{checking:0,savings:0}};
  document.getElementById("checking-val").textContent     = fmt(data.balances.checking);
  document.getElementById("savings-val").textContent      = fmt(data.balances.savings);
  document.getElementById("rate-chk-display").textContent = data.rates.checking || 0;
  document.getElementById("rate-sav-display").textContent = data.rates.savings  || 0;
  // v35.0 — Account owner chip removed from Checking card (now lives in parent top bar)
  const chkCard = document.querySelector(".balance-card.checking");
  if(chkCard){
    const owner = chkCard.querySelector(".account-owner");
    if(owner) owner.remove();
  }
  // Interest earned this month estimate
  const ec=(data.balances.checking*(data.rates.checking/100/12));
  const es=(data.balances.savings *(data.rates.savings /100/12));
  const echkEl=document.getElementById("earned-chk-display");
  const esavEl=document.getElementById("earned-sav-display");
  if(ec>0 && echkEl){ echkEl.textContent="+"+fmt(ec)+" /mo"; echkEl.classList.remove("hidden"); }
  else if(echkEl)   { echkEl.classList.add("hidden"); }
  if(es>0 && esavEl){ esavEl.textContent="+"+fmt(es)+" /mo"; esavEl.classList.remove("hidden"); }
  else if(esavEl)   { esavEl.classList.add("hidden"); }
}

// ════════════════════════════════════════════════════════════════════
// 7. TABS + CHORE BADGES
// ════════════════════════════════════════════════════════════════════
function switchTab(panel,tab){
  const bar=document.getElementById(panel+"-tab-bar");
  if(bar){
    bar.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    const idx=Array.from(bar.querySelectorAll(".tab-btn")).findIndex(b=>b.getAttribute("onclick")?.includes("'"+tab+"'"));
    if(idx>=0) bar.querySelectorAll(".tab-btn")[idx].classList.add("active");
  }
  // Hide all panels for this owner
  document.querySelectorAll("#"+panel+"-panel .tab-panel").forEach(p=>p.classList.remove("active"));
  const target=document.getElementById(panel+"-tab-"+tab);
  if(target) target.classList.add("active");
  // Render content for the activated tab
  if(panel==="parent" && tab==="chores")   renderParentChores();
  if(panel==="parent" && tab==="loans")    renderParentLoans();
  if(panel==="parent" && tab==="settings") renderParentSettings();
  if(panel==="child"  && tab==="chores")   renderChildChores();
  if(panel==="child"  && tab==="loans")    renderChildLoans();
}

function updateChoreBadges(){
  const child=activeChild||currentUser;
  if(!child) return;
  const chores=getChildData(child).chores||[];
  // Child badge — chores due today, not yet completed
  const childCount = chores.filter(c=>
    c.status==="available" && isDueToday(c) && c.lastCompleted!==todayStr()
  ).length;
  const cb=document.getElementById("child-chore-badge");
  if(cb){
    if(childCount>0){ cb.textContent=childCount; cb.classList.remove("hidden"); }
    else            { cb.classList.add("hidden"); }
  }
  // Parent badge — pending approvals
  const pendingCount = chores.filter(c=>c.status==="pending").length;
  const pb=document.getElementById("parent-chore-badge");
  if(pb){
    if(pendingCount>0){ pb.textContent=pendingCount; pb.classList.remove("hidden"); }
    else              { pb.classList.add("hidden"); }
    bindLongPressApprove();  // v31.2: long-press → quick approve
  }
}

function renderParentTabBar(){
  const bar=document.getElementById("parent-tab-bar");
  if(!bar||!activeChild) return;
  const tabs=getChildTabs(activeChild);
  const btns=[];
  // v34.1 Item 15 — Chores is now the default-active first parent tab.
  btns.push(`<button class="tab-btn active" onclick="switchTab('parent','chores')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Chores <span class="notif-badge hidden" id="parent-chore-badge">0</span></button>`);
  btns.push(`<button class="tab-btn" onclick="switchTab('parent','money')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-currency-dollar'/></svg> Money</button>`);
  if(tabs.loans) btns.push(`<button class="tab-btn" onclick="switchTab('parent','loans')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-bank'/></svg> Loans</button>`);
  btns.push(`<button class="tab-btn" onclick="switchTab('parent','settings')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-gear'/></svg> Settings</button>`);
  bar.className="tab-bar tabs-"+btns.length;
  bar.innerHTML=btns.join("");
  // Force the chores panel to be the visible one & render its content on initial mount
  document.querySelectorAll("#parent-panel .tab-panel").forEach(p=>p.classList.remove("active"));
  document.getElementById("parent-tab-chores")?.classList.add("active");
  renderParentChores();
}

function renderChildTabBar(){
  const tabs=getChildTabs(currentUser);
  const bar=document.getElementById("child-tab-bar");
  if(!bar) return;
  const btns=[];
  let firstTab=null;
  if(tabs.money) { btns.push({tab:"money", html:`<button class="tab-btn" onclick="switchTab('child','money')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-money'/></svg> Money</button>`}); if(!firstTab) firstTab="money"; }
  if(tabs.chores){ btns.push({tab:"chores",html:`<button class="tab-btn" onclick="switchTab('child','chores')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Chores <span class="notif-badge hidden" id="child-chore-badge">0</span></button>`}); if(!firstTab) firstTab="chores"; }
  if(tabs.loans) { btns.push({tab:"loans", html:`<button class="tab-btn" onclick="switchTab('child','loans')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-bank'/></svg> Loans</button>`}); if(!firstTab) firstTab="loans"; }
  bar.className="tab-bar tabs-"+btns.length;
  bar.innerHTML=btns.map(b=>b.html).join("");
  if(firstTab){
    bar.querySelectorAll(".tab-btn")[0]?.classList.add("active");
    document.getElementById("child-tab-"+firstTab)?.classList.add("active");
  }
}

// ════════════════════════════════════════════════════════════════════
// 8. AUTH (login, logout, remember-me, child picker)
// ════════════════════════════════════════════════════════════════════

// v38 Step 4 — cached familyId accessor (Safari-private-mode safe).
function _getCachedFamilyId(){
  try { return localStorage.getItem("fb_familyId") || ""; } catch(_){ return ""; }
}

// v38 Step 4 — two-mode login renderer.
//   State A (no cached familyId): email + PIN. Submit -> loginByEmail.
//   State B (cached familyId):    display-name + PIN. Submit -> doGet?familyId=X.
// Remember-me / auto-login are display-name features and are hidden in State A.
function renderLoginMode(){
  const cached     = _getCachedFamilyId();
  const nameField  = document.getElementById("login-name-field");
  const emailField = document.getElementById("login-email-field");
  const rememberRow= document.getElementById("login-remember-row");
  const autoWrap   = document.getElementById("auto-login-wrap");
  const btn        = document.getElementById("login-submit-btn");
  if(cached){
    if(nameField)   nameField.style.display   = "";
    if(emailField)  emailField.style.display  = "none";
    if(rememberRow) rememberRow.style.display = "";
    if(btn) btn.setAttribute("data-mode","name");
  } else {
    if(nameField)   nameField.style.display   = "none";
    if(emailField)  emailField.style.display  = "";
    if(rememberRow) rememberRow.style.display = "none";
    if(autoWrap)    autoWrap.style.display    = "none";
    if(btn) btn.setAttribute("data-mode","email");
    const nb=document.getElementById("not-you-btn"); if(nb) nb.classList.add("hidden");
  }
}

// v38 Step 4 — single Log In button dispatches by current mode.
function doLoginSubmit(){
  const btn=document.getElementById("login-submit-btn");
  if(btn && btn.getAttribute("data-mode")==="email"){ attemptLoginByEmail(); return; }
  // v38.1-d1-1 Fix-A (Bug-3) — name field always accepts email:
  // an "@" in the username routes to email login, which re-resolves the
  // family and re-caches fb_familyId. This is the family-switch path.
  const raw=(document.getElementById("username-input").value||"").trim();
  if(raw.indexOf("@")!==-1){ attemptLoginByEmail(raw); return; }
  attemptLogin();
}

// v38 Step 4 — State A submit: email + PIN -> loginByEmail -> cache familyId -> load -> enter.
// Strake returns an identical loginFailed shape for wrong-PIN and unknown-email,
// so we surface one generic error (Open Item #3 lock).
async function attemptLoginByEmail(emailOverride){
  // v38.1-d1-1 Fix-A (Bug-3) — callable from name mode with the typed
  // address. #login-email-input is hidden in name mode, so errors route
  // to the visible pair (pin-error), matching attemptLogin's convention.
  const fromNameMode = (typeof emailOverride==="string" && emailOverride.length>0);
  const errIn = fromNameMode ? "pin-input" : "login-email-input";
  const errEl = fromNameMode ? "pin-error" : "email-error";
  clearFieldError(errIn, errEl);
  const email = fromNameMode ? emailOverride
              : (document.getElementById("login-email-input").value||"").trim();
  const pin=document.getElementById("pin-input").value;
  if(!email || !pin){
    showFieldError(errIn, errEl, "Enter your email and PIN.");
    return;
  }
  setStatus("loading","Signing in...");
  try{
    const url=API_URL+"?action=loginByEmail&email="+encodeURIComponent(email)+"&pin="+encodeURIComponent(pin);
    const res=await fetch(url);
    const data=await res.json();
    if(data && data.status==="ok" && data.familyId){
      // v38.1-d1-1 (Bug-3, locked rule) — remembered identity never crosses
      // families: landing a DIFFERENT familyId wipes remembered name + PIN.
      const prevFam = _getCachedFamilyId();
      if(prevFam && prevFam !== data.familyId){
        try{
          localStorage.removeItem("fb_remembered_user");
          localStorage.removeItem("fb_remembered_pin");
        }catch(_){}
      }
      try{ localStorage.setItem("fb_familyId", data.familyId); }catch(_){}
      await loadFromCloud();           // reads the freshly-cached familyId, hydrates state
      const dn=data.displayName;
      const valid=state.users && state.users.find(u=>u.toLowerCase()===String(dn||"").toLowerCase());
      if(valid){
        // v38.1-d1-3 (Bug-4, R-2) — honor remember-me on the email path.
        // Mirrors attemptLogin's save block; runs AFTER the family-switch
        // wipe above, so remembered identity always belongs to the landed
        // family. Saves the RESOLVED displayName, never the typed email.
        const rememberUser=document.getElementById("remember-me").checked;
        const autoLogin=document.getElementById("auto-login-cb")?.checked;
        try{
          if(rememberUser){
            localStorage.setItem("fb_remembered_user",valid);
            if(autoLogin) localStorage.setItem("fb_remembered_pin",pin);
            else          localStorage.removeItem("fb_remembered_pin");
          } else {
            localStorage.removeItem("fb_remembered_user");
            localStorage.removeItem("fb_remembered_pin");
          }
        } catch(e){}
        enterApp(valid);
      }
      else { setStatus("ready","Connected ✓"); }  // loaded but no user match — stay on login
    } else {
      setStatus("ready","Connected ✓");
      showFieldError(errIn, errEl, "Email or PIN not recognized.");
      document.getElementById("pin-input").value="";
    }
  }catch(e){
    setStatus("error","Could not connect");
    showFieldError(errIn, errEl, "Network error — try again.");
  }
}
function attemptLogin(){
  clearFieldError("pin-input","pin-error");
  const userRaw=document.getElementById("username-input").value.trim();
  const pin=document.getElementById("pin-input").value;
  const user=state.users.find(u=>u.toLowerCase()===userRaw.toLowerCase());
  if(!user){ showFieldError("pin-input","pin-error","Name not recognized — check spelling."); return; }
  if(state.pins[user]!==pin){
    showFieldError("pin-input","pin-error","Incorrect PIN. Try again.");
    document.getElementById("pin-input").value="";
    return;
  }

  // Persist remember-me / auto-login choices
  const rememberUser=document.getElementById("remember-me").checked;
  const autoLogin=document.getElementById("auto-login-cb")?.checked;
  try{
    if(rememberUser){
      localStorage.setItem("fb_remembered_user",user);
      if(autoLogin) localStorage.setItem("fb_remembered_pin",pin);
      else          localStorage.removeItem("fb_remembered_pin");
    } else {
      localStorage.removeItem("fb_remembered_user");
      localStorage.removeItem("fb_remembered_pin");
    }
  } catch(e){}

  enterApp(user);
}

// Shared landing logic used by both attemptLogin and auto-login restore
function enterApp(user){
  currentUser=user;
  // v33.1 — If the one-parent migration ran during loadFromCloud and this login
  // is that parent, persist the seeded parentChildren list now.
  try {
    if(state._needsSingleParentMigrationSave){
      delete state._needsSingleParentMigrationSave;
      if((state.roles||{})[user] === "parent"){
        syncToCloud("Single-parent migration");
      }
    }
  } catch(e){}
  // v32: login counter 5-min guard — only increment if >5 min since last login.
  // stats.lastAt updates ONLY when counter increments (reloads inside window
  // leave both untouched).
  if(!state.config.loginStats) state.config.loginStats = {};
  const stats = state.config.loginStats[user] || {count:0, lastAt:null};
  const nowMs = Date.now();
  const lastMs = stats.lastAt ? new Date(stats.lastAt).getTime() : 0;
  const FIVE_MIN = 5*60*1000;
  if(!lastMs || (nowMs - lastMs) > FIVE_MIN){
    stats.count  = (parseInt(stats.count)||0) + 1;
    stats.lastAt = new Date().toISOString();
    state.config.loginStats[user] = stats;
    // v34.0 — REMOVED: setTimeout(()=>{ syncToCloud("Login"); }, 500)
    // The speculative Login sync was racing with chore submissions and silently
    // overwriting them. Counter still updates in memory and will persist on the
    // next meaningful sync (chore, deposit, settings change, etc.). If the user
    // logs in and does nothing, we lose one login-count update — acceptable.
  }
  currentRole=state.roles[user]||"child";
  // v34.2 — persist session so page refresh doesn't log out
  try { sessionStorage.setItem("fb_session_user", user); } catch(e){}
  // v34.2 — show share notification if another parent shared a child with this user
  try {
    const notifs = state.config.shareNotifications && state.config.shareNotifications[user];
    if(notifs && notifs.length){
      const unseen = notifs.filter(n => !n.seen);
      if(unseen.length){
        unseen.forEach(n => { n.seen = true; });
        const names = [...new Set(unseen.map(n => n.child))].join(", ");
        const froms = [...new Set(unseen.map(n => n.from))].join(", ");
        setTimeout(()=>{ showToast(froms+" shared "+names+" with you! 🎉","success",5000); }, 800);
        syncToCloud("Share Notification Cleared");
      }
    }
  } catch(e){}
  document.getElementById("login-screen").classList.add("hidden");
  updateLogoutButtonLabel();
  if(currentRole==="parent"){
    // v32: parent uses single-line top bar, not child top-bar
    document.getElementById("child-top-bar")?.classList.add("hidden");
    document.getElementById("parent-top-bar")?.classList.remove("hidden");
    const children=getAssignedChildren();
    updateChildSwitcherVisibility();  // v34.0 — hide Switch button if ≤1 child
    if(children.length===1){
      document.getElementById("main-screen").classList.remove("hidden");
      selectChild(children[0]);
    } else if(children.length>1){
      document.getElementById("child-picker-screen").classList.remove("hidden");
      showChildPicker();
    } else {
      document.getElementById("main-screen").classList.remove("hidden");
      // No assigned children — keep parent top bar visible but label generic
      const ptb=document.getElementById("ptb-child-name"); if(ptb) ptb.textContent="—";
      document.getElementById("parent-panel").classList.remove("hidden");
      // v33.0 item #11: auto-open guided setup wizard on empty-children parent landing.
      // Replaces v32.4 item #10 behavior (which opened raw sheet-add-child).
      // Non-coercive — close button still works. Deferred via setTimeout so the panel paints first.
      setTimeout(()=>{
        if(currentRole==="parent" && typeof getMyChildrenList === "function"
           && getMyChildrenList().length === 0
           && typeof uwOpenAdd === "function"){
          uwOpenAdd();   // v38.1 — wizard v2
        }
      }, 60);
    }
  } else {
    // v32: child uses the original top-bar; parent top-bar stays hidden
    document.getElementById("parent-top-bar")?.classList.add("hidden");
    document.getElementById("child-top-bar")?.classList.remove("hidden");
    activeChild=user;
    document.getElementById("main-screen").classList.remove("hidden");
    document.getElementById("welcome-msg").innerHTML=renderAvatar(user,"sm")+' <span>Hi, '+user+'! 👋</span>';
    document.getElementById("child-panel").classList.remove("hidden");
    renderChildTabBar();
    renderBalances(); renderChildChores(); renderSavingsGoals(); renderPendingDeposits(); renderChildLoans(); showChoreWaitingBanner(); updateChoreBadges(); renderChildAvatar();
    initInactivityTimer();
  }
}

function logout(){
  try { sessionStorage.removeItem("fb_session_user"); sessionStorage.removeItem("fb_session_child"); } catch(e){}
  currentUser=null; currentRole=null; activeChild=null;
  pendingTransactions=[];
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("child-picker-screen").classList.add("hidden");
  document.getElementById("parent-panel").classList.add("hidden");
  document.getElementById("child-panel").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("pin-input").value="";
  clearTimeout(inactivityTimer);
  _cancelLogoutCountdown();          // v38 Bug-7b: kill any in-flight warning countdown on logout
  prefillRememberedUser();           // v38.1-d1-4 (Bug-5): logout renders the same login screen a refresh does
}

function updateLogoutButtonLabel(){
  const btn=document.getElementById("logout-btn-main");
  if(btn) btn.textContent=currentRole==="parent" ? "Log Out" : "Log Out";
}

function changePinPrompt(who){
  const target = who==="parent" ? currentUser : (activeChild||currentUser);
  openInputModal({
    icon:"🔑", title:"Change PIN for "+target,
    body:"Enter a new 4-digit PIN.",
    inputType:"password", inputAttrs:'maxlength="4" inputmode="numeric" placeholder="••••"',
    confirmText:"Save",
    onConfirm:v=>{
      if(!v||v.length!==4||!/^\d{4}$/.test(v)){ showToast("PIN must be exactly 4 digits.","error"); return; }
      state.pins[target]=v;
      syncToCloud("PIN Changed");
      showToast("PIN updated.","success");
    }
  });
}

function confirmResetChildPin(){
  if(!activeChild) return;
  openModal({
    icon:"🔄", title:"Reset "+activeChild+"'s PIN?",
    body:"PIN will be set to 0000.",
    confirmText:"Reset", confirmClass:"btn-danger",
    onConfirm:()=>{
      state.pins[activeChild]="0000";
      syncToCloud("Child PIN Reset");
      showToast(activeChild+"'s PIN reset to 0000.","success");
    }
  });
}

function onRememberMeChange(){
  const checked=document.getElementById("remember-me").checked;
  const autoWrap=document.getElementById("auto-login-wrap");
  const autoCb=document.getElementById("auto-login-cb");
  if(autoWrap) autoWrap.style.display = checked ? "block" : "none";
  if(!checked){
    if(autoCb) autoCb.checked=false;
    try{
      localStorage.removeItem("fb_remembered_user");
      localStorage.removeItem("fb_remembered_pin");
    }catch(e){}
    document.getElementById("not-you-btn")?.classList.add("hidden");
  }
}
function onAutoLoginChange(){
  const autoCb=document.getElementById("auto-login-cb");
  if(!autoCb||!autoCb.checked){ try{ localStorage.removeItem("fb_remembered_pin"); }catch(e){} }
}
function clearRememberedUser(){
  try{
    localStorage.removeItem("fb_remembered_user");
    localStorage.removeItem("fb_remembered_pin");
    localStorage.removeItem("fb_familyId");   // v38.1-d1-1 Fix-B (Bug-3)
  }catch(e){}
  const ni=document.getElementById("username-input");
  const rc=document.getElementById("remember-me");
  const ac=document.getElementById("auto-login-cb");
  const nb=document.getElementById("not-you-btn");
  const aw=document.getElementById("auto-login-wrap");
  if(ni){ ni.value=""; }
  if(rc) rc.checked=false;
  if(ac) ac.checked=false;
  if(nb) nb.classList.add("hidden");
  if(aw) aw.style.display="none";
  // v38.1-d1-1 Fix-B — with no cached family, re-render to email mode so
  // the device can switch families ("Not you?" escape now actually escapes).
  renderLoginMode();
  const ei=document.getElementById("login-email-input");
  if(ei){ ei.value=""; ei.focus(); }
}
// v38.1-d1-4 (Bug-5) — PREFILL-ONLY restore, called from logout().
// Mirrors what a page refresh renders (renderLoginMode + the prefill half of
// restoreRememberedUser: remembered name, remember-me checked, "Not you?"
// visible) but can NEVER enter the app: no session restore, no auto-login,
// regardless of any stored flag. Never call enterApp() from here.
function prefillRememberedUser(){
  try{
    renderLoginMode();
    const ni=document.getElementById("username-input");
    const rc=document.getElementById("remember-me");
    const ac=document.getElementById("auto-login-cb");
    const aw=document.getElementById("auto-login-wrap");
    const nb=document.getElementById("not-you-btn");
    const saved=localStorage.getItem("fb_remembered_user");
    const valid=saved ? (state.users||[]).find(u=>u.toLowerCase()===saved.toLowerCase()) : null;
    if(!valid){
      if(saved){ localStorage.removeItem("fb_remembered_user"); localStorage.removeItem("fb_remembered_pin"); }
      if(ni) ni.value="";
      if(rc) rc.checked=false;
      if(ac) ac.checked=false;
      if(aw) aw.style.display="none";
      if(nb) nb.classList.add("hidden");
      return;
    }
    if(ni) ni.value=valid;
    if(rc) rc.checked=true;
    if(aw) aw.style.display="block";
    if(nb) nb.classList.remove("hidden");
    const savedPin=localStorage.getItem("fb_remembered_pin");
    if(ac) ac.checked=!!(savedPin && state.pins && state.pins[valid]===savedPin);
    setTimeout(()=>document.getElementById("pin-input")?.focus(),400);
  }catch(e){}
}
function restoreRememberedUser(){
  // v36.1 — Guard: if a user is already logged in (currentUser set), skip the
  // entire enter flow. Without this, periodic loadFromCloud polls re-run
  // restore -> enterApp -> selectChild -> closeAllSheets, nuking any open
  // sheet (notably the wizard). This was the wizard "random crash" cause.
  if(currentUser) return;
  // v34.2 — Restore active session on page refresh (sessionStorage survives refresh, not tab close)
  try{
    const sessUser = sessionStorage.getItem("fb_session_user");
    if(sessUser){
      const valid = state.users.find(u=>u.toLowerCase()===sessUser.toLowerCase());
      if(valid && state.pins[valid] !== undefined){
        // Re-enter without re-validating PIN (session already authenticated)
        enterApp(valid);
        // If a child was active, re-select them after enterApp renders
        const sessChild = sessionStorage.getItem("fb_session_child");
        if(sessChild && (state.roles[valid]==="parent")){
          const ch = (state.children && state.children[sessChild]) ? sessChild : null;
          if(ch) setTimeout(()=>{ try{ selectChild(ch); }catch(e){} }, 100);
        }
        return;
      } else {
        sessionStorage.removeItem("fb_session_user");
        sessionStorage.removeItem("fb_session_child");
      }
    }
  } catch(e){}
  try{
    const saved=localStorage.getItem("fb_remembered_user");
    if(!saved) return;
    const valid=state.users.find(u=>u.toLowerCase()===saved.toLowerCase());
    if(!valid){
      localStorage.removeItem("fb_remembered_user");
      localStorage.removeItem("fb_remembered_pin");
      return;
    }
    const ni=document.getElementById("username-input");
    const rc=document.getElementById("remember-me");
    const aw=document.getElementById("auto-login-wrap");
    const nb=document.getElementById("not-you-btn");
    if(ni) ni.value=valid;
    if(rc) rc.checked=true;
    if(aw) aw.style.display="block";
    if(nb) nb.classList.remove("hidden");
    // Try auto-login
    const savedPin=localStorage.getItem("fb_remembered_pin");
    if(savedPin && state.pins[valid]===savedPin){
      const ac=document.getElementById("auto-login-cb");
      if(ac) ac.checked=true;
      enterApp(valid);
      return;
    }
    setTimeout(()=>document.getElementById("pin-input")?.focus(),400);
  }catch(e){}
}

function showChildPicker(){
  if(currentRole!=="parent") return;  // safety: children must never reach the picker
  const children=getAssignedChildren();
  document.getElementById("picker-welcome").innerHTML=renderAvatar(currentUser,"sm")+' <span>Hi '+escapeHtml(currentUser)+'! 👋</span>';
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("child-picker-screen").classList.remove("hidden");
  const list=document.getElementById("child-picker-list");
  if(!children.length){
    list.innerHTML=emptyState("children","No children assigned. Add one in Admin.");
    return;
  }
  list.innerHTML=children.map(name=>{
    const d=getChildData(name);
    const total=(d.balances?.checking||0)+(d.balances?.savings||0);
    return `<div class="child-btn-wrap">
      <button class="child-btn with-avatar" onclick="selectChild('${name}')">
        ${renderAvatar(name,"md")}
        ${escapeHtml(name)}
        <div class="child-btn-balance">Total: ${fmt(total)}</div>
        <span class="child-btn-arrow">›</span>
      </button>
      <button class="btn btn-sm btn-outline child-btn-wizard" onclick="uwOpenEdit('${name}')" title="Edit ${name} with Setup Wizard">🪄 Setup</button>
    </div>`;
  }).join("");
}

function selectChild(childName){
  activeChild=childName;
  try { sessionStorage.setItem("fb_session_child", childName); } catch(e){}
  document.getElementById("child-picker-screen").classList.add("hidden");
  document.getElementById("main-screen").classList.remove("hidden");
  // v32: Parent uses single-line top bar; child-top-bar stays hidden for parent
  document.getElementById("child-top-bar")?.classList.add("hidden");
  document.getElementById("parent-top-bar")?.classList.remove("hidden");
  const ptb=document.getElementById("ptb-child-name");
  if(ptb) ptb.textContent=childName;
  // v35.0 — render child avatar in parent top bar Managing row
  const ptbAvatar=document.getElementById("ptb-child-avatar");
  if(ptbAvatar) ptbAvatar.innerHTML = renderAvatar(childName,"sm");
  document.getElementById("parent-panel").classList.remove("hidden");
  document.getElementById("child-panel").classList.add("hidden");
  renderParentTabBar();
  renderBalances(); renderParentChores(); renderParentLoans(); renderParentGoals(); renderPendingDeposits(); renderParentDepositApprovals(); renderParentWithdrawalApprovals(); renderPendingWithdrawals(); renderParentSettings(); renderWeekAtGlance();
  const gcn = document.getElementById("goals-child-name-money");
  if(gcn) gcn.textContent=childName;
  document.getElementById("loans-child-name").textContent=childName;
  updateChoreBadges();
  updateChildSwitcherVisibility();  // v34.0 — hide Switch button if ≤1 child
  initInactivityTimer();
}

function getAssignedChildren(){
  const all=getChildNames();
  if(!currentUser || currentRole!=="parent") return all;
  const assigned=(state.config.parentChildren && state.config.parentChildren[currentUser]) || [];
  // v33.1 — empty assigned list = sees NO children (was: sees all).
  // Admin can hand-assign via User Edit → Assigned Children. The one-parent
  // migration in loadFromCloud seeds Dad's list so existing setups don't break.
  return all.filter(c=>assigned.indexOf(c)!==-1);
}

// v34.0 — Hide the "Switch ▼" button when this parent has 0 or 1 assigned
// children. It's dead UI noise when there's nothing to switch between.
function updateChildSwitcherVisibility(){
  const btn = document.getElementById("ptb-switch-btn");
  if(!btn) return;
  if(currentRole !== "parent"){
    btn.classList.add("hidden");
    return;
  }
  const count = getAssignedChildren().length;
  btn.classList.toggle("hidden", count <= 1);
}

// ════════════════════════════════════════════════════════════════════
// 9. CHILD MONEY ACTIONS
// ════════════════════════════════════════════════════════════════════

// v34.2 — Open Manage Money sheet with options filtered to what's available
function openManageMoneySheet(){
  const child = activeChild || currentUser;
  const data = getChildData ? getChildData(child) : {};
  const hasSavings = !!(data.balances && (data.balances.savings !== undefined));
  const hasLoans   = !!(data.loans && data.loans.length);
  const hasBothAccounts = !!(data.balances && data.balances.checking !== undefined && data.balances.savings !== undefined);

  const sel = document.getElementById("child-action");
  if(sel){
    Array.from(sel.options).forEach(opt => {
      if(opt.value === "loanpayment") opt.style.display = hasLoans ? "" : "none";
      if(opt.value === "transfer")    opt.style.display = hasBothAccounts ? "" : "none";
    });
    // If current selection is now hidden, reset to first visible
    const cur = sel.options[sel.selectedIndex];
    if(cur && cur.style.display === "none"){
      for(let i=0; i<sel.options.length; i++){
        if(sel.options[i].style.display !== "none"){ sel.selectedIndex = i; break; }
      }
    }
    onChildActionChange();
  }
  openSheet("sheet-manage-money");
}
function onChildActionChange(){
  const action=document.getElementById("child-action").value;
  const hint=document.getElementById("child-action-hint");
  const btn=document.getElementById("child-action-btn");
  const splitWrap=document.getElementById("child-deposit-split-wrap");
  const loanWrap=document.getElementById("child-loan-select-wrap");
  const noteLabel=document.getElementById("child-note-label");

  splitWrap.classList.add("hidden");
  loanWrap.classList.add("hidden");

  if(action==="withdraw"){
    hint.textContent="Take cash out of your checking account.";
    btn.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-arrow-circle-up'/></svg> Withdraw Cash"; btn.className="btn btn-primary";
    noteLabel.textContent="What is this for?";
  } else if(action==="transfer"){
    hint.textContent="Move money from checking to savings.";
    btn.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-piggy-bank'/></svg> Transfer to Savings"; btn.className="btn btn-secondary";
    noteLabel.textContent="What is this for?";
  } else if(action==="deposit"){
    hint.textContent="Submit money for parent approval. Once approved it will be added to your account.";
    btn.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-arrow-circle-down'/></svg> Submit Deposit"; btn.className="btn btn-secondary";
    splitWrap.classList.remove("hidden");
    noteLabel.textContent="Where did this money come from?";
  } else if(action==="loanpayment"){
    hint.textContent="Pay extra toward a loan's principal balance.";
    btn.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-credit-card'/></svg> Pay Loan"; btn.className="btn btn-warning";
    loanWrap.classList.remove("hidden");
    noteLabel.textContent="Note (optional)";
    populateChildLoanSelect();
  }
}

function updateDepositSplitLabel(){
  const p=parseInt(document.getElementById("deposit-split").value);
  document.getElementById("dep-split-chk-label").textContent=p;
  document.getElementById("dep-split-sav-label").textContent=100-p;
}

function validateChildForm(){
  const action=document.getElementById("child-action").value;
  const amt=readMoney("child-amt");
  const note=document.getElementById("child-note").value.trim();
  clearFieldError("child-amt","child-amt-msg");
  clearFieldError("child-note","child-note-msg");
  if(!amt||amt<=0){ showFieldError("child-amt","child-amt-msg","Enter a valid amount."); return null; }
  if(action!=="loanpayment" && !note){ showFieldError("child-note","child-note-msg","Please add a note."); return null; }
  return {action,amt,note};
}

function doChildAction(){
  const v=validateChildForm();
  if(!v) return;
  if(v.action==="withdraw")    confirmWithdraw();
  else if(v.action==="transfer") confirmTransfer();
  else if(v.action==="deposit")  submitDeposit();
  else if(v.action==="loanpayment"){
    const sel=document.getElementById("child-loan-select").value;
    if(!sel){ showToast("Select a loan to pay.","error"); return; }
    applyLoanPayment(sel);
  }
}

function confirmWithdraw(){
  const v=validateChildForm(); if(!v) return;
  const data=getChildData(currentUser);
  if(v.amt>data.balances.checking){ showToast("Not enough in checking.","error"); return; }
  openModal({
    icon:"💸", title:"Request withdrawal of "+fmt(v.amt)+"?",
    body:"This request will be sent to your parent for approval. The money stays in checking until they approve.",
    detail:{Note:v.note,From:"Checking",Amount:fmt(v.amt)},
    confirmText:"Submit Request", confirmClass:"btn-primary",
    onConfirm:()=>{
      // v35.0 Item 2 — pending-approval flow (mirrors deposit pattern). No immediate deduction.
      if(!data.pendingWithdrawals) data.pendingWithdrawals=[];
      data.pendingWithdrawals.push({
        id:"wd_"+Date.now(),
        amount:v.amt, note:v.note,
        submittedBy:currentUser, submittedAt:fmtDate(new Date())
      });
      syncToCloud("Withdrawal Submitted");
      showToast("Withdrawal submitted for approval. 💸","success");
      document.getElementById("child-amt").value=""; document.getElementById("child-note").value="";
      try { closeSheet("sheet-manage-money", true); } catch(e){} // Item 18 — auto-close
      try { renderPendingWithdrawals(); } catch(e){}
    }
  });
}

// v35.0 Item 2 — child-side banner showing their pending withdrawals
function renderPendingWithdrawals(){
  const child=activeChild||currentUser;
  const data=getChildData(child);
  const el=document.getElementById("withdrawal-pending-list");
  if(!el) return;
  const pending=(data.pendingWithdrawals||[]).filter(d=>d.submittedBy===currentUser);
  if(!pending.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-bottom:10px;font-size:15px;color:#92400e;">
    <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-hourglass'/></svg> ${pending.length} withdrawal${pending.length===1?"":"s"} awaiting approval — total ${fmt(pending.reduce((s,d)=>s+d.amount,0))}
  </div>`;
}

// v35.0 Item 2 — parent-side withdrawal approval cards
function renderParentWithdrawalApprovals(){
  const data=getChildData(activeChild);
  const pending=data.pendingWithdrawals||[];
  const el=document.getElementById("parent-withdrawal-approvals");
  if(!el) return;
  if(!pending.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div class="approval-banner">
    <h3><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-hourglass'/></svg> Withdrawals Awaiting Approval (${pending.length})</h3>
    ${pending.map(d=>`
      <div class="chore-card state-pending">
        <div class="chore-card-header">
          <span class="chore-card-name">${escapeHtml(d.note)}</span>
          <span class="chore-card-amount">${fmt(d.amount)}</span>
        </div>
        <div class="chore-card-meta">
          By <strong>${d.submittedBy}</strong> at ${d.submittedAt}<br>
          From: Checking
        </div>
        <div class="row" style="gap:8px;">
          <button class="btn btn-secondary btn-sm col" onclick="approveWithdrawal('${d.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Approve</button>
          <button class="btn btn-danger    btn-sm col" onclick="denyWithdrawal('${d.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg> Deny</button>
        </div>
      </div>`).join("")}
  </div>`;
}

function approveWithdrawal(wdId){
  const data=getChildData(activeChild);
  const wd=(data.pendingWithdrawals||[]).find(d=>d.id===wdId);
  if(!wd) return;
  if(wd.amount > data.balances.checking){
    showToast("Not enough in checking to approve this withdrawal.","error");
    return;
  }
  data.balances.checking -= wd.amount;
  recordTransaction(wd.submittedBy, "Withdraw: "+wd.note, -wd.amount);
  data.pendingWithdrawals = data.pendingWithdrawals.filter(d=>d.id!==wdId);
  syncToCloud("Withdrawal Approved");
  showToast("Withdrawal approved. "+fmt(wd.amount)+" deducted.","success");
  renderParentWithdrawalApprovals();
  renderBalances();
}

function denyWithdrawal(wdId){
  const data=getChildData(activeChild);
  const wd=(data.pendingWithdrawals||[]).find(d=>d.id===wdId);
  if(!wd) return;
  openModal({
    icon:"❌", title:"Deny withdrawal?",
    body:"Reject this "+fmt(wd.amount)+" withdrawal from "+wd.submittedBy+"? No money has been deducted.",
    confirmText:"Deny", confirmClass:"btn-danger",
    onConfirm:()=>{
      data.pendingWithdrawals=data.pendingWithdrawals.filter(d=>d.id!==wdId);
      syncToCloud("Withdrawal Denied");
      showToast("Withdrawal denied.","info");
      renderParentWithdrawalApprovals();
    }
  });
}
window.approveWithdrawal = approveWithdrawal;
window.denyWithdrawal    = denyWithdrawal;

function confirmTransfer(){
  const v=validateChildForm(); if(!v) return;
  const data=getChildData(currentUser);
  if(v.amt>data.balances.checking){ showToast("Not enough in checking.","error"); return; }
  openModal({
    icon:"🏦", title:"Transfer "+fmt(v.amt)+" to savings?",
    body:"Move "+fmt(v.amt)+" from checking to savings.",
    detail:{Note:v.note,From:"Checking",To:"Savings",Amount:fmt(v.amt)},
    confirmText:"Transfer", confirmClass:"btn-secondary",
    onConfirm:()=>{
      data.balances.checking-=v.amt; data.balances.savings+=v.amt;
      recordTransaction(currentUser,"Transfer to Savings: "+v.note,-v.amt);
      recordTransaction(currentUser,"Transfer to Savings: "+v.note+" (Sav)",v.amt);
      syncToCloud("Transfer");
      showToast("Transferred "+fmt(v.amt)+" to savings.","success");
      document.getElementById("child-amt").value=""; document.getElementById("child-note").value="";
    }
  });
}

function submitDeposit(){
  const v=validateChildForm(); if(!v) return;
  const splitChk=parseInt(document.getElementById("deposit-split").value);
  const data=getChildData(currentUser);
  // v38.1 final (In-4) — same confirm modal as withdrawals; (In-3) sheet auto-closes on submit.
  openModal({
    icon:"📥", title:"Submit deposit of "+fmt(v.amt)+"?",
    body:"This request will be sent to your parent for approval.",
    detail:{Note:v.note, Split:splitChk+"% checking / "+(100-splitChk)+"% savings", Amount:fmt(v.amt)},
    confirmText:"Submit Request", confirmClass:"btn-primary",
    onConfirm:()=>{
      if(!data.pendingDeposits) data.pendingDeposits=[];
      data.pendingDeposits.push({
        id:"dep_"+Date.now(),
        amount:v.amt, note:v.note, splitChk,
        submittedBy:currentUser, submittedAt:fmtDate(new Date())
      });
      syncToCloud("Deposit Submitted");
      showToast("Deposit submitted for approval. 📥","success");
      document.getElementById("child-amt").value=""; document.getElementById("child-note").value="";
      try { closeSheet("sheet-manage-money", true); } catch(e){}
      try { renderPendingDeposits(); } catch(e){}
    }
  });
}

function renderPendingDeposits(){
  const child=activeChild||currentUser;
  const data=getChildData(child);
  const el=document.getElementById("deposit-pending-list");
  if(!el) return;
  const pending=(data.pendingDeposits||[]).filter(d=>d.submittedBy===currentUser);
  if(!pending.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-bottom:10px;font-size:15px;color:#92400e;">
    <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-hourglass'/></svg> ${pending.length} deposit${pending.length===1?"":"s"} awaiting approval — total ${fmt(pending.reduce((s,d)=>s+d.amount,0))}
  </div>`;
}

function renderParentDepositApprovals(){
  const data=getChildData(activeChild);
  const pending=data.pendingDeposits||[];
  const el=document.getElementById("parent-deposit-approvals");
  if(!el) return;
  if(!pending.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div class="approval-banner">
    <h3><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-hourglass'/></svg> Deposits Awaiting Approval (${pending.length})</h3>
    ${pending.map(d=>`
      <div class="chore-card state-pending">
        <div class="chore-card-header">
          <span class="chore-card-name">${escapeHtml(d.note)}</span>
          <span class="chore-card-amount">${fmt(d.amount)}</span>
        </div>
        <div class="chore-card-meta">
          By <strong>${d.submittedBy}</strong> at ${d.submittedAt}<br>
          Split: ${d.splitChk}% Chk / ${100-d.splitChk}% Sav
        </div>
        <div class="row" style="gap:8px;">
          <button class="btn btn-secondary btn-sm col" onclick="approveDeposit('${d.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Approve</button>
          <button class="btn btn-danger    btn-sm col" onclick="denyDeposit('${d.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg> Deny</button>
        </div>
      </div>`).join("")}
  </div>`;
}

function approveDeposit(depositId){
  const data=getChildData(activeChild);
  const dep=(data.pendingDeposits||[]).find(d=>d.id===depositId);
  if(!dep) return;
  const ck=dep.amount*(dep.splitChk/100), sv=dep.amount*((100-dep.splitChk)/100);
  data.balances.checking+=ck; data.balances.savings+=sv;
  if(ck>0) recordTransaction("Bank","Deposit: "+dep.note+" (Chk)",ck);
  if(sv>0) recordTransaction("Bank","Deposit: "+dep.note+" (Sav)",sv);
  data.pendingDeposits=data.pendingDeposits.filter(d=>d.id!==depositId);
  syncToCloud("Deposit Approved");
  showToast("Deposit approved! "+fmt(dep.amount)+" added.","success");
  renderParentDepositApprovals();
}

function denyDeposit(depositId){
  const data=getChildData(activeChild);
  const dep=(data.pendingDeposits||[]).find(d=>d.id===depositId);
  if(!dep) return;
  openModal({
    icon:"❌", title:"Deny deposit?",
    body:"Reject this "+fmt(dep.amount)+" deposit from "+dep.submittedBy+"?",
    confirmText:"Deny", confirmClass:"btn-danger",
    onConfirm:()=>{
      data.pendingDeposits=data.pendingDeposits.filter(d=>d.id!==depositId);
      syncToCloud("Deposit Denied");
      showToast("Deposit denied.","info");
      renderParentDepositApprovals();
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// 10. PARENT ADJUST + ALLOWANCE + RATES
// ════════════════════════════════════════════════════════════════════
function confirmAdjust(){
  const ck=readMoney("adj-chk")||0;
  const sv=readMoney("adj-sav")||0;
  const note=document.getElementById("adj-note").value.trim();
  clearFieldError("adj-note","adj-msg");
  if(!note){ showFieldError("adj-note","adj-msg","Reason is required."); return; }
  if(ck===0 && sv===0){ showFieldError("adj-note","adj-msg","Enter at least one amount (positive or negative)."); return; }
  const data=getChildData(activeChild);
  data.balances.checking+=ck; data.balances.savings+=sv;
  if(ck!==0) recordTransaction(currentUser,"Adjust: "+note+(ck<0?" (withdraw)":" (deposit)"),ck);
  if(sv!==0) recordTransaction(currentUser,"Adjust: "+note+(sv<0?" (withdraw, Sav)":" (deposit, Sav)"),sv);
  syncToCloud("Adjustment");
  showToast("Adjustment applied.","success");
  document.getElementById("adj-chk").value=""; document.getElementById("adj-sav").value=""; document.getElementById("adj-note").value="";
  closeSheet("sheet-adjust", true);
}

function saveAllowance(){
  const data=getChildData(activeChild);
  const sched=document.getElementById("allow-schedule").value;
  data.autoDeposit=data.autoDeposit||{};
  data.autoDeposit.checking=readMoney("allow-chk")||0;
  data.autoDeposit.savings =readMoney("allow-sav")||0;
  data.autoDeposit.schedule=sched;
  if(sched==="weekly"||sched==="biweekly"){
    data.autoDeposit.weekday=getAllowanceSelectedDay();
  } else if(sched==="monthly"){
    data.autoDeposit.monthlyDay=document.getElementById("allow-monthly-day").value;
  }
  syncToCloud("Allowance Update");
  showToast("Allowance saved.","success");
  closeSheet("sheet-allowance-interest", true);
}

function saveRates(){
  const data=getChildData(activeChild);
  data.rates.checking=readPercent("rate-chk")||0; // v34.2 — use readPercent (handles "5%" display format)
  data.rates.savings =readPercent("rate-sav")||0;
  renderBalances();
  syncToCloud("Rates Update");
  showToast("Interest rates saved.","success");
  closeSheet("sheet-allowance-interest", true);
}

// v35.0 — combined Allowance &amp; Interest save (one-tap Save All on merged sheet)
function saveAllowanceAndInterest(){
  const data=getChildData(activeChild);
  // Allowance
  const sched=document.getElementById("allow-schedule").value;
  data.autoDeposit=data.autoDeposit||{};
  data.autoDeposit.checking=readMoney("allow-chk")||0;
  data.autoDeposit.savings =readMoney("allow-sav")||0;
  data.autoDeposit.schedule=sched;
  if(sched==="weekly"||sched==="biweekly"){
    data.autoDeposit.weekday=getAllowanceSelectedDay();
  } else if(sched==="monthly"){
    data.autoDeposit.monthlyDay=document.getElementById("allow-monthly-day").value;
  }
  // Interest rates
  data.rates=data.rates||{};
  data.rates.checking=readPercent("rate-chk")||0;
  data.rates.savings =readPercent("rate-sav")||0;
  renderBalances();
  syncToCloud("Allowance &amp; Interest Update");
  showToast("Allowance &amp; interest saved.","success");
  closeSheet("sheet-allowance-interest", true);
}

// v35.0 — open combined sheet (prefills fields &amp; renders projection)
function openAllowanceInterestSheet(){
  renderParentSettings();                  // reuses existing prefill for allowance + rates inputs
  renderAllowanceInterestProjection();
  // Live-update projection as values change
  ["allow-chk","allow-sav","allow-schedule","rate-chk","rate-sav"].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el._aiProjWired){
      el.addEventListener("input", renderAllowanceInterestProjection);
      el.addEventListener("change", renderAllowanceInterestProjection);
      el._aiProjWired = true;
    }
  });
  openSheet("sheet-allowance-interest");
}

// v35.0 — Annual earnings projection (mirrors wizard step 4 calc)
function renderAllowanceInterestProjection(){
  const body=document.getElementById("allow-interest-projection-body");
  if(!body) return;
  const sched=(document.getElementById("allow-schedule")||{}).value || "weekly";
  const aChk=readMoney("allow-chk")||0;
  const aSav=readMoney("allow-sav")||0;
  const rChk=(readPercent("rate-chk")||0)/100;
  const rSav=(readPercent("rate-sav")||0)/100;
  const perYear = sched==="weekly" ? 52 : sched==="biweekly" ? 26 : 12;
  const annualAllowance = (aChk+aSav)*perYear;
  // Simple APY on the year's allowance contributions (approx) — matches wizard live calc.
  const data=getChildData(activeChild)||{};
  const balChk=(data.balances && data.balances.checking) || 0;
  const balSav=(data.balances && data.balances.savings)  || 0;
  const annualInterest = balChk*rChk + balSav*rSav + (aChk*perYear*rChk*0.5) + (aSav*perYear*rSav*0.5);
  const total = annualAllowance + annualInterest;
  body.innerHTML =
    `<div style="font-size:15px;color:var(--muted);margin-bottom:4px;">Projected in next 12 months</div>`+
    `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;">`+
      `<div><div style="font-size:14px;color:var(--muted);">Allowance</div><div style="font-weight:700;">${fmt(annualAllowance)}</div></div>`+
      `<div><div style="font-size:14px;color:var(--muted);">Interest</div><div style="font-weight:700;">${fmt(annualInterest)}</div></div>`+
      `<div><div style="font-size:14px;color:var(--muted);">Total</div><div style="font-weight:800;color:var(--primary);">${fmt(total)}</div></div>`+
    `</div>`;
}

function renderParentSettings(){
  const data=getChildData(activeChild);
  // v34.2 — reformat percent inputs so they display as "5%" not bare "5"
  const rChkEl=document.getElementById("rate-chk");
  const rSavEl=document.getElementById("rate-sav");
  if(rChkEl){ rChkEl.value=data.rates.checking||""; _reformatPercentInput(rChkEl); }
  if(rSavEl){ rSavEl.value=data.rates.savings ||""; _reformatPercentInput(rSavEl); }
  const ad=data.autoDeposit||{};
  // v34.0 — write money values then blur-format by calling installMoneyInputs;
  // the installer no-ops on already-wired inputs but still applies format.
  const allowChkEl = document.getElementById("allow-chk");
  const allowSavEl = document.getElementById("allow-sav");
  if(allowChkEl){
    allowChkEl.value = (ad.checking !== undefined && ad.checking !== null) ? ad.checking : "";
    _reformatMoneyInput(allowChkEl);
  }
  if(allowSavEl){
    allowSavEl.value = (ad.savings !== undefined && ad.savings !== null) ? ad.savings : "";
    _reformatMoneyInput(allowSavEl);
  }
  document.getElementById("allow-schedule").value=ad.schedule||"weekly";
  onAllowanceScheduleChange();
  if(ad.schedule==="monthly" && ad.monthlyDay){
    document.getElementById("allow-monthly-day").value=ad.monthlyDay;
  }
  if((ad.schedule==="weekly"||ad.schedule==="biweekly"||!ad.schedule) && ad.weekday!==undefined){
    setAllowanceDayToggles([ad.weekday]);
  }
  // v30.1: populate child profile section
  renderChildProfileSection();
  // v38.1 final (In-2) — orphan parent-email field reads removed (field retired in v38 Step 4).
}

// v30.1: Child profile — email, calendar, notifications, tabs
function renderChildProfileSection(){
  if(!activeChild) return;
  const cfg=state.config;
  document.getElementById("profile-section-title").textContent = activeChild + " — Profile";
  document.getElementById("profile-email").value       = (cfg.emails    && cfg.emails[activeChild])    || "";
  document.getElementById("profile-calendar-id").value = (cfg.calendars && cfg.calendars[activeChild]) || "";
  const notify=(cfg.notify && cfg.notify[activeChild]) || {};
  document.getElementById("profile-notify-email").checked  = notify.email        !== false;  // default ON
  document.getElementById("profile-notify-cal").checked    = !!notify.calendar;              // default OFF
  document.getElementById("profile-chore-rewards").checked = notify.choreRewards !== false;  // default ON
  // v32: per-user celebration sound (default ON)
  const ud = (state.usersData && state.usersData[activeChild]) || {};
  const csProfile = document.getElementById("profile-celebration-sound");
  if(csProfile) csProfile.checked = (ud.celebrationSound !== false);
  // Tabs
  const tabs=getChildTabs(activeChild);
  const selected=[];
  if(tabs.money)  selected.push("money");
  if(tabs.chores) selected.push("chores");
  if(tabs.loans)  selected.push("loans");
  if(!window._pickerSelections) window._pickerSelections={};
  window._pickerSelections.profileTabs=[...selected];
  updatePickerDisplay("profileTabs", selected, PICKER_CONFIG.profileTabs);
  // Clear any prior message
  document.getElementById("profile-msg").className="field-msg";
  document.getElementById("profile-msg").textContent="";
}

function saveChildProfile(){
  if(!activeChild) return;
  const child = activeChild;
  const msgEl=document.getElementById("profile-msg"); msgEl.className="field-msg";
  const email=document.getElementById("profile-email").value.trim();
  const calId=document.getElementById("profile-calendar-id").value.trim();
  if(!state.config.emails)    state.config.emails={};
  if(!state.config.calendars) state.config.calendars={};
  if(!state.config.notify)    state.config.notify={};
  if(!state.config.tabs)      state.config.tabs={};
  // v38 Step 4 — non-email fields need no admin auth; apply + sync them now.
  if(calId) state.config.calendars[child]=calId;
  else      delete state.config.calendars[child];
  state.config.notify[child]={
    email:        document.getElementById("profile-notify-email").checked,
    calendar:     document.getElementById("profile-notify-cal").checked,
    choreRewards: document.getElementById("profile-chore-rewards").checked
  };
  if(!state.usersData) state.usersData={};
  if(!state.usersData[child]) state.usersData[child]={};
  const csProfile = document.getElementById("profile-celebration-sound");
  if(csProfile) state.usersData[child].celebrationSound = !!csProfile.checked;
  const sel=getPickerSelections("profileTabs");
  state.config.tabs[child]={
    money:  sel.indexOf("money")!==-1,
    chores: sel.indexOf("chores")!==-1,
    loans:  sel.indexOf("loans")!==-1
  };
  syncToCloud("Child Profile Updated");
  renderParentTabBar();  // loan tab may appear/disappear for parent too

  // v38.1 final — child email commits inside the state POST (same contract as
  // the user wizard, d1.2): no admin PIN in user-facing UI, no setChildEmail
  // leg. The EmailIndex is refreshed by Admin → "Rebuild email index" (In-8).
  // Clearing an email from this form is still unsupported (use the user wizard).
  const oldEmail = state.config.emails[child] || "";
  const emailChanged = email.toLowerCase() !== oldEmail.toLowerCase();
  if(!emailChanged){
    msgEl.className="field-msg success"; msgEl.textContent="Profile saved.";
    showToast(child+"'s profile updated. 💾","success");
    closeSheet("sheet-child-profile", true);
    return;
  }
  if(!email){
    document.getElementById("profile-email").value = oldEmail;  // revert (clear unsupported)
    msgEl.className="field-msg success";
    msgEl.textContent="Saved. To remove an email, use the admin panel (coming soon).";
    showToast("Other settings saved. Email removal needs the admin panel (coming soon).","info",4200);
    closeSheet("sheet-child-profile", true);
    return;
  }
  const taken = (typeof uwEmailTaken==="function") ? uwEmailTaken(email, child) : null;
  if(taken){
    msgEl.className="field-msg error"; msgEl.textContent="That email is already used by "+taken+".";
    document.getElementById("profile-email").value = oldEmail;
    showToast("Other settings saved. Email unchanged — already used by "+taken+".","error",4200);
    closeSheet("sheet-child-profile", true);
    return;
  }
  state.config.emails[child] = email;
  syncToCloud("Child Email Updated");
  showToast(child+"'s email updated. 💾","success");
  closeSheet("sheet-child-profile", true);
}

function openProfilePicker(){ openPicker("profileTabs"); }

// v32.4 item #9: Save parent's own email address (state.config.emails[currentUser]).
// Parent emails share the same emails map as child notification emails, keyed by
// display name. User renaming isn't supported so collision isn't a concern.
// v38 Step 4 — saveParentEmail removed (parent self-service email edit retired; D5/D6 throw-out).

function populateAllowanceMonthlyDays(){
  const sel=document.getElementById("allow-monthly-day");
  if(!sel||sel.options.length>0) return;
  for(let i=1;i<=28;i++) sel.appendChild(new Option(i+(i===1?"st":i===2?"nd":i===3?"rd":"th"), String(i)));
  ["last-2","last-1","last"].forEach(v=>{
    const lbl = v==="last"?"Last day":v==="last-1"?"2nd to last":"3rd to last";
    sel.appendChild(new Option(lbl, v));
  });
}

function onAllowanceScheduleChange(){
  const s=document.getElementById("allow-schedule").value;
  document.getElementById("allow-day-wrap").classList.toggle("hidden",s==="monthly");
  document.getElementById("allow-monthly-wrap").classList.toggle("hidden",s!=="monthly");
  const lbl=document.getElementById("allow-day-label");
  if(lbl) lbl.textContent = s==="biweekly" ? "Day of Week (every other week)" : "Day of Week";
}

function toggleAllowanceDay(btn){
  // Single-select for allowance day
  document.querySelectorAll("#allow-day-toggles .day-toggle").forEach(b=>b.classList.remove("selected"));
  btn.classList.add("selected");
}

function getAllowanceSelectedDay(){
  const sel=document.querySelector("#allow-day-toggles .day-toggle.selected");
  return sel ? parseInt(sel.dataset.day) : 1;
}

function setAllowanceDayToggles(days){
  document.querySelectorAll("#allow-day-toggles .day-toggle").forEach(b=>b.classList.remove("selected"));
  days.forEach(d=>{
    const el=document.querySelector(`#allow-day-toggles .day-toggle[data-day='${d}']`);
    if(el) el.classList.add("selected");
  });
}

// ════════════════════════════════════════════════════════════════════
// 11. CHORES — SCHEDULE UI, PER-DAY TIMES, CREATE/EDIT/APPROVE
// ════════════════════════════════════════════════════════════════════
function scheduleLabel(chore){
  const s=chore.schedule;
  const fullDays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  if(s==="once"){ return chore.onceDate ? "Due "+chore.onceDate : "One-time"; }
  if(s==="daily") return "Daily";
  if(s==="weekly"){
    const days=chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : []);
    return "Weekly"+(days.length ? " ("+days.map(d=>fullDays[d]).join(", ")+"s)" : "");
  }
  if(s==="biweekly"){
    const days=chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : []);
    return "Bi-weekly"+(days.length ? " ("+days.map(d=>fullDays[d]).join(", ")+"s)" : "");
  }
  if(s==="monthly"){
    const d=chore.monthlyDay;
    if(d==="last")   return "Monthly (last day)";
    if(d==="last-1") return "Monthly (2nd to last)";
    if(d==="last-2") return "Monthly (3rd to last)";
    const sfx={1:"st",2:"nd",3:"rd"};
    const n=parseInt(d);
    return "Monthly ("+n+(sfx[n]||"th")+")";
  }
  return s;
}

function resolveMonthlyDay(monthlyDay,year,month){
  const dim=new Date(year,month+1,0).getDate();
  if(monthlyDay==="last")   return dim;
  if(monthlyDay==="last-1") return dim-1;
  if(monthlyDay==="last-2") return dim-2;
  return parseInt(monthlyDay)||1;
}

// v38.1 final — chore-card Edit opens the chore wizard AT Review, pre-populated
// (single-chore edit contract: "Chore Edited" + _editedChoreId, see cwCommitEdit).
function editChore(choreId){
  cwOpenEdit(activeChild, choreId);
}

function renderParentChores(){
  const data=getChildData(activeChild);
  const chores=data.chores||[];
  const approvalsEl=document.getElementById("parent-chore-approvals");
  const pending=chores.filter(c=>c.status==="pending");
  approvalsEl.innerHTML = pending.length ? `
    <div class="approval-banner">
      <h3><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-hourglass'/></svg> Awaiting Approval (${pending.length})</h3>
      ${pending.map(c=>`
        <div class="chore-card state-pending">
          <div class="chore-card-header">
            <span class="chore-card-name">${escapeHtml(c.name)}</span>
            <span class="chore-card-amount">${c.amount>0 ? fmt(c.amount) : '<span style="color:var(--muted);font-size:15px;">No reward</span>'}</span>
          </div>
          <div class="chore-card-meta">
            Completed by <span class="completed-by-chip">${renderAvatar(c.completedBy,"xs")}<strong>${c.completedBy}</strong></span> at ${c.completedAt}<br>
            Split: ${c.splitChk}% Chk / ${100-c.splitChk}% Sav${c.desc?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> "+escapeHtml(c.desc):""}
          </div>
          <div class="row" style="gap:8px;">
            <button class="btn btn-secondary btn-sm col" onclick="approveChore('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Approve</button>
            <button class="btn btn-danger    btn-sm col" onclick="denyChore('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg> Deny</button>
          </div>
        </div>`).join("")}
    </div>` : "";

  const listEl=document.getElementById("parent-chore-list");
  if(!chores.length){
    listEl.innerHTML=emptyState("chores","No chores yet.");
    return;
  }
  listEl.innerHTML=chores.map(c=>{
    const badge = c.status==="pending"
      ? '<span class="status-badge badge-pending">Awaiting Approval</span>'
      : '<span class="status-badge badge-available">Active</span>';
    return `<div class="chore-card">
      <div class="chore-card-header">
        <span class="chore-card-name">${escapeHtml(c.name)}</span>
        <span class="chore-card-amount">${fmt(c.amount)}</span>
      </div>
      <div class="chore-card-meta">
        ${badge} <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-calendar'/></svg> ${scheduleLabel(c)}<br>
        <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-currency-dollar'/></svg> ${c.splitChk}% Chk / ${100-c.splitChk}% Sav${c.childChooses?" (child chooses)":""}${c.endDate?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-clock'/></svg> Ends: "+c.endDate:""}${c.desc?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> "+escapeHtml(c.desc):""}
        ${_renderNextChorePill(c)}
      </div>
      <div class="row" style="gap:8px;margin-top:4px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="editChore('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Edit</button>
        <button class="btn btn-danger  btn-sm" onclick="deleteChore('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-trash'/></svg> Delete</button>
      </div>
    </div>`;
  }).join("");
}

function approveChore(choreId){
  const data=getChildData(activeChild);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  const ck=chore.amount*(chore.splitChk/100), sv=chore.amount*((100-chore.splitChk)/100);
  openModal({
    icon:"✅", title:'Approve "'+chore.name+'"?',
    body:"Deposits the reward into "+chore.completedBy+"'s account now.",
    detail:{"Total":fmt(chore.amount),"→ Checking":fmt(ck),"→ Savings":fmt(sv),"By":chore.completedBy},
    confirmText:"Approve & Pay", confirmClass:"btn-secondary",
    onConfirm:()=>{
      data.balances.checking+=ck; data.balances.savings+=sv;
      if(ck>0) recordTransaction("Bank","Chore: "+chore.name+" (Chk)",ck);
      if(sv>0) recordTransaction("Bank","Chore: "+chore.name+" (Sav)",sv);
      if(chore.schedule==="once"){
        data.chores=data.chores.filter(c=>c.id!==choreId);
      } else {
        Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote:null,lastCompleted:todayStr()});
        // Streak milestone bonus
        if(chore.streakMilestone && chore.streakReward){
          chore.streakCount=(parseInt(chore.streakCount)||0)+1;
          const effective=chore.streakCount + (parseInt(chore.streakStart)||0);
          const milestone=parseInt(chore.streakMilestone)||0;
          if(milestone>0 && effective%milestone===0){
            const bonus=parseFloat(chore.streakReward)||0;
            if(bonus>0){
              data.balances.checking+=bonus;
              recordTransaction("Bank","🔥 Streak Bonus: "+chore.name+" ("+effective+" in a row!) (Chk)",bonus);
              showToast("🔥 Streak milestone! +"+fmt(bonus)+" bonus deposited!","success",4000);
            }
          }
        }
      }
      state._approvedChoreId=chore.id;
      state._approvedChoreTitle=buildCalEventTitle(chore);
      state._approvedChoreSchedule=chore.schedule;
      syncToCloud("Chore Approved");
      delete state._approvedChoreId; delete state._approvedChoreTitle; delete state._approvedChoreSchedule;
      showToast("Approved! "+fmt(chore.amount)+" deposited. 🎉","success");
      renderParentChores(); renderChildChores(); updateChoreBadges();
    }
  });
}

// v38.2-1 — shared by denyChore / quickDenyOne. A denied chore of ANY schedule goes
// back to the queue; one-time chores used to be deleted here (the deny branch was
// byte-identical to the approve branch). A one-time chore whose date has already
// passed loses the date (undated one-time = always due, never expires) so the
// child can actually redo it instead of seeing a permanent "Expired" row; moving
// the date to today would only buy one day (cold audit findings #2 / re-check #1, 2026-09-24).
function reopenDeniedChore(chore, denialNote){
  Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote:denialNote||null,lastCompleted:null});
  if(chore.schedule==="once" && chore.onceDate && chore.onceDate<todayStr()){ chore.onceDate=null; chore.onceDueOn=false; }
}
function denyChore(choreId){
  const data=getChildData(activeChild);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  openInputModal({
    icon:"❌", title:'Deny "'+chore.name+'"?',
    body:"Optionally leave a reason for "+chore.completedBy+".",
    inputType:"text", inputAttrs:'placeholder="Reason (optional)"',
    confirmText:"Deny", confirmClass:"btn-danger",
    onConfirm:(reason)=>{
      const denialNote=reason||null;
      reopenDeniedChore(chore, denialNote);   // v38.2-1 — was: one-time chores filtered out (deleted)
      syncToCloud("Chore Denied");
      showToast("Chore denied.","error");
      renderParentChores(); renderChildChores(); updateChoreBadges();
    }
  });
}

function deleteChore(choreId){
  const data=getChildData(activeChild);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  openModal({
    icon:"🗑️", title:'Delete "'+chore.name+'"?',
    body:"This cannot be undone.",
    confirmText:"Delete", confirmClass:"btn-danger",
    onConfirm:()=>{
      state._deletedChoreId=chore.id;
      state._deletedChoreTitle=buildCalEventTitle(chore);
      data.chores=data.chores.filter(c=>c.id!==choreId);
      syncToCloud("Chore Deleted");
      delete state._deletedChoreId; delete state._deletedChoreTitle;
      showToast("Chore deleted.","info");
      renderParentChores(); renderChildChores(); updateChoreBadges();
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// 12. CHORE CHECKLIST (CHILD VIEW)
// ════════════════════════════════════════════════════════════════════
function setChoreFilter(f){
  choreFilter=f;
  ["today","week","all"].forEach(id=>{
    const el=document.getElementById("cf-"+id);
    if(!el) return;
    el.classList.toggle("active", f===id);
  });
  renderChoreTable();
}

function isDueToday(chore){
  const now=new Date();
  if(chore.schedule==="daily") return true;
  if(chore.schedule==="once"){
    if(!chore.onceDate) return true;
    const today=todayStr();
    if(chore.onceDate<today) return false;
    if(chore.onceDueOn) return chore.onceDate===today;
    return true;
  }
  if(chore.schedule==="weekly"){
    const days = chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [now.getDay()]);
    return days.indexOf(now.getDay())!==-1;
  }
  if(chore.schedule==="biweekly"){
    const days = chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [now.getDay()]);
    if(days.indexOf(now.getDay())===-1) return false;
    const created=new Date(chore.createdAt||Date.now());
    const weeksDiff=Math.floor((Date.now()-created.getTime())/(7*24*60*60*1000));
    // v30.1: if skipFirstWeek, flip the bi-weekly phase so "this week" is off-week
    const offset = chore.skipFirstWeek ? 1 : 0;
    return (weeksDiff + offset) % 2 === 0;
  }
  if(chore.schedule==="monthly"){
    const target=resolveMonthlyDay(chore.monthlyDay||"1",now.getFullYear(),now.getMonth());
    return now.getDate()===target;
  }
  return false;
}

function isDueThisWeek(chore){
  if(isDueToday(chore)) return true;
  if(chore.schedule==="daily") return true;
  if(chore.schedule==="once"){
    if(!chore.onceDate) return true;
    const today=todayStr();
    return chore.onceDate>=today;
  }
  if(chore.schedule==="weekly"){
    const days=chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [new Date(chore.createdAt||Date.now()).getDay()]);
    const today=new Date().getDay();
    return days.some(t => ((t-today+7)%7)<=6);
  }
  if(chore.schedule==="biweekly"){
    const days=chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [new Date(chore.createdAt||Date.now()).getDay()]);
    const today=new Date().getDay();
    const anyDay=days.some(t => ((t-today+7)%7)<=6);
    if(!anyDay) return false;
    const created=new Date(chore.createdAt||Date.now());
    const daysElapsed=Math.floor((Date.now()-created.getTime())/(24*60*60*1000));
    // v30.1: if skipFirstWeek, shift window by 7 days
    const offset = chore.skipFirstWeek ? 7 : 0;
    return (14-((daysElapsed+offset)%14))<=7;
  }
  if(chore.schedule==="monthly"){
    const now=new Date();
    const target=resolveMonthlyDay(chore.monthlyDay||"1",now.getFullYear(),now.getMonth());
    const today=now.getDate();
    const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    return ((target-today+dim)%dim)<=6;
  }
  return false;
}

function renderChildChores(){
  renderWeeklyStreakBanner();  // v31.2 — green "6 chores done this week!" banner (kept)
  const listEl=document.getElementById("child-chore-list");
  const notifEl=document.getElementById("child-chore-notifications");
  // v32.2: Streak pills row removed per Mike — too busy at the top.
  // Streak info is now shown inline inside each chore card body (see renderChoreRow below).
  const streakEl=document.getElementById("chore-streaks-wrap");
  if(streakEl) streakEl.innerHTML = "";
  if(!listEl) return;
  const data=getChildData(activeChild||currentUser);
  const chores=data.chores||[];
  // Notification cards for approved/denied chores
  const decisions=chores.filter(c=>(c.status==="approved"||c.status==="denied")&&c.completedBy===currentUser);
  if(notifEl){
    notifEl.innerHTML=decisions.map(c=>`
      <div class="chore-card" style="${c.status==="approved"?"border-color:var(--secondary);background:#f0fdf4;":"border-color:var(--danger);background:#fef2f2;"}">
        <div class="chore-card-header">
          <span class="chore-card-name">${c.status==="approved"?"<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg>":"<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg>"} ${escapeHtml(c.name)}</span>
          <span class="chore-card-amount">${fmt(c.amount)}</span>
        </div>
        <div class="chore-card-meta">${c.status==="approved" ? "Great work! "+fmt(c.amount)+" added to your account! <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-party-popper'/></svg>" : "Not approved this time."+(c.denialNote?" Reason: "+c.denialNote:"")+" Talk to your parent if you have questions."}</div>
        <button class="btn btn-ghost btn-sm" onclick="dismissChoreNotif('${c.id}')">Got it ✓</button>
      </div>`).join("") || "";
  }

  // v38.2-4 — expired one-time chores (onceDate in the past) are not "available":
  // they were counted here but excluded in renderChoreTable, so the count and
  // "Up to $X" total disagreed with the rows. Same rule as renderChoreTable now.
  const available=chores.filter(c=>!c.paused && c.status==="available" && (!c.endDate||c.endDate>=todayStr()) && c.lastCompleted!==todayStr()
    && !(c.schedule==="once" && c.onceDate && c.onceDate<todayStr()));
  const expiredOnce=chores.filter(c=>c.schedule==="once" && c.onceDate && c.onceDate<todayStr() && c.status==="available");
  if(!available.length && !expiredOnce.length){
    listEl.innerHTML=emptyState("chores", decisions.length?"Check the notifications above!":"No chores right now — check back later!");
    return;
  }

  const totalPossible=available.reduce((s,c)=>s+(parseFloat(c.amount)||0),0);
  const showRew=choreRewardsEnabled(activeChild||currentUser);

  listEl.innerHTML=`
    <div class="chore-filter-bar">
      <button id="cf-today" class="chore-filter-btn" onclick="setChoreFilter('today')">Due Today</button>
      <button id="cf-week"  class="chore-filter-btn" onclick="setChoreFilter('week')">This Week</button>
      <button id="cf-all"   class="chore-filter-btn" onclick="setChoreFilter('all')">All Chores</button>
    </div>
    <div style="background:var(--bg);border-radius:10px;padding:8px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;font-size:15px;">
      <span style="color:var(--muted);font-weight:600;">${available.length} chore${available.length===1?"":"s"} available</span>
      ${showRew?`<span style="color:var(--secondary);font-weight:700;font-family:var(--mono);">Up to ${fmt(totalPossible)}</span>`:""}
    </div>
    <div id="chore-table-wrap"></div>
    <p style="font-size:15px;color:var(--muted);text-align:center;margin-top:8px;">Tap the checkbox when you've finished a chore ✓</p>`;
  setChoreFilter(choreFilter);
}

function renderChoreTable(){
  const wrap=document.getElementById("chore-table-wrap");
  if(!wrap) return;
  const data=getChildData(activeChild||currentUser);
  const chores=data.chores||[];
  const today=todayStr();
  const expired=chores.filter(c=>c.schedule==="once"&&c.onceDate&&c.onceDate<today&&c.status==="available");
  // v30.1: "available" now means non-paused, not-yet-completed-today, not-past-endDate.
  // Per-tab narrowing (today / this week / all) happens in the filter step below.
  const available=chores.filter(c=>
    !c.paused &&
    c.status==="available" &&
    (!c.endDate || c.endDate>=today) &&
    c.lastCompleted!==today &&
    // Exclude one-time chores whose date has passed (those are in `expired`)
    !(c.schedule==="once" && c.onceDate && c.onceDate<today)
  );
  const filtered=available.filter(c=>{
    if(choreFilter==="today") return isDueToday(c);
    if(choreFilter==="week")  return isDueThisWeek(c);
    return true;  // "all" — show every available chore regardless of schedule window
  });
  function dueBadge(c){
    if(isDueToday(c))    return `<span style="font-size:14px;font-weight:700;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:10px;margin-left:5px;">Today</span>`;
    if(isDueThisWeek(c)) return `<span style="font-size:14px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:10px;margin-left:5px;">This Week</span>`;
    return "";
  }
  // v38.2-4 — on All Chores, expired one-time rows still render even when nothing is active.
  if(!filtered.length && !(choreFilter==="all" && expired.length)){
    const msg = choreFilter==="today" ? "No chores due today — check 'This Week' or 'All Chores'!"
              : choreFilter==="week"  ? "No chores due this week — check 'All Chores'!"
              : "No chores available right now!";
    wrap.innerHTML=emptyState("chores", msg);
    return;
  }
  const showRewards=choreRewardsEnabled(activeChild||currentUser);
  // v38.2-4 — dimmed "Expired" rows belong on All Chores only; Due Today / This Week
  // were listing chores that could not be done today.
  const expiredRows=(choreFilter!=="all" ? [] : expired).map(c=>`
    <tr style="opacity:.42;">
      <td class="chore-check-cell"><div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:16px;"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg></div></td>
      <td class="chore-name-cell">${escapeHtml(c.name)}<div class="chore-desc-small" style="color:var(--danger);">Expired ${c.onceDate}</div></td>
      <td class="chore-schedule-cell">One-time</td>
      ${showRewards?`<td class="chore-amount-cell">${c.amount>0?fmt(c.amount):"—"}</td>`:""}
    </tr>`).join("");

  wrap.innerHTML=`
    <table class="chore-table">
      <thead><tr><th style="width:36px;"></th><th>Chore</th><th>Schedule</th>${showRewards?`<th style="text-align:right;">Earn</th>`:""}</tr></thead>
      <tbody>
        ${filtered.map(c=>`
          <tr class="chore-row" id="chore-row-${c.id}">
            <td class="chore-check-cell">${isDueToday(c) ? `<div class="chore-checkbox-wrap" id="chk-${c.id}" onclick="toggleChoreCheck('${c.id}')"></div>` : `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--muted);" title="Not due today"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-lock-simple'/></svg></div>`}</td>
            <td class="chore-name-cell">
              ${escapeHtml(c.name)}${dueBadge(c)}
              ${c.desc?`<div class="chore-desc-small">${escapeHtml(c.desc)}</div>`:""}
              ${showRewards?(c.childChooses?`<div class="chore-desc-small"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-currency-dollar'/></svg> You choose the split</div>`:`<div class="chore-desc-small"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-currency-dollar'/></svg> ${c.splitChk}% Checking / ${100-c.splitChk}% Savings</div>`):""}
              ${renderInlineStreak(c)}
            </td>
            <td class="chore-schedule-cell">${scheduleLabel(c)}</td>
            ${showRewards?`<td class="chore-amount-cell" id="chore-amt-${c.id}">${c.amount>0?fmt(c.amount):"—"}</td>`:""}
          </tr>`).join("")}
        ${expiredRows}
      </tbody>
    </table>`;
}

function toggleChoreCheck(choreId){
  const data=getChildData(activeChild||currentUser);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore || chore.status==="pending") return;
  // v33.0 — If chore requires proof and no photo has been captured yet for THIS chore,
  // open the capture sheet first. After the user approves the thumbnail and taps
  // "Continue", the capture flow calls back into this same function; by then
  // pendingProofPhoto is populated and pendingProofChoreId matches, so we fall through.
  if(chore.requiresProof && (!pendingProofPhoto || pendingProofChoreId !== choreId)){
    openProofPhotoCapture(choreId);
    return;
  }
  if(chore.childChooses){
    openModal({
      icon:"✅", title:'Mark "'+chore.name+'" Complete?',
      body:"Choose how to split your "+fmt(chore.amount)+" reward.",
      detail:{}, confirmText:"Submit ✋", confirmClass:"btn-secondary",
      onConfirm:()=>{
        const sl=document.getElementById("modal-split-slider");
        submitChoreCheck(choreId, sl?parseInt(sl.value):chore.splitChk);
      }
    });
    setTimeout(()=>{
      const de=document.getElementById("modal-detail");
      // v32: Always default split to 50/50 (drop v31.2 goal-aware conditional)
      const p = chore.splitChk ?? 50;
      de.innerHTML=`<div class="split-display"><span class="chk-pct">Checking: <span id="msc-chk">${p}</span>%</span><span class="sav-pct">Savings: <span id="msc-sav">${100-p}</span>%</span></div><input type="range" id="modal-split-slider" min="0" max="100" value="${p}" oninput="document.getElementById('msc-chk').textContent=this.value;document.getElementById('msc-sav').textContent=100-parseInt(this.value);"><p style="font-size:15px;color:var(--muted);margin:6px 0 0;text-align:center;">Drag to set your split</p>`;
      de.classList.remove("hidden");
    },60);
  } else {
    submitChoreCheck(choreId,chore.splitChk);
  }
}

function submitChoreCheck(choreId,chkPct){
  const data=getChildData(activeChild||currentUser);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  // Animate
  const row=document.getElementById("chore-row-"+choreId);
  const chkEl=document.getElementById("chk-"+choreId);
  const amtEl=document.getElementById("chore-amt-"+choreId);
  if(row)   row.classList.add("done");
  if(chkEl){ chkEl.classList.add("pending"); chkEl.onclick=null; }
  if(amtEl) amtEl.classList.add("done-amt");
  // Mark pending
  Object.assign(chore,{
    status:"pending",
    completedBy:currentUser,
    completedAt:fmtDate(new Date()),
    splitChk:chkPct
  });
  syncToCloud("Chore Submitted");
  showEarnedPopup(chore.amount,chore.name);
  updateChoreBadges();
}

function dismissChoreNotif(choreId){
  const data=getChildData(activeChild||currentUser);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  if(chore.status==="approved" || chore.status==="denied"){
    if(chore.schedule==="once"){
      data.chores=data.chores.filter(c=>c.id!==choreId);
    } else {
      Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote:null});
    }
    syncToCloud("Chore Notif Dismissed");
    renderChildChores(); updateChoreBadges();
  }
}

function showChoreWaitingBanner(){
  const data=getChildData(activeChild||currentUser);
  const dueToday=(data.chores||[]).filter(c=>c.status==="available" && (!c.endDate||c.endDate>=todayStr()) && isDueToday(c) && c.lastCompleted!==todayStr());
  const banner=document.getElementById("chore-waiting-banner");
  if(!banner) return;
  if(!dueToday.length){ banner.classList.add("hidden"); return; }
  const title=document.getElementById("chore-banner-title");
  if(title) title.textContent = dueToday.length===1
    ? "You have 1 chore due today!"
    : "You have "+dueToday.length+" chores due today!";
  banner.classList.remove("hidden");
}

// ════════════════════════════════════════════════════════════════════
// 13. SAVINGS GOALS
// ════════════════════════════════════════════════════════════════════
function addSavingsGoal(){
  const name=document.getElementById("new-goal-name").value.trim();
  const amt=readMoney("new-goal-amount");
  if(!name||!amt||amt<=0){ showToast("Enter a goal name and amount.","error"); return; }
  const data=getChildData(currentUser);
  if(!data.goals) data.goals=[];
  data.goals.push({id:"goal_"+Date.now(),name,target:amt,createdAt:todayStr()});
  document.getElementById("new-goal-name").value="";
  document.getElementById("new-goal-amount").value="";
  syncToCloud("Goal Added");
  renderSavingsGoals();
  showToast("Goal added! 🎯","success");
}

function renderSavingsGoals(){
  const data=getChildData(currentUser);
  const goals=data.goals||[];
  const el=document.getElementById("child-goals-list");
  if(!el) return;
  if(!goals.length){
    el.innerHTML=emptyState("goals","No goals yet. Set one below!");
    return;
  }
  const sav=data.balances.savings||0;
  el.innerHTML=goals.map(g=>{
    const pct=Math.min(100,Math.round((sav/g.target)*100));
    return `<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
        <span>${escapeHtml(g.name)}</span>
        <span style="font-family:var(--mono);">${fmt(sav)} / ${fmt(g.target)}</span>
      </div>
      <div style="background:var(--surface);height:8px;border-radius:4px;overflow:hidden;">
        <div style="background:var(--secondary);height:100%;width:${pct}%;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;color:var(--muted);">
        <span>${pct}% there!</span>
        <button onclick="deleteGoal('${g.id}')" style="background:none;border:none;color:var(--danger);font-size:15px;cursor:pointer;font-family:var(--font);">Remove</button>
      </div>
    </div>`;
  }).join("");
}

function deleteGoal(goalId){
  const data=getChildData(activeChild||currentUser);
  data.goals=(data.goals||[]).filter(g=>g.id!==goalId);
  syncToCloud("Goal Removed");
  renderSavingsGoals(); renderParentGoals();
}

function addParentSavingsGoal(){
  const name=document.getElementById("parent-new-goal-name").value.trim();
  const amt=readMoney("parent-new-goal-amount");
  if(!name||!amt||amt<=0){ showToast("Enter a goal name and amount.","error"); return; }
  const data=getChildData(activeChild);
  if(!data.goals) data.goals=[];
  data.goals.push({id:"goal_"+Date.now(),name,target:amt,createdAt:todayStr()});
  document.getElementById("parent-new-goal-name").value="";
  document.getElementById("parent-new-goal-amount").value="";
  syncToCloud("Goal Added");
  renderParentGoals();
  showToast("Goal added! 🎯","success");
}

function renderParentGoals(){
  const data=getChildData(activeChild);
  const goals=data.goals||[];
  const el=document.getElementById("parent-goals-list");
  if(!el) return;
  if(!goals.length){
    el.innerHTML=emptyState("goals","No goals yet for this child.");
    return;
  }
  const sav=data.balances.savings||0;
  el.innerHTML=goals.map(g=>{
    const pct=Math.min(100,Math.round((sav/g.target)*100));
    return `<div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
        <span>${escapeHtml(g.name)}</span>
        <span style="font-family:var(--mono);">${fmt(sav)} / ${fmt(g.target)}</span>
      </div>
      <div style="background:var(--surface);height:8px;border-radius:4px;overflow:hidden;">
        <div style="background:var(--secondary);height:100%;width:${pct}%;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;color:var(--muted);">
        <span>${pct}% there!</span>
        <button onclick="deleteGoal('${g.id}')" style="background:none;border:none;color:var(--danger);font-size:15px;cursor:pointer;font-family:var(--font);">Remove</button>
      </div>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 14. LOANS
// ════════════════════════════════════════════════════════════════════
function calcMonthlyPayment(principal,annualRate,termMonths){
  if(!principal||!termMonths) return 0;
  const r=(annualRate/100)/12;
  if(r===0) return principal/termMonths;
  return (principal*r)/(1-Math.pow(1+r,-termMonths));
}

function updateLoanPaymentPreview(){
  const p=readMoney("loan-principal")||0;
  const r=parseFloat(document.getElementById("loan-rate").value)||0;
  const t=parseInt(document.getElementById("loan-term").value)||0;
  document.getElementById("loan-payment-preview").textContent=fmt(calcMonthlyPayment(p,r,t))+"/mo";
}

function populateLoanDueDayPicker(){
  const sel=document.getElementById("loan-due-day");
  if(!sel||sel.options.length>0) return;
  for(let i=1;i<=28;i++) sel.appendChild(new Option(i+(i===1?"st":i===2?"nd":i===3?"rd":"th"), String(i)));
  ["last-2","last-1","last"].forEach(v=>{
    const lbl = v==="last"?"Last day":v==="last-1"?"2nd to last":"3rd to last";
    sel.appendChild(new Option(lbl, v));
  });
}

function createLoan(){
  const name=document.getElementById("loan-name").value.trim();
  const p=readMoney("loan-principal");
  const r=parseFloat(document.getElementById("loan-rate").value);
  const t=parseInt(document.getElementById("loan-term").value);
  const dueDay=document.getElementById("loan-due-day").value;
  const msgEl=document.getElementById("loan-form-msg"); msgEl.className="field-msg";
  if(!name){ msgEl.className="field-msg error"; msgEl.textContent="Loan name is required."; return; }
  if(isNaN(r)||r<0){ msgEl.className="field-msg error"; msgEl.textContent="Enter a valid interest rate."; return; }
  if(!t||t<=0){ msgEl.className="field-msg error"; msgEl.textContent="Term must be at least 1 month."; return; }

  const data=getChildData(activeChild);
  if(!data.loans) data.loans=[];

  if(editingLoanId){
    // v30.1: Edit terms only — name, rate, term, dueDay.
    // Principal is locked (edit form disables that input).
    // Payment is recalculated from CURRENT balance + new terms — keeps audit trail intact.
    const loan=data.loans.find(l=>l.id===editingLoanId);
    if(!loan){ msgEl.className="field-msg error"; msgEl.textContent="Loan not found."; return; }
    loan.name=name;
    loan.rate=r;
    loan.termMonths=t;
    loan.dueDay=dueDay;
    loan.payment=calcMonthlyPayment(loan.balance, r, t);
    editingLoanId=null;
    setLoanFormMode("create");
    syncToCloud("Loan Edited");
    showToast("Loan updated. ✏️","success");
  } else {
    if(!p||p<=0){ msgEl.className="field-msg error"; msgEl.textContent="Principal must be greater than 0."; return; }
    data.loans.push({
      id:"loan_"+Date.now(),
      name, principal:p, balance:p, rate:r, termMonths:t, dueDay,
      payment:calcMonthlyPayment(p,r,t),
      createdAt:todayStr()
    });
    syncToCloud("Loan Created");
    showToast("Loan created. 💳","success");
  }
  resetLoanForm();
  renderParentLoans();
  // v32.2: Auto-close the creator sheet after successful save (create or edit)
  closeSheet("sheet-loan-creator", true);
}

function resetLoanForm(){
  ["loan-name","loan-principal","loan-rate","loan-term"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("loan-principal").disabled=false;
  document.getElementById("loan-payment-preview").textContent="$0.00/mo";
  setLoanFormMode("create");
}

function editLoan(loanId){
  const data=getChildData(activeChild);
  const loan=(data.loans||[]).find(l=>l.id===loanId);
  if(!loan) return;
  editingLoanId=loanId;
  document.getElementById("loan-name").value=loan.name||"";
  // Principal field shows balance (read-only visual cue) — users can see but not change
  const lpEl=document.getElementById("loan-principal");
  lpEl.value=loan.balance; lpEl.disabled=true; _reformatMoneyInput(lpEl); // v34.2
  const lrEl=document.getElementById("loan-rate");
  lrEl.value=loan.rate; _reformatPercentInput(lrEl); // v34.2
  document.getElementById("loan-term").value=loan.termMonths;
  document.getElementById("loan-due-day").value=loan.dueDay||"1";
  // Show payment preview using current balance
  const newPayment=calcMonthlyPayment(loan.balance,loan.rate,loan.termMonths);
  document.getElementById("loan-payment-preview").textContent=fmt(newPayment)+"/mo";
  setLoanFormMode("edit",loan.name);
  // v32.1: Reuse the loan creator bottom sheet for editing
  openSheet("sheet-loan-creator");
  showToast('Editing "'+loan.name+'" — principal locked; adjust terms and save.',"info",4000);
}

function cancelLoanEdit(){
  editingLoanId=null;
  resetLoanForm();
}

function setLoanFormMode(mode,name){
  const t=document.getElementById("loan-form-title");
  const sb=document.getElementById("loan-submit-btn");
  const cb=document.getElementById("loan-cancel-edit-btn");
  const hint=document.getElementById("loan-edit-hint");
  if(mode==="edit"){
    if(t)    t.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Editing: "+(name||"Loan");
    if(sb)   sb.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-floppy-disk'/></svg> Save Changes";
    if(cb)   cb.classList.remove("hidden");
    if(hint) hint.classList.remove("hidden");
  } else {
    if(t)    t.textContent="Create New Loan";
    if(sb)   sb.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-plus-circle'/></svg> Create Loan";
    if(cb)   cb.classList.add("hidden");
    if(hint) hint.classList.add("hidden");
  }
}

function renderParentLoans(){
  const data=getChildData(activeChild);
  const loans=data.loans||[];
  const el=document.getElementById("parent-loans-list");
  if(!el) return;
  if(!loans.length){
    el.innerHTML=emptyState("loans","No loans yet.");
    return;
  }
  el.innerHTML=loans.map(l=>`
    <div class="chore-card">
      <div class="chore-card-header">
        <span class="chore-card-name">${l.name}</span>
        <span class="chore-card-amount">${fmt(l.balance)}</span>
      </div>
      <div class="chore-card-meta">
        Original: ${fmt(l.principal)} • ${l.rate}% APR • ${l.termMonths} mo<br>
        Payment: ${fmt(l.payment)}/mo • Due: ${fmtNextPayment(l)}
      </div>
      <div class="row" style="gap:8px;margin-top:4px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="editLoan('${l.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Edit</button>
        <button class="btn btn-danger  btn-sm" onclick="deleteLoan('${l.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-trash'/></svg> Delete</button>
      </div>
    </div>`).join("");
}

function renderChildLoans(){
  const data=getChildData(activeChild||currentUser);
  const loans=data.loans||[];
  const el=document.getElementById("child-loans-list");
  if(!el) return;
  if(!loans.length){
    el.innerHTML=emptyState("loans","No loans right now.");
    return;
  }
  el.innerHTML=loans.map(l=>`
    <div class="chore-card">
      <div class="chore-card-header">
        <span class="chore-card-name">${l.name}</span>
        <span class="chore-card-amount">${fmt(l.balance)}</span>
      </div>
      <div class="chore-card-meta">
        Original: ${fmt(l.principal)} • ${l.rate}% APR<br>
        Payment: ${fmt(l.payment)}/mo • Next due: ${fmtNextPayment(l)}<br>
        <span class="loan-paid-split">
          <span>Principal paid: <strong>${fmt(l.totalPrincipalPaid||0)}</strong></span>
          <span>Interest paid: <strong>${fmt(l.totalInterestPaid||0)}</strong></span>
        </span>
      </div>
    </div>`).join("");
}

function applyLoanPayment(loanId){
  const amt=readMoney("child-amt");
  if(!amt||amt<=0){ showToast("Enter a payment amount.","error"); return; }
  const data=getChildData(currentUser);
  const loan=(data.loans||[]).find(l=>l.id===loanId);
  if(!loan){ showToast("Loan not found.","error"); return; }
  if(amt>data.balances.checking){ showToast("Not enough in checking.","error"); return; }

  // v33.0 — Standard amortization: split payment into interest + principal
  const monthlyRate    = (loan.rate || 0) / 100 / 12;
  const interestOwed   = loan.balance * monthlyRate;
  // Cap the payment at (balance + interest owed) so the child can't overpay
  const cappedPayment  = Math.min(amt, loan.balance + interestOwed);
  const interestPortion  = Math.min(cappedPayment, interestOwed);
  const principalPortion = Math.max(0, cappedPayment - interestPortion);

  data.balances.checking -= cappedPayment;
  loan.balance            = Math.max(0, loan.balance - principalPortion);
  loan.totalInterestPaid  = (loan.totalInterestPaid  || 0) + interestPortion;
  loan.totalPrincipalPaid = (loan.totalPrincipalPaid || 0) + principalPortion;

  // Log principal and interest as separate ledger lines so parents can see both
  if(principalPortion > 0){
    recordTransaction(currentUser, "Loan payment to " + loan.name + " (principal)",  -principalPortion);
  }
  if(interestPortion > 0){
    recordTransaction(currentUser, "Loan payment to " + loan.name + " (interest)",   -interestPortion);
  }
  syncToCloud("Loan Payment");
  if(cappedPayment < amt){
    showToast("Loan paid in full. " + fmt(amt - cappedPayment) + " returned to checking. 💳","success");
    data.balances.checking += (amt - cappedPayment);
  } else {
    showToast("Loan payment applied. 💳","success");
  }
  document.getElementById("child-amt").value="";
  populateChildLoanSelect();
}

function deleteLoan(loanId){
  const data=getChildData(activeChild);
  const loan=(data.loans||[]).find(l=>l.id===loanId);
  if(!loan) return;
  openModal({
    icon:"🗑️", title:"Delete loan?",
    body:'Delete "'+loan.name+'"? This cannot be undone.',
    confirmText:"Delete", confirmClass:"btn-danger",
    onConfirm:()=>{
      data.loans=data.loans.filter(l=>l.id!==loanId);
      syncToCloud("Loan Deleted");
      renderParentLoans();
      showToast("Loan deleted.","info");
    }
  });
}

function calcNextPaymentDate(loan){
  const now=new Date();
  const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const day=resolveMonthlyDay(loan.dueDay||"1",now.getFullYear(),now.getMonth());
  let next=new Date(now.getFullYear(),now.getMonth(),Math.min(day,dim));
  if(next<now) next=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day, new Date(now.getFullYear(),now.getMonth()+2,0).getDate()));
  return next;
}

function fmtNextPayment(loan){
  if(loan.balance<=0) return "Paid off ✓";
  const d=calcNextPaymentDate(loan);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

function populateChildLoanSelect(){
  const sel=document.getElementById("child-loan-select");
  if(!sel) return;
  const data=getChildData(currentUser);
  const loans=(data.loans||[]).filter(l=>l.balance>0);
  sel.innerHTML='<option value="">— Select a loan —</option>'+loans.map(l=>`<option value="${l.id}">${l.name} — ${fmt(l.balance)}</option>`).join("");
  document.getElementById("child-loan-info").style.display="none";
}

function onChildLoanSelect(){
  const id=document.getElementById("child-loan-select").value;
  const info=document.getElementById("child-loan-info");
  if(!id){ info.style.display="none"; return; }
  const data=getChildData(currentUser);
  const loan=(data.loans||[]).find(l=>l.id===id);
  if(!loan) return;
  document.getElementById("child-loan-payment").textContent=fmt(loan.payment);
  document.getElementById("child-loan-balance").textContent=fmt(loan.balance);
  document.getElementById("child-loan-due").textContent=fmtNextPayment(loan);
  info.style.display="block";
}

// ════════════════════════════════════════════════════════════════════
// 15. HISTORY (LEDGER DRAWER)
// ════════════════════════════════════════════════════════════════════
function openHistory(){
  populateHistoryDateFilters();
  renderHistory();
  document.getElementById("history-drawer").classList.add("open");
}
function closeHistory(){ document.getElementById("history-drawer").classList.remove("open"); }

function populateHistoryDateFilters(){
  const sel=document.getElementById("f-date");
  if(!sel) return;
  const child=activeChild||currentUser;
  const rows=state.history[child]||[];
  sel.innerHTML='<option value="all">All Time</option>';
  const months=new Set(), years=new Set();
  rows.forEach(r=>{
    let d=null; try{ d=new Date(r.date); }catch(e){}
    if(d&&!isNaN(d)){
      months.add(d.getFullYear()+"-"+d.getMonth());
      years.add(d.getFullYear());
    }
  });
  Array.from(months).sort().reverse().forEach(m=>{
    const [yr,mo]=m.split("-").map(Number);
    const lbl=new Date(yr,mo,1).toLocaleDateString("en-US",{month:"short",year:"numeric"});
    sel.appendChild(new Option(lbl,"month-"+yr+"-"+mo));
  });
  Array.from(years).sort().reverse().forEach(y=>{
    sel.appendChild(new Option("All "+y,"year-"+y));
  });
}

function renderHistory(){
  const child=activeChild||currentUser;
  const rows=[...(state.history[child]||[])];
  const sort=document.getElementById("f-sort").value;
  const fAcct=document.getElementById("f-acct").value;
  const fType=document.getElementById("f-type").value;
  const fDate=document.getElementById("f-date")?.value || "all";
  const filtered=rows.filter(h=>{
    const n=(h.note||"").toLowerCase();
    const isSav=n.includes("(sav)")||n.includes("to savings")||n.includes("to sav")||n.includes("interest (sav)");
    if(fAcct==="chk" && isSav) return false;
    if(fAcct==="sav" && !isSav) return false;
    if(fType==="pos" && h.amt<0) return false;
    if(fType==="neg" && h.amt>=0) return false;
    if(fDate!=="all"){
      let d=null; try{ d=new Date(h.date); }catch(e){}
      if(d&&!isNaN(d)){
        if(fDate.startsWith("month-")){
          const parts=fDate.split("-");
          const yr=parseInt(parts[1]); const mo=parseInt(parts[2]);
          if(d.getFullYear()!==yr || d.getMonth()!==mo) return false;
        } else if(fDate.startsWith("year-")){
          const yr=parseInt(fDate.split("-")[1]);
          if(d.getFullYear()!==yr) return false;
        }
      }
    }
    return true;
  });
  if(sort==="new") filtered.reverse();
  const totalIn=filtered.filter(r=>r.amt>0).reduce((s,r)=>s+r.amt,0);
  const totalOut=filtered.filter(r=>r.amt<0).reduce((s,r)=>s+r.amt,0);
  const net=totalIn+totalOut;
  document.getElementById("hist-in").textContent="+"+fmt(totalIn);
  document.getElementById("hist-out").textContent=fmt(totalOut);
  document.getElementById("hist-net").textContent=(net>=0?"+":"")+fmt(net);
  document.getElementById("hist-net").className="chip-val "+(net>=0?"pos":"neg");
  const listEl=document.getElementById("ledger-list");
  if(!filtered.length){
    listEl.innerHTML=emptyState("history","No transactions match these filters.");
    return;
  }
  // v31.2: compute goal-hit signatures once per render
  const childForLedger = activeChild || currentUser;
  const goalSigs = computeGoalHitSignatures(childForLedger);
  listEl.innerHTML=filtered.map(h=>{
    const n=(h.note||"").toLowerCase();
    const isSav=n.includes("(sav)")||n.includes("to savings")||n.includes("to sav")||n.includes("interest (sav)");
    const isChore=n.includes("chore:");
    const pillCls = isChore ? "acct-pill chore" : isSav ? "acct-pill sav" : "acct-pill";
    const goalName = goalHitForRow(childForLedger, h, goalSigs);
    const goalBadge = goalName ? `<span class="goal-hit-badge" title="Goal reached: ${escapeHtml(goalName)}"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-target'/></svg> Goal: ${escapeHtml(goalName)}</span>` : "";   // v38.2-6 — goal name is user-typed; escape it like h.user/h.note (m-5 miss, audit #5)
    return `<div class="ledger-row${goalName?' ledger-row-goal':''}">
      <div class="${pillCls}">${isChore?"CHORE":isSav?"SAV":"CHK"}</div>
      <div><span class="ledger-date">${fmtLedgerDate(h.date)}</span><span class="ledger-who-wrap">${renderAvatar(h.user,"xs")}<span class="ledger-who">${escapeHtml(h.user)}</span></span><span class="ledger-note"> — ${escapeHtml(h.note)}</span>${goalBadge}</div>
      <div class="ledger-amt ${h.amt>=0?"pos":"neg"}">${h.amt>=0?"+":""}${fmt(h.amt)}</div>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 16. NET WORTH CHART (Chart.js)
// ════════════════════════════════════════════════════════════════════
function setNwFilter(btn,months){
  document.querySelectorAll(".nw-filter-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  nwFilterMonths=months;
  drawNetWorthChart();
}

function openNetWorthChart(){
  document.getElementById("networth-drawer").classList.add("open");
  // Defer chart draw so the canvas has measured dimensions
  setTimeout(drawNetWorthChart,80);
}

function closeNetWorthChart(){
  document.getElementById("networth-drawer").classList.remove("open");
  if(nwChartInstance){ nwChartInstance.destroy(); nwChartInstance=null; }
}

function drawNetWorthChart(){
  const child=activeChild||currentUser;
  if(!child) return;   // v38.1 final (In-7) — nothing to draw before login / after logout
  let history=(state.netWorthHistory && state.netWorthHistory[child]) || [];
  const monthNames=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Build 3 future months for projection
  const now=new Date();
  const futureMonths=[];
  for(let i=1;i<=3;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    futureMonths.push({
      month:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),
      total:null, future:true
    });
  }

  // Apply time-window filter
  if(nwFilterMonths>0 && history.length>0){
    const cutoff=new Date();
    cutoff.setMonth(cutoff.getMonth()-nwFilterMonths);
    const cutoffKey=cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0");
    history=history.filter(d=>d.month>=cutoffKey);
  }

  const canvas=document.getElementById("networth-canvas");
  if(!canvas) return;

  // Empty state
  if(!history.length){
    if(nwChartInstance){ nwChartInstance.destroy(); nwChartInstance=null; }
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    canvas.parentElement.innerHTML=emptyState("chart","No history yet — keep saving!","padding:60px 0;");
    const _z=(id,t)=>{ const el=document.getElementById(id); if(el) el.textContent=t; };
    _z("nw-start","$0.00"); _z("nw-current","$0.00"); _z("nw-growth","+$0.00");
    return;
  }

  // Combine actuals + projection — single dataset, with nulls for future
  const labels=[...history,...futureMonths].map(d=>{
    const [yr,mm]=d.month.split("-");
    return monthNames[parseInt(mm)] + (mm==="01" ? " '"+yr.slice(2) : "");
  });
  const actuals=[...history.map(d=>d.total), ...futureMonths.map(()=>null)];

  // v30.1: single-point data looks lonely; enlarge the dot and widen the default radius
  const singlePoint = history.length === 1;

  // Brand color
  const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#2563eb";

  // Destroy any existing instance
  if(nwChartInstance){ nwChartInstance.destroy(); nwChartInstance=null; }

  const ctx=canvas.getContext("2d");
  nwChartInstance = new Chart(ctx, {
    type:"line",
    data:{
      labels,
      datasets:[{
        label:"Net Worth",
        data:actuals,
        borderColor:primary,
        backgroundColor:hexToRgba(primary,0.12),
        borderWidth:2.5,
        fill:true,
        tension:0.35,
        spanGaps:false,
        pointRadius: actuals.map((v,i)=> i===history.length-1 ? 5 : 3),
        pointBackgroundColor:primary,
        pointBorderColor:"#fff",
        pointBorderWidth:2,
        pointHoverRadius:6
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{intersect:false, mode:"index"},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:"#1e293b",
          titleFont:{family:"DM Sans", size:12, weight:"700"},
          bodyFont:{family:"DM Mono", size:13},
          padding:10, cornerRadius:8, displayColors:false,
          callbacks:{
            label:(ctx)=> ctx.parsed.y===null ? "—" : fmt(ctx.parsed.y)
          }
        }
      },
      scales:{
        x:{
          grid:{display:false},
          ticks:{
            font:{family:"DM Sans", size:11},
            color:"#64748b",
            maxRotation:0
          }
        },
        y:{
          grid:{color:"#f1f5f9", drawBorder:false},
          ticks:{
            font:{family:"DM Mono", size:11},
            color:"#64748b",
            callback:(v)=> "$"+v.toLocaleString("en-US",{maximumFractionDigits:0})
          },
          beginAtZero:false
        }
      },
      animation:{duration:600, easing:"easeOutCubic"}
    }
  });

  // Summary chips
  const first=history[0].total;
  const last=history[history.length-1].total;
  const growth=last-first;
  document.getElementById("nw-start").textContent=fmt(first);
  document.getElementById("nw-current").textContent=fmt(last);
  document.getElementById("nw-growth").textContent=(growth>=0?"+":"")+fmt(growth);
  document.getElementById("nw-growth").className="chip-val "+(growth>=0?"pos":"neg");
}

function hexToRgba(hex,alpha){
  hex=hex.replace("#","");
  const r=parseInt(hex.slice(0,2),16);
  const g=parseInt(hex.slice(2,4),16);
  const b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ════════════════════════════════════════════════════════════════════
// 17. STREAKS
// ════════════════════════════════════════════════════════════════════
function renderStreaks(){
  const data=getChildData(activeChild||currentUser);
  const chores=data.chores||[];
  return chores
    .filter(c=>c.streakMilestone && c.streakMilestone>0)
    .map(c=>{
      const effective=(parseInt(c.streakCount)||0) + (parseInt(c.streakStart)||0);
      const milestone=parseInt(c.streakMilestone);
      const remaining=milestone - (effective % milestone);
      return {
        name:c.name,
        streak:effective,
        unit: remaining===milestone ? "🎯" : `(${remaining} to bonus)`
      };
    });
}

/**
 * v32.2: Inline streak line for a single chore — shown inside the chore card
 * body (replaces the deleted top-of-page pill row). Only renders when the
 * chore has milestone tracking enabled OR a nonzero streak already accrued.
 */
function renderInlineStreak(c){
  if(!c) return "";
  const effective = (parseInt(c.streakCount)||0) + (parseInt(c.streakStart)||0);
  const milestone = parseInt(c.streakMilestone) || 0;
  // Only show if streak tracking is enabled or user already has progress
  if(milestone <= 0 && effective <= 0) return "";
  let suffix = "";
  if(milestone > 0){
    const remaining = milestone - (effective % milestone);
    suffix = remaining === milestone
      ? ` <span style="color:var(--warning);">🎯 milestone!</span>`
      : ` <span style="color:var(--muted);">(${remaining} to bonus)</span>`;
  }
  return `<div class="chore-desc-small" style="color:#92400e;font-weight:600;"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-fire'/></svg> Streak: ${effective}${suffix}</div>`;
}

// ════════════════════════════════════════════════════════════════════
// 18. ADMIN
// ════════════════════════════════════════════════════════════════════
// ── v38 Step 5 (Sill) — global-admin session ────────────────────────
// The new admin routes (adminLoad, adminListPendingSignups, adminApprove,
// adminDeny, adminRevealSignupPin, …) are PIN-gated server-side. There is
// no server session, so the validated admin PIN is held in memory for the
// life of the panel session and passed to every admin route call.
// NEVER persisted (no localStorage). Cleared on open and on close.
let _adminSessionPin = null;   // set on successful adminLoad
let _adminSummary    = null;   // {adminEmail, familyCount, queueLength} from adminLoad
const _revealTimers  = {};     // signupId -> re-mask setTimeout handle
function _clearRevealTimers(){ for(const k in _revealTimers){ clearTimeout(_revealTimers[k]); delete _revealTimers[k]; } }

function openAdmin(){
  // v32.4: Admin is now a bottom sheet (sheet-admin), not a drawer.
  // Still reset to locked state every open.
  _adminSessionPin=null; _adminSummary=null; _clearRevealTimers(); // v38 Step 5 — open locked, drop any stale session
  document.getElementById("admin-login-section").classList.remove("hidden");
  document.getElementById("admin-settings-section").classList.add("hidden");
  document.getElementById("admin-pin-input").value="";
  document.getElementById("admin-pin-error").className="field-msg";
  openSheet("sheet-admin");
  // v34.1 Item 17 — autofocus the PIN field after the sheet slide-in completes
  setTimeout(()=>{
    const pin=document.getElementById("admin-pin-input");
    if(pin) pin.focus();
  }, 300);
}
function closeAdmin(){ _adminSessionPin=null; _adminSummary=null; _clearRevealTimers(); closeSheet("sheet-admin", true); }

// v38 Step 5 (Sill) — admin login now validates the GLOBAL admin PIN
// (AdminConfig!A2) server-side via the adminLoad route. The old client-side
// check against state.config.adminPin is gone — v38 families carry no
// per-family admin PIN. On success the PIN is held in the in-memory session
// and the panel renders. Wrong PIN -> generic auth failure (no leakage).
async function attemptAdminLogin(){
  const pin   = document.getElementById("admin-pin-input").value;
  const errEl = document.getElementById("admin-pin-error");
  if(!/^\d{4}$/.test(pin||"")){
    errEl.className="field-msg error";
    errEl.textContent="Enter the 4-digit Admin PIN.";
    return;
  }
  errEl.className="field-msg";
  try{
    const url = API_URL+"?action=adminLoad&adminPin="+encodeURIComponent(pin);
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.status==="ok"){
      _adminSessionPin = pin;                       // establish session
      _adminSummary    = { adminEmail:data.adminEmail||"", familyCount:data.familyCount||0, queueLength:data.queueLength||0 };
      document.getElementById("admin-login-section").classList.add("hidden");
      document.getElementById("admin-settings-section").classList.remove("hidden");
      populateAdminForm();    // per-family settings (kept this drop — see Step 5 handoff open item)
      renderAdminUsers();     // per-family user list (kept this drop)
      renderAdminQueue();     // v38 Step 5 — server-backed signup queue (replaces renderPendingRequests)
      renderFamilyList();     // v38 Step 5 — global family list (drop 2)
      populateAdminAccount(); // v38 Step 5 drop 3 (Lintel) — global admin email/PIN card
    } else {
      errEl.className="field-msg error";
      errEl.textContent="Incorrect Admin PIN.";   // generic — adminLoad returns auth for bad format AND wrong PIN
      document.getElementById("admin-pin-input").value="";
    }
  }catch(e){
    errEl.className="field-msg error";
    errEl.textContent="Network error — try again.";
  }
}

function populateAdminForm(){
  const cfg=state.config;
  document.getElementById("admin-bank-name").value      = cfg.bankName       || "";
  document.getElementById("admin-bank-tagline").value   = cfg.tagline        || "";
  document.getElementById("admin-color-primary").value  = cfg.colorPrimary   || CFG_COLOR_PRIMARY;
  document.getElementById("admin-color-secondary").value= cfg.colorSecondary || CFG_COLOR_SECONDARY;
  document.getElementById("admin-img-banner").value     = cfg.imgBanner      || "";
  document.getElementById("admin-img-logo").value       = cfg.imgLogo        || "";
  document.getElementById("admin-timezone").value       = cfg.timezone       || CFG_TIMEZONE;
  document.getElementById("admin-autologout").value     = String(cfg.autoLogout||0);
  // v32.4 item #8: Admin Email
  const aeEl = document.getElementById("admin-email-input");
  if(aeEl) aeEl.value = cfg.adminEmail || "";
  const aeMsg = document.getElementById("admin-email-msg");
  if(aeMsg) aeMsg.className = "field-msg";
  // v32: admin-celebration-sound removed — celebration sound is now per-user
  // (see user edit form + child profile sheet)
}

function renderAdminUsers(){
  const el=document.getElementById("admin-user-list");
  if(!el) return;
  el.innerHTML=state.users.map(u=>{
    const role=state.roles[u]||"child";
    const stats=(state.config.loginStats && state.config.loginStats[u]) || null;
    const lastSeen = stats && stats.lastAt
      ? new Date(stats.lastAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + " " + new Date(stats.lastAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})
      : "never";
    const count = stats ? (parseInt(stats.count)||0) : 0;
    return `<div class="user-row">
      <div style="flex:1;display:flex;align-items:center;gap:8px;">
        ${renderAvatar(u,"sm")}
        <div class="user-row-info">
          <div>
            <strong>${escapeHtml(u)}</strong>
            <span class="user-role-badge ${role==="parent"?"role-parent":"role-child"}" style="margin-left:4px;">${role.charAt(0).toUpperCase()+role.slice(1)}</span>
          </div>
          <div class="user-row-substats">Last seen: ${lastSeen} · ${count} login${count===1?"":"s"}</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="uwOpenEdit('${u}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Edit</button>
      ${state.users.length>1 ? `<button class="btn btn-danger btn-sm" onclick="adminRemoveUser('${u}')">Remove</button>` : ""}
    </div>`;
  }).join("");
}

function adminRemoveUser(u){
  openModal({
    icon:"⚠️", title:"Remove "+u+"?",
    body:"Removes this user login. History remains.",
    confirmText:"Remove", confirmClass:"btn-danger",
    onConfirm:()=>{
      state.users=state.users.filter(x=>x!==u);
      delete state.pins[u];
      delete state.roles[u];
      delete (state.config.emails||{})[u];
      renderAdminUsers();
      syncToCloud("User Removed");
      showToast(u+" removed.","info");
    }
  });
}

// Preserved as a stub in case legacy callers exist.
function addUser(){ uwOpenAdd(); }   // v38.1 — wizard v2 (legacy add/edit user sheet removed in v38.1 final)

function saveAdminSettings(){
  // v32.4 item #8: validate admin email if present (empty is OK — feature just disabled)
  const aeInput = document.getElementById("admin-email-input");
  const aeMsg   = document.getElementById("admin-email-msg");
  const aeVal   = aeInput ? aeInput.value.trim() : "";
  if(aeVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aeVal)){
    if(aeMsg){ aeMsg.className="field-msg error"; aeMsg.textContent="Please enter a valid email address."; }
    showToast("Invalid admin email.","error");
    return;
  }
  if(aeMsg) aeMsg.className="field-msg";
  state.config.adminEmail     = aeVal;
  state.config.bankName       = document.getElementById("admin-bank-name").value.trim()    || CFG_BANK_NAME;
  state.config.tagline        = document.getElementById("admin-bank-tagline").value.trim() || "";
  state.config.colorPrimary   = document.getElementById("admin-color-primary").value;
  state.config.colorSecondary = document.getElementById("admin-color-secondary").value;
  state.config.imgBanner      = document.getElementById("admin-img-banner").value.trim()   || CFG_IMG_BANNER;
  state.config.imgLogo        = document.getElementById("admin-img-logo").value.trim()     || CFG_IMG_LOGO;
  state.config.timezone       = document.getElementById("admin-timezone").value;
  state.config.autoLogout     = parseInt(document.getElementById("admin-autologout").value) || 0;
  // v32: celebrationSound removed from global config — now per-user in user edit form
  if(window._pickerSelections) window._pickerSelections={};
  applyBranding();
  syncToCloud("Admin Settings Updated");
  showToast("All settings saved! 💾","success");
  initInactivityTimer(); // v34.2 — apply new auto-logout setting immediately
}

function changeAdminPin(){
  openInputModal({
    icon:"🔑", title:"New Admin PIN",
    body:"Enter a new 4-digit admin PIN.",
    inputType:"password", inputAttrs:'maxlength="4" inputmode="numeric" placeholder="••••"',
    confirmText:"Save",
    onConfirm:v=>{
      if(!v||v.length!==4||!/^\d{4}$/.test(v)){ showToast("Admin PIN must be exactly 4 digits.","error"); return; }
      state.config.adminPin=v;
      syncToCloud("Admin PIN Changed");
      showToast("Admin PIN updated.","success");
    }
  });
}

/* Re-renders whatever is visible so avatars update immediately. */
function refreshVisibleAvatars(){
  if(typeof renderBalances==="function") renderBalances();
  if(typeof renderHistory==="function" && document.getElementById("history-drawer")?.classList.contains("open")) renderHistory();
  if(typeof renderParentChores==="function" && activeChild) renderParentChores();
}

// v31.1: child can edit their own avatar from the Money tab (no admin PIN).
// Scope-locked: only currentUser (when role is child). Cannot edit siblings.
function renderChildAvatar(){
  if(currentRole!=="child" || !currentUser) return;
  const cur = document.getElementById("child-avatar-current");
  const grid = document.getElementById("child-avatar-grid");
  if(!cur || !grid) return;
  const hasPhoto = !!getAvatarPhoto(currentUser);
  const selected = getAvatarEmoji(currentUser);
  cur.innerHTML = renderAvatar(currentUser,"lg") +
    `<div class="label-stack">
       <div class="who">${currentUser}</div>
       <div class="src">${hasPhoto ? "Using device photo — emoji shown if photo removed" : "Using emoji"}</div>
     </div>`;
  grid.innerHTML = AVATAR_EMOJIS.map(e =>
    `<button type="button" class="${e===selected?"selected":""}" onclick="childSelectAvatarEmoji('${e}')">${e}</button>`
  ).join("");
}

function childSelectAvatarEmoji(emoji){
  if(currentRole!=="child" || !currentUser) return;  // scope guard
  setAvatarEmoji(currentUser, emoji);
  syncToCloud("Avatar Changed");
  renderChildAvatar();
  refreshVisibleAvatars();
  // Update welcome message live
  const wm = document.getElementById("welcome-msg");
  if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+escapeHtml(currentUser)+'! 👋</span>';
  showToast("Avatar updated!","success");
}

async function onChildAvatarPhotoChosen(event){
  if(currentRole!=="child" || !currentUser){ event.target.value=""; return; }
  const file = event.target.files && event.target.files[0];
  if(!file) return;
  try {
    const dataUrl = await resizeImageFileTo200(file);
    setAvatarPhoto(currentUser, dataUrl);
    showToast("Photo saved on this device.","success");
    renderChildAvatar();
    refreshVisibleAvatars();
    const wm = document.getElementById("welcome-msg");
    if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+escapeHtml(currentUser)+'! 👋</span>';
  } catch(e){
    showToast("Could not process photo.","error");
  }
  event.target.value = "";
}

function removeChildAvatarPhoto(){
  if(currentRole!=="child" || !currentUser) return;
  clearAvatarPhoto(currentUser);
  showToast("Photo removed from this device.","info");
  renderChildAvatar();
  refreshVisibleAvatars();
  const wm = document.getElementById("welcome-msg");
  if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+escapeHtml(currentUser)+'! 👋</span>';
}

// ════════════════════════════════════════════════════════════════════
// 19. MULTI-SELECT PICKER (children, tabs)
// ════════════════════════════════════════════════════════════════════
const PICKER_CONFIG = {
  children: {
    title:"Select Children",
    hint:"Tap to toggle. No selection = parent sees no children.",
    displayId:"edit-child-display",
    noItemsText:"No children added yet.",
    getItems: ()=> getChildNames().map(c=>({value:c, label:c}))
  },
  tabs: {
    title:"Select Visible Tabs",
    hint:"Tap to toggle. Money and Chores are on by default.",
    displayId:"edit-tab-display",
    noItemsText:"",
    getItems: ()=> [
      {value:"money",  label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-money"/></svg> Money`},
      {value:"chores", label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-check-circle"/></svg> Chores`},
      {value:"loans",  label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-bank"/></svg> Loans`}
    ]
  },
  // v30.1: separate picker mode for parent Settings tab — different displayId,
  // same items. Keeps state isolated from the admin edit flow.
  profileTabs: {
    title:"Select Visible Tabs",
    hint:"Controls which tabs this child sees on login.",
    displayId:"profile-tab-display",
    noItemsText:"",
    getItems: ()=> [
      {value:"money",  label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-money"/></svg> Money`},
      {value:"chores", label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-check-circle"/></svg> Chores`},
      {value:"loans",  label:`<svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-bank"/></svg> Loans`}
    ]
  },
  // v34.1 Item 16 — admin add-child: assign the new child to one or more parents.
  // Blank selection = auto-assign to current admin user only.
  assignParents: {
    title:"Assign to Parent(s)",
    hint:"Tap to toggle. Leave empty to auto-assign to you only.",
    displayId:"edit-child-parents-display",
    noItemsText:"No parent accounts available.",
    getItems: ()=> (state.users||[])
      .filter(u => state.roles && state.roles[u] === "parent")
      .map(u => ({value:u, label:u}))
  }
};

function openPicker(mode){
  pickerMode=mode;
  const cfg=PICKER_CONFIG[mode];
  if(!cfg) return;
  pickerSelected=[...((window._pickerSelections && window._pickerSelections[mode]) || [])];
  document.getElementById("picker-title").textContent=cfg.title;
  document.getElementById("picker-hint").textContent=cfg.hint;
  const items=cfg.getItems();
  const listEl=document.getElementById("picker-items");
  if(!items.length){
    listEl.innerHTML=`<p style="color:var(--muted);font-size:16px;text-align:center;padding:20px 0;">${cfg.noItemsText}</p>`;
  } else {
    listEl.innerHTML=items.map(item=>`
      <div class="picker-item" onclick="togglePickerItem('${item.value}',this)">
        <div class="picker-item-check ${pickerSelected.indexOf(item.value)!==-1?'checked':''}" id="pck-${item.value}"></div>
        <span>${item.label}</span>
      </div>`).join("");
  }
  document.getElementById("picker-overlay").classList.add("open");
}

function togglePickerItem(value,row){
  const checkEl=document.getElementById("pck-"+value);
  const idx=pickerSelected.indexOf(value);
  if(idx===-1){ pickerSelected.push(value); if(checkEl) checkEl.classList.add("checked"); }
  else        { pickerSelected.splice(idx,1); if(checkEl) checkEl.classList.remove("checked"); }
}

function closePicker(){
  if(!pickerMode) return;
  const cfg=PICKER_CONFIG[pickerMode];
  if(!window._pickerSelections) window._pickerSelections={};
  window._pickerSelections[pickerMode]=[...pickerSelected];
  updatePickerDisplay(pickerMode, pickerSelected, cfg);
  document.getElementById("picker-overlay").classList.remove("open");
  pickerMode=null;
}

function pickerOverlayClick(e){
  if(e.target===document.getElementById("picker-overlay")) closePicker();
}

function updatePickerDisplay(mode,selected,cfg){
  const displayEl=document.getElementById(cfg.displayId);
  if(!displayEl) return;
  if(!selected.length){
    displayEl.innerHTML=`<span style="font-size:15px;color:var(--muted);font-style:italic;">None selected</span>`;
    return;
  }
  const items=cfg.getItems();
  displayEl.innerHTML=selected.map(v=>{
    const item=items.find(i=>i.value===v);
    return item ? `<span style="background:var(--primary);color:white;border-radius:20px;padding:4px 12px;font-size:15px;font-weight:700;">${item.label}</span>` : "";
  }).join("");
}

function getPickerSelections(mode){
  return (window._pickerSelections && window._pickerSelections[mode]) || [];
}

// ════════════════════════════════════════════════════════════════════
// 20. PWA INSTALL + SERVICE WORKER AUTO-UPDATE
// ════════════════════════════════════════════════════════════════════
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  showInstallBanner();
});
function showInstallBanner(){
  if(sessionStorage.getItem("installDismissed")) return;
  document.getElementById("install-banner")?.classList.remove("hidden");
}
function triggerInstall(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(()=>{
    document.getElementById("install-banner").classList.add("hidden");
    deferredInstallPrompt=null;
  });
}
function dismissInstallBanner(){
  sessionStorage.setItem("installDismissed","1");
  document.getElementById("install-banner").classList.add("hidden");
}
const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
if(isIos && !isStandalone && !sessionStorage.getItem("installDismissed")){
  setTimeout(()=>{
    const b=document.getElementById("install-banner");
    if(b){
      document.getElementById("install-banner-text").textContent='Tap Share then "Add to Home Screen" to install.';
      document.getElementById("install-btn").classList.add("hidden");
      b.classList.remove("hidden");
    }
  },2000);
}

// Register SW + listen for update messages
let pendingUpdate = false;
let lastActivityAt = Date.now();
const IDLE_THRESHOLD_MS = 30*1000;  // 30 seconds of no taps before auto-applying update

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
    // v38.1 final (In-6) — when a new SW takes control, reload ONCE so the page
    // runs the code that matches the new cache. sessionStorage flag = no loops.
    const _hadController = !!navigator.serviceWorker.controller;   // first install: no reload needed
    navigator.serviceWorker.addEventListener("controllerchange", ()=>{
      if(!_hadController) return;
      let done=false; try{ done = sessionStorage.getItem("fb_sw_reloaded")==="1"; }catch(_){}
      if(done) return;
      try{ sessionStorage.setItem("fb_sw_reloaded","1"); }catch(_){}
      location.reload();
    });
    navigator.serviceWorker.addEventListener("message", e=>{
      if(e.data && e.data.type==="NEW_VERSION_AVAILABLE"){
        pendingUpdate=true;
        const banner=document.getElementById("update-banner");
        const txt=document.getElementById("update-banner-text");
        if(txt) txt.textContent="Version "+e.data.newVersion+" is ready.";
        if(banner) banner.classList.add("show");
        scheduleIdleUpdate();
      }
    });
  });
}

function bumpActivity(){ lastActivityAt = Date.now(); }
["click","touchstart","keydown","scroll"].forEach(ev=>document.addEventListener(ev,bumpActivity,{passive:true}));

function scheduleIdleUpdate(){
  if(!pendingUpdate) return;
  setTimeout(()=>{
    if(!pendingUpdate) return;
    if(Date.now()-lastActivityAt >= IDLE_THRESHOLD_MS){
      applyUpdateNow();
    } else {
      scheduleIdleUpdate();  // not idle yet — check again
    }
  }, 5000);
}

function applyUpdateNow(){
  pendingUpdate=false;
  if(navigator.serviceWorker && navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({type:"CLEAR_CACHE_AND_RELOAD"});
  } else {
    location.reload();
  }
}

// ════════════════════════════════════════════════════════════════════
// 21. AUTO-LOGOUT TIMER
// ════════════════════════════════════════════════════════════════════
// v34.2 — Auto-logout with 30-second countdown warning modal
const LOGOUT_WARN_SECS = 30;

function _cancelLogoutCountdown(){
  clearTimeout(inactivityWarnTimer);
  clearInterval(inactivityCountdown);
  inactivityWarnTimer = null;
  inactivityCountdown = null;
}

function _startLogoutWarning(){
  let secsLeft = LOGOUT_WARN_SECS;
  // Open warning modal — no cancel button, user dismisses by tapping "Stay Logged In"
  openModal({
    icon: "⏱️",
    title: "Still there?",
    body: `You'll be logged out in ${secsLeft} seconds due to inactivity.`,
    confirmText: "Stay Logged In",
    confirmClass: "btn-primary",
    hideCancel: true,
    onConfirm: () => {
      closeModal();
      _cancelLogoutCountdown();
      resetInactivityTimer();
    }
  });
  // Tick countdown every second, update modal body
  inactivityCountdown = setInterval(() => {
    secsLeft--;
    const bodyEl = document.getElementById("modal-body");
    if(bodyEl) bodyEl.textContent = `You'll be logged out in ${secsLeft} second${secsLeft===1?"":"s"} due to inactivity.`;
    if(secsLeft <= 0){
      _cancelLogoutCountdown();
      closeModal();
      showToast("Logged out due to inactivity.","info",3000);
      logout();
      setTimeout(()=>location.reload(),1500);
    }
  }, 1000);
}

function resetInactivityTimer(){
  if(!currentUser) return;          // v38 Bug-7: no session, no timer
  const mins=parseInt((state.config && state.config.autoLogout)||0);
  if(!mins) return;
  _cancelLogoutCountdown();
  clearTimeout(inactivityTimer);
  // Warn 30s before logout
  const warnMs = Math.max((mins*60 - LOGOUT_WARN_SECS)*1000, 0);
  inactivityWarnTimer = setTimeout(_startLogoutWarning, warnMs);
  // Hard reload fallback in case modal is dismissed but countdown cancelled
  inactivityTimer = setTimeout(()=>{
    _cancelLogoutCountdown();
    closeModal();
    showToast("Logged out due to inactivity.","info",3000);
    logout();
    setTimeout(()=>location.reload(),1500);
  }, mins*60*1000);
}
function initInactivityTimer(){
  // v34.2 — idempotent: remove old listeners before (re-)attaching so changing
  // the admin setting during a live session takes effect immediately.
  ["click","touchstart","keydown","scroll"].forEach(ev=>
    document.removeEventListener(ev, resetInactivityTimer)
  );
  _cancelLogoutCountdown();
  clearTimeout(inactivityTimer);
  if(!currentUser) return;          // v38 Bug-7: no session, no timer
  const mins=parseInt((state.config && state.config.autoLogout)||0);
  if(!mins) return; // disabled — timers already cleared above
  ["click","touchstart","keydown","scroll"].forEach(ev=>
    document.addEventListener(ev, resetInactivityTimer, {passive:true})
  );
  resetInactivityTimer();
}

// ════════════════════════════════════════════════════════════════════
// 21b. v31.2 — USABILITY FEATURES
//   • Goal-aware split default (helper)
//   • Weekly stats + child streak banner + parent "this week at a glance"
//   • Goal-hit badges in ledger
//   • In-app help drawer
//   • Long-press quick-approve from chore badge
//   • Monthly statement PDF (jsPDF — vendor/jspdf.umd.min.js must exist)
// ════════════════════════════════════════════════════════════════════

// ── Goal awareness ──────────────────────────────────────────────────
function hasUnmetGoal(childName){
  if(!childName) return false;
  const goals = (getChildData(childName).goals) || [];
  const sav   = (getChildData(childName).balances?.savings) || 0;
  return goals.some(g => (parseFloat(g.target)||0) > sav);
}

// ── Week stats (derived from existing history; no schema change) ────
/* Returns {choresDone, earned, pending, weekStart, weekEnd} for the
   child's last 7 days (rolling, not ISO week). */
function computeWeekStats(childName){
  if(!childName) return {choresDone:0, earned:0, pending:0};
  const data = getChildData(childName);
  const hist = (state.history && state.history[childName]) || [];
  const now  = new Date();
  const start = new Date(now); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
  const inWindow = d => {
    // history dates are stored via fmtDate — try to parse, fall back to false
    const dt = new Date(d);
    return !isNaN(dt) && dt >= start && dt <= now;
  };
  const choreRows = hist.filter(h => inWindow(h.date) && /chore:/i.test(h.note||""));
  // Dedup chore credits: a chore can hit ledger twice (chk+sav), count the name+date pair once
  const seen = new Set();
  let choresDone = 0, earned = 0;
  for(const h of choreRows){
    const key = (h.date||"") + "|" + (h.note||"").replace(/\(chk\)|\(sav\)/ig,"").trim();
    if(!seen.has(key)) { seen.add(key); choresDone++; }
    earned += (parseFloat(h.amt)||0);
  }
  const pending = ((data.chores)||[]).filter(c=>c.status==="pending").length;
  return {choresDone, earned, pending, weekStart:start, weekEnd:now};
}

// ── Child: weekly streak banner (chore tab top) ─────────────────────
function renderWeeklyStreakBanner(){
  const el = document.getElementById("child-weekly-summary");
  if(!el) return;
  const child = activeChild || currentUser;
  if(!child || currentRole!=="child"){ el.innerHTML=""; return; }
  const s = computeWeekStats(child);
  if(s.choresDone<=0){ el.innerHTML=""; return; }
  const showEarn = choreRewardsEnabled(child);
  el.innerHTML = `<div class="weekly-streak-banner">
    <svg class="icon icon-lg" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-fire"/></svg>
    <div class="wsb-text">
      <div class="wsb-title">${s.choresDone} chore${s.choresDone===1?"":"s"} done this week!</div>
      ${showEarn?`<div class="wsb-sub">Earned ${fmt(s.earned)} — keep it up!</div>`:`<div class="wsb-sub">Great job — keep it up!</div>`}
    </div>
  </div>`;
}

// ── Parent: "this week at a glance" card ────────────────────────────
function renderWeekAtGlance(){
  const el = document.getElementById("parent-week-glance");
  if(!el) return;
  if(currentRole!=="parent" || !activeChild){ el.innerHTML=""; return; }
  const s = computeWeekStats(activeChild);
  // Only show if there's something to show OR there are no deposits pending
  const depEl = document.getElementById("parent-deposit-approvals");
  const hasDep = depEl && depEl.innerHTML.trim().length > 0;
  if(hasDep && s.choresDone===0 && s.pending===0){ el.innerHTML=""; return; }
  el.innerHTML = `<div class="week-glance-card">
    <div class="wgc-header">
      <svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-chart-bar"/></svg>
      <span>This week for ${activeChild}</span>
    </div>
    <div class="wgc-stats">
      <div class="wgc-stat"><div class="wgc-num">${s.choresDone}</div><div class="wgc-lbl">chores done</div></div>
      <div class="wgc-stat"><div class="wgc-num">${fmt(s.earned)}</div><div class="wgc-lbl">earned</div></div>
      <div class="wgc-stat ${s.pending?'wgc-alert':''}"><div class="wgc-num">${s.pending}</div><div class="wgc-lbl">pending</div></div>
    </div>
  </div>`;
}

// ── Goal-hit badges in ledger ────────────────────────────────────────
/* Returns a Set of ledger-row signatures ("date|note") that represent
   the first time the child's running savings balance met/exceeded
   a goal target. Run against the full history each render. */
function computeGoalHitSignatures(childName){
  const sigs = new Set();
  if(!childName) return sigs;
  const goals = (getChildData(childName).goals) || [];
  if(!goals.length) return sigs;
  const hist = (state.history && state.history[childName]) || [];
  // Sort chronologically
  const sorted = [...hist].filter(h => h.date).sort((a,b) => new Date(a.date) - new Date(b.date));
  // Running savings: start at zero (history covers the whole lifetime in this app)
  let runSav = 0;
  const hitTargets = new Set(); // each goal target hit only once, at first crossing
  for(const h of sorted){
    const n = (h.note||"").toLowerCase();
    const isSav = n.includes("(sav)") || n.includes("to savings") || n.includes("to sav") || n.includes("interest (sav)");
    if(isSav) runSav += (parseFloat(h.amt)||0);
    // Check each goal target
    for(const g of goals){
      const target = parseFloat(g.target)||0;
      if(target<=0) continue;
      if(hitTargets.has(target)) continue;
      if(runSav >= target){
        sigs.add((h.date||"")+"|"+(h.note||"")+"|"+target);
        hitTargets.add(target);
      }
    }
  }
  return sigs;
}

/* Looks up whether a given ledger row is a goal-hit row. Returns the goal
   name that was met on that row, or null. */
function goalHitForRow(childName, h, goalSigs){
  const goals = (getChildData(childName).goals) || [];
  for(const g of goals){
    const target = parseFloat(g.target)||0;
    if(target<=0) continue;
    const sig = (h.date||"")+"|"+(h.note||"")+"|"+target;
    if(goalSigs.has(sig)) return g.name || ("$"+target.toFixed(0));
  }
  return null;
}

// ── Help drawer ──────────────────────────────────────────────────────
const HELP_CONTENT = {
  login: {
    title: "Logging In",
    body: `<p>Enter your name and 4-digit PIN, then tap <strong>Log In</strong>.</p>
      <p><strong>Remember my username</strong> saves your name on this device so you don't re-type it.</p>
      <p><strong>Auto-login</strong> skips the PIN entirely. Only turn this on for your own personal device — anyone who picks it up will be logged in as you.</p>
      <p>Forgot your PIN? Ask a parent to reset it from Admin.</p>`
  },
  picker: {
    title: "Choosing an Account",
    body: `<p>You're a parent with more than one child. Pick whose account you want to manage.</p>
      <p>Tap a child's name to go to their account. You can switch later using the <strong>Switch</strong> button at the top.</p>`
  },
  main: {
    title: "Using Family Bank",
    body: `<p><strong>Checking &amp; Savings cards</strong> show your balances and monthly interest.</p>
      <p><strong>Transaction History</strong> lists every deposit, withdrawal, and chore payment. Goals you've met show a 🎯 badge.</p>
      <p><strong>Net Worth Chart</strong> plots your total balance over time with a 3-month projection.</p>
      <hr>
      <p><strong>For kids:</strong> the Money tab is where you withdraw, transfer between accounts, or deposit cash. The Chores tab shows what's due and lets you mark completed chores.</p>
      <p><strong>For parents:</strong> Money lets you add or remove money directly, see reports, and configure allowance, interest, and savings goals. Chores is where you approve submissions. Settings handles profile and parent email.</p>
      <hr>
      <p><strong>Tip:</strong> long-press the red badge on the Chores tab to quick-approve without navigating.</p>`
  },
  admin: {
    title: "Admin Panel",
    body: `<p>The Admin PIN gates this panel. Change it from <strong>Admin PIN</strong> below.</p>
      <p><strong>User Management</strong> — add kids, edit avatars, reset PINs, change emails/notifications, choose which tabs each child sees.</p>
      <p><strong>Bank Branding</strong> — customize the name, tagline, and colors.</p>
      <p><strong>Auto-Logout</strong> — returns to the login screen after inactivity. Set to 5 minutes on shared devices.</p>
      <p><strong>Celebration Sound</strong> — plays a short chime when kids submit chores. Off by default.</p>`
  }
};

function openHelp(screen){
  const data = HELP_CONTENT[screen] || HELP_CONTENT.main;
  document.getElementById("help-drawer-title").textContent = data.title;
  document.getElementById("help-drawer-body").innerHTML = data.body;
  document.getElementById("help-drawer").classList.add("open");
}
function closeHelp(){ document.getElementById("help-drawer").classList.remove("open"); }

// ── Long-press quick-approve ─────────────────────────────────────────
let _lpTimer = null, _lpTarget = null;
function bindLongPressApprove(){
  const badge = document.getElementById("parent-chore-badge");
  if(!badge || badge._lpBound) return;
  badge._lpBound = true;
  const start = (ev)=>{
    if(badge.classList.contains("hidden")) return;
    _lpTarget = badge;
    badge.classList.add("lp-active");
    _lpTimer = setTimeout(()=>{
      badge.classList.remove("lp-active");
      if(navigator.vibrate) try{ navigator.vibrate(30); }catch(e){}
      openQuickApprove();
    }, 500);
  };
  const cancel = ()=>{
    clearTimeout(_lpTimer); _lpTimer=null;
    if(_lpTarget){ _lpTarget.classList.remove("lp-active"); _lpTarget=null; }
  };
  badge.addEventListener("touchstart", start, {passive:true});
  badge.addEventListener("mousedown",  start);
  ["touchend","touchcancel","mouseup","mouseleave"].forEach(ev=>badge.addEventListener(ev,cancel));
}

function openQuickApprove(){
  if(currentRole!=="parent" || !activeChild) return;
  const data = getChildData(activeChild);
  const pending = (data.chores||[]).filter(c=>c.status==="pending");
  if(!pending.length){ showToast("No pending chores.","info"); return; }
  const sheet = document.getElementById("quick-approve-sheet");
  const list  = document.getElementById("quick-approve-list");
  list.innerHTML = pending.map(c=>`
    <div class="qa-row">
      <div class="qa-info">
        <div class="qa-name">${escapeHtml(c.name)}</div>
        <div class="qa-meta">${renderAvatar(c.completedBy,"xs")} ${c.completedBy} · ${fmt(c.amount)}</div>
      </div>
      <div class="qa-btns">
        <button class="btn btn-secondary btn-sm" onclick="quickApproveOne('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg></button>
        <button class="btn btn-danger btn-sm" onclick="quickDenyOne('${c.id}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg></button>
      </div>
    </div>`).join("");
  sheet.classList.add("open");
}
function closeQuickApprove(){ document.getElementById("quick-approve-sheet").classList.remove("open"); }

function quickApproveOne(choreId){
  // Reuse existing approveChore flow but skip its confirmation modal
  const data = getChildData(activeChild);
  const chore = data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  const ck = chore.amount * (chore.splitChk/100);
  const sv = chore.amount * ((100-chore.splitChk)/100);
  data.balances.checking += ck;
  data.balances.savings  += sv;
  if(ck>0) recordTransaction("Bank","Chore: "+chore.name+" (Chk)",ck);
  if(sv>0) recordTransaction("Bank","Chore: "+chore.name+" (Sav)",sv);
  if(chore.schedule==="once"){
    data.chores = data.chores.filter(c=>c.id!==choreId);
  } else {
    Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote:null,lastCompleted:todayStr()});
    if(chore.streakMilestone && chore.streakReward){
      chore.streakCount = (parseInt(chore.streakCount)||0) + 1;
      const effective = chore.streakCount + (parseInt(chore.streakStart)||0);
      const milestone = parseInt(chore.streakMilestone)||0;
      if(milestone>0 && effective%milestone===0){
        const bonus = parseFloat(chore.streakReward)||0;
        if(bonus>0){
          data.balances.checking += bonus;
          recordTransaction("Bank","🔥 Streak Bonus: "+chore.name+" ("+effective+" in a row!) (Chk)",bonus);
          showToast("🔥 Streak milestone! +"+fmt(bonus)+" bonus deposited!","success",4000);
        }
      }
    }
  }
  state._approvedChoreId = chore.id;
  state._approvedChoreTitle = buildCalEventTitle(chore);
  state._approvedChoreSchedule = chore.schedule;
  syncToCloud("Chore Approved (Quick)");
  delete state._approvedChoreId; delete state._approvedChoreTitle; delete state._approvedChoreSchedule;
  showToast("Approved! "+fmt(chore.amount)+" deposited.","success");
  renderParentChores(); renderChildChores(); updateChoreBadges(); renderWeekAtGlance();
  // Refresh the quick-approve sheet
  const remaining = (data.chores||[]).filter(c=>c.status==="pending");
  if(remaining.length) openQuickApprove();
  else closeQuickApprove();
}

function quickDenyOne(choreId){
  // Quick deny — no reason prompt; use normal deny for reasons
  const data = getChildData(activeChild);
  const chore = data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  reopenDeniedChore(chore, null);   // v38.2-1 — mirrors denyChore; was: one-time chores filtered out (deleted)
  syncToCloud("Chore Denied (Quick)");
  showToast("Chore denied.","error");
  renderParentChores(); renderChildChores(); updateChoreBadges(); renderWeekAtGlance();
  const remaining = (data.chores||[]).filter(c=>c.status==="pending");
  if(remaining.length) openQuickApprove();
  else closeQuickApprove();
}

// ── PDF monthly statement ────────────────────────────────────────────


// v38 Step 4 — granular version stamp from version.json (cache-busted).
// Displays version + " · build " + build so Mike can confirm a force-refresh
// landed on the intended build. Falls back to APP_VERSION if the fetch fails,
// so the stamp is never blank. version.json stores version WITHOUT a "v" prefix
// (SW version-check invariant); we prefix "v" for display only.
(function stampVersion(){
  const sv = document.getElementById("splash-version");
  const lv = document.getElementById("login-version");
  const fallback = "v" + APP_VERSION;
  if(sv) sv.textContent = fallback;
  if(lv) lv.textContent = fallback;
  fetch("version.json?t=" + Date.now())
    .then(r => r.json())
    .then(v => {
      if(!v) return;
      const ver   = v.version ? ("v" + String(v.version).replace(/^v/, "")) : fallback;
      const stamp = ver + (v.build ? " · build " + v.build : "");
      if(sv) sv.textContent = stamp;
      if(lv) lv.textContent = stamp;
    })
    .catch(() => { /* keep fallback */ });
})();

populateAllowanceMonthlyDays();
populateLoanDueDayPicker();
onAllowanceScheduleChange();
document.querySelector("#allow-day-toggles .day-toggle[data-day='1']")?.classList.add("selected");
updateDepositSplitLabel();
onChildActionChange();
document.getElementById("login-email-input")?.addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("pin-input").focus(); });
document.getElementById("username-input").addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("pin-input").focus(); });
document.getElementById("pin-input").addEventListener("keydown",      e=>{ if(e.key==="Enter") doLoginSubmit(); });
document.getElementById("admin-pin-input").addEventListener("keydown",e=>{ if(e.key==="Enter") attemptAdminLogin(); });   // In-5 (already in place; verified v38.1 final)
loadFromCloud();

// ════════════════════════════════════════════════════════════════════
// 20. v32 — BOTTOM SHEETS, COLLAPSIBLES, LAUNCHER HELPERS
// ════════════════════════════════════════════════════════════════════
/**
 * v32.3 — Exit-without-saving warning
 * ─────────────────────────────────────
 * Sheets in EXIT_WARN_SHEETS track "dirty" state. When the user starts
 * typing in any input inside such a sheet, it's marked dirty. Closing
 * via ✕, backdrop, or auto-logic will prompt a confirm modal if dirty.
 * Successful save paths should call closeSheet() AFTER clearing the
 * form (so the reset removes dirty flag naturally via the input events)
 * OR call clearSheetDirty(id) explicitly.
 */
const EXIT_WARN_SHEETS = new Set([
  "sheet-loan-creator",
  "sheet-adjust",
  "sheet-allowance-interest",
  "sheet-manage-money",
  "sheet-child-profile",
  "sheet-add-child",
  "sheet-share-child",
  // v33.0
  "sheet-signup-request"
]);
const _sheetDirty = {}; // sheetId -> bool

function markSheetDirty(id){ _sheetDirty[id] = true; }
function clearSheetDirty(id){ _sheetDirty[id] = false; }
function isSheetDirty(id){ return !!_sheetDirty[id]; }

/** Attach input listeners so any typing inside a watched sheet sets its dirty flag. */
(function installSheetDirtyTracking(){
  if(typeof document === "undefined") return;
  document.addEventListener("input", e=>{
    const sheet = e.target.closest && e.target.closest(".bottom-sheet");
    if(!sheet || !sheet.id) return;
    if(!EXIT_WARN_SHEETS.has(sheet.id)) return;
    markSheetDirty(sheet.id);
  }, true);
  document.addEventListener("change", e=>{
    const sheet = e.target.closest && e.target.closest(".bottom-sheet");
    if(!sheet || !sheet.id) return;
    if(!EXIT_WARN_SHEETS.has(sheet.id)) return;
    markSheetDirty(sheet.id);
  }, true);
})();

/**
 * Open a bottom sheet by DOM id. Shared dim backdrop slides in.
 * Multiple sheets can stack — backdrop stays until all are closed.
 * Opening always clears the dirty flag (fresh start).
 */
function openSheet(id){
  const sheet = document.getElementById(id);
  if(!sheet) return;
  clearSheetDirty(id);
  // v33.2 — If another sheet is already open, promote this one above it so
  // sheet-over-sheet (e.g. chore creator launched from inside the wizard)
  // doesn't pop behind. Base z-index is 500 in styles.css.
  const openSiblings = document.querySelectorAll(".bottom-sheet.open");
  if(openSiblings.length){
    let maxZ = 500;
    openSiblings.forEach(s => {
      const z = parseInt(s.style.zIndex || getComputedStyle(s).zIndex || "500", 10);
      if(!isNaN(z) && z > maxZ) maxZ = z;
    });
    sheet.style.zIndex = String(maxZ + 10);
  } else {
    sheet.style.zIndex = ""; // reset to stylesheet default
  }
  sheet.classList.add("open");
  document.getElementById("sheet-backdrop")?.classList.add("open");
}

/**
 * Close a sheet. If it's in EXIT_WARN_SHEETS and dirty, prompt first.
 * Force-close (bypassing the prompt) is available via closeSheet(id, true)
 * — used by successful save flows that want unconditional dismissal.
 */
function closeSheet(id, force){
  const sheet = document.getElementById(id);
  if(!sheet) return;
  if(!force && EXIT_WARN_SHEETS.has(id) && isSheetDirty(id)){
    openModal({
      icon:"⚠️",
      title:"Discard changes?",
      body:"You have unsaved changes. Close without saving?",
      confirmText:"Discard",
      confirmClass:"btn-warning",
      onConfirm:()=>{
        closeModal(); // v34.1 Item 6 — must dismiss the modal overlay before closing the sheet
        clearSheetDirty(id);
        sheet.classList.remove("open");
        sheet.style.zIndex = ""; // v33.2 — reset stacking promotion
        if(!document.querySelector(".bottom-sheet.open")){
          document.getElementById("sheet-backdrop")?.classList.remove("open");
        }
      }
    });
    return;
  }
  clearSheetDirty(id);
  sheet.classList.remove("open");
  sheet.style.zIndex = ""; // v33.2 — reset stacking promotion
  if(!document.querySelector(".bottom-sheet.open")){
    document.getElementById("sheet-backdrop")?.classList.remove("open");
  }
}

function closeAllSheets(){
  // v32.3: Force-close all, no dirty check (used by selectChild / logout flows)
  document.querySelectorAll(".bottom-sheet.open").forEach(s=>{
    s.classList.remove("open");
    s.style.zIndex = ""; // v33.2 — reset stacking promotion
    if(s.id) clearSheetDirty(s.id);
  });
  document.getElementById("sheet-backdrop")?.classList.remove("open");
}

/**
 * Toggle a collapsible card's expanded state (used for admin User Management
 * and Bank Branding sections). Chevron rotation handled via CSS.
 * v32.4 item #3: Auto-closes sibling collapsibles so only one is open at a time
 * within the same parent container.
 */
function toggleCollapsible(id){
  const card = document.getElementById(id);
  if(!card) return;
  const isExpanding = !card.classList.contains("expanded");
  if(isExpanding && card.parentElement){
    // Close every sibling collapsible first
    card.parentElement.querySelectorAll(":scope > .collapsible-card.expanded").forEach(sib=>{
      if(sib !== card) sib.classList.remove("expanded");
    });
  }
  card.classList.toggle("expanded");
}

/**
 * Launcher helpers — open the right sheet and also reset/populate the form
 * inside so the user gets a clean experience each time.
 */
function openLoanCreator(){
  if(typeof editingLoanId === "undefined" || !editingLoanId){
    try { resetLoanForm(); } catch(e){}
  }
  openSheet("sheet-loan-creator");
}
function openChildProfileSheet(){
  // Populate from current activeChild before showing
  try { renderChildProfileSection(); } catch(e){}
  openSheet("sheet-child-profile");
}

// v32: When parent changes active child, close any open sheets that show stale data
(function(){
  const origSelectChild = typeof selectChild === "function" ? selectChild : null;
  if(!origSelectChild) return;
  window.selectChild = function(name){
    closeAllSheets();
    return origSelectChild(name);
  };
})();

// ════════════════════════════════════════════════════════════════════
// 21. v32.1 — SWIPE NAVIGATION BETWEEN TABS
// ════════════════════════════════════════════════════════════════════
/**
 * Horizontal swipe on the active tab panel advances to the adjacent tab.
 * Design:
 *   - Threshold: 60px horizontal distance
 *   - Dominance: dx must be at least 1.5x |dy| (so vertical scrolls pass through)
 *   - Guards: ignore if swipe starts inside a bottom sheet, drawer, picker
 *     overlay, range slider, day-toggle row, chart canvas, or any input
 *   - Panel container: #child-panel for child view, #parent-panel for parent
 *   - Direction: left-swipe → next tab, right-swipe → previous tab
 */
(function installSwipeNavigation(){
  const TAB_ORDER = {
    child:  ["money","chores","loans"],
    parent: ["money","chores","settings"]
  };
  const THRESHOLD = 60;      // px
  const DOMINANCE = 1.5;     // dx/|dy| ratio minimum
  const MAX_MS    = 600;     // swipe must complete within this

  function getActiveTab(panelKey){
    const bar = document.getElementById(panelKey+"-tab-bar");
    if(!bar) return null;
    const active = bar.querySelector(".tab-btn.active");
    if(!active) return null;
    const match = (active.getAttribute("onclick")||"").match(/'([^']+)'\s*\)\s*$/);
    return match ? match[1] : null;
  }

  function getVisibleTabs(panelKey){
    const full = TAB_ORDER[panelKey] || [];
    // Child panel hides tabs the admin has disabled — read from DOM
    const bar = document.getElementById(panelKey+"-tab-bar");
    if(!bar) return full;
    const btns = Array.from(bar.querySelectorAll(".tab-btn"));
    const names = btns.map(b=>{
      const m = (b.getAttribute("onclick")||"").match(/'([^']+)'\s*\)\s*$/);
      return m ? m[1] : null;
    }).filter(Boolean);
    return names.length ? names : full;
  }

  function shouldIgnore(target){
    if(!target || !target.closest) return true;
    // Never intercept swipes inside bottom sheets, drawers, overlays, or modals
    if(target.closest(".bottom-sheet, .history-drawer, .admin-drawer, .help-drawer, .picker-overlay, .modal-overlay, .quick-approve-sheet")) return true;
    // Never intercept on interactive controls that use horizontal gestures
    if(target.closest("input[type=range], .day-toggles, .nw-chart-wrap, .avatar-picker-grid, canvas, select, textarea")) return true;
    // Let typing in text/number inputs pass through normally (no swipe)
    if(target.closest("input[type=text], input[type=number], input[type=email], input[type=password], input[type=date], input[type=url], input[type=color]")) return true;
    return false;
  }

  function attach(panelKey){
    const panel = document.getElementById(panelKey+"-panel");
    if(!panel) return;
    let startX=0, startY=0, startT=0, active=false;

    panel.addEventListener("touchstart", e=>{
      if(e.touches.length !== 1){ active=false; return; }
      if(shouldIgnore(e.target)){ active=false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      active = true;
    }, {passive:true});

    panel.addEventListener("touchend", e=>{
      if(!active) return;
      active = false;
      const touch = e.changedTouches[0];
      if(!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startT;
      if(dt > MAX_MS) return;
      if(Math.abs(dx) < THRESHOLD) return;
      if(Math.abs(dx) < DOMINANCE * Math.abs(dy)) return;

      const tabs = getVisibleTabs(panelKey);
      const current = getActiveTab(panelKey);
      if(!tabs.length || !current) return;
      const idx = tabs.indexOf(current);
      if(idx < 0) return;

      // dx negative → swiped left → advance to next tab
      // dx positive → swiped right → go back to previous tab
      let target = null;
      if(dx < 0 && idx < tabs.length - 1) target = tabs[idx + 1];
      if(dx > 0 && idx > 0)               target = tabs[idx - 1];
      if(target && typeof switchTab === "function"){
        switchTab(panelKey, target);
      }
    }, {passive:true});
  }

  // Install on both panels once DOM is ready (they exist at script load)
  attach("child");
  attach("parent");
})();

// ════════════════════════════════════════════════════════════════════
// 22. v32.3 — PARENT-OWNED CHILDREN (Add / Share / Remove from Settings)
// ════════════════════════════════════════════════════════════════════
const MAX_CHILDREN_PER_PARENT = 6;

/**
 * Returns true if no OTHER existing user shares the given display name
 * with the given PIN. Lets a parent create "Emma" PIN 5678 even if
 * another Emma with PIN 1234 exists — login disambiguates by PIN.
 */
function isNamePinAvailable(name, pin){
  if(!name || !pin) return false;
  const users = state.users || [];
  for(const u of users){
    if(u === name && state.pins[u] === pin) return false;
  }
  return true;
}

/**
 * Returns true if the name is already taken AND we'd collide with an
 * existing PIN. Returns {collision, reason} object.
 */
function checkNamePinCollision(name, pin, excludeName){
  const users = state.users || [];
  for(const u of users){
    if(u === excludeName) continue;
    if(u === name && state.pins[u] === pin){
      return {collision:true, reason:'A user named "'+name+'" with that PIN already exists. Pick a different PIN.'};
    }
  }
  return {collision:false};
}

/** Returns the list of child names owned/assigned to the current parent. */
function getMyChildrenList(){
  if(currentRole !== "parent" || !currentUser) return [];
  const assigned = (state.config.parentChildren && state.config.parentChildren[currentUser]) || [];
  return assigned;
}

/** Returns the list of parents who have this child assigned. */
function getParentsOfChild(childName){
  const pc = state.config.parentChildren || {};
  return Object.keys(pc).filter(p => (pc[p]||[]).indexOf(childName) !== -1);
}

/**
 * Render the "My Children" list on parent Settings. Called from
 * renderParentSettings and after any add/share/remove action.
 */
function renderMyChildren(){
  const el = document.getElementById("my-children-list");
  // v34.2 — also refresh parent settings sheet list if open
  try { renderMyChildrenInSheet("my-children-list-ps"); } catch(e){}
  if(!el) return;
  if(currentRole !== "parent"){ el.innerHTML = ""; return; }
  const mine = getMyChildrenList();
  if(!mine.length){
    el.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:16px;text-align:center;">No children yet. Tap "Add Child" below to create one.</div>';
    return;
  }
  el.innerHTML = mine.map(name => {
    const shared = getParentsOfChild(name).length > 1;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
        <div style="flex-shrink:0;">${renderAvatar(name,"sm")}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:17px;">${escapeHtml(name)}</div>
          ${shared ? '<div style="font-size:14px;color:var(--muted);">Shared with '+(getParentsOfChild(name).length-1)+' other parent'+(getParentsOfChild(name).length>2?'s':'')+'</div>' : '<div style="font-size:14px;color:var(--muted);">Only on your account</div>'}
        </div>
        <button class="btn btn-sm btn-outline" style="width:auto;margin:0;padding:6px 10px;" onclick="openShareChildSheet('${name.replace(/'/g,"\\'")}')">Share</button>
        <button class="btn btn-sm btn-ghost" style="width:auto;margin:0;padding:6px 10px;color:var(--danger);" onclick="removeChildFromMyView('${name.replace(/'/g,"\\'")}')"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-trash"/></svg></button>
      </div>`;
  }).join("");
}

/**
 * Handle Add Child submit from sheet-add-child.
 * Creates a new child user, auto-assigns to current parent.
 */
function submitAddChild(){
  const nameEl = document.getElementById("add-child-name");
  const pinEl  = document.getElementById("add-child-pin");
  const msgEl  = document.getElementById("add-child-msg");
  msgEl.className = "field-msg";
  const name = nameEl.value.trim();
  const pin  = pinEl.value;
  if(!name){ msgEl.className="field-msg error"; msgEl.textContent="Name is required."; return; }
  if(!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)){
    msgEl.className="field-msg error"; msgEl.textContent="PIN must be exactly 4 digits."; return;
  }
  // 6-child cap for this parent
  const mine = getMyChildrenList();
  if(mine.length >= MAX_CHILDREN_PER_PARENT){
    msgEl.className="field-msg error"; msgEl.textContent="You've hit the "+MAX_CHILDREN_PER_PARENT+"-child limit. Remove one first."; return;
  }
  // PIN + name collision check
  const col = checkNamePinCollision(name, pin);
  if(col.collision){ msgEl.className="field-msg error"; msgEl.textContent=col.reason; return; }
  // If a user with same name AND different PIN exists, still allow — disambiguation by PIN at login.
  // If a user with same name exists (same PIN was caught above), the new entry uses the SAME
  // state.users entry — we can't have two "Emma" keys in state.pins. For v32.3, reject and ask
  // for a different display name when a name already exists. (True multi-Emma requires UIDs,
  // which we deferred.)
  if((state.users||[]).indexOf(name) !== -1){
    msgEl.className="field-msg error";
    msgEl.textContent='"'+name+'" is already taken. Pick a different name.';
    return;
  }
  // Create
  state.users = state.users || [];
  state.users.push(name);
  state.pins[name] = pin;
  state.roles[name] = "child";
  getChildData(name); // seed empty child data
  // Default tabs: money + chores ON, loans OFF
  if(!state.config.tabs) state.config.tabs = {};
  state.config.tabs[name] = {money:true, chores:true, loans:false};
  // Default notify: email ON (parent), rest off
  if(!state.config.notify) state.config.notify = {};
  state.config.notify[name] = {email:true, calendar:false, choreRewards:true};
  // Default celebration sound on
  if(!state.usersData) state.usersData = {};
  state.usersData[name] = {
    celebrationSound: true,
    createdAt: new Date().toISOString()  // v34.0 — anchor for annual projection anniversary
  };
  // Auto-assign to creating parent
  if(!state.config.parentChildren) state.config.parentChildren = {};
  if(!state.config.parentChildren[currentUser]) state.config.parentChildren[currentUser] = [];
  state.config.parentChildren[currentUser].push(name);
  syncToCloud("Child Created");
  showToast('"'+name+'" added! Refreshing...',"success",2000);
  nameEl.value = ""; pinEl.value = "";
  closeSheet("sheet-add-child", true);
  // v34.2 — reload to pick up new child; sessionStorage preserves login
  setTimeout(()=>location.reload(), 2200);
}

/** Open the share sheet for a specific child. */
let _sharingChildName = null;
function openShareChildSheet(childName){
  _sharingChildName = childName;
  document.getElementById("share-child-name").textContent = childName;
  document.getElementById("share-child-usernames").value = "";
  document.getElementById("share-child-msg").className = "field-msg";
  document.getElementById("share-child-msg").textContent = "";
  openSheet("sheet-share-child");
}

/** Handle share submission — validates each username, adds child to their parentChildren. */
function submitShareChild(){
  const msgEl = document.getElementById("share-child-msg");
  msgEl.className = "field-msg";
  if(!_sharingChildName){ msgEl.className="field-msg error"; msgEl.textContent="No child selected."; return; }
  const raw = document.getElementById("share-child-usernames").value.trim();
  if(!raw){ msgEl.className="field-msg error"; msgEl.textContent="Enter at least one parent username."; return; }
  const names = raw.split(",").map(s=>s.trim()).filter(Boolean);
  // Validate each
  const notFound = [];
  const notParent = [];
  const selfRef = [];
  const alreadyShared = [];
  const valid = [];
  names.forEach(n => {
    if(n === currentUser){ selfRef.push(n); return; }
    if((state.users||[]).indexOf(n) === -1){ notFound.push(n); return; }
    if((state.roles||{})[n] !== "parent"){ notParent.push(n); return; }
    const existing = (state.config.parentChildren && state.config.parentChildren[n]) || [];
    if(existing.indexOf(_sharingChildName) !== -1){ alreadyShared.push(n); return; }
    valid.push(n);
  });
  if(notFound.length){
    msgEl.className="field-msg error";
    msgEl.textContent = "User not found: "+notFound.join(", ");
    return;
  }
  if(notParent.length){
    msgEl.className="field-msg error";
    msgEl.textContent = "Not a parent account: "+notParent.join(", ")+". Only parents can have children.";
    return;
  }
  if(selfRef.length){
    msgEl.className="field-msg error";
    msgEl.textContent = "You already have this child — can't share with yourself.";
    return;
  }
  if(!valid.length && alreadyShared.length){
    msgEl.className="field-msg info";
    msgEl.textContent = "Already shared with: "+alreadyShared.join(", ");
    return;
  }
  // Apply
  if(!state.config.parentChildren) state.config.parentChildren = {};
  if(!state.config.shareNotifications) state.config.shareNotifications = {};
  valid.forEach(p => {
    if(!state.config.parentChildren[p]) state.config.parentChildren[p] = [];
    state.config.parentChildren[p].push(_sharingChildName);
    // v34.2 — store pending notification for recipient; Code.gs will send email on next sync
    if(!state.config.shareNotifications[p]) state.config.shareNotifications[p] = [];
    state.config.shareNotifications[p].push({
      child: _sharingChildName,
      from: currentUser,
      at: new Date().toISOString(),
      seen: false
    });
  });
  syncToCloud("Child Shared");
  showToast(_sharingChildName+" shared with "+valid.join(", "),"success");
  closeSheet("sheet-share-child", true);
  _sharingChildName = null;
  renderMyChildren();
}

/**
 * Remove child from *this* parent's view. If they're the last parent
 * assigned, warn that it's a full delete of the child + all data.
 */
// v34.2 — alias used in parent settings sheet
function confirmRemoveChild(childName){ removeChildFromMyView(childName); }

function removeChildFromMyView(childName){
  const parents = getParentsOfChild(childName);
  const isLast = parents.length <= 1;
  openModal({
    icon: isLast ? "🗑️" : "👋",
    title: isLast ? "Delete "+childName+"?" : "Remove "+childName+"?",
    body: isLast
      ? "You are the only parent on "+childName+"'s account. Removing will permanently delete "+childName+" and all their balances, chores, loans, and history. This cannot be undone."
      : "Remove "+childName+" from your account? "+childName+" will still be available to their other "+(parents.length-1)+" parent"+(parents.length>2?"s":"")+".",
    confirmText: isLast ? "Delete Permanently" : "Remove",
    confirmClass: isLast ? "btn-danger" : "btn-warning",
    onConfirm: ()=>{
      if(isLast){
        // Full delete
        const idx = (state.users||[]).indexOf(childName);
        if(idx >= 0) state.users.splice(idx,1);
        delete state.pins[childName];
        delete state.roles[childName];
        if(state.children) delete state.children[childName];
        if(state.history) delete state.history[childName];
        if(state.config.tabs) delete state.config.tabs[childName];
        if(state.config.notify) delete state.config.notify[childName];
        if(state.config.emails) delete state.config.emails[childName];
        if(state.config.calendars) delete state.config.calendars[childName];
        if(state.config.avatars) delete state.config.avatars[childName];
        if(state.usersData) delete state.usersData[childName];
        // Scrub from all parentChildren lists
        if(state.config.parentChildren){
          Object.keys(state.config.parentChildren).forEach(p=>{
            state.config.parentChildren[p] = (state.config.parentChildren[p]||[]).filter(c=>c!==childName);
          });
        }
        showToast(childName+" fully deleted.","info");
      } else {
        // Soft remove — just this parent
        if(state.config.parentChildren && state.config.parentChildren[currentUser]){
          state.config.parentChildren[currentUser] = state.config.parentChildren[currentUser].filter(c=>c!==childName);
        }
        showToast(childName+" removed from your account.","info");
      }
      // If the removed child was currently active, switch to another or back to picker
      if(activeChild === childName){
        const remaining = getAssignedChildren();
        if(remaining.length) selectChild(remaining[0]);
        else logout();
      }
      syncToCloud("Child Removed");
      renderMyChildren();
      renderParentTabBar && renderParentTabBar();
    }
  });
}

// Hook into renderParentSettings so My Children populates on Settings tab open
(function wireMyChildrenRender(){
  if(typeof renderParentSettings !== "function") return;
  const orig = renderParentSettings;
  window.renderParentSettings = function(){
    const r = orig.apply(this, arguments);
    try { renderMyChildren(); } catch(e){}
    return r;
  };
})();

// ════════════════════════════════════════════════════════════════════
// 22. v33.0 — SIGNUP REQUESTS, PROOF PHOTO, EARNINGS CALC, WIZARD
// ════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────
// 22.1 — ACCOUNT SIGNUP REQUESTS (parent only)
// ────────────────────────────────────────────────────────────────────

function openSignupRequest(){
  // Reset form
  ["signup-name","signup-email","signup-pin","signup-honeypot"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  const msgEl=document.getElementById("signup-msg"); if(msgEl){ msgEl.className="field-msg"; msgEl.textContent=""; }
  openSheet("sheet-signup-request");
}

async function submitSignupRequest(){
  // ── v38 Step 6 (Transom) — server-backed public signup ────────────
  // Replaces the v37 state.config.pendingUsers writer. Submits via GET
  // to _routeSignup (Code.gs). Backend stays authoritative on ALL
  // validation; the client checks below are instant-feedback mirrors.
  const msgEl = document.getElementById("signup-msg");
  msgEl.className = "field-msg";
  msgEl.textContent = "";

  // Read + trim all four fields. Honeypot is trimmed but passed through
  // verbatim — NO client-side honeypot branch (bots get the normal flow).
  const name  = (document.getElementById("signup-name").value     || "").trim();
  const email = (document.getElementById("signup-email").value    || "").trim();
  const pin   = (document.getElementById("signup-pin").value      || "").trim();
  const hp    = (document.getElementById("signup-honeypot").value || "").trim();

  // Client-side validation — mirrors _routeSignup; locked copy strings.
  if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4}$/.test(pin)){
    msgEl.className = "field-msg error";
    msgEl.textContent = "Please check your entries — name, valid email, and a 4-digit PIN are required.";
    return;
  }
  if(name.toLowerCase() === "admin"){  // backend additionally strips zero-width chars (D6.5) and remains the real gate
    msgEl.className = "field-msg error";
    msgEl.textContent = "That name is reserved — please choose another.";
    return;
  }

  // In-flight disable (Dec-4 / NTH-5-C class) — re-enabled in finally on ANY outcome.
  const btn = document.getElementById("signup-submit-btn");
  if(btn) btn.disabled = true;

  try{
    // Plain awaited GET — no no-cors (D5), no custom headers. The honeypot
    // param is ALWAYS present, even when empty: _routeSignup returns
    // badInput if the param is absent (typeof check at route step 0.5).
    const url = API_URL
      + "?action=signup"
      + "&name="     + encodeURIComponent(name)
      + "&email="    + encodeURIComponent(email)
      + "&pin="      + encodeURIComponent(pin)
      + "&honeypot=" + encodeURIComponent(hp);
    const resp = await fetch(url);
    const data = await resp.json();

    if(data && data.status === "ok"){
      // Locked success copy (Dec-3); v38.1 final (In-9) — confirmation toast and the sheet closes.
      msgEl.className = "field-msg success";
      msgEl.textContent = "Your application is in the queue. The admin will be in touch once your family is approved.";
      ["signup-name","signup-email","signup-pin"].forEach(id=>{
        const el = document.getElementById(id); if(el) el.value = "";
      });
      showToast("Request sent. The admin will be in touch once your family is approved.","success",6000);
      setTimeout(()=>{ try{ closeSheet("sheet-signup-request", true); }catch(_){} }, 900);
    } else {
      const reason = data && data.reason;
      msgEl.className = "field-msg error";
      if(reason === "duplicateEmail")      msgEl.textContent = "That email is already registered or pending approval.";
      else if(reason === "reservedName")   msgEl.textContent = "That name is reserved — please choose another.";
      else if(reason === "queueFull")      msgEl.textContent = "Signups are temporarily closed. Please try again later.";
      else if(reason === "badInput")       msgEl.textContent = "Please check your entries — name, valid email, and a 4-digit PIN are required.";
      else                                 msgEl.textContent = "Something went wrong — please try again.";
    }
  } catch(err){
    // Network throw / non-JSON body → generic error.
    msgEl.className = "field-msg error";
    msgEl.textContent = "Something went wrong — please try again.";
  } finally {
    if(btn) btn.disabled = false;
  }
}

// ── v38 Step 5 (Sill) — server-backed signup queue ──────────────────
// Replaces the v37 renderPendingRequests / approvePendingRequest /
// denyPendingRequest (which read state.config.pendingUsers). The queue now
// lives in the PendingSignups Sheet tab, read via adminListPendingSignups
// (oldest-first, PIN masked "***"). Reveal is on-demand via
// adminRevealSignupPin. Approve/deny call the adminApprove / adminDeny routes
// with the in-memory admin-session PIN.
//
// NOTE: the v37 submitSignupRequest writer was replaced in Step 6 (Transom)
// with a server-backed submit (GET ?action=signup → _routeSignup). The
// state.config.pendingUsers default (buildDefaultState + load-time ensure)
// remains as a dead, harmless initializer — nothing reads or writes it in v38.

function _escHtml(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function _fmtSignupDate(iso){
  try{
    const d=new Date(iso);
    if(isNaN(d.getTime())) return String(iso||"");
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
         + " " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  }catch(e){ return String(iso||""); }
}

async function renderAdminQueue(){
  const listEl  = document.getElementById("pending-requests-list");
  const badgeEl = document.getElementById("pending-requests-badge");
  if(!listEl) return;
  if(!_adminSessionPin){ listEl.innerHTML=""; if(badgeEl) badgeEl.classList.add("hidden"); return; }
  listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:16px;text-align:center;">Loading…</div>';
  try{
    const url = API_URL+"?action=adminListPendingSignups&adminPin="+encodeURIComponent(_adminSessionPin);
    const res = await fetch(url);
    const data = await res.json();
    if(!data || data.status!=="ok"){
      listEl.innerHTML = '<div style="padding:12px;color:var(--danger);font-size:16px;text-align:center;">Could not load the queue.</div>';
      if(badgeEl) badgeEl.classList.add("hidden");
      return;
    }
    const arr = Array.isArray(data.signups) ? data.signups : [];
    if(badgeEl){ badgeEl.textContent=String(arr.length); badgeEl.classList.toggle("hidden", arr.length===0); }
    if(!arr.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:16px;text-align:center;">No pending requests.</div>';
      return;
    }
    listEl.innerHTML = arr.map(s=>{
      const sid  = String(s.signupId||"");   // server-minted sig_xxxxxxxx — no quotes/specials
      const sidA = _escHtml(sid);
      return `
      <div class="pending-request-card" data-signup-id="${sidA}">
        <div class="pending-request-meta">
          <div class="pr-name">${_escHtml(s.name)}</div>
          <div class="pr-line"><span class="pr-label">Email</span> <span>${_escHtml(s.email)}</span></div>
          <div class="pr-line"><span class="pr-label">PIN</span> <span class="pr-pin" id="pin-${sidA}">***</span>
            <button class="btn btn-sm btn-ghost" style="width:auto;margin:0 0 0 6px;padding:2px 10px;" onclick="revealSignupPin('${sid}')">👁 Reveal</button></div>
          <div class="pr-line"><span class="pr-label">Requested</span> <span>${_escHtml(_fmtSignupDate(s.submittedAt))}</span></div>
        </div>
        <div class="pending-request-actions">
          <button class="btn btn-sm btn-secondary" style="width:auto;margin:0;" onclick="approveSignup('${sid}')">✅ Approve</button>
          <button class="btn btn-sm btn-danger" style="width:auto;margin:0;" onclick="denySignup('${sid}')">❌ Deny</button>
        </div>
      </div>`;
    }).join("");
  }catch(e){
    listEl.innerHTML = '<div style="padding:12px;color:var(--danger);font-size:16px;text-align:center;">Network error loading the queue.</div>';
    if(badgeEl) badgeEl.classList.add("hidden");
  }
}

// Reveal one signup's PIN on demand (adminRevealSignupPin); show ~10s then
// re-mask. The revealed PIN only ever lives in the DOM text node — never stored.
async function revealSignupPin(signupId){
  const span = document.getElementById("pin-"+signupId);
  if(!span || !_adminSessionPin) return;
  if(_revealTimers[signupId]){ clearTimeout(_revealTimers[signupId]); delete _revealTimers[signupId]; }
  span.textContent = "…";
  try{
    const url = API_URL+"?action=adminRevealSignupPin&adminPin="+encodeURIComponent(_adminSessionPin)+"&signupId="+encodeURIComponent(signupId);
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.status==="ok"){
      span.textContent = String(data.pin);
      _revealTimers[signupId] = setTimeout(()=>{
        const s2=document.getElementById("pin-"+signupId);
        if(s2) s2.textContent="***";
        delete _revealTimers[signupId];
      }, 10000);
    } else {
      span.textContent = "***";
      showToast("Could not reveal PIN.","error");
    }
  }catch(e){
    span.textContent = "***";
    showToast("Network error.","error");
  }
}

// Approve a queued signup (adminApprove). Family is created server-side; we
// refresh the queue (row gone). Family-list refresh lands in drop 2.
async function approveSignup(signupId){
  if(!_adminSessionPin) return;
  try{
    const url = API_URL+"?action=adminApprove&adminPin="+encodeURIComponent(_adminSessionPin)+"&signupId="+encodeURIComponent(signupId);
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.status==="ok"){
      showToast("Signup approved. Family created.","success",4000);
    } else {
      showToast("Approve failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500);
    }
  }catch(e){ showToast("Network error.","error"); }
  renderAdminQueue();
}

// Deny a queued signup (adminDeny). Destructive removal -> confirm first.
// adminDeny takes no reason param (the denial-reason email is a backend Open Item).
async function denySignup(signupId){
  if(!_adminSessionPin) return;
  openModal({
    icon:"❌", title:"Deny this request?",
    body:"This removes the signup request from the queue. It can't be undone.",
    confirmText:"Deny", confirmClass:"btn-danger",
    onConfirm: async ()=>{
      try{
        const url = API_URL+"?action=adminDeny&adminPin="+encodeURIComponent(_adminSessionPin)+"&signupId="+encodeURIComponent(signupId);
        const res = await fetch(url);
        const data = await res.json();
        if(data && data.status==="ok"){ showToast("Request denied.","info",3600); }
        else { showToast("Deny failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500); }
      }catch(e){ showToast("Network error.","error"); }
      renderAdminQueue();
    }
  });
}

// ── v38 Step 5 (Sill) — global family list ──────────────────────────
// adminListFamilies returns familyIds only; per-family label + email(s) come
// from N+1 ?familyId= fetches (Gap-3 path-a). label = the parent-role user's
// name (state has no family-name field). Each row gets a delete affordance
// behind a type-"delete" confirm -> adminDeleteFamily (LockService + tombstone
// + Ledger audit server-side). The 2-fetch / batched variant is logged NTH.
async function renderFamilyList(){
  const listEl = document.getElementById("admin-family-list");
  if(!listEl) return;
  if(!_adminSessionPin){ listEl.innerHTML=""; return; }
  listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:16px;text-align:center;">Loading…</div>';
  try{
    const res = await fetch(API_URL+"?action=adminListFamilies&adminPin="+encodeURIComponent(_adminSessionPin));
    const data = await res.json();
    if(!data || data.status!=="ok"){
      listEl.innerHTML = '<div style="padding:12px;color:var(--danger);font-size:16px;text-align:center;">Could not load families.</div>';
      return;
    }
    const ids = Array.isArray(data.familyIds) ? data.familyIds : [];
    if(!ids.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:16px;text-align:center;">No families yet.</div>';
      return;
    }
    // N+1: fetch each family's state for label + email(s) (parallel; per-row failure -> dash).
    const details = await Promise.all(ids.map(async (fid)=>{
      try{
        const r  = await fetch(API_URL+"?t="+Date.now()+"&familyId="+encodeURIComponent(fid));
        const st = await r.json();
        if(!st || st.status==="error") return { fid, label:"—", emails:"" };
        const users   = Array.isArray(st.users) ? st.users : Object.keys(st.pins||{});
        const roles   = st.roles || {};
        const parents = users.filter(u => roles[u]==="parent");
        const labelUsers = parents.length ? parents : users.slice(0,1);
        const emailMap   = (st.config && st.config.emails) || {};
        const emails     = labelUsers.map(u => emailMap[u]).filter(Boolean);
        return { fid, label: labelUsers.join(", ") || "—", emails: emails.join(", ") };
      }catch(e){ return { fid, label:"—", emails:"" }; }
    }));
    listEl.innerHTML = details.map(d=>{
      const fidA = _escHtml(d.fid);
      return `
      <div class="user-row" data-family-id="${fidA}" data-label="${_escHtml(d.label)}">
        <div style="flex:1;min-width:0;">
          <div><strong>${_escHtml(d.label)}</strong></div>
          <div class="user-row-substats">${_escHtml(d.emails) || "no email on file"}</div>
          <div class="user-row-substats" style="opacity:.7;font-size:14px;">${fidA}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteFamilyConfirm('${d.fid}')">Delete</button>
      </div>`;
    }).join("");
  }catch(e){
    listEl.innerHTML = '<div style="padding:12px;color:var(--danger);font-size:16px;text-align:center;">Network error loading families.</div>';
  }
}

// Delete a family (adminDeleteFamily) behind a type-"delete" confirm. Server-side
// this scrubs EmailIndex, deletes the Families row, writes a DeletedFamilies
// tombstone, and audits the Ledger. Wrong confirm text -> no-op.
function deleteFamilyConfirm(familyId){
  const row   = document.querySelector('[data-family-id="'+familyId+'"]');
  const label = row ? (row.getAttribute("data-label") || familyId) : familyId;
  openInputModal({
    icon:"⚠️", title:"Delete this family?",
    body:'Permanently deletes "'+label+'" and all its data. Type delete to confirm. This cannot be undone.',
    inputType:"text", inputAttrs:'placeholder="delete" maxlength="10" autocapitalize="off" autocomplete="off"',
    confirmText:"Delete", confirmClass:"btn-danger",
    onConfirm: async (val)=>{
      if(String(val||"").trim().toLowerCase()!=="delete"){
        showToast('Type "delete" to confirm.',"error");
        return;
      }
      if(!_adminSessionPin){ showToast("Admin session expired — reopen the panel.","error"); return; }
      try{
        const url = API_URL+"?action=adminDeleteFamily&adminPin="+encodeURIComponent(_adminSessionPin)+"&familyId="+encodeURIComponent(familyId);
        const res = await fetch(url);
        const data = await res.json();
        if(data && data.status==="ok"){ showToast("Family deleted.","info",3600); }
        else { showToast("Delete failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500); }
      }catch(e){ showToast("Network error.","error"); }
      renderFamilyList();
    }
  });
}

// v38 Step 5 drop 3 (Lintel) -- global Admin Account (admin email + admin PIN).
// GLOBAL admin config (AdminConfig sheet), distinct from the per-family
// admin-email-input / changeAdminPin controls, which stay this drop (Option-A)
// until NTH-5-A relocates them off the parent surface. Email is populated from
// the adminLoad summary (_adminSummary.adminEmail); both writes go through the
// dedicated routes (setAdminEmail / setAdminPin).
function populateAdminAccount(){
  const aeEl  = document.getElementById("global-admin-email-input");
  const aeMsg = document.getElementById("global-admin-email-msg");
  if(aeEl)  aeEl.value = (_adminSummary && _adminSummary.adminEmail) || "";
  if(aeMsg){ aeMsg.className = "field-msg"; aeMsg.textContent = ""; }
}

// setAdminEmail: params adminPin (= session PIN, the auth) + newEmail. The backend
// normalizes (trim + lowercase) and writes AdminConfig col B -- it does NOT validate
// email format, so we validate client-side here. Empty is allowed (clears the admin
// email -> statements disabled), mirroring the per-family field.
// v38.1 final (In-8) — admin: rebuild the EmailIndex tab (existing rebuildEmailIndex route).
async function adminRebuildEmailIndex(){
  if(!_adminSessionPin){ showToast("Admin session expired — reopen the panel.","error"); return; }
  const btn = document.getElementById("admin-rebuild-email-btn");
  if(btn){ btn.disabled=true; btn.textContent="Rebuilding…"; }
  try{
    const url = API_URL+"?action=rebuildEmailIndex&adminPin="+encodeURIComponent(_adminSessionPin)+"&t="+Date.now();
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.status==="ok"){
      const n = (data.indexedCount!==undefined) ? data.indexedCount : "all";
      showToast("Email index rebuilt — "+n+" address"+(n===1?"":"es")+" indexed.","success",4500);
    } else if(data && data.reason==="auth"){
      showToast("Admin session expired — reopen the panel.","error",4500);
    } else {
      showToast("Rebuild failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500);
    }
  }catch(e){
    showToast("Couldn't reach the server — index not rebuilt.","error",4500);
  }
  if(btn){ btn.disabled=false; btn.textContent="Rebuild email index"; }
}
window.adminRebuildEmailIndex = adminRebuildEmailIndex;

async function saveGlobalAdminEmail(){
  if(!_adminSessionPin){ showToast("Admin session expired — reopen the panel.","error"); return; }
  const inp = document.getElementById("global-admin-email-input");
  const msg = document.getElementById("global-admin-email-msg");
  const val = inp ? inp.value.trim() : "";
  if(val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){
    if(msg){ msg.className="field-msg error"; msg.textContent="Please enter a valid email address."; }
    showToast("Invalid admin email.","error");
    return;
  }
  if(msg){ msg.className="field-msg"; msg.textContent=""; }
  try{
    const url = API_URL+"?action=setAdminEmail&adminPin="+encodeURIComponent(_adminSessionPin)+"&newEmail="+encodeURIComponent(val);
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.status==="ok"){
      if(_adminSummary) _adminSummary.adminEmail = val.toLowerCase();
      if(msg){ msg.className="field-msg success"; msg.textContent="Admin email saved."; }
      showToast("Admin email saved.","success");
    } else if(data && data.reason==="auth"){
      showToast("Admin session expired — reopen the panel.","error",4500);
    } else {
      showToast("Save failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500);
    }
  }catch(e){ showToast("Network error.","error"); }
}

// setAdminPin: params oldPin (= session PIN, the auth) + newPin. Backend validates
// newPin /^\d{4}$/ and writes AdminConfig col A. On success the session PIN is stale,
// so re-lock the panel and force a fresh sign-in with the new PIN.
function changeGlobalAdminPin(){
  if(!_adminSessionPin){ showToast("Admin session expired — reopen the panel.","error"); return; }
  openInputModal({
    icon:"\ud83d\udd11", title:"New Admin PIN",
    body:"Enter a new 4-digit admin PIN. The panel will lock and you'll sign in again with the new PIN.",
    inputType:"password", inputAttrs:'maxlength="4" inputmode="numeric" placeholder="\u2022\u2022\u2022\u2022" autocomplete="off"',
    confirmText:"Save", confirmClass:"btn-primary",
    onConfirm: async (v)=>{
      if(!v || !/^\d{4}$/.test(v)){ showToast("Admin PIN must be exactly 4 digits.","error"); return; }
      if(!_adminSessionPin){ showToast("Admin session expired — reopen the panel.","error"); return; }
      try{
        const url = API_URL+"?action=setAdminPin&oldPin="+encodeURIComponent(_adminSessionPin)+"&newPin="+encodeURIComponent(v);
        const res = await fetch(url);
        const data = await res.json();
        if(data && data.status==="ok"){
          showToast("Admin PIN updated — sign in with the new PIN.","success",4000);
          _adminSessionPin=null; _adminSummary=null; _clearRevealTimers();
          document.getElementById("admin-settings-section").classList.add("hidden");
          document.getElementById("admin-login-section").classList.remove("hidden");
          const pinEl=document.getElementById("admin-pin-input"); if(pinEl) pinEl.value="";
          const errEl=document.getElementById("admin-pin-error"); if(errEl) errEl.className="field-msg";
        } else if(data && data.reason==="badInput"){
          showToast("Admin PIN must be exactly 4 digits.","error");
        } else if(data && data.reason==="auth"){
          showToast("Current session PIN no longer valid — reopen the panel.","error",4500);
        } else {
          showToast("PIN change failed"+(data&&data.reason?(" ("+data.reason+")"):"")+".","error",4500);
        }
      }catch(e){ showToast("Network error.","error"); }
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// 22.2 — PROOF PHOTO CAPTURE
// ────────────────────────────────────────────────────────────────────

const PROOF_MAX_EDGE = 1200;
const PROOF_JPEG_QUALITY = 0.7;

function openProofPhotoCapture(choreId){
  pendingProofChoreId = choreId;
  // Wipe previous preview
  const prev = document.getElementById("proof-preview");
  if(prev) prev.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:16px;text-align:center;">No photo yet — tap "Take Photo" to capture.</div>';
  const cont = document.getElementById("proof-continue-btn");
  if(cont) cont.disabled = true;
  const fileEl = document.getElementById("proof-file-input");
  if(fileEl) fileEl.value = "";
  // Clear any previous buffered photo so Continue can't use a stale shot from another chore
  pendingProofPhoto = null;
  openSheet("sheet-proof-photo");
}

function handleProofFileSelected(inputEl){
  const f = inputEl.files && inputEl.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      try {
        const maxEdge = PROOF_MAX_EDGE;
        let w = img.naturalWidth, h = img.naturalHeight;
        if(w > h && w > maxEdge){ h = Math.round(h * (maxEdge/w)); w = maxEdge; }
        else if(h >= w && h > maxEdge){ w = Math.round(w * (maxEdge/h)); h = maxEdge; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", PROOF_JPEG_QUALITY);
        pendingProofPhoto = dataUrl;

        // Show preview
        const prev = document.getElementById("proof-preview");
        if(prev){
          const approxKb = Math.round((dataUrl.length * 3/4) / 1024);
          prev.innerHTML =
            '<img src="'+dataUrl+'" class="proof-thumb" alt="Proof photo preview">' +
            '<div style="font-size:14px;color:var(--muted);margin-top:6px;text-align:center;">'+w+'×'+h+' • ~'+approxKb+' KB</div>';
        }
        const cont = document.getElementById("proof-continue-btn");
        if(cont) cont.disabled = false;
      } catch(e){
        showToast("Photo too large, try again.","error");
        pendingProofPhoto = null;
      }
    };
    img.onerror = function(){ showToast("Could not read that image.","error"); pendingProofPhoto = null; };
    img.src = ev.target.result;
  };
  reader.onerror = function(){ showToast("Could not read file.","error"); };
  reader.readAsDataURL(f);
}

function proofRetake(){
  pendingProofPhoto = null;
  const fileEl = document.getElementById("proof-file-input");
  if(fileEl){ fileEl.value=""; fileEl.click(); }
}

function proofContinueToSubmit(){
  if(!pendingProofPhoto){
    showToast("Take a photo first.","error");
    return;
  }
  const choreId = pendingProofChoreId;
  closeSheet("sheet-proof-photo", true);
  // Re-enter the normal submit path; toggleChoreCheck will now fall through
  // because pendingProofPhoto is populated and IDs match.
  setTimeout(()=>{ try { toggleChoreCheck(choreId); } catch(e){} }, 120);
}

function proofCancel(){
  pendingProofPhoto = null;
  pendingProofChoreId = null;
  closeSheet("sheet-proof-photo", true);
}

// ────────────────────────────────────────────────────────────────────
// 22.3 — ANNUAL EARNINGS CALCULATOR (shared math engine)
// ────────────────────────────────────────────────────────────────────
/**
 * Returns {allowance, chores, staysPut, gamesIt} — all annual $ figures.
 *
 * FV-of-annuity per handoff Q11=B:
 *   For each deposit in a year, FV = deposit × (1 + monthly_rate)^months_remaining
 *   months_remaining = 12 - deposit_month_index (1-based within the year)
 *
 * "staysPut" uses each account's own configured rate.
 * "gamesIt" routes every deposit to whichever account has the higher APR.
 *
 * Falls back to 0s cleanly when data is missing. Never throws.
 */
function calcMaxAnnualEarnings(childName){
  try {
    const data = (state.children && state.children[childName]) || null;
    if(!data) return {allowance:0, chores:0, staysPut:0, gamesIt:0,
                      allowanceDeposited:0, choresDeposited:0};

    const ad = data.autoDeposit || {};
    const rates = data.rates || {checking:0, savings:0};
    const rChk = (parseFloat(rates.checking)||0)/100/12;
    const rSav = (parseFloat(rates.savings )||0)/100/12;
    const rHigh = Math.max(rChk, rSav);

    // Cycles per year by schedule
    const schedMap = {weekly:52, biweekly:26, monthly:12};
    const allowCycles = schedMap[ad.schedule] || 0;
    const allowChk = parseFloat(ad.checking) || 0;
    const allowSav = parseFloat(ad.savings ) || 0;

    // Allowance totals (raw deposited)
    const allowanceDeposited = (allowChk + allowSav) * allowCycles;

    // Chore totals per handoff: D=365, W=52 (per weekday), BW=26, M=12, recurring only
    const chores = (data.chores || []).filter(c => c.schedule && c.schedule !== "once" && !c.paused);
    let choresDeposited = 0;
    let choreChkFlow = 0, choreSavFlow = 0;  // split-weighted flow totals per year
    chores.forEach(c => {
      const occurrencesPerYear =
        c.schedule === "daily"    ? 365 :
        c.schedule === "weekly"   ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length * 52 : 52) :
        c.schedule === "biweekly" ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length * 26 : 26) :
        c.schedule === "monthly"  ? 12 : 0;
      const amt = parseFloat(c.amount)||0;
      choresDeposited += amt * occurrencesPerYear;
      const splitChkPct = (c.splitChk===undefined?50:c.splitChk)/100;
      choreChkFlow += amt * occurrencesPerYear * splitChkPct;
      choreSavFlow += amt * occurrencesPerYear * (1 - splitChkPct);
    });

    // FV-of-annuity over 12 months. We assume deposits are spread evenly across
    // the year (so the month index for the k-th of N deposits = (k * 12/N), 1-based).
    // For each deposit k, months remaining = 12 - monthIndex.
    function fvOfSeries(perCycleAmt, cyclesPerYear, monthlyRate){
      if(!perCycleAmt || !cyclesPerYear) return 0;
      let fv = 0;
      for(let k=1; k<=cyclesPerYear; k++){
        const monthIdx = k * (12/cyclesPerYear);
        const monthsRemaining = Math.max(0, 12 - monthIdx);
        fv += perCycleAmt * Math.pow(1 + monthlyRate, monthsRemaining);
      }
      return fv;
    }

    // staysPut — allowance into its configured accounts; chores into their configured splits
    const allowFvStaysPut = fvOfSeries(allowChk, allowCycles, rChk) + fvOfSeries(allowSav, allowCycles, rSav);

    // Chores are more fiddly because each chore has its own schedule. Sum per-chore FVs.
    let choreFvStaysPut = 0;
    let choreFvGamesIt  = 0;
    chores.forEach(c => {
      const occ =
        c.schedule === "daily"    ? 365 :
        c.schedule === "weekly"   ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length * 52 : 52) :
        c.schedule === "biweekly" ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length * 26 : 26) :
        c.schedule === "monthly"  ? 12 : 0;
      const amt = parseFloat(c.amount)||0;
      const splitChkPct = (c.splitChk===undefined?50:c.splitChk)/100;
      const chkPart = amt * splitChkPct;
      const savPart = amt * (1 - splitChkPct);
      choreFvStaysPut += fvOfSeries(chkPart, occ, rChk) + fvOfSeries(savPart, occ, rSav);
      choreFvGamesIt  += fvOfSeries(amt,     occ, rHigh);
    });

    // gamesIt — everything (allowance + chores) flows to the highest-yield account
    const allowTotalPerCycle = allowChk + allowSav;
    const allowFvGamesIt = fvOfSeries(allowTotalPerCycle, allowCycles, rHigh);

    const staysPut = allowanceDeposited + choresDeposited + (allowFvStaysPut - (allowChk+allowSav)*allowCycles) + (choreFvStaysPut - choresDeposited);
    const gamesIt  = allowanceDeposited + choresDeposited + (allowFvGamesIt  - allowTotalPerCycle*allowCycles) + (choreFvGamesIt  - choresDeposited);

    return {
      allowance: allowanceDeposited,
      chores:    choresDeposited,
      staysPut:  staysPut,
      gamesIt:   gamesIt,
      allowanceDeposited: allowanceDeposited,
      choresDeposited:    choresDeposited
    };
  } catch(e){
    return {allowance:0, chores:0, staysPut:0, gamesIt:0, allowanceDeposited:0, choresDeposited:0};
  }
}

/**
 * Persistent Annual Earnings Calculator card — rendered inside the Child Profile
 * sheet. Auto-refreshes whenever the parent opens the sheet or changes a setting
 * on the active child.
 */
function renderEarningsCard(childName){
  const el = document.getElementById("earnings-card-body");
  if(!el) return;
  if(!childName){ el.innerHTML = '<div style="color:var(--muted);font-size:16px;">Select a child to see projections.</div>'; return; }
  const r = calcMaxAnnualEarnings(childName);
  el.innerHTML = `
    <div class="earnings-grid">
      <div class="earnings-cell">
        <div class="earnings-label">Allowance / yr</div>
        <div class="earnings-value">${fmt(r.allowance)}</div>
      </div>
      <div class="earnings-cell">
        <div class="earnings-label">Chores / yr (max)</div>
        <div class="earnings-value">${fmt(r.chores)}</div>
      </div>
      <div class="earnings-cell earnings-cell-primary">
        <div class="earnings-label">Stays put (default split)</div>
        <div class="earnings-value">${fmt(r.staysPut)}</div>
      </div>
      <div class="earnings-cell earnings-cell-warn">
        <div class="earnings-label">Games it (highest-yield)</div>
        <div class="earnings-value">${fmt(r.gamesIt)}</div>
      </div>
    </div>
    <div style="font-size:14px;color:var(--muted);margin-top:8px;">
      Compounded monthly using each account's APR. "Games it" assumes every dollar routes to the higher-yield account.
    </div>`;
}


// Attach earnings card auto-refresh to Child Profile sheet open
(function wireEarningsCardRefresh(){
  const orig = typeof renderChildProfileSection === "function" ? renderChildProfileSection : null;
  if(!orig) return;
  window.renderChildProfileSection = function(){
    const r = orig.apply(this, arguments);
    try { renderEarningsCard(activeChild); } catch(e){}
    return r;
  };
})();

// ════════════════════════════════════════════════════════════════════
// MONEY INPUT FORMATTER — v34.0
// Any <input class="money-input"> gets:
//   • On blur: value formats to "$1,234.56" (display-only type=text)
//   • On focus: strips format, switches to type=number so mobile gets
//     the numeric keypad and the user can edit raw digits.
//   • On paste: accepts "$1,234.56", "1234.56", "1,234", etc. Keeps digits
//     and one decimal point, drops everything else.
// Works on both static inputs (tagged in index.html) and dynamically-
// rendered inputs (any template string that emits class="money-input").
// installMoneyInputs() is idempotent — safe to call repeatedly.
// ════════════════════════════════════════════════════════════════════

function _parseMoneyRaw(str){
  if(str === null || str === undefined) return NaN;
  // Strip everything that isn't a digit, dot, or minus. Keep first minus only.
  const s = String(str).replace(/[^\d.\-]/g, "");
  if(s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function _formatMoneyDisplay(n){
  if(!isFinite(n)) return "";
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  return sign + "$" + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function installMoneyInputs(root){
  const scope = root || document;
  const inputs = scope.querySelectorAll("input.money-input");
  inputs.forEach(el => {
    if(el.dataset.moneyWired === "1") return;  // idempotent
    el.dataset.moneyWired = "1";

    // Initial paint: if the element shipped with a numeric value, format it.
    if(el.value !== "" && !isNaN(_parseMoneyRaw(el.value))){
      const n = _parseMoneyRaw(el.value);
      el.type  = "text";
      el.inputMode = "decimal";
      el.value = _formatMoneyDisplay(n);
    }

    el.addEventListener("focus", function(){
      // Switch to raw number for easy editing + numeric keypad
      const n = _parseMoneyRaw(el.value);
      el.type = "number";
      el.value = isNaN(n) ? "" : String(n);
      // Select all so typing replaces rather than appending to "0"
      setTimeout(() => { try { el.select(); } catch(e){} }, 0);
    });

    el.addEventListener("blur", function(){
      const n = _parseMoneyRaw(el.value);
      if(isNaN(n)){
        el.type  = "text";
        el.inputMode = "decimal";
        el.value = "";
        return;
      }
      el.type  = "text";
      el.inputMode = "decimal";
      el.value = _formatMoneyDisplay(n);
    });

    el.addEventListener("paste", function(ev){
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData("text");
      const n = _parseMoneyRaw(text);
      if(isNaN(n)) return;
      // During paste we're in focus state → type=number. Write raw number.
      el.value = String(n);
      // Nudge any oninput listeners (loan preview etc.) that depend on the value
      el.dispatchEvent(new Event("input", {bubbles:true}));
    });
  });
}

// Note: _parseMoneyRaw(document.getElementById("x").value) is how any
// existing submit handler should read a money field. The existing code uses
// parseFloat(...) which ALSO works on raw-number input during blur timing,
// because we switch type=number on focus. Edge case: if submit fires while
// the element is still in display state (type=text, "$5.00"), parseFloat
// returns NaN. Submit handlers that want to be robust should call
// _parseMoneyRaw instead. For v34.0 we're relying on the blur-first rule
// (fields always lose focus before a button click — mobile bottom-sheet
// pattern enforces this).

// Wire on initial DOM ready
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", () => installMoneyInputs());
} else {
  installMoneyInputs();
}

// Global helper for submit handlers — safely reads a money-input field
// whether it's in focused raw-number state or blurred formatted-text state.
// Returns NaN on bad input; callers wrap with `|| 0` to coerce like parseFloat.
window.readMoney = function(id){
  const el = document.getElementById(id);
  if(!el) return NaN;
  return _parseMoneyRaw(el.value);
};

// Helper for code that programmatically sets a money-input value. Call this
// after assigning .value = someNumber — it formats the display without
// disturbing focus state. No-op if the element is currently focused (user
// would see their typing get clobbered).
function _reformatMoneyInput(el){
  if(!el) return;
  if(document.activeElement === el) return;  // don't fight the user
  const n = _parseMoneyRaw(el.value);
  if(isNaN(n)){
    el.type  = "text";
    el.inputMode = "decimal";
    el.value = "";
    return;
  }
  el.type  = "text";
  el.inputMode = "decimal";
  el.value = _formatMoneyDisplay(n);
}
window._reformatMoneyInput = _reformatMoneyInput;

// ════════════════════════════════════════════════════════════════════
// v34.1 ADDITIONS — appended at end of file so everything above stays intact
// ════════════════════════════════════════════════════════════════════

// ─── Item 13: "Next: <date>" pill for chore cards ───────────────────
/**
 * Given a chore, return the next Date it will come due, or null if none.
 * Skips "once" chores whose date has already passed.
 */
function getNextChoreOccurrence(chore){
  if(!chore) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "once" — either onceDate (specific) or today (if no date set)
  if(chore.schedule === "once"){
    if(!chore.onceDate) return chore.status === "approved" ? null : today;
    const d = new Date(chore.onceDate + "T00:00:00");
    if(isNaN(d.getTime())) return null;
    if(chore.status === "approved") return null;
    return d; // may be past = overdue
  }

  // daily — today (if not done) or tomorrow
  if(chore.schedule === "daily"){
    if(chore.lastCompleted === todayStr()){
      const t = new Date(today); t.setDate(t.getDate()+1); return t;
    }
    return today;
  }

  // weekly / biweekly — scan next 21 days for a day-of-week match
  if(chore.schedule === "weekly" || chore.schedule === "biweekly"){
    const days = chore.weekdays || (chore.weekday !== undefined ? [chore.weekday] : []);
    if(!days.length) return null;
    for(let i=0; i<21; i++){
      const d = new Date(today); d.setDate(d.getDate()+i);
      if(days.indexOf(d.getDay()) === -1) continue;
      // Bi-weekly phase check
      if(chore.schedule === "biweekly"){
        const created = new Date(chore.createdAt || Date.now());
        const weeksDiff = Math.floor((d.getTime() - created.getTime()) / (7*24*60*60*1000));
        const offset = chore.skipFirstWeek ? 1 : 0;
        if((weeksDiff + offset) % 2 !== 0) continue;
      }
      // Skip today if already completed today
      if(i === 0 && chore.lastCompleted === todayStr()) continue;
      return d;
    }
    return null;
  }

  // monthly — this month's target day (if future), else next month
  if(chore.schedule === "monthly"){
    const tryMonth = (year, monthIdx) => {
      const td = typeof resolveMonthlyDay === "function"
        ? resolveMonthlyDay(chore.monthlyDay || "1", year, monthIdx)
        : parseInt(chore.monthlyDay || 1);
      return new Date(year, monthIdx, td);
    };
    let d = tryMonth(now.getFullYear(), now.getMonth());
    if(d < today || chore.lastCompleted === todayStr()){
      d = tryMonth(now.getFullYear(), now.getMonth() + 1);
    }
    return d;
  }

  return null;
}

function _formatNextLabel(d){
  if(!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if(dDate.getTime() === today.getTime())    return {label:"today",    cls:"today"};
  if(dDate.getTime() === tomorrow.getTime()) return {label:"tomorrow", cls:""};
  if(dDate < today){
    // overdue
    const txt = dDate.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
    return {label:"overdue ("+txt+")", cls:"overdue"};
  }
  const txt = dDate.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
  return {label:txt, cls:""};
}

function _renderNextChorePill(chore){
  try {
    const d = getNextChoreOccurrence(chore);
    if(!d) return "";
    const lbl = _formatNextLabel(d);
    if(!lbl) return "";
    return '<div class="chore-next-pill '+lbl.cls+'"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-calendar"/></svg> Next: '+lbl.label+'</div>';
  } catch(e){ return ""; }
}

// ─── Item 10: Animate slider to preset value ────────────────────────
function animateSplitTo(sliderId, targetValue, updateFnName){
  const el = document.getElementById(sliderId);
  if(!el) return;
  const start = parseInt(el.value || "50", 10);
  const end = parseInt(targetValue, 10);
  if(start === end){ el.value = end; try { window[updateFnName]?.(); } catch(e){} return; }
  const duration = 200;
  const t0 = performance.now();
  function step(now){
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1-p, 3); // ease-out cubic
    el.value = Math.round(start + (end - start) * eased);
    try { window[updateFnName]?.(); } catch(e){}
    if(p < 1) requestAnimationFrame(step);
    else { el.value = end; try { window[updateFnName]?.(); } catch(e){} }
  }
  requestAnimationFrame(step);
}
window.animateSplitTo = animateSplitTo;

// ─── Items 2 + 8: Percent input helpers (parallels the money system) ──
function _parsePercentRaw(str){
  if(str === null || str === undefined) return NaN;
  const s = String(str).replace(/[^\d.\-]/g, "");
  if(s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function _formatPercentDisplay(n){
  if(!isFinite(n)) return "";
  // Trim trailing zeros: 5 → "5%", 5.5 → "5.5%", 5.25 → "5.25%"
  let s = Number(n).toFixed(2);
  s = s.replace(/\.?0+$/, "");
  return s + "%";
}

function installPercentInputs(root){
  const scope = root || document;
  const inputs = scope.querySelectorAll("input.percent-input");
  inputs.forEach(el => {
    if(el.dataset.percentWired === "1") return;
    el.dataset.percentWired = "1";
    if(el.value !== "" && !isNaN(_parsePercentRaw(el.value))){
      const n = _parsePercentRaw(el.value);
      el.type = "text";
      el.inputMode = "decimal";
      el.value = _formatPercentDisplay(n);
    }
    el.addEventListener("focus", function(){
      const n = _parsePercentRaw(el.value);
      el.type = "number";
      el.value = isNaN(n) ? "" : String(n);
      setTimeout(() => { try { el.select(); } catch(e){} }, 0);
    });
    el.addEventListener("blur", function(){
      const n = _parsePercentRaw(el.value);
      if(isNaN(n)){
        el.type = "text";
        el.inputMode = "decimal";
        el.value = "0%";
        return;
      }
      el.type = "text";
      el.inputMode = "decimal";
      el.value = _formatPercentDisplay(n);
    });
    el.addEventListener("paste", function(ev){
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData("text");
      const n = _parsePercentRaw(text);
      if(isNaN(n)) return;
      el.value = String(n);
      el.dispatchEvent(new Event("input", {bubbles:true}));
    });
  });
}

function _reformatPercentInput(el){
  if(!el) return;
  if(document.activeElement === el) return;
  const n = _parsePercentRaw(el.value);
  if(isNaN(n)){
    el.type = "text";
    el.inputMode = "decimal";
    el.value = "0%";
    return;
  }
  el.type = "text";
  el.inputMode = "decimal";
  el.value = _formatPercentDisplay(n);
}

window.readPercent = function(id){
  const el = document.getElementById(id);
  if(!el) return NaN;
  return _parsePercentRaw(el.value);
};
window._reformatPercentInput = _reformatPercentInput;

// Wire percent inputs on initial DOM ready and wizard render
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", () => installPercentInputs());
} else {
  installPercentInputs();
}
// Combined reformat helper for setters writing both types of fields
function reformatAllMoneyPercentInputs(scope){
  const s = scope || document;
  s.querySelectorAll("input.money-input").forEach(el => _reformatMoneyInput(el));
  s.querySelectorAll("input.percent-input").forEach(el => _reformatPercentInput(el));
}
window.reformatAllMoneyPercentInputs = reformatAllMoneyPercentInputs;

// ─── Item 9: Delete My Account (parent self-delete) ─────────────────
function _purgeUserFromState(name){
  if(!name || !state) return;
  if(state.users){
    const i = state.users.indexOf(name);
    if(i !== -1) state.users.splice(i, 1);
  }
  ["pins","roles","children","usersData"].forEach(k => {
    if(state[k] && state[k][name] !== undefined) delete state[k][name];
  });
  if(state.config){
    ["emails","avatars","calendars","parentChildren","tabs","notify"].forEach(k => {
      if(state.config[k] && state.config[k][name] !== undefined) delete state.config[k][name];
    });
    // Also remove this name from any OTHER parent's child-list
    if(state.config.parentChildren){
      Object.keys(state.config.parentChildren).forEach(p => {
        const list = state.config.parentChildren[p] || [];
        const idx = list.indexOf(name);
        if(idx !== -1) list.splice(idx, 1);
      });
    }
  }
  if(state.loginStats && state.loginStats[name]) delete state.loginStats[name];
  // Remove local-only avatar photo
  try { localStorage.removeItem("fb_avatar_" + name); } catch(e){}
}
window._purgeUserFromState = _purgeUserFromState;


// v34.2 — Parent Settings sheet
function openParentSettingsSheet(){
  // v38.1 final (In-2) — orphan ps-email-input/ps-email-msg reads removed.
  // Render children list (mirrors renderMyChildren but targets ps-specific container)
  renderMyChildrenInSheet("my-children-list-ps");
  openSheet("sheet-parent-settings");
}

function renderMyChildrenInSheet(containerId){
  const list = document.getElementById(containerId);
  if(!list) return;
  const children = getAssignedChildren ? getAssignedChildren() : [];
  if(!children.length){ list.innerHTML = ""; return; }
  list.innerHTML = children.map(name => {
    const shared = getParentsOfChild ? getParentsOfChild(name).length > 1 : false;
    return `<div class="child-btn-wrap" style="margin-bottom:6px;">
      <div class="child-btn with-avatar" style="cursor:default;pointer-events:none;">
        ${renderAvatar(name,"sm")}
        <span style="font-weight:700;">${escapeHtml(name)}</span>
        <div class="child-btn-balance" style="font-size:14px;">${shared?"Shared":"Only on your account"}</div>
      </div>
      <button class="btn btn-sm btn-outline child-btn-wizard" onclick="uwOpenEdit('${name}')" title="Edit with Wizard">🪄</button>
      <button class="btn btn-sm btn-outline" style="width:auto;margin:0;padding:6px 10px;" onclick="openShareChildSheet('${name}')">Share</button>
      <button class="btn btn-sm btn-ghost" style="width:auto;margin:0;padding:6px 10px;color:var(--danger);" onclick="confirmRemoveChild('${name}')"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-trash"/></svg></button>
    </div>`;
  }).join("");
}

// v38 Step 4 — saveParentEmailFromSheet removed (parent self-service email edit retired; D5/D6 throw-out).
function openDeleteMyAccount(){
  if(!currentUser){ return; }
  // Guard: cannot delete the last parent
  const parentCount = (state.users||[]).filter(u => state.roles && state.roles[u] === "parent").length;
  if(parentCount <= 1){
    openModal({
      icon:"⚠️",
      title:"Can't delete this account",
      body:"You are the only parent account. Add another parent first, or use Admin > DANGER_resetEverything to wipe everything.",
      confirmText:"OK",
      confirmClass:"btn-primary",
      onConfirm:()=>{ closeModal(); }
    });
    return;
  }
  // Identify which children this parent solo-parents vs shares
  const myKids = (state.config.parentChildren && state.config.parentChildren[currentUser]) || [];
  const sharedKids = [];
  const soloKids   = [];
  myKids.forEach(k => {
    let otherParents = 0;
    Object.keys(state.config.parentChildren || {}).forEach(p => {
      if(p === currentUser) return;
      if((state.config.parentChildren[p] || []).indexOf(k) !== -1) otherParents++;
    });
    if(otherParents > 0) sharedKids.push(k);
    else soloKids.push(k);
  });
  let bodyText = "This will permanently delete your parent account (" + currentUser + ").";
  if(soloKids.length) bodyText += " Also deletes " + soloKids.join(", ") + " (solo-parented).";
  if(sharedKids.length) bodyText += " Unassigns you from shared: " + sharedKids.join(", ") + ".";
  bodyText += " This cannot be undone.";
  openModal({
    icon:"⚠️",
    title:"Delete your account?",
    body: bodyText,
    confirmText:"I understand, continue",
    confirmClass:"btn-danger",
    onConfirm:()=>{
      closeModal();
      // Second-confirm typed DELETE
      const typed = prompt('Type DELETE (in all caps) to permanently delete your account:');
      if(typed !== "DELETE"){
        showToast("Cancelled — account not deleted.", "info");
        return;
      }
      // Nuke solo kids first
      soloKids.forEach(k => _purgeUserFromState(k));
      // Remove self
      _purgeUserFromState(currentUser);
      syncToCloud("Parent Self-Delete");
      showToast("Account deleted.", "success");
      setTimeout(()=>{ try { logout(); } catch(e){ location.reload(); } }, 600);
    }
  });
}
window.openDeleteMyAccount = openDeleteMyAccount;

// ─── Item 14: Calendar status check (client side) ───────────────────
async function checkChoreCalendar(chore){
  const statusEl = document.getElementById("chore-cal-status");
  if(!statusEl || !chore || !activeChild) return;
  // Only show if this child has calendar notifications turned on
  const notify = (state.config && state.config.notify && state.config.notify[activeChild]) || {};
  if(!notify.calendar){
    statusEl.classList.add("hidden");
    statusEl.innerHTML = "";
    return;
  }
  // Show a loading state
  statusEl.className = "chore-cal-status";
  statusEl.classList.remove("hidden");
  statusEl.innerHTML = '<span class="cal-status-label"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-calendar"/></svg> Checking calendar…</span>';
  try {
    const url = API_URL +
      "?action=checkCalendar" +
      "&child="     + encodeURIComponent(activeChild) +
      "&choreId="   + encodeURIComponent(chore.id || "") +
      "&choreName=" + encodeURIComponent(chore.name || "") +
      "&t="         + Date.now();
    const res = await fetch(url);
    const data = await res.json();
    if(data.noCalendar){
      statusEl.classList.add("hidden");
      statusEl.innerHTML = "";
      return;
    }
    if(data.calendarOff){
      statusEl.classList.add("hidden");
      statusEl.innerHTML = "";
      return;
    }
    const events = data.events || [];
    if(events.length > 0){
      statusEl.className = "chore-cal-status on";
      statusEl.innerHTML = '<span class="cal-status-label"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-check-circle"/></svg> On calendar (' + events.length + ' match' + (events.length===1?"":"es") + ')</span>';
    } else {
      statusEl.className = "chore-cal-status off";
      statusEl.innerHTML =
        '<span class="cal-status-label"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-warning"/></svg> Not on calendar</span>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="reAddChoreToCalendar(\'' + (chore.id || "").replace(/'/g, "\\'") + '\')"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-calendar-plus"/></svg> Re-add</button>';
    }
  } catch(err){
    statusEl.classList.add("hidden");
    statusEl.innerHTML = "";
  }
}
window.checkChoreCalendar = checkChoreCalendar;

/**
 * Safe re-add: re-run the check to make sure nothing was added between
 * the initial render and the button tap, then trigger a no-op edit save to
 * let syncCalendarEvent rebuild the event series on the server.
 */
async function reAddChoreToCalendar(choreId){
  if(!choreId) return;
  const data = getChildData(activeChild);
  const chore = (data.chores || []).find(c => c.id === choreId);
  if(!chore){ showToast("Chore not found.", "error"); return; }
  // Re-check before blindly creating
  const statusEl = document.getElementById("chore-cal-status");
  if(statusEl){
    statusEl.className = "chore-cal-status";
    statusEl.innerHTML = '<span class="cal-status-label"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-spinner"/></svg> Re-checking…</span>';
  }
  try {
    const url = API_URL + "?action=checkCalendar&child=" + encodeURIComponent(activeChild) +
      "&choreId=" + encodeURIComponent(chore.id || "") +
      "&choreName=" + encodeURIComponent(chore.name || "") +
      "&t=" + Date.now();
    const res = await fetch(url);
    const d = await res.json();
    if(d.events && d.events.length > 0){
      // It got added by someone else in the meantime — just refresh status
      checkChoreCalendar(chore);
      showToast("Already on calendar.", "info");
      return;
    }
  } catch(e){ /* fall through, still try the sync */ }
  // v38.1 final (M-2) — exact lastAction string (Code.gs matches "Chore Edited"
  // with ===, so the old suffixed form never hit its branch) and _editedChoreId
  // handed in via opts.extra so it actually rides the queued payload.
  syncToCloud("Chore Edited", {activeChild:activeChild, extra:{_editedChoreId:chore.id}});
  setTimeout(()=>{ checkChoreCalendar(chore); }, 2500);
  showToast("Added to calendar.", "success");
}
window.reAddChoreToCalendar = reAddChoreToCalendar;


// ════════════════════════════════════════════════════════════════════
// v35.0 — Android back button: app-internal navigation stack.
// Uses history.pushState to intercept the Android system back gesture
// on mobile browsers/PWAs. Each significant view change pushes a state;
// popstate pops that view rather than exiting the app. When the stack
// is empty, a confirm() is shown before allowing the default exit.
// ════════════════════════════════════════════════════════════════════
(function(){
  const KEY = "fb_nav";
  const stack = [];  // array of handlers: fn called on back
  let poppingInternal = false;

  function seed(){
    // Baseline history entry so the first back press is captured
    try { history.replaceState({fb:KEY, base:true}, "", location.href); } catch(e){}
  }

  // Push a handler onto the back stack. Called when a view opens.
  window.fbNavPush = function(handler){
    if(typeof handler !== "function") return;
    stack.push(handler);
    try { history.pushState({fb:KEY, depth:stack.length}, "", location.href); } catch(e){}
  };

  // Pop without triggering (e.g., when the user closes a sheet via the × button).
  window.fbNavPop = function(){
    if(!stack.length) return;
    stack.pop();
    poppingInternal = true;
    try { history.back(); } catch(e){}
  };

  window.addEventListener("popstate", function(){
    if(poppingInternal){ poppingInternal = false; return; }
    if(stack.length){
      const fn = stack.pop();
      try { fn(); } catch(e){ console.error("[fbNav] handler failed:", e); }
      // Re-seed a forward entry so subsequent backs still get captured
      try { history.pushState({fb:KEY, base:true}, "", location.href); } catch(e){}
    } else {
      // Empty stack: ask before exit
      const ok = confirm("Exit FamilyBank?");
      if(!ok){
        try { history.pushState({fb:KEY, base:true}, "", location.href); } catch(e){}
      }
      // If ok, let the default behavior happen (history is already popped)
    }
  });

  // Seed on first load
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", seed);
  } else { seed(); }

  // Wrap openSheet/closeSheet/showChildPicker to auto-maintain the stack.
  // v35.0 exception for the legacy #sheet-wizard removed in v38.1 final (sheet gone).
  const NO_STACK = {};
  const _open  = window.openSheet;
  const _close = window.closeSheet;
  if(typeof _open === "function"){
    window.openSheet = function(id){
      const r = _open.apply(this, arguments);
      if(NO_STACK[id]) return r; // skip stack for excluded sheets
      try {
        fbNavPush(()=>{
          try { _close && _close(id, true); } catch(e){}
        });
      } catch(e){}
      return r;
    };
  }
  // When a sheet closes programmatically, pop one from stack to stay in sync
  if(typeof _close === "function"){
    window.closeSheet = function(id, force){
      const r = _close.apply(this, arguments);
      if(NO_STACK[id]) return r; // wizard never pushed, so don't pop
      if(stack.length) { stack.pop(); poppingInternal = true; try{ history.back(); }catch(e){} }
      return r;
    };
  }
})();

// ════════════════════════════════════════════════════════════════════
// v38.1 WIZARD v2 — shared step engine + USER WIZARD (Drop-1)
// Spec of record: FamilyBank_v38_1_Wizard_Scope_Lock.md (Halyard, 2026-07-03)
// Replaced the legacy #sheet-wizard (child wizard) and #sheet-user-edit (add/edit
// user); both surfaces were removed in v38.1 final along with #sheet-chore-creator.
// Commit model: ZERO mid-wizard POSTs (Spec-E). S3 order: state POST first
// (emails untouched), verified {status:"ok"}, THEN setChildEmail GET leg.
// ════════════════════════════════════════════════════════════════════

let wz = null;                          // active wizard instance
const WZ_DRAFT_KEY = "fb_wiz_draft";    // Spec-H — device-local draft

// ── small helpers ───────────────────────────────────────────────────
function wzEsc(s){ return escapeHtml(s); }
function wzEmailOk(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function uwOtherChildren(){
  // Copy-source candidates: every existing child except the one being edited.
  const ex = (wz && wz.mode==="edit") ? wz.meta.editName : null;
  return getChildNames().filter(n => n !== ex);
}
const WZ_WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function uwMonthDayLabel(v){
  if(v==="last") return "Last day of month";
  if(v==="last-1") return "2nd-to-last day";
  if(v==="last-2") return "3rd-to-last day";
  const n = parseInt(v,10);
  if(!n) return String(v||"");
  return n + (n===1?"st":n===2?"nd":n===3?"rd":"th") + " of the month";
}

// ── draft persistence (Spec-H) ─────────────────────────────────────
function wzDraftKey(){ return (wz && wz.meta && wz.meta.draftKey) || WZ_DRAFT_KEY; }   // v38.1 final — chore wizard uses fb_cw_draft
function wzSaveDraft(){
  if(!wz || wz.meta.committed) return;
  try{
    const d = {...wz.draft}; delete d._photo;  // dataURLs too big for the draft slot
    localStorage.setItem(wzDraftKey(), JSON.stringify({
      k: wz.kind, mode: wz.mode, editName: wz.meta.editName || null,
      idx: wz.idx, draft: d, ts: Date.now()
    }));
  }catch(_){}
}
function wzLoadDraft(kind, mode, editName, key){
  try{
    const raw = localStorage.getItem(key||WZ_DRAFT_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(s.k!==kind || s.mode!==mode) return null;
    if(mode==="edit" && s.editName!==editName) return null;
    return s;
  }catch(_){ return null; }
}
function wzClearDraft(){ try{ localStorage.removeItem(wzDraftKey()); }catch(_){} }

// ── engine: navigation ─────────────────────────────────────────────
function wzVisible(){ return wz.steps.filter(s => !(s.skip && s.skip(wz.draft))); }
function wzCur(){ return wz.steps[wz.idx]; }
function wzStepIndexById(id){ return wz.steps.findIndex(s => s.id===id); }
function wzIsSkipped(step){ return !!(step.skip && step.skip(wz.draft)); }

function wzNormalizeIdx(){
  // If the current step became skipped (e.g. after a draft resume or a
  // dependency flip), slide forward to the next visible step.
  let guard = 0;
  while(wz.idx < wz.steps.length && wzIsSkipped(wz.steps[wz.idx]) && guard++ < 60){ wz.idx++; }
  if(wz.idx >= wz.steps.length) wz.idx = wzStepIndexById("review");
}

function wzGotoId(id){
  const i = wzStepIndexById(id);
  if(i === -1) return;
  wz.idx = i; wzNormalizeIdx(); wzRender();
}

/** Advance after the current step's value is saved on the draft. */
function wzAdvance(){
  wzSaveDraft();
  const cur = wzCur();
  if(cur.afterPick === "review" && wz.draft._copied){ wz.meta.returnToReview=false; wzGotoId("review"); return; }
  if(wz.meta.returnToReview){
    // Came from a Review edit-link. Return to Review unless the change
    // exposed a required step that's now unset (e.g. allowance flipped ON):
    // continue forward to the first invalid required step instead (spec §2 Spec-E).
    const vis = wzVisible();
    const curVisIdx = vis.indexOf(cur);
    for(let i=curVisIdx+1; i<vis.length; i++){
      const s = vis[i];
      if(s.id==="review" || s.id==="success" || s.id==="resume") break;
      if(s.validate && s.validate(wz.draft) !== true){ wz.idx = wzStepIndexById(s.id); wzRender(); return; }
    }
    wz.meta.returnToReview = false;
    wzGotoId("review"); return;
  }
  const vis = wzVisible();
  const curVisIdx = vis.indexOf(cur);
  const next = vis[curVisIdx+1];
  if(next){ wz.idx = wzStepIndexById(next.id); wzRender(); }
}

function wzBack(){
  const cur = wzCur();
  if(cur.id==="success") return;
  if(wz.meta.returnToReview){ wz.meta.returnToReview=false; wzGotoId("review"); return; }
  const vis = wzVisible();
  const curVisIdx = vis.indexOf(cur);
  if(curVisIdx > 0){
    const prev = vis[curVisIdx-1];
    if(prev.id==="resume") return;                 // never navigate back into resume
    wz.idx = wzStepIndexById(prev.id); wzSaveDraft(); wzRender();
  }
}

function wzJump(id){
  // Review edit-link: jump to a step, return to Review on its advance (Spec-E).
  wz.meta.returnToReview = true;
  wzGotoId(id);
}

function wzClose(){
  // ✕ pre-commit: plain close. Draft persists in localStorage (Spec-H) —
  // reopening offers Resume/Start-over. Post-commit ✕ = Done.
  if(wz && wz.meta.committed){ (wz.meta.onDone||uwSuccessDone)(); return; }
  // v38.2-5 — three cases on a pre-commit close:
  //   at the Resume prompt  -> leave the saved draft as it is (saving here overwrote it with a blank one)
  //   draft untouched       -> clear, so the next open does not ask "Pick up where you left off?"
  //   anything typed/picked -> save as before (Spec-H)
  const _cur = wz && wzCur();
  const _untouched = !!(wz && wz.meta.pristine && JSON.stringify(wz.draft) === wz.meta.pristine);
  if(_cur && _cur.id === "resume"){ /* keep stored draft */ }
  else if(_untouched){ wzClearDraft(); }
  else { wzSaveDraft(); }
  closeSheet("sheet-wiz2", true);
  wz = null;
}

// ── engine: input plumbing ─────────────────────────────────────────
function wzChooseIdx(i){
  const s = wzCur(); if(!s || !s.options) return;
  const opt = s.options[i]; if(!opt) return;
  if(s.beforePick && s.beforePick(opt.v) === false){ return; } // guard hook (inline msg set by hook)
  wz.draft[s.field] = opt.v;
  if(s.onPick) s.onPick(opt.v);
  wzAdvance();
}
function wzToggleIdx(i){
  const s = wzCur(); if(!s || !s.options) return;
  const opt = s.options[i]; if(!opt) return;
  if(s.multiKind === "tabs"){
    wz.draft.tabs[opt.v] = !wz.draft.tabs[opt.v];
  } else {
    const arr = wz.draft[s.field] || (wz.draft[s.field]=[]);
    const at = arr.indexOf(opt.v);
    if(at===-1) arr.push(opt.v); else arr.splice(at,1);
  }
  wzSaveDraft();
  wzRenderBodyOnly();
}
function wzTextInput(){
  const s = wzCur();
  const el = document.getElementById("wz-input");
  if(!s || !el) return;
  wz.draft[s.field] = el.value;
  wzRefreshPrimary();
  wzInlineMsg(s);
}
function wzPinInput(){
  const el = document.getElementById("wz-input"); if(!el) return;
  let v = (el.value||"").replace(/\D/g,"").slice(0,4);
  if(el.value !== v) el.value = v;
  wz.draft.pin = v;
  const s = wzCur();
  wzInlineMsg(s);
  if(v.length===4){
    if(s.validate(wz.draft) === true){ wzAdvance(); }
  }
}
function wzKeydown(ev){
  if(ev.key !== "Enter") return;
  ev.preventDefault();
  const btn = document.getElementById("wz-primary");
  if(btn && !btn.disabled) wzPrimary();
}
function wzInlineMsg(s){
  const m = document.getElementById("wz-msg"); if(!m) return;
  const r = s.validate ? s.validate(wz.draft) : true;
  const raw = (wz.draft[s.field]==null?"":String(wz.draft[s.field]));
  if(r === true || raw.trim()===""){ m.className="wz-msg"; m.textContent=""; }
  else { m.className="wz-msg error"; m.textContent = r; }
}
function wzRefreshPrimary(){
  const s = wzCur();
  const btn = document.getElementById("wz-primary"); if(!btn || !s) return;
  btn.disabled = s.validate ? (s.validate(wz.draft) !== true) : false;
}
/** Primary button — text/multi/etc. steps (Spec-B). */
function wzPrimary(){
  const s = wzCur(); if(!s) return;
  if(s.onPrimary && s.onPrimary() === false) return;
  if(s.validate && s.validate(wz.draft) !== true){ wzInlineMsg(s); return; }
  wzAdvance();
}
function wzSecondary(){
  const s = wzCur(); if(!s || !s.onSecondary) return;
  s.onSecondary();
}

// ── engine: render ─────────────────────────────────────────────────
function wzRender(){
  const body = document.getElementById("wz2-body");
  const foot = document.getElementById("wz2-footer");
  if(!body || !foot || !wz) return;
  wzNormalizeIdx();
  const s = wzCur();
  const vis = wzVisible().filter(x => x.id!=="resume" && x.id!=="success");
  const pos = Math.max(1, vis.indexOf(s)+1);

  // header chrome
  const backBtn = document.getElementById("wz2-back");
  const secEl   = document.getElementById("wz2-section");
  const fill    = document.getElementById("wz2-progress-fill");
  const noChrome = (s.id==="resume" || s.id==="success");
  if(backBtn){
    const vAll = wzVisible();
    const firstNav = vAll.find(x => x.id!=="resume");
    const hideBack = noChrome || (s === firstNav && !wz.meta.returnToReview)
      || (s.id==="review" && wz.mode==="edit" && !wz.meta.navigated);
    backBtn.style.visibility = hideBack ? "hidden" : "visible";
  }
  if(secEl) secEl.textContent = wz.meta.sectionLabel;
  if(fill)  fill.style.width = noChrome ? "0%" : Math.round((pos/vis.length)*100) + "%";
  if(s.id!=="resume" && s.id!=="review" && s.id!=="success") wz.meta.navigated = true;

  // body
  const title = (typeof s.title==="function") ? s.title(wz.draft) : s.title;
  const sub   = s.sub ? ((typeof s.sub==="function") ? s.sub(wz.draft) : s.sub) : "";
  body.innerHTML = `
    ${noChrome ? "" : `<h2 class="wz-q">${title}</h2>`}
    ${sub ? `<div class="wz-sub">${sub}</div>` : ""}
    <div id="wz-content">${s.render(wz.draft)}</div>
    <div class="wz-msg" id="wz-msg"></div>`;

  // footer
  foot.innerHTML = wzFooterHtml(s);
  wzRefreshPrimary();

  // Spec-G: autofocus on step entry
  setTimeout(()=>{ const el=document.getElementById("wz-input"); if(el){ el.focus(); } }, 80);
  body.scrollTop = 0;
}
function wzRenderBodyOnly(){
  const s = wzCur();
  const c = document.getElementById("wz-content");
  if(c && s){ c.innerHTML = s.render(wz.draft); wzRefreshPrimary(); }
}
function wzFooterHtml(s){
  if(s.footer === "none") return "";
  if(s.footer === "custom") return s.footerHtml ? s.footerHtml(wz.draft) : "";
  let h = "";
  if(s.secondaryLabel) h += `<button class="wz-btn-secondary" onclick="wzSecondary()">${s.secondaryLabel}</button>`;
  h += `<button class="btn btn-primary wz-btn-primary" id="wz-primary" onclick="wzPrimary()">${s.primaryLabel||"Continue"}</button>`;
  return h;
}

// ── shared render fragments ────────────────────────────────────────
function wzOptButtons(s, selectedTest){
  return s.options.map((o,i)=>`
    <button type="button" class="wz-opt${selectedTest(o.v)?" selected":""}" onclick="${s.multi?`wzToggleIdx(${i})`:`wzChooseIdx(${i})`}">
      <span class="wz-opt-label">${o.label}</span>
      ${o.desc?`<span class="wz-opt-desc">${o.desc}</span>`:""}
    </button>`).join("");
}
function wzChoiceRender(d){
  const s = wzCur();
  return `<div class="wz-opts">${wzOptButtons(s, v => d[s.field]===v)}</div>`;
}
function wzMultiRender(d){
  const s = wzCur();
  const test = s.multiKind==="tabs" ? (v)=>!!d.tabs[v] : (v)=> (d[s.field]||[]).indexOf(v)!==-1;
  return `<div class="wz-opts">${wzOptButtons(s, test)}</div>`;
}

// ════════════════════════════════════════════════════════════════════
// USER WIZARD
// ════════════════════════════════════════════════════════════════════

function uwBlankDraft(){
  return {
    role: undefined, name:"", pin:"", email:"", emailSkipped:false,
    assignChildren: [],
    copyChoice: undefined, copyFrom: undefined, _copied:false,
    tabs: {money:false, chores:false, loans:false},
    useAllowance: undefined, structure: undefined, schedule: undefined,
    allowWeekday: undefined, allowMonthlyDay: undefined,
    allowChk: "", allowSav: "", rateChk:"", rateSav:"",
    choreRewards: undefined,
    notifyEmail: undefined, notifyChoreRewards: undefined,
    useCalendar: undefined, calendarId:"",
    celebrationSound: undefined,
    avatarEmoji:"", _photo:null,
    _oldEmail:""
  };
}

/** Edit-mode prefill (field set inherited from the retired legacy child wizard). */
function uwPrefillEdit(name){
  const d = uwBlankDraft();
  const role = (state.roles && state.roles[name]) || "child";
  d.role = role;
  d.name = name;
  d.pin  = "";                                        // blank = keep current (legacy rule)
  d._oldEmail = (state.config.emails && state.config.emails[name]) || "";
  d.email = d._oldEmail;
  d.emailAction = d._oldEmail ? "keep" : undefined;   // d1.2 R-1 default
  if(role === "parent"){
    d.assignChildren = [ ...(((state.config.parentChildren||{})[name]) || []) ];
    return d;
  }
  const data  = (state.children && state.children[name]) || {};
  const ad    = data.autoDeposit || {};
  const rates = data.rates || {};
  const tabs  = (state.config.tabs && state.config.tabs[name]) || {money:true, chores:true, loans:false};
  const notify= (state.config.notify && state.config.notify[name]) || {};
  d.tabs = {...tabs};
  d.useAllowance = !!((ad.checking||0) + (ad.savings||0));
  d.structure = (ad.checking>0 && ad.savings>0) ? "both" : (ad.savings>0 ? "savings" : "checking");
  d.schedule  = ad.schedule || "weekly";
  d.allowWeekday    = (ad.weekday !== undefined) ? ad.weekday : 1;
  d.allowMonthlyDay = ad.monthlyDay || "1";
  d.allowChk = ad.checking || 0;
  d.allowSav = ad.savings  || 0;
  d.rateChk  = (rates.checking===0 || rates.checking) ? rates.checking : "";
  d.rateSav  = (rates.savings===0  || rates.savings)  ? rates.savings  : "";
  d.choreRewards       = notify.choreRewards !== false;
  d.notifyEmail        = notify.email !== false;
  d.notifyChoreRewards = notify.choreRewards !== false;
  d.useCalendar = !!(state.config.calendars && state.config.calendars[name]);
  d.calendarId  = (state.config.calendars && state.config.calendars[name]) || "";
  d.celebrationSound = !!(state.usersData && state.usersData[name] && state.usersData[name].celebrationSound !== false);
  d.avatarEmoji = (state.config.avatars && state.config.avatars[name]) || "";
  return d;
}

/** Copy-set (spec §3, LOCKED). Reads live state of the source child. */
function uwApplyCopySet(src){
  const d = wz.draft;
  const data  = (state.children && state.children[src]) || {};
  const ad    = data.autoDeposit || {};
  const rates = data.rates || {};
  const tabs  = (state.config.tabs && state.config.tabs[src]) || {money:true, chores:true, loans:false};
  const notify= (state.config.notify && state.config.notify[src]) || {};
  d.tabs = {...tabs};
  d.useAllowance = !!((ad.checking||0) + (ad.savings||0));
  d.structure = (ad.checking>0 && ad.savings>0) ? "both" : (ad.savings>0 ? "savings" : "checking");
  d.schedule  = ad.schedule || "weekly";
  d.allowWeekday    = (ad.weekday !== undefined) ? ad.weekday : 1;
  d.allowMonthlyDay = ad.monthlyDay || "1";
  d.allowChk = ad.checking || 0;
  d.allowSav = ad.savings  || 0;
  d.rateChk  = (rates.checking===0 || rates.checking) ? rates.checking : "";
  d.rateSav  = (rates.savings===0  || rates.savings)  ? rates.savings  : "";
  d.choreRewards       = notify.choreRewards !== false;
  d.notifyEmail        = notify.email !== false;
  d.notifyChoreRewards = notify.choreRewards !== false;
  d.celebrationSound   = !!(state.usersData && state.usersData[src] && state.usersData[src].celebrationSound !== false);
  // NEVER copies (locked): name, pin, email, avatar, useCalendar/calendarId,
  // balances, ledger, goals, streaks, history.
  d._copied = true;
  d.copyFrom = src;
}

// ── step definitions ───────────────────────────────────────────────
function uwBuildSteps(mode){
  const isEdit = mode === "edit";
  const steps = [];

  steps.push({
    id:"resume", footer:"none",
    skip: () => !wz.meta.hasSavedDraft,
    render: () => `
      <h2 class="wz-q">Pick up where you left off?</h2>
      <div class="wz-sub">You have an unfinished setup from before.</div>
      <div class="wz-opts">
        <button type="button" class="wz-opt" onclick="uwResumeDraft()"><span class="wz-opt-label">Resume where I left off</span></button>
        <button type="button" class="wz-opt" onclick="uwStartOver()"><span class="wz-opt-label">Start over</span></button>
      </div>`
  });

  steps.push({
    id:"role", field:"role", footer:"none",
    skip: () => isEdit,
    title:"Who are you adding?",
    options:[
      {v:"parent", label:"A parent", desc:"Approves chores and manages the family"},
      {v:"child",  label:"A child",  desc:"Earns, saves, and spends"}
    ],
    beforePick:(v)=>{
      if(v==="child" && typeof getMyChildrenList==="function" && getMyChildrenList().length >= MAX_CHILDREN_PER_PARENT){
        const m=document.getElementById("wz-msg");
        if(m){ m.className="wz-msg error"; m.textContent="You've hit the "+MAX_CHILDREN_PER_PARENT+"-child limit."; }
        return false;
      }
      return true;
    },
    validate:(d)=> d.role!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"name", field:"name", footer:"default",
    skip: () => isEdit,
    title:(d)=> d.role==="parent" ? "What's the parent's name?" : "What's your child's name?",
    sub:"This is the display name they'll log in with.",
    validate:(d)=>{
      const n=(d.name||"").trim();
      if(!n) return "Name is required.";
      if((state.users||[]).includes(n)) return `"${n}" is already taken.`;   // spec §10 — inline, at the Name step
      return true;
    },
    render:(d)=>`<input id="wz-input" class="wz-text" type="text" value="${wzEsc(d.name)}" placeholder="e.g. Emma" autocomplete="off" oninput="wzTextInput()" onkeydown="wzKeydown(event)">`,
    onPrimary:()=>{ wz.draft.name = (wz.draft.name||"").trim(); return true; }
  });

  steps.push({
    id:"pin", field:"pin", footer: isEdit ? "default" : "none",
    title:(d)=> isEdit ? "Set a new PIN?" : `Pick a 4-digit PIN for ${wzEsc(d.name||"them")}`,
    sub: isEdit ? "Type a new 4-digit PIN, or keep the current one." : "They'll use it to log in. Digits show as you type.",
    secondaryLabel: isEdit ? "Keep current PIN" : null,
    onSecondary: isEdit ? ()=>{ wz.draft.pin=""; wzAdvance(); } : null,
    primaryLabel:"Continue",
    validate:(d)=>{
      const p = d.pin||"";
      if(isEdit && p==="") return true;                       // blank = keep (rule inherited from the retired user-edit sheet)
      if(!/^\d{4}$/.test(p)) return "PIN must be exactly 4 digits.";
      const ex = isEdit ? wz.meta.editName : undefined;
      const col = (typeof checkNamePinCollision==="function") ? checkNamePinCollision((d.name||"").trim(), p, ex) : {collision:false};
      if(col.collision) return col.reason || "Name/PIN conflict.";
      return true;
    },
    render:(d)=>`<input id="wz-input" class="wz-pin" type="text" inputmode="numeric" autocomplete="off" maxlength="4" value="${wzEsc(d.pin)}" placeholder="0000" oninput="wzPinInput()">`
  });

  steps.push({
    id:"email", field:"email", footer:"custom",
    // d1.2 (R-1) — edit-with-existing gets an explicit Keep/Change/Remove
    // choice. Blank NEVER silently clears (PIN symmetry). Email commits
    // inside the state POST — no setChildEmail leg, no admin PIN here.
    title:(d)=> (isEdit && d._oldEmail && d.emailAction!=="change")
      ? "Email for " + wzEsc(wz.meta.editName||"")
      : "Add an email for " + wzEsc((d.name||"").trim()||"them") + "?",
    sub:"Used for statements and notifications.",
    validate:(d)=>{
      if(isEdit && d._oldEmail){
        if(d.emailAction==="keep" || d.emailAction==="remove") return true;
        if(d.emailAction==="change"){
          const e=(d.email||"").trim();
          if(!e) return "Enter the new address, or go back to options.";
          if(!wzEmailOk(e)) return "That doesn't look like a valid email.";
          const holder=uwEmailTaken(e, wz.meta.editName);
          if(holder) return "Already used by "+holder+".";
          return true;
        }
        return "Pick one.";
      }
      const e=(d.email||"").trim();
      if(!e) return true;
      if(!wzEmailOk(e)) return "That doesn't look like a valid email.";
      const holder=uwEmailTaken(e, isEdit ? wz.meta.editName : null);
      if(holder) return "Already used by "+holder+".";
      return true;
    },
    render:(d)=>{
      if(isEdit && d._oldEmail && d.emailAction!=="change"){
        return `<div class="wz-opts">
          <button type="button" class="wz-opt${d.emailAction==="keep"?" selected":""}" onclick="uwEmailChoice('keep')"><span class="wz-opt-label">Keep current</span><span class="wz-opt-desc">${wzEsc(d._oldEmail)}</span></button>
          <button type="button" class="wz-opt" onclick="uwEmailChoice('change')"><span class="wz-opt-label">Change it</span></button>
          <button type="button" class="wz-opt${d.emailAction==="remove"?" selected":""}" onclick="uwEmailChoice('remove')"><span class="wz-opt-label">Remove email</span><span class="wz-opt-desc">Stops statements and notifications</span></button>
        </div>`;
      }
      return `<input id="wz-input" class="wz-text" type="email" inputmode="email" autocomplete="off" value="${wzEsc(d.email)}" placeholder="name@example.com" oninput="wzTextInput()" onkeydown="wzKeydown(event)">`;
    },
    footerHtml:(d)=>{
      if(isEdit && d._oldEmail && d.emailAction!=="change") return "";
      let h="";
      if(isEdit && d._oldEmail) h += `<button class="wz-btn-secondary" onclick="uwEmailChoice(null)">Back to options</button>`;
      else h += `<button class="wz-btn-secondary" onclick="uwEmailSkip()">Maybe later</button>`;
      h += `<button class="btn btn-primary wz-btn-primary" id="wz-primary" onclick="wzPrimary()">Continue</button>`;
      return h;
    },
    onPrimary:()=>{ const d=wz.draft; d.email=(d.email||"").trim(); return true; }
  });

  steps.push({
    id:"assignChildren", field:"assignChildren", footer:"default", multi:true,
    skip:(d)=> d.role!=="parent" || getChildNames().filter(n=> n!==wz.meta.editName).length===0,  // spec S1 auto-skip
    title:(d)=>`Which children should ${wzEsc((d.name||"").trim()||"this parent")} manage?`,
    sub:"Tap to toggle. You can change this anytime.",
    get options(){ return getChildNames().filter(n=> n!==wz.meta.editName).map(n=>({v:n,label:wzEsc(n)})); },
    validate:()=> true,                                        // empty allowed (legacy hint: no selection = sees no children)
    render: wzMultiRender
  });

  steps.push({
    id:"copyAsk", field:"copyChoice", footer:"none",
    skip:(d)=> isEdit || d.role!=="child" || uwOtherChildren().length===0,   // spec §3 auto-skip
    title:(d)=>`Copy an existing child's settings for ${wzEsc((d.name||"").trim()||"them")}?`,
    sub:"Copies setup like tabs, allowance, and rates — never balances, PINs, or history.",
    options:[
      {v:"copy",  label:"Yes, copy from another child", desc:"Fastest — review and adjust after"},
      {v:"fresh", label:"No, set up from scratch"}
    ],
    validate:(d)=> d.copyChoice!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"copySource", field:"copyFrom", footer:"none", afterPick:"review",
    skip:(d)=> isEdit || d.role!=="child" || d.copyChoice!=="copy",
    title:"Copy settings from which child?",
    get options(){ return uwOtherChildren().map(n=>({v:n,label:wzEsc(n)})); },
    onPick:(v)=> uwApplyCopySet(v),
    validate:(d)=> d.copyChoice!=="copy" || d.copyFrom ? true : "Pick a child.",
    render: wzChoiceRender
  });

  steps.push({
    id:"tabs", footer:"default", multi:true, multiKind:"tabs", field:"tabs",
    skip:(d)=> d.role!=="child",
    title:(d)=>`Which tabs should ${wzEsc((d.name||"").trim()||"they")} see?`,
    sub:"Pick at least one.",
    options:[
      {v:"money",  label:"💰 Money",  desc:"Balances, deposits, goals"},
      {v:"chores", label:"🧹 Chores", desc:"Tasks and rewards"},
      {v:"loans",  label:"🏦 Loans",  desc:"Borrowing from the Bank of Mom & Dad"}
    ],
    validate:(d)=> (d.tabs.money||d.tabs.chores||d.tabs.loans) ? true : "Pick at least one tab.",
    render: wzMultiRender
  });

  steps.push({
    id:"useAllowance", field:"useAllowance", footer:"none",
    skip:(d)=> d.role!=="child",
    title:(d)=>`Does ${wzEsc((d.name||"").trim()||"this child")} get an allowance?`,
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.useAllowance!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"structure", field:"structure", footer:"none",
    skip:(d)=> d.role!=="child" || d.useAllowance!==true,
    title:"Where should the allowance go?",
    options:[
      {v:"checking", label:"Checking only"},
      {v:"savings",  label:"Savings only"},
      {v:"both",     label:"Split between both"}
    ],
    validate:(d)=> d.structure!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"schedule", field:"schedule", footer:"none",
    skip:(d)=> d.role!=="child" || d.useAllowance!==true,
    title:"How often is allowance paid?",
    options:[
      {v:"weekly",   label:"Weekly"},
      {v:"biweekly", label:"Every 2 weeks"},
      {v:"monthly",  label:"Monthly"}
    ],
    validate:(d)=> d.schedule!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"weekday", field:"allowWeekday", footer:"none",
    skip:(d)=> d.role!=="child" || d.useAllowance!==true || d.schedule==="monthly",
    title:"Which day does it pay out?",
    options: WZ_WEEKDAYS.map((n,i)=>({v:i,label:n})),
    validate:(d)=> d.allowWeekday!==undefined ? true : "Pick a day.",
    render: wzChoiceRender
  });

  steps.push({
    id:"monthday", field:"allowMonthlyDay", footer:"default",
    skip:(d)=> d.role!=="child" || d.useAllowance!==true || d.schedule!=="monthly",
    title:"Which day of the month?",
    sub:"Enter 1–28, or pick a month-end option.",
    validate:(d)=>{
      const v = d.allowMonthlyDay;
      if(v==="last"||v==="last-1"||v==="last-2") return true;
      const n = parseInt(v,10);
      return (n>=1 && n<=28) ? true : "Enter a day from 1 to 28, or pick an option below.";
    },
    render:(d)=>{
      const isNum = d.allowMonthlyDay && !String(d.allowMonthlyDay).startsWith("last");
      return `
        <input id="wz-input" class="wz-text" type="text" inputmode="numeric" maxlength="2" value="${isNum?wzEsc(d.allowMonthlyDay):""}" placeholder="e.g. 15" oninput="wzTextInput()" onkeydown="wzKeydown(event)">
        <div class="wz-opts" style="margin-top:14px;">
          <button type="button" class="wz-opt${d.allowMonthlyDay==="last"?" selected":""}" onclick="uwPickMonthEnd('last')"><span class="wz-opt-label">Last day of the month</span></button>
          <button type="button" class="wz-opt${d.allowMonthlyDay==="last-1"?" selected":""}" onclick="uwPickMonthEnd('last-1')"><span class="wz-opt-label">2nd-to-last day</span></button>
          <button type="button" class="wz-opt${d.allowMonthlyDay==="last-2"?" selected":""}" onclick="uwPickMonthEnd('last-2')"><span class="wz-opt-label">3rd-to-last day</span></button>
        </div>`;
    },
    onPrimary:()=>{ wz.draft.allowMonthlyDay = String(parseInt(wz.draft.allowMonthlyDay,10)); return true; }
  });

  steps.push({
    id:"amounts", footer:"default", field:"allowChk",
    skip:(d)=> d.role!=="child" || d.useAllowance!==true,
    title:"How much per payment?",
    sub:(d)=> d.structure==="both" ? "Split it however you like." : "",
    validate:(d)=>{
      const num = v => { const n=parseFloat(String(v).replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; };
      const c=num(d.allowChk), s=num(d.allowSav);
      if(c<0||s<0) return "Amounts can't be negative.";
      return true;
    },
    render:(d)=>{
      const chk = d.structure!=="savings";
      const sav = d.structure!=="checking";
      return `
        ${chk?`<label class="wz-label">Checking ($)</label>
        <input id="wz-input" class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.allowChk)}" placeholder="0.00" oninput="uwAmountInput('allowChk',this)" onkeydown="wzKeydown(event)">`:""}
        ${sav?`<label class="wz-label"${chk?' style="margin-top:14px;"':""}>Savings ($)</label>
        <input ${chk?"":'id="wz-input" '}class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.allowSav)}" placeholder="0.00" oninput="uwAmountInput('allowSav',this)" onkeydown="wzKeydown(event)">`:""}`;
    }
  });

  steps.push({
    id:"rates", footer:"default", field:"rateChk",
    skip:(d)=> d.role!=="child",
    title:"Any interest on their balances?",
    sub:"Annual rate, %. Leave blank for none.",
    validate:(d)=>{
      const ok = v => { if(v===""||v===null||v===undefined) return true; const n=parseFloat(v); return !isNaN(n)&&n>=0&&n<=100; };
      if(!ok(d.rateChk)||!ok(d.rateSav)) return "Rates must be between 0 and 100.";
      return true;
    },
    render:(d)=>`
      <label class="wz-label">Checking rate (% / yr)</label>
      <input id="wz-input" class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.rateChk)}" placeholder="e.g. 2" oninput="uwAmountInput('rateChk',this)" onkeydown="wzKeydown(event)">
      <label class="wz-label" style="margin-top:14px;">Savings rate (% / yr)</label>
      <input class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.rateSav)}" placeholder="e.g. 5" oninput="uwAmountInput('rateSav',this)" onkeydown="wzKeydown(event)">`
  });

  steps.push({
    id:"choreRewards", field:"choreRewards", footer:"none",
    skip:(d)=> d.role!=="child",
    title:"Do chores pay rewards?",
    sub:"If yes, completed chores add money to their balance.",
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.choreRewards!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"notifyEmail", field:"notifyEmail", footer:"none",
    skip:(d)=> d.role!=="child",
    title:"Email them monthly statements?",
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.notifyEmail!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"notifyRewards", field:"notifyChoreRewards", footer:"none",
    skip:(d)=> d.role!=="child",
    title:"Email them about chore rewards?",
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.notifyChoreRewards!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"useCalendar", field:"useCalendar", footer:"none",
    skip:(d)=> d.role!=="child",
    title:"Sync chores to a Google Calendar?",
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.useCalendar!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"calId", field:"calendarId", footer:"default",
    skip:(d)=> d.role!=="child" || d.useCalendar!==true,
    title:"Paste their Calendar ID",
    sub:"From Google Calendar → Settings → Integrate calendar.",
    validate:(d)=> (d.calendarId||"").trim() ? true : "Calendar ID is required when sync is on.",
    render:(d)=>`<input id="wz-input" class="wz-text" type="text" autocomplete="off" value="${wzEsc(d.calendarId)}" placeholder="abc123@group.calendar.google.com" oninput="wzTextInput()" onkeydown="wzKeydown(event)">`,
    onPrimary:()=>{ wz.draft.calendarId=(wz.draft.calendarId||"").trim(); return true; }
  });

  steps.push({
    id:"sound", field:"celebrationSound", footer:"none",
    skip:(d)=> d.role!=="child",
    title:"Play a sound when they earn money?",
    options:[ {v:true,label:"Yes"}, {v:false,label:"No"} ],
    validate:(d)=> d.celebrationSound!==undefined ? true : "Pick Yes or No.",
    render: wzChoiceRender
  });

  steps.push({
    id:"avatar", footer:"default", field:"avatarEmoji",
    skip:(d)=> d.role!=="child",
    title:"Pick an avatar",
    sub:"Choose an emoji, or upload a photo. You can change it later.",
    validate:()=> true,
    render:(d)=>{
      const emojis = (typeof AVATAR_EMOJIS!=="undefined" ? AVATAR_EMOJIS : ["🙂","😀","😎","🐱","🐶","🦊","🐼","🐸","🦄","🐵","🐯","🦁"]);
      const cur = d.avatarEmoji || "";
      const grid = emojis.map(e=>`<button type="button" class="wz-emoji${e===cur?" selected":""}" onclick="uwPickEmoji('${e}')">${e}</button>`).join("");
      const photoRow = d._photo
        ? `<div class="wz-photo-row"><img src="${d._photo}" class="wz-photo-preview" alt=""> <button type="button" class="wz-btn-secondary" style="width:auto;" onclick="uwRemovePhoto()">Remove photo</button></div>`
        : `<button type="button" class="wz-btn-secondary" style="width:auto;margin-top:14px;" onclick="document.getElementById('wz-avatar-file').click()">Upload a photo instead</button>`;
      return `<div class="wz-emoji-grid" id="wz-emoji-grid">${grid}</div>
        ${photoRow}
        <input type="file" id="wz-avatar-file" accept="image/*" style="display:none;" onchange="uwPhotoPicked(event)">`;
    }
  });

  steps.push({
    id:"review", footer:"custom",
    title: isEdit ? "Review the changes" : "Review before creating",
    sub: isEdit ? "Nothing saves until you confirm." : "Nothing is created until you confirm.",
    validate:()=> true,
    render: uwReviewRender,
    footerHtml: ()=>{
      const bad = uwInvalidSteps().length>0;
      const busy = wz.meta.committing;
      const label = busy ? "Saving…" : (isEdit ? "Save changes" : (wz.draft.role==="parent" ? "Add parent" : "Add child"));
      return `<button class="btn btn-primary wz-btn-primary" id="wz-primary" onclick="uwCommit()" ${bad||busy?"disabled":""}>${label}</button>`;
    }
  });

  steps.push({
    id:"success", footer:"none",
    skip:()=> !wz.meta.committed,
    render: uwSuccessRender
  });

  return steps;
}

// step-specific input handlers
function uwAmountInput(field, el){ wz.draft[field]=el.value; wzRefreshPrimary(); wzInlineMsg(wzCur()); }
function uwPickMonthEnd(v){ wz.draft.allowMonthlyDay=v; wzAdvance(); }
function uwPickEmoji(e){
  wz.draft.avatarEmoji=e;
  const g=document.getElementById("wz-emoji-grid");
  if(g) g.querySelectorAll("button").forEach(b=> b.classList.toggle("selected", b.textContent===e));
}
function uwPhotoPicked(ev){
  const file = ev && ev.target && ev.target.files && ev.target.files[0];
  if(!file) return;
  if(typeof resizeImageFileTo200 !== "function"){ showToast("Image resize unavailable.","error"); return; }
  resizeImageFileTo200(file).then(dataUrl=>{ wz.draft._photo=dataUrl; wzRenderBodyOnly(); })
    .catch(()=> showToast("Couldn't process image.","error"));
}
function uwRemovePhoto(){ wz.draft._photo=null; wzRenderBodyOnly(); }
// d1.2 — email step handlers (R-1 Keep/Change/Remove) + within-family uniqueness
function uwEmailChoice(a){
  const d=wz.draft;
  if(a==="keep"){ d.emailAction="keep"; d.email=d._oldEmail; wzAdvance(); return; }
  if(a==="remove"){ d.emailAction="remove"; d.email=""; wzAdvance(); return; }
  if(a==="change"){ d.emailAction="change"; d.email=""; wzRender(); return; }
  d.emailAction = d._oldEmail ? "keep" : undefined;   // back to options
  d.email = d._oldEmail || "";
  wzRender();
}
function uwEmailSkip(){ wz.draft.email=""; wz.draft.emailSkipped=true; wzAdvance(); }
function uwEmailTaken(email, excludeUser){
  const e=(email||"").trim().toLowerCase();
  if(!e) return null;
  const map=(state.config && state.config.emails)||{};
  for(const u in map){
    if(excludeUser && u===excludeUser) continue;
    if(String(map[u]||"").trim().toLowerCase()===e) return u;
  }
  return null;
}
function uwResumeDraft(){
  const s = wz.meta.savedDraft;
  if(s && s.draft){ wz.draft = {...uwBlankDraft(), ...s.draft, _photo:null}; wz.idx = s.idx||0; }
  wz.meta.hasSavedDraft=false;
  if(wzCur() && wzCur().id==="resume") wz.idx++;
  wzNormalizeIdx(); wzRender();
}
function uwStartOver(){
  wzClearDraft();
  wz.meta.hasSavedDraft=false;
  wz.draft = wz.mode==="edit" ? uwPrefillEdit(wz.meta.editName) : uwBlankDraft();
  wz.idx = 0; wzNormalizeIdx(); wzRender();
}

// ── review ─────────────────────────────────────────────────────────
function uwInvalidSteps(){
  const bad=[];
  wzVisible().forEach(s=>{
    if(s.id==="resume"||s.id==="review"||s.id==="success") return;
    if(s.validate && s.validate(wz.draft)!==true) bad.push(s.id);
  });
  return bad;
}
function uwReviewRows(){
  const d=wz.draft, isEdit=wz.mode==="edit";
  const yn = v => v===true?"Yes":v===false?"No":"—";
  const rows=[];
  const row=(label,value,stepId,locked)=> rows.push({label,value,stepId,locked:!!locked});
  row("Role", d.role==="parent"?"Parent":"Child", "role", true);
  row("Name", wzEsc(d.name), "name", isEdit);
  row("PIN", isEdit ? (d.pin?"••••  (new)":"Unchanged") : (d.pin?"••••":"—"), "pin");
  const emailVal = (isEdit && d._oldEmail)
    ? (d.emailAction==="remove" ? "Will be removed"
       : d.emailAction==="change" ? wzEsc(d.email)
       : wzEsc(d._oldEmail))
    : (d.email ? wzEsc(d.email) : "None");
  row("Email", emailVal, "email");
  if(d.role==="parent"){
    const kids = getChildNames().filter(n=> n!==wz.meta.editName);
    if(kids.length) row("Manages", (d.assignChildren&&d.assignChildren.length)? d.assignChildren.map(wzEsc).join(", ") : "No children selected", "assignChildren");
    return rows;
  }
  const t=[]; if(d.tabs.money)t.push("Money"); if(d.tabs.chores)t.push("Chores"); if(d.tabs.loans)t.push("Loans");
  row("Tabs", t.length?t.join(", "):"—", "tabs");
  if(d.useAllowance===true){
    const amt=[];
    const num=v=>{const n=parseFloat(String(v).replace(/[^0-9.\-]/g,""));return isNaN(n)?0:n;};
    if(d.structure!=="savings") amt.push("$"+num(d.allowChk).toFixed(2)+" checking");
    if(d.structure!=="checking") amt.push("$"+num(d.allowSav).toFixed(2)+" savings");
    const when = d.schedule==="monthly"
      ? uwMonthDayLabel(d.allowMonthlyDay)
      : (d.schedule==="biweekly"?"every 2 weeks":"weekly")+(d.allowWeekday!==undefined?" on "+WZ_WEEKDAYS[d.allowWeekday]:"");
    row("Allowance", amt.join(" + ")+", "+when, "useAllowance");
  } else {
    row("Allowance", d.useAllowance===false?"Off":"—", "useAllowance");
  }
  const rc = d.rateChk===""?"0":String(d.rateChk), rs = d.rateSav===""?"0":String(d.rateSav);
  row("Interest", rc+"% checking / "+rs+"% savings", "rates");
  row("Chore rewards", yn(d.choreRewards), "choreRewards");
  row("Statement emails", yn(d.notifyEmail), "notifyEmail");
  row("Reward emails", yn(d.notifyChoreRewards), "notifyRewards");
  row("Calendar sync", d.useCalendar===true ? "On — "+wzEsc(d.calendarId||"(no ID)") : yn(d.useCalendar), "useCalendar");
  row("Celebration sound", yn(d.celebrationSound), "sound");
  row("Avatar", d._photo ? "Photo" : (d.avatarEmoji||"Default"), "avatar");
  return rows;
}
function uwReviewRender(d){
  const bad = uwInvalidSteps();
  const visIds = wzVisible().map(s=>s.id);
  const rows = uwReviewRows().filter(r => r.locked || visIds.includes(r.stepId));
  const copied = d._copied ? `<div class="wz-copied-note">Settings copied from <b>${wzEsc(d.copyFrom)}</b> — tap any row to adjust.</div>` : "";
  const err = wz.meta.commitError ? `<div class="wz-commit-error">${wzEsc(wz.meta.commitError)}</div>` : "";
  return copied + err + `<div class="wz-review">` + rows.map(r=>{
    const invalid = bad.includes(r.stepId);
    return `<div class="wz-review-row${invalid?" invalid":""}">
      <div class="wz-review-l"><div class="wz-review-label">${r.label}</div>
      <div class="wz-review-value">${invalid?'<span class="wz-req">Required — tap Edit</span>':r.value}</div></div>
      ${r.locked?"":`<button type="button" class="wz-review-edit" onclick="wzJump('${r.stepId}')">Edit</button>`}
    </div>`;
  }).join("") + `</div>`;
}

// ── S3 COMMIT PROTOCOL (spec §4 — order-critical) ─────────────────
function uwApplyAdd(){
  const d=wz.draft, name=d.name.trim();
  const num=v=>{const n=parseFloat(String(v).replace(/[^0-9.\-]/g,""));return isNaN(n)?0:n;};
  state.users = state.users||[]; state.users.push(name);
  state.pins  = state.pins ||{}; state.pins[name]=d.pin;
  state.roles = state.roles||{}; state.roles[name]=d.role;
  state.config = state.config||{};
  // d1.2 — email commits inside the state POST (both roles).
  const _em=(d.email||"").trim();
  if(_em){ state.config.emails = state.config.emails||{}; state.config.emails[name]=_em; }
  if(d.role==="parent"){
    state.config.parentChildren = state.config.parentChildren||{};
    state.config.parentChildren[name] = [ ...(d.assignChildren||[]) ];
    return name;
  }
  // child — mirrors legacy wizard writes (app.js:5928–6100), single-shot
  getChildData(name);                                        // seed balances/chores
  state.config.tabs = state.config.tabs||{};
  state.config.tabs[name] = {...d.tabs};
  state.config.notify = state.config.notify||{};
  state.config.notify[name] = {
    email: d.notifyEmail,
    calendar: !!(d.useCalendar && (d.calendarId||"").trim()),
    choreRewards: d.notifyChoreRewards
  };
  state.usersData = state.usersData||{};
  state.usersData[name] = { celebrationSound: d.celebrationSound, createdAt: new Date().toISOString() };
  state.config.parentChildren = state.config.parentChildren||{};
  state.config.parentChildren[currentUser] = state.config.parentChildren[currentUser]||[];
  if(state.config.parentChildren[currentUser].indexOf(name)===-1) state.config.parentChildren[currentUser].push(name);
  const cd = getChildData(name);
  if(d.useAllowance===true){
    cd.autoDeposit = {
      checking: d.structure==="savings" ? 0 : num(d.allowChk),
      savings:  d.structure==="checking"? 0 : num(d.allowSav),
      schedule: d.schedule
    };
    if(d.schedule==="monthly") cd.autoDeposit.monthlyDay = String(d.allowMonthlyDay);
    else cd.autoDeposit.weekday = (d.allowWeekday!==undefined ? d.allowWeekday : 1);
  } else {
    cd.autoDeposit = {checking:0, savings:0};                // legacy case-3 shape
  }
  cd.rates = {
    checking: d.rateChk===""?0:parseFloat(d.rateChk)||0,
    savings:  d.rateSav===""?0:parseFloat(d.rateSav)||0
  };
  state.config.calendars = state.config.calendars||{};
  if(d.useCalendar && (d.calendarId||"").trim()) state.config.calendars[name]=(d.calendarId||"").trim();
  if(d.avatarEmoji) setAvatarEmoji(name, d.avatarEmoji);
  return name;
}

function uwApplyEdit(){
  const d=wz.draft, u=wz.meta.editName;
  const num=v=>{const n=parseFloat(String(v).replace(/[^0-9.\-]/g,""));return isNaN(n)?0:n;};
  if(d.pin) state.pins[u]=d.pin;                             // blank = keep (legacy)
  // d1.2 (R-1) — explicit email action; keep = untouched, blank never clears.
  state.config = state.config||{};
  state.config.emails = state.config.emails||{};
  if(d._oldEmail){
    if(d.emailAction==="remove") delete state.config.emails[u];
    else if(d.emailAction==="change" && (d.email||"").trim()) state.config.emails[u]=(d.email||"").trim();
  } else if((d.email||"").trim()){
    state.config.emails[u]=(d.email||"").trim();
  }
  if(d.role==="parent"){
    state.config.parentChildren = state.config.parentChildren||{};
    state.config.parentChildren[u] = [ ...(d.assignChildren||[]) ];
    return u;
  }
  state.config.tabs = state.config.tabs||{};
  state.config.tabs[u] = {...d.tabs};
  state.config.notify = state.config.notify||{};
  state.config.notify[u] = {
    email: d.notifyEmail,
    calendar: !!(d.useCalendar && (d.calendarId||"").trim()),
    choreRewards: d.notifyChoreRewards
  };
  state.config.calendars = state.config.calendars||{};
  if(d.useCalendar && (d.calendarId||"").trim()) state.config.calendars[u]=(d.calendarId||"").trim();
  else delete state.config.calendars[u];
  state.usersData = state.usersData||{};
  state.usersData[u] = state.usersData[u]||{};
  state.usersData[u].celebrationSound = d.celebrationSound;
  const cd = getChildData(u);
  if(d.useAllowance===true){
    cd.autoDeposit = {
      checking: d.structure==="savings" ? 0 : num(d.allowChk),
      savings:  d.structure==="checking"? 0 : num(d.allowSav),
      schedule: d.schedule
    };
    if(d.schedule==="monthly") cd.autoDeposit.monthlyDay = String(d.allowMonthlyDay);
    else cd.autoDeposit.weekday = (d.allowWeekday!==undefined ? d.allowWeekday : 1);
  } else {
    cd.autoDeposit = {checking:0, savings:0};
  }
  cd.rates = cd.rates||{};
  cd.rates.checking = d.rateChk===""?0:parseFloat(d.rateChk)||0;
  cd.rates.savings  = d.rateSav===""?0:parseFloat(d.rateSav)||0;
  if(d.avatarEmoji) setAvatarEmoji(u, d.avatarEmoji);
  return u;
}

async function uwCommit(){
  if(!wz || wz.meta.committing || wz.meta.committed) return;
  const bad = uwInvalidSteps();
  if(bad.length){ wzRender(); return; }
  wz.meta.committing = true; wz.meta.commitError = null;
  wzRender();
  const snapshot = JSON.stringify(state);
  let name;
  try{
    name = (wz.mode==="add") ? uwApplyAdd() : uwApplyEdit();
  }catch(e){
    state = JSON.parse(snapshot);
    wz.meta.committing=false; wz.meta.commitError="Local error: "+(e&&e.message||e);
    wzRender(); return;
  }
  let res = null;
  try{
    res = await syncToCloud(wz.mode==="add" ? "User Created (Wizard)" : "User Updated (Wizard)");
  }catch(_){ res=null; }
  if(!(res && res.status==="ok")){
    // S3 step 2 — failure/timeout: roll back local mutation, draft retained,
    // Review becomes the retry point. Never toast success unverified (M-1 class).
    state = JSON.parse(snapshot);
    try{ renderBalances(); }catch(_){}
    wz.meta.committing=false;
    wz.meta.commitError = (res && res.reason)
      ? "Save failed ("+res.reason+")."
      : "Couldn't reach the server — nothing was saved. Check your connection and try again.";
    wzRender(); return;
  }
  // verified success
  wz.meta.committing=false; wz.meta.committed=true;
  wz.meta.name = name;
  wzClearDraft();
  if(wz.draft._photo){ try{ localStorage.setItem("fb_avatar_"+name, wz.draft._photo); }catch(_){} }
  try{ renderMyChildren && renderMyChildren(); }catch(_){}
  try{ renderParentTabBar && renderParentTabBar(); }catch(_){}
  try{ renderAdminUsers && renderAdminUsers(); }catch(_){}
  // d1.2 — email rode the commit POST above (scope §4 current rev).
  // No setChildEmail leg, no admin-PIN prompt in user-facing UI (locked).
  wzGotoId("success");
}

// ── success screen + Q2 landings (spec §5) ────────────────────────
function uwSuccessRender(){
  const isEdit = wz.mode==="edit";
  const name = wzEsc(wz.meta.name||"");
  const childAdd = (!isEdit && wz.draft.role==="child");
  return `
    <div class="wz-success">
      <div class="wz-success-check">✓</div>
      <h2 class="wz-q" style="text-align:center;">${name} ${isEdit?"updated":"added"}!</h2>
      <div class="wz-opts" style="margin-top:22px;">
        ${childAdd?`<button type="button" class="wz-opt" onclick="uwSuccessChores()"><span class="wz-opt-label">Create chores for ${name} now</span><span class="wz-opt-desc">Takes about a minute</span></button>`:""}
        <button type="button" class="wz-opt" onclick="uwSuccessDone()"><span class="wz-opt-label">Done</span></button>
      </div>
    </div>`;
}
function uwSuccessDone(){
  const isEdit = wz && wz.mode==="edit";
  const nm = wz && wz.meta.name;
  wz = null;
  closeSheet("sheet-wiz2", true);
  if(isEdit && nm) showToast(nm+" updated.","success");
  else if(nm) showToast('"'+nm+'" added!',"success");
}
function uwSuccessChores(){
  const nm = wz && wz.meta.name;
  wz = null;
  closeSheet("sheet-wiz2", true);
  if(nm) uwGotoChores(nm);
}
/** v38.1 final — lands the parent on the new child, then opens the chore
 *  wizard with that child pre-selected (child step auto-skips). */
function uwGotoChores(childName){
  try{ selectChild(childName); }catch(_){}
  setTimeout(()=>{ try{ cwOpenAdd(childName); }catch(_){} }, 250);
}

// ── open / entry points ────────────────────────────────────────────
function uwStart(mode, editName){
  const saved = wzLoadDraft("user", mode, editName||null);
  wz = {
    kind:"user", mode:mode, idx:0,
    draft: mode==="edit" ? uwPrefillEdit(editName) : uwBlankDraft(),
    steps: null,
    meta: {
      editName: editName||null,
      sectionLabel: mode==="edit" ? ("Edit "+editName) : "Add a user",
      hasSavedDraft: !!saved, savedDraft: saved,
      returnToReview:false, navigated:false,
      committing:false, committed:false, commitError:null,
      name:null
    }
  };
  wz.steps = uwBuildSteps(mode);
  wz.meta.pristine = JSON.stringify(wz.draft);   // v38.2-5 — untouched-draft baseline (see wzClose)
  if(mode==="edit" && !saved){ wz.idx = wzStepIndexById("review"); }   // spec §7 — edit opens AT Review
  openSheet("sheet-wiz2");
  wzRender();
}
function uwOpenAdd(){
  if(currentRole !== "parent"){ showToast("Only parents can add users.","error"); return; }
  uwStart("add", null);
}
function uwOpenEdit(name){
  if(currentRole !== "parent"){ showToast("Only parents can edit users.","error"); return; }
  if(!name || !state.roles || !state.roles[name]){ showToast("User not found.","error"); return; }
  uwStart("edit", name);
}
window.uwOpenAdd = uwOpenAdd;
window.uwOpenEdit = uwOpenEdit;

// ════════════════════════════════════════════════════════════════════
// CHORE WIZARD (v38.1 final — built on the shared wz step engine above)
// Spec of record: FamilyBank_v38_1_FINISH_DOC.md §2 (Halyard, 2026-09-04)
// Entry points: cwOpenAdd(presetChild?) — parent Chores tab launcher and the
//   user-wizard success screen ("Create chores now?"); cwOpenEdit(child, id)
//   — the Edit button on a chore card (editChore() forwards here).
// Draft: fb_cw_draft (resume / start-over like the user wizard).
// Commit protocol (WB-1 hybrid, locked):
//   exactly 1 chore × 1 child → one POST "Chore Created" (server creates the
//     calendar event + sends the notification email — full fidelity);
//   anything multi (chores OR children) → one POST PER CHILD, "Chore Edited",
//     no _editedChoreId → server full-rebuilds that child's chore calendar;
//     bulk "new chore" emails intentionally dropped.
//   Sequential, each awaited and verified {status:"ok"} (S3 pattern). On a
//   failure the fan stops: children already posted stay committed, the
//   failed child's local clones roll back, per-child ✓/✗ + "Retry remaining".
// Edit mode: opens AT Review pre-populated; single POST "Chore Edited" with
//   _editedChoreId riding the payload (legacy createChore contract, Code.gs
//   syncCalendarEvent:1907 — single-chore calendar rebuild).
// Zero mid-wizard POSTs — everything at commit, same as the user wizard.
// ════════════════════════════════════════════════════════════════════

const CW_DRAFT_KEY = "fb_cw_draft";
const CW_REMINDER_HOURS = [[6,"6:00 AM"],[7,"7:00 AM"],[8,"8:00 AM"],[9,"9:00 AM"],[10,"10:00 AM"],
  [11,"11:00 AM"],[12,"12:00 PM (Noon)"],[13,"1:00 PM"],[14,"2:00 PM"],[15,"3:00 PM (After school)"],
  [16,"4:00 PM"],[17,"5:00 PM"],[18,"6:00 PM (Evening)"],[19,"7:00 PM"],[20,"8:00 PM"]];
const CW_MONTH_DAYS = (()=>{ const a=[]; for(let i=1;i<=28;i++) a.push(String(i)); return a.concat(["last-2","last-1","last"]); })();
// Authoritative per-chore field list = legacy createChore's choreFields (app.js
// "data.chores.push(" site). Instance fields (id/status/completed*/streakCount/
// createdAt) are NOT in this list — they're reset on every clone.
const CW_FIELD_KEYS = ["name","desc","amount","schedule","monthlyDay","weekday","weekdays",
  "onceDate","onceDueOn","reminderHour","dayTimes","skipFirstWeek","splitChk","childChooses",
  "paused","endDate","requiresProof","streakStart","streakMilestone","streakReward"];

// ── helpers ─────────────────────────────────────────────────────────
function cwNum(v){ const n=parseFloat(String(v==null?"":v).replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }
function cwCopy(o){ return JSON.parse(JSON.stringify(o)); }
function cwChildrenList(preset){
  // Parent context: children this parent manages; fall back to every child
  // (rows with no parentChildren map). A preset child is always offered.
  let list = (typeof getAssignedChildren==="function") ? getAssignedChildren() : getChildNames();
  if(!list.length) list = getChildNames();
  if(preset && list.indexOf(preset)===-1) list = [preset].concat(list);
  return list;
}
function cwChildren(){ return cwChildrenList(wz && wz.meta ? wz.meta.presetChild : null); }
function cwPrimaryChild(d){ return (wz && wz.mode==="edit") ? wz.meta.editChild : (d.child || (cwChildren()[0]||null)); }
function cwRewardsOn(){ return typeof choreRewardsEnabled==="function" ? choreRewardsEnabled(cwPrimaryChild(wz.draft)) : true; }
function cwChildHasCalendar(child){ return !!(child && state.config && state.config.calendars && state.config.calendars[child]); }
function cwCopySources(d){
  return getChildNames().filter(n => n!==d.child && (((state.children||{})[n]||{}).chores||[]).length>0);
}
function cwManual(d){ return (wz && wz.mode==="edit") || d.copyChoice==="manual" || cwCopySources(d).length===0; }
function cwCurActive(d){ return (wz && wz.mode==="edit") || d._curOpen===true || (d.chores||[]).length===0; }

function cwBlankCur(){
  return {
    cName:"", cDesc:"", cAmount:"", cSplit:50, cChildChooses:true,
    cSchedule:undefined, cOnceType:undefined, cOnceDate:"", cWeekdays:[], cSkipFirst:undefined,
    cMonthlyDay:"1", cEndDate:"", cReminder:8, cProof:undefined,
    cStreakStart:"0", cStreakMilestone:"", cStreakReward:"", cDayTimes:{}
  };
}
function cwBlankDraft(){
  return { child:null, copyChoice:undefined, copyFrom:null, _copyFromPrev:null, copySel:[], copyAll:false,
           chores:[], curIdx:-1, _curOpen:true, _fromReview:false, addAnother:undefined, assign:[],
           ...cwBlankCur() };
}
function cwResetCur(d){ Object.assign(d, cwBlankCur()); d.curIdx=-1; d.addAnother=undefined; }

/** Draft c* fields → legacy chore field object (mirrors createChore's choreFields). */
function cwCurToFields(d){
  const schedule = d.cSchedule||"once";
  const weekdays = (schedule==="weekly"||schedule==="biweekly") ? (d.cWeekdays||[]).map(Number).sort((a,b)=>a-b) : null;
  const onceType = schedule==="once" ? (d.cOnceType||"none") : "none";
  const split = (d.cSplit===undefined||d.cSplit===null||d.cSplit==="") ? 50 : parseInt(d.cSplit,10);
  return {
    name:(d.cName||"").trim(), desc:(d.cDesc||"").trim(),
    amount: cwRewardsOn() ? cwNum(d.cAmount) : 0,
    schedule,
    monthlyDay: schedule==="monthly" ? (d.cMonthlyDay||"1") : null,
    weekday: weekdays && weekdays.length ? weekdays[0] : null,          // legacy single-day field
    weekdays,
    onceDate: (schedule==="once" && onceType!=="none") ? (d.cOnceDate||null) : null,
    onceDueOn: onceType==="on",
    reminderHour: parseInt(d.cReminder,10)||8,
    dayTimes: (weekdays && d.cDayTimes && typeof d.cDayTimes==="object") ? cwCopy(d.cDayTimes) : {},
    skipFirstWeek: schedule==="biweekly" && d.cSkipFirst===true,
    splitChk: Math.max(0, Math.min(100, isNaN(split)?50:split)),
    childChooses: d.cChildChooses===true,
    paused:false,
    endDate: schedule!=="once" ? (d.cEndDate||null) : null,
    requiresProof: d.cProof===true,
    streakStart: parseInt(d.cStreakStart,10)||0,
    streakMilestone: parseInt(d.cStreakMilestone,10)||0,
    streakReward: cwNum(d.cStreakReward)||0
  };
}
/** Existing chore (or staged field object) → draft c* fields. */
function cwFieldsToCur(c){
  const cur = cwBlankCur(); c = c||{};
  cur.cName = c.name||""; cur.cDesc = c.desc||"";
  cur.cAmount = (c.amount===undefined||c.amount===null||c.amount==="") ? "" : String(c.amount);
  cur.cSplit = (c.splitChk===undefined||c.splitChk===null) ? 50 : c.splitChk;
  cur.cChildChooses = !!c.childChooses;                                   // legacy editChore: !!chore.childChooses
  cur.cSchedule = c.schedule||"once";
  cur.cOnceType = c.onceDate ? (c.onceDueOn?"on":"by") : "none";
  cur.cOnceDate = c.onceDate||"";
  cur.cWeekdays = (c.weekdays || (c.weekday!==undefined&&c.weekday!==null ? [c.weekday] : [])).slice();
  cur.cSkipFirst = !!c.skipFirstWeek;
  cur.cMonthlyDay = c.monthlyDay||"1";
  cur.cEndDate = c.endDate||"";
  cur.cReminder = c.reminderHour||8;
  cur.cProof = !!c.requiresProof;
  cur.cStreakStart = String(c.streakStart||0);
  cur.cStreakMilestone = c.streakMilestone ? String(c.streakMilestone) : "";
  cur.cStreakReward = c.streakReward ? String(c.streakReward) : "";
  cur.cDayTimes = (c.dayTimes && typeof c.dayTimes==="object") ? cwCopy(c.dayTimes) : {};
  return cur;
}
/** Copy branch: strip a source chore down to its configuration fields. */
function cwFieldsFromChore(c){
  const o={};
  CW_FIELD_KEYS.forEach(k=>{ if(c[k]!==undefined) o[k]=cwCopy(c[k]); });
  o.paused=false; o.streakStart=0;                                       // never carry streak credit across children
  return o;
}
/** Clone rule (§2): fresh id, instance fields reset, fresh createdAt. */
function cwClone(fields, stamp, n){
  return { id:"chore_"+stamp+"_"+n, ...cwCopy(fields),
           status:"available", completedBy:null, completedAt:null, denialNote:null,
           createdAt:fmtDate(new Date()), streakCount:0 };
}
/** Chores staged for Review/commit, as field objects. */
function cwStaged(d){
  if(wz.mode==="edit") return [cwCurToFields(d)];
  if(d.copyChoice==="copy" && cwCopySources(d).length){
    const src = (((state.children||{})[d.copyFrom]||{}).chores||[]);
    return src.filter(c=> (d.copySel||[]).indexOf(c.id)!==-1).map(cwFieldsFromChore);
  }
  return (d.chores||[]).slice();
}
function cwTargets(d){
  if(wz.mode==="edit") return [wz.meta.editChild];
  const kids = cwChildren();
  if(kids.length>1 && (d.assign||[]).length) return d.assign.filter(n=>kids.indexOf(n)!==-1);
  return d.child ? [d.child] : [];
}
function cwStageCur(d){
  const f=cwCurToFields(d);
  if(d.curIdx>=0 && d.chores[d.curIdx]) d.chores[d.curIdx]=f; else d.chores.push(f);
  cwResetCur(d); d._curOpen=false;
}
function cwChoreSummary(c){
  const bits=["$"+cwNum(c.amount).toFixed(2), (typeof scheduleLabel==="function") ? scheduleLabel(c) : (c.schedule||"")];
  if(c.schedule==="biweekly" && c.skipFirstWeek) bits.push("starts next week");
  if(c.endDate) bits.push("ends "+c.endDate);
  if(c.requiresProof) bits.push("📷 proof");
  if(c.streakMilestone) bits.push("streak every "+c.streakMilestone+" → $"+cwNum(c.streakReward).toFixed(2));
  return wzEsc(bits.join(" · "));
}

// ── step-specific input handlers ────────────────────────────────────
function cwInput(field, el){ wz.draft[field]=el.value; wzSaveDraft(); wzRefreshPrimary(); wzInlineMsg(wzCur()); }
function cwToggleBool(field){ wz.draft[field]=!wz.draft[field]; wzSaveDraft(); wzRenderBodyOnly(); }
function cwSplitInput(el){
  const v=Math.max(0,Math.min(100,parseInt(el.value,10)||0)); wz.draft.cSplit=v;
  const a=document.getElementById("cw-split-chk"), b=document.getElementById("cw-split-sav");
  if(a) a.textContent=v; if(b) b.textContent=100-v;
  wzSaveDraft();
}
function cwCopyToggle(id){
  const d=wz.draft; const a=d.copySel||(d.copySel=[]); const i=a.indexOf(id);
  if(i===-1) a.push(id); else a.splice(i,1);
  d.copyAll=false; wzSaveDraft(); wzRenderBodyOnly();
}
function cwCopyAll(){
  const d=wz.draft; const src=(((state.children||{})[d.copyFrom]||{}).chores||[]);
  const all = src.length>0 && src.every(c=>(d.copySel||[]).indexOf(c.id)!==-1);
  d.copySel = all ? [] : src.map(c=>c.id); d.copyAll=!all;
  wzSaveDraft(); wzRenderBodyOnly();
}
function cwAssignAll(){
  const d=wz.draft; const kids=cwChildren();
  const all = kids.every(k=>(d.assign||[]).indexOf(k)!==-1);
  d.assign = all ? (d.child?[d.child]:[]) : kids.slice();
  wzSaveDraft(); wzRenderBodyOnly();
}
function cwCopySelectRender(d){
  const src=(((state.children||{})[d.copyFrom]||{}).chores||[]); const sel=d.copySel||[];
  const all = src.length>0 && src.every(c=>sel.indexOf(c.id)!==-1);
  return `<div class="wz-opts">
    <button type="button" class="wz-opt wz-opt-all${all?" selected":""}" onclick="cwCopyAll()"><span class="wz-opt-label">${all?"✓ ":""}Copy all (${src.length})</span></button>
    ${src.map(c=>`<button type="button" class="wz-opt${sel.indexOf(c.id)!==-1?" selected":""}" onclick="cwCopyToggle('${wzEsc(c.id)}')">
      <span class="wz-opt-label">${wzEsc(c.name)}</span><span class="wz-opt-desc">${cwChoreSummary(c)}</span></button>`).join("")}
  </div>`;
}
function cwResumeDraft(){
  const s = wz.meta.savedDraft;
  if(s && s.draft){ wz.draft = {...cwBlankDraft(), ...s.draft}; wz.idx = s.idx||0; }
  const preset = wz.meta.presetChild;
  if(preset){                                   // launched for a specific child: retarget the resumed draft
    const d=wz.draft;
    d.child = preset; d.assign=[preset];
    if(d.copyFrom===preset){ d.copyFrom=null; d._copyFromPrev=null; d.copySel=[]; d.copyAll=false; if(d.copyChoice==="copy") d.copyChoice=undefined; }
    // In-progress manual chores must survive a retarget that newly exposes the copy question.
    if(d.copyChoice!=="copy" && ((d.chores||[]).length || (d.cName||"").trim())) d.copyChoice="manual";
  }
  wz.meta.hasSavedDraft=false;
  if(wzCur() && wzCur().id==="resume") wz.idx++;
  wzNormalizeIdx(); wzRender();
}
function cwStartOver(){
  wzClearDraft(); wz.meta.hasSavedDraft=false;
  wz.draft = cwFreshDraft(wz.mode, wz.meta);
  wz.idx = 0; wzNormalizeIdx(); wzRender();
}
function cwFreshDraft(mode, meta){
  if(mode==="edit"){
    const ex=(((state.children||{})[meta.editChild]||{}).chores||[]).find(c=>c.id===meta.editChoreId);
    return {...cwBlankDraft(), ...cwFieldsToCur(ex), child:meta.editChild, _curOpen:true};
  }
  const d=cwBlankDraft(); const kids=cwChildrenList(meta.presetChild);
  d.child = meta.presetChild || (kids.length===1 ? kids[0] : null);
  d.assign = d.child ? [d.child] : [];
  return d;
}

// ── steps ───────────────────────────────────────────────────────────
function cwBuildSteps(mode){
  const isEdit = mode==="edit";
  const steps = [];
  const man = (d)=> !cwManual(d) || !cwCurActive(d);     // skip predicate for the per-chore steps

  steps.push({
    id:"resume", footer:"none",
    skip: () => !wz.meta.hasSavedDraft,
    render: () => `
      <h2 class="wz-q">Pick up where you left off?</h2>
      <div class="wz-sub">You have unfinished chores from before.</div>
      <div class="wz-opts">
        <button type="button" class="wz-opt" onclick="cwResumeDraft()"><span class="wz-opt-label">Resume where I left off</span></button>
        <button type="button" class="wz-opt" onclick="cwStartOver()"><span class="wz-opt-label">Start over</span></button>
      </div>`
  });

  steps.push({
    id:"child", field:"child", footer:"none",
    skip:()=> isEdit || !!wz.meta.presetChild || cwChildren().length<=1,   // §2 auto-skip
    title:"Chores for which child?",
    get options(){ return cwChildren().map(n=>({v:n,label:wzEsc(n)})); },
    onPick:(v)=>{ const d=wz.draft; d.assign=[v]; if(d.copyFrom===v){ d.copyFrom=null; d._copyFromPrev=null; d.copySel=[]; d.copyAll=false; } },
    validate:(d)=> d.child ? true : "Pick a child.",
    render: wzChoiceRender
  });

  steps.push({
    id:"copyAsk", field:"copyChoice", footer:"none",
    skip:(d)=> isEdit || cwCopySources(d).length===0,                       // §2 auto-skip
    title:"Copy chores from another child?",
    sub:"Copies the chore setup only — never completion history or streaks.",
    options:[
      {v:"copy",   label:"Yes, copy existing chores", desc:"Pick which ones, then review"},
      {v:"manual", label:"No, create new chores"}
    ],
    validate:(d)=> d.copyChoice!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"copySource", field:"copyFrom", footer:"none",
    skip:(d)=> isEdit || d.copyChoice!=="copy" || cwCopySources(d).length===0,
    title:"Copy chores from which child?",
    get options(){ return cwCopySources(wz.draft).map(n=>({v:n,label:wzEsc(n),desc:((((state.children||{})[n]||{}).chores||[]).length)+" chores"})); },
    onPick:(v)=>{ const d=wz.draft; if(d._copyFromPrev!==v){ d.copySel=[]; d.copyAll=false; } d._copyFromPrev=v; },
    validate:(d)=> d.copyFrom ? true : "Pick a child.",
    render: wzChoiceRender
  });

  steps.push({
    id:"copySelect", field:"copySel", footer:"default",
    skip:(d)=> isEdit || d.copyChoice!=="copy" || !d.copyFrom || cwCopySources(d).length===0,
    title:(d)=>`Which of ${wzEsc(d.copyFrom||"")}'s chores?`,
    sub:"Tap to toggle.",
    validate:(d)=> (d.copySel||[]).length ? true : "Pick at least one chore.",
    render: cwCopySelectRender
  });

  // ── manual branch: one chore at a time (repeat loop via addAnother) ──
  steps.push({
    id:"cName", field:"cName", footer:"default", skip:man,
    title:(d)=> isEdit ? "Chore name" : (d.curIdx>=0 ? "Edit the chore name" : ((d.chores||[]).length ? "What's the next chore?" : "What's the chore?")),
    sub:"Short and clear — this is what they'll see.",
    validate:(d)=> (d.cName||"").trim() ? true : "Chore name is required.",
    render:(d)=>`<input id="wz-input" class="wz-text" type="text" value="${wzEsc(d.cName)}" placeholder="e.g. Vacuum living room" autocomplete="off" oninput="wzTextInput()" onkeydown="wzKeydown(event)">
      <label class="wz-label" style="margin-top:14px;">Details (optional)</label>
      <input class="wz-text" type="text" value="${wzEsc(d.cDesc)}" placeholder="Any extra details…" autocomplete="off" oninput="cwInput('cDesc',this)" onkeydown="wzKeydown(event)">`,
    onPrimary:()=>{ wz.draft.cName=(wz.draft.cName||"").trim(); wz.draft.cDesc=(wz.draft.cDesc||"").trim(); return true; }
  });

  steps.push({
    id:"cReward", field:"cAmount", footer:"default",
    skip:(d)=> man(d) || !cwRewardsOn(),
    title:(d)=>`How much does "${wzEsc((d.cName||"").trim()||"it")}" pay?`,
    sub:"$0 is fine for unpaid chores.",
    validate:(d)=>{
      const raw=String(d.cAmount==null?"":d.cAmount).trim();
      if(raw==="") return "Enter an amount (0 is OK).";
      const n=parseFloat(raw.replace(/[^0-9.\-]/g,""));
      return (!isNaN(n)&&n>=0) ? true : "Enter a valid amount (0 or more).";
    },
    render:(d)=>`<input id="wz-input" class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.cAmount)}" placeholder="0.00" oninput="wzTextInput()" onkeydown="wzKeydown(event)">`
  });

  steps.push({
    id:"cSplit", field:"cSplit", footer:"default",
    skip:(d)=> man(d) || !cwRewardsOn() || cwNum(d.cAmount)<=0,
    title:"How should the reward be split?",
    sub:"Between checking and savings.",
    validate:()=> true,
    render:(d)=>{
      const s=parseInt(d.cSplit,10); const chk=isNaN(s)?50:s;
      return `
      <div class="wz-split-labels"><span>Checking <b id="cw-split-chk">${chk}</b>%</span><span>Savings <b id="cw-split-sav">${100-chk}</b>%</span></div>
      <input type="range" class="wz-range" min="0" max="100" step="5" value="${chk}" oninput="cwSplitInput(this)">
      <div class="wz-opts" style="margin-top:18px;">
        <button type="button" class="wz-opt${d.cChildChooses?" selected":""}" onclick="cwToggleBool('cChildChooses')"><span class="wz-opt-label">${d.cChildChooses?"✓ ":""}Let them choose their own split</span><span class="wz-opt-desc">They pick checking vs. savings when they complete it</span></button>
      </div>`;
    }
  });

  steps.push({
    id:"cSchedule", field:"cSchedule", footer:"none", skip:man,
    title:"How often?",
    options:[{v:"once",label:"One-time"},{v:"daily",label:"Daily"},{v:"weekly",label:"Weekly"},{v:"biweekly",label:"Every 2 weeks"},{v:"monthly",label:"Monthly"}],
    validate:(d)=> d.cSchedule ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"cOnceType", field:"cOnceType", footer:"none",
    skip:(d)=> man(d) || d.cSchedule!=="once",
    title:"Is there a due date?",
    options:[{v:"none",label:"No specific date"},{v:"by",label:"Due by a date",desc:"Anytime before that day"},{v:"on",label:"Due on a date",desc:"That day only"}],
    validate:(d)=> d.cOnceType ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"cOnceDate", field:"cOnceDate", footer:"default",
    skip:(d)=> man(d) || d.cSchedule!=="once" || !d.cOnceType || d.cOnceType==="none",
    title:(d)=> d.cOnceType==="on" ? "Due on which day?" : "Due by which day?",
    validate:(d)=> d.cOnceDate ? true : "Pick a date.",
    render:(d)=>`<input class="wz-text" type="date" value="${wzEsc(d.cOnceDate)}" oninput="cwInput('cOnceDate',this)" onchange="cwInput('cOnceDate',this)">`
  });

  steps.push({
    id:"cWeekdays", field:"cWeekdays", footer:"default", multi:true,
    skip:(d)=> man(d) || (d.cSchedule!=="weekly" && d.cSchedule!=="biweekly"),
    title:"Which days?", sub:"Tap to toggle.",
    options: WZ_WEEKDAYS.map((n,i)=>({v:i,label:n})),
    validate:(d)=> (d.cWeekdays||[]).length ? true : "Pick at least one day.",
    render: wzMultiRender
  });

  steps.push({
    id:"cSkipFirst", field:"cSkipFirst", footer:"none",
    skip:(d)=> man(d) || d.cSchedule!=="biweekly",
    title:"Start this week or next?",
    options:[{v:false,label:"This week"},{v:true,label:"Next week",desc:"Skip the current week"}],
    validate:(d)=> d.cSkipFirst!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"cMonthlyDay", field:"cMonthlyDay", footer:"default",
    skip:(d)=> man(d) || d.cSchedule!=="monthly",
    title:"Which day of the month?",
    validate:(d)=> d.cMonthlyDay ? true : "Pick a day.",
    render:(d)=>`<select class="wz-text" onchange="cwInput('cMonthlyDay',this)">${CW_MONTH_DAYS.map(v=>`<option value="${v}"${String(d.cMonthlyDay)===v?" selected":""}>${uwMonthDayLabel(v)}</option>`).join("")}</select>`
  });

  steps.push({
    id:"cEndDate", field:"cEndDate", footer:"default",
    skip:(d)=> man(d) || d.cSchedule==="once",
    title:"Does it end on a date?", sub:"Optional — leave blank to keep it going.",
    secondaryLabel:"No end date", onSecondary:()=>{ wz.draft.cEndDate=""; wzAdvance(); },
    validate:()=> true,
    render:(d)=>`<input class="wz-text" type="date" value="${wzEsc(d.cEndDate)}" oninput="cwInput('cEndDate',this)" onchange="cwInput('cEndDate',this)">`
  });

  steps.push({
    id:"cReminder", field:"cReminder", footer:"default",
    skip:(d)=> man(d) || !cwChildHasCalendar(cwPrimaryChild(d)),
    title:"Calendar reminder time?", sub:"When the calendar event is set for.",
    validate:()=> true,
    render:(d)=>`<select class="wz-text" onchange="cwInput('cReminder',this)">${CW_REMINDER_HOURS.map(([v,l])=>`<option value="${v}"${(parseInt(d.cReminder,10)||8)===v?" selected":""}>${l}</option>`).join("")}</select>`
  });

  steps.push({
    id:"cProof", field:"cProof", footer:"none", skip:man,
    title:"Require a proof photo?", sub:"They'll attach a photo when they mark it done.",
    options:[{v:false,label:"No"},{v:true,label:"Yes, require a photo"}],
    validate:(d)=> d.cProof!==undefined ? true : "Pick one.",
    render: wzChoiceRender
  });

  steps.push({
    id:"cStreak", field:"cStreakMilestone", footer:"default",
    skip:(d)=> man(d) || !cwRewardsOn() || d.cSchedule==="once",
    title:"Streak bonus?", sub:"Optional. A bonus deposited to checking every X completions in a row.",
    secondaryLabel:"No streak bonus", onSecondary:()=>{ wz.draft.cStreakMilestone=""; wz.draft.cStreakReward=""; wzAdvance(); },
    validate:(d)=>{
      const m=String(d.cStreakMilestone==null?"":d.cStreakMilestone).trim();
      const r=String(d.cStreakReward==null?"":d.cStreakReward).trim();
      const s=String(d.cStreakStart==null?"":d.cStreakStart).trim();
      if(m!=="" && !/^\d+$/.test(m)) return "Milestone must be a whole number.";
      if(s!=="" && !/^\d+$/.test(s)) return "Starting streak must be a whole number.";
      if(r!=="" && (isNaN(parseFloat(r.replace(/[^0-9.\-]/g,""))) || cwNum(r)<0)) return "Bonus must be 0 or more.";
      return true;
    },
    render:(d)=>`<label class="wz-label">Milestone every X times</label>
      <input id="wz-input" class="wz-text" type="text" inputmode="numeric" value="${wzEsc(d.cStreakMilestone)}" placeholder="e.g. 4" oninput="wzTextInput()" onkeydown="wzKeydown(event)">
      <label class="wz-label" style="margin-top:14px;">Bonus reward $</label>
      <input class="wz-text" type="text" inputmode="decimal" value="${wzEsc(d.cStreakReward)}" placeholder="0.00" oninput="cwInput('cStreakReward',this)" onkeydown="wzKeydown(event)">
      <label class="wz-label" style="margin-top:14px;">Starting streak count</label>
      <input class="wz-text" type="text" inputmode="numeric" value="${wzEsc(d.cStreakStart)}" placeholder="0" oninput="cwInput('cStreakStart',this)" onkeydown="wzKeydown(event)">
      <div class="wz-sub" style="margin-top:6px;margin-bottom:0;">Credit past completions.</div>`
  });

  steps.push({
    id:"addAnother", field:"addAnother", footer:"none",
    skip:(d)=> isEdit || man(d),
    title:(d)=>`"${wzEsc((d.cName||"").trim())}" is ready.`,
    sub:(d)=> d._fromReview ? "" : `${(d.chores||[]).length+1} chore${(d.chores||[]).length?"s":""} so far.`,
    get options(){
      const fr = wz.draft._fromReview;
      return [
        {v:"another", label:"Save and add another chore"},
        {v:"done",    label: fr ? "Save changes" : "Done — review chores", desc: fr ? "" : "Nothing is created until you confirm"}
      ];
    },
    beforePick:(v)=>{
      // Staging closes the per-chore steps (this one included), so navigate
      // explicitly instead of letting wzAdvance() look for a now-hidden step.
      const d=wz.draft; const fromReview=!!d._fromReview;
      cwStageCur(d); d.addAnother=v; d._fromReview=false; wz.meta.returnToReview=false;
      if(v==="another"){ d._curOpen=true; wzSaveDraft(); wzGotoId("cName"); return false; }
      wzSaveDraft();
      wzGotoId(fromReview ? "review" : "assign");                        // "done" → assign (normalizes to review when assign is skipped)
      return false;
    },
    validate:()=> true,
    render: wzChoiceRender
  });

  steps.push({
    id:"assign", field:"assign", footer:"default", multi:true,
    skip:()=> isEdit || cwChildren().length<=1,                            // NTH-33; pointless with one child
    title:"Assign to which children?",
    sub:"Each selected child gets their own copy.",
    get options(){ return cwChildren().map(n=>({v:n,label:wzEsc(n)})); },
    validate:(d)=> (d.assign||[]).length ? true : "Pick at least one child.",
    render:(d)=>{
      const kids=cwChildren(); const all=kids.every(k=>(d.assign||[]).indexOf(k)!==-1);
      return `<div class="wz-opts">
        <button type="button" class="wz-opt wz-opt-all${all?" selected":""}" onclick="cwAssignAll()"><span class="wz-opt-label">${all?"✓ ":""}Assign to all (${kids.length})</span></button>
        ${wzOptButtons(wzCur(), v=>(d.assign||[]).indexOf(v)!==-1)}
      </div>`;
    }
  });

  steps.push({
    id:"review", footer:"custom",
    title: isEdit ? "Review the changes" : "Review before creating",
    sub: isEdit ? "Nothing saves until you confirm." : "Nothing is created until you confirm.",
    validate:()=> true,
    render: cwReviewRender,
    footerHtml: ()=>{
      const d=wz.draft, bad=cwInvalidSteps().length>0, busy=wz.meta.committing;
      const n=cwStaged(d).length, t=cwTargets(d).length;
      const failed = wz.meta.fan && wz.meta.fan.some(f=>f.status==="fail");
      if(failed && !busy) return `<button class="btn btn-primary wz-btn-primary" id="wz-primary" onclick="cwRetryFan()">Retry remaining</button>`;
      const label = busy ? "Saving…" : isEdit ? "Save changes" : `Create ${n} chore${n===1?"":"s"}${t>1?" for "+t+" children":""}`;
      return `<button class="btn btn-primary wz-btn-primary" id="wz-primary" onclick="cwCommit()" ${bad||busy||n===0||t===0?"disabled":""}>${label}</button>`;
    }
  });

  steps.push({ id:"success", footer:"none", skip:()=> !wz.meta.committed, render: cwSuccessRender });
  return steps;
}

// ── review ──────────────────────────────────────────────────────────
function cwInvalidSteps(){
  const bad=[];
  wzVisible().forEach(s=>{
    if(s.id==="resume"||s.id==="review"||s.id==="success"||s.id==="addAnother") return;
    if(s.validate && s.validate(wz.draft)!==true) bad.push(s.id);
  });
  return bad;
}
function cwReviewEditChore(i){
  const d=wz.draft; const f=d.chores[i]; if(!f) return;
  Object.assign(d, cwFieldsToCur(f)); d.curIdx=i; d._curOpen=true; d._fromReview=true;
  wz.meta.returnToReview=false; wzSaveDraft(); wzGotoId("cName");
}
function cwReviewRemoveChore(i){ const d=wz.draft; d.chores.splice(i,1); wzSaveDraft(); wzRender(); }
function cwReviewAddChore(){
  const d=wz.draft; cwResetCur(d); d._curOpen=true; d._fromReview=true; d.copyChoice="manual";
  wz.meta.returnToReview=false; wzSaveDraft(); wzGotoId("cName");
}
function cwReviewDeselect(id){ cwCopyToggle(id); wzRender(); }
function cwFanStatusHtml(){
  const fan=wz.meta.fan||[];
  const icon = s => s==="ok"?"✓":s==="fail"?"✗":s==="saving"?"…":"·";
  return `<div class="wz-fan">${fan.map(f=>`<div class="wz-fan-row ${f.status}"><span class="wz-fan-icon">${icon(f.status)}</span><span>${wzEsc(f.child)}</span><span class="wz-fan-state">${f.status==="ok"?"Saved":f.status==="fail"?"Failed":f.status==="saving"?"Saving":"Waiting"}</span></div>`).join("")}</div>`;
}
function cwReviewRender(d){
  const isEdit = wz.mode==="edit";
  const bad = cwInvalidSteps();
  const visIds = wzVisible().map(s=>s.id);
  const err = wz.meta.commitError ? `<div class="wz-commit-error">${wzEsc(wz.meta.commitError)}</div>` : "";
  const fan = wz.meta.fan ? cwFanStatusHtml() : "";
  const rowHtml = (label, value, stepId, locked)=>{
    const invalid = stepId && bad.includes(stepId);
    return `<div class="wz-review-row${invalid?" invalid":""}">
      <div class="wz-review-l"><div class="wz-review-label">${label}</div>
      <div class="wz-review-value">${invalid?'<span class="wz-req">Required — tap Edit</span>':value}</div></div>
      ${locked||!stepId?"":`<button type="button" class="wz-review-edit" onclick="wzJump('${stepId}')">Edit</button>`}
    </div>`;
  };

  if(isEdit){
    const f = cwCurToFields(d);
    const rows=[];
    rows.push(rowHtml("Child", wzEsc(wz.meta.editChild), null, true));
    rows.push(rowHtml("Name", wzEsc(d.cName), "cName"));
    rows.push(rowHtml("Details", d.cDesc ? wzEsc(d.cDesc) : "—", "cName"));
    if(visIds.includes("cReward")) rows.push(rowHtml("Reward", "$"+cwNum(d.cAmount).toFixed(2), "cReward"));
    if(visIds.includes("cSplit"))  rows.push(rowHtml("Payout split", f.splitChk+"% checking / "+(100-f.splitChk)+"% savings"+(f.childChooses?" · child may choose":""), "cSplit"));
    rows.push(rowHtml("Schedule", wzEsc(typeof scheduleLabel==="function" ? scheduleLabel(f) : f.schedule), "cSchedule"));
    if(visIds.includes("cOnceType")) rows.push(rowHtml("Due date", f.onceDate ? ((f.onceDueOn?"Due on ":"Due by ")+wzEsc(f.onceDate)) : "None", "cOnceType"));
    if(visIds.includes("cWeekdays")) rows.push(rowHtml("Days", (f.weekdays||[]).map(i=>WZ_WEEKDAYS[i]).join(", ")||"—", "cWeekdays"));
    if(visIds.includes("cSkipFirst")) rows.push(rowHtml("Starts", f.skipFirstWeek?"Next week":"This week", "cSkipFirst"));
    if(visIds.includes("cMonthlyDay")) rows.push(rowHtml("Day of month", uwMonthDayLabel(f.monthlyDay), "cMonthlyDay"));
    if(visIds.includes("cEndDate")) rows.push(rowHtml("End date", f.endDate ? wzEsc(f.endDate) : "None", "cEndDate"));
    if(visIds.includes("cReminder")){ const h=CW_REMINDER_HOURS.find(x=>x[0]===f.reminderHour); rows.push(rowHtml("Calendar reminder", h?h[1]:(f.reminderHour+":00"), "cReminder")); }
    rows.push(rowHtml("Proof photo", f.requiresProof?"Required":"No", "cProof"));
    if(visIds.includes("cStreak")) rows.push(rowHtml("Streak bonus", f.streakMilestone ? ("Every "+f.streakMilestone+" → $"+cwNum(f.streakReward).toFixed(2)+(f.streakStart?" (starting at "+f.streakStart+")":"")) : "None", "cStreak"));
    // v34.1 Item 14 — calendar status lives on Review now that the legacy creator sheet is gone.
    setTimeout(()=>{ try{ if(typeof checkChoreCalendar==="function" && wz && wz.mode==="edit"){ const ex=(((state.children||{})[wz.meta.editChild]||{}).chores||[]).find(c=>c.id===wz.meta.editChoreId); if(ex) checkChoreCalendar(ex); } }catch(_){} }, 50);
    return err + `<div class="wz-review">${rows.join("")}</div><div id="chore-cal-status" class="chore-cal-status hidden"></div>`;
  }

  const targets = cwTargets(d);
  const staged  = cwStaged(d);
  const isCopy  = d.copyChoice==="copy" && cwCopySources(d).length>0;
  const forStep = visIds.includes("assign") ? "assign" : (visIds.includes("child") ? "child" : null);
  let h = err + fan;
  h += `<div class="wz-review">`;
  h += rowHtml("For", targets.length ? targets.map(wzEsc).join(", ") : "—", forStep, !forStep);
  if(isCopy) h += rowHtml("Copied from", wzEsc(d.copyFrom||"—"), "copySource");
  h += `</div>`;
  h += `<div class="wz-label" style="margin-top:18px;">Chores (${staged.length})</div>`;
  if(!staged.length) h += `<div class="wz-sub">No chores yet.</div>`;
  const srcIds = isCopy ? ((((state.children||{})[d.copyFrom]||{}).chores||[]).filter(c=>(d.copySel||[]).indexOf(c.id)!==-1).map(c=>c.id)) : [];
  h += staged.map((c,i)=>`
    <div class="wz-chore-card">
      <div class="wz-chore-main"><div class="wz-chore-name">${wzEsc(c.name)}</div><div class="wz-chore-sum">${cwChoreSummary(c)}${c.desc?"<br>"+wzEsc(c.desc):""}</div></div>
      <div class="wz-chore-actions">
        ${isCopy ? `<button type="button" class="wz-review-edit" onclick="cwReviewDeselect('${wzEsc(srcIds[i]||"")}')">Remove</button>`
                 : `<button type="button" class="wz-review-edit" onclick="cwReviewEditChore(${i})">Edit</button><button type="button" class="wz-review-edit" onclick="cwReviewRemoveChore(${i})">Remove</button>`}
      </div>
    </div>`).join("");
  if(isCopy) h += `<button type="button" class="wz-linkbtn" onclick="wzJump('copySelect')">Change which chores are copied</button>`;
  else       h += `<button type="button" class="wz-linkbtn" onclick="cwReviewAddChore()">+ Add another chore</button>`;
  return h;
}

// ── commit (WB-1 hybrid, S3-verified, sequential fan) ───────────────
async function cwCommit(){
  if(!wz || wz.meta.committing || wz.meta.committed) return;
  if(cwInvalidSteps().length){ wzRender(); return; }
  wz.meta.committing=true; wz.meta.commitError=null;
  if(wz.mode==="edit"){ await cwCommitEdit(); return; }
  const staged=cwStaged(wz.draft), targets=cwTargets(wz.draft);
  if(!staged.length || !targets.length){ wz.meta.committing=false; wz.meta.commitError="Nothing to create."; wzRender(); return; }
  wz.meta.fan = targets.map(n=>({child:n, status:"pending"}));
  wz.meta.single = (staged.length===1 && targets.length===1);
  wzRender();
  await cwRunFan(staged);
}
async function cwRetryFan(){
  if(!wz || wz.meta.committing || wz.meta.committed || !wz.meta.fan) return;
  wz.meta.fan.forEach(f=>{ if(f.status==="fail") f.status="pending"; });
  wz.meta.committing=true; wz.meta.commitError=null; wzRender();
  await cwRunFan(cwStaged(wz.draft));
}
async function cwRunFan(staged){
  const fan=wz.meta.fan; let counter=wz.meta.idCounter||0;
  for(let k=0;k<fan.length;k++){
    const f=fan[k]; if(f.status==="ok") continue;
    f.status="saving"; wzRender();
    const snapshot=JSON.stringify(state);
    const stamp=Date.now();
    const data=getChildData(f.child); data.chores=data.chores||[];
    staged.forEach(fields=>{ data.chores.push(cwClone(fields, stamp, counter++)); });   // clones added per child, right before its POST
    const isLast = !fan.slice(k+1).some(x=>x.status!=="ok");
    let res=null;
    try{
      // payload.activeChild = this child (server keys calendar/email off it).
      // v38.3-1 — skipReload on EVERY leg; the wizard reloads itself once the whole fan is
      // committed, so a post-save reload can never re-hydrate a rolled-back state (audit #3).
      res = await syncToCloud(wz.meta.single ? "Chore Created" : "Chore Edited", {activeChild:f.child, skipReload:true});
    }catch(_){ res=null; }
    if(!(res && res.status==="ok")){
      state=JSON.parse(snapshot);                       // roll back THIS child only; earlier legs stay committed
      f.status="fail";
      const earlier = fan.slice(0,k).filter(x=>x.status==="ok").length;
      wz.meta.commitError = (res && res.reason)
        ? "Save failed for "+f.child+" ("+res.reason+")."
        : "Couldn't reach the server while saving "+f.child+". "+(earlier?earlier+" child"+(earlier===1?"":"ren")+" already saved; ":"Nothing was saved; ")+"the rest were not. Check your connection and retry.";
      wz.meta.idCounter=counter; wz.meta.committing=false;
      try{ renderParentChores(); renderChildChores(); updateChoreBadges(); }catch(_){}
      wzRender(); return;
    }
    f.status="ok"; wzRender();
  }
  wz.meta.committing=false; wz.meta.committed=true;
  wz.meta.created=staged.length; wz.meta.createdFor=fan.map(x=>x.child);
  wzClearDraft();
  { const _g=_saveGen; setTimeout(()=>loadFromCloud({ifGen:_g}), 1800); }   // v38.3-1 — one reload for the whole fan, guarded like any other
  try{ renderParentChores(); renderChildChores(); updateChoreBadges(); }catch(_){}
  wzGotoId("success");
}
async function cwCommitEdit(){
  const d=wz.draft, child=wz.meta.editChild, id=wz.meta.editChoreId;
  const data=getChildData(child);
  const ex=(data.chores||[]).find(c=>c.id===id);
  if(!ex){ wz.meta.committing=false; wz.meta.commitError="That chore no longer exists."; wzRender(); return; }
  const snapshot=JSON.stringify(state);
  Object.assign(ex, cwCurToFields(d));                   // legacy createChore edit path: Object.assign(ex, choreFields)
  wzRender();
  let res=null;
  try{ res = await syncToCloud("Chore Edited", {activeChild:child, extra:{_editedChoreId:id}}); }catch(_){ res=null; }
  if(!(res && res.status==="ok")){
    state=JSON.parse(snapshot); wz.meta.committing=false;
    wz.meta.commitError = (res && res.reason) ? "Save failed ("+res.reason+")." : "Couldn't reach the server — nothing was saved. Check your connection and try again.";
    try{ renderParentChores(); }catch(_){}
    wzRender(); return;
  }
  wz.meta.committing=false; wz.meta.committed=true; wz.meta.editedName=ex.name;
  wzClearDraft();
  try{ renderParentChores(); renderChildChores(); updateChoreBadges(); }catch(_){}
  wzGotoId("success");
}

// ── success ─────────────────────────────────────────────────────────
function cwSuccessRender(){
  const m=wz.meta, isEdit=wz.mode==="edit";
  const msg = isEdit
    ? `"${wzEsc(m.editedName||"")}" updated!`
    : `${m.created} chore${m.created===1?"":"s"} created for ${(m.createdFor||[]).map(wzEsc).join(", ")}!`;
  const multi = !isEdit && !m.single;
  return `
    <div class="wz-success">
      <div class="wz-success-check">✓</div>
      <h2 class="wz-q" style="text-align:center;">${msg}</h2>
      ${multi ? `<div class="wz-sub" style="text-align:center;">Calendar events were rebuilt where enabled. Bulk creation doesn't send "new chore" emails.</div>` : ""}
      <div class="wz-opts" style="margin-top:22px;">
        ${isEdit ? "" : `<button type="button" class="wz-opt" onclick="cwSuccessMore()"><span class="wz-opt-label">Create more chores</span></button>`}
        <button type="button" class="wz-opt" onclick="cwSuccessDone()"><span class="wz-opt-label">Done</span></button>
      </div>
    </div>`;
}
function cwSuccessDone(){
  const m = wz && wz.meta;
  const primary = m && (m.editChild || (m.createdFor && m.createdFor[0]));
  wz=null; closeSheet("sheet-wiz2", true);
  // Land the parent on the child that just got chores (if they were viewing someone else).
  if(primary && primary!==activeChild && currentRole==="parent"){ try{ selectChild(primary); }catch(_){} }
}
function cwSuccessMore(){ wz=null; closeSheet("sheet-wiz2", true); setTimeout(()=>{ try{ cwOpenAdd(null); }catch(_){} }, 200); }

// ── open / entry points ────────────────────────────────────────────
function cwStart(mode, opts){
  opts=opts||{};
  const editKey = mode==="edit" ? (opts.child+"|"+opts.choreId) : null;
  const saved = wzLoadDraft("chore", mode, editKey, CW_DRAFT_KEY);
  const meta = {
    draftKey:CW_DRAFT_KEY, onDone:cwSuccessDone,
    presetChild:opts.presetChild||null, editChild:opts.child||null, editChoreId:opts.choreId||null, editName:editKey,
    sectionLabel: mode==="edit" ? "Edit chore" : "New chores",
    hasSavedDraft:!!saved, savedDraft:saved,
    returnToReview:false, navigated:false,
    committing:false, committed:false, commitError:null,
    fan:null, single:false, idCounter:0, created:0, createdFor:[], editedName:null
  };
  wz = { kind:"chore", mode:mode, idx:0, draft:null, steps:null, meta:meta };
  wz.draft = cwFreshDraft(mode, meta);
  wz.steps = cwBuildSteps(mode);
  wz.meta.pristine = JSON.stringify(wz.draft);   // v38.2-5 — untouched-draft baseline (see wzClose)
  if(mode==="edit" && !saved){ wz.idx = wzStepIndexById("review"); }     // edit opens AT Review (spec §7 symmetry)
  openSheet("sheet-wiz2");
  wzRender();
}
function cwOpenAdd(presetChild){
  if(currentRole !== "parent"){ showToast("Only parents can create chores.","error"); return; }
  const kids = cwChildrenList(presetChild||null);
  if(!kids.length){ showToast("Add a child first.","error"); return; }
  if(presetChild && getChildNames().indexOf(presetChild)===-1) presetChild=null;
  cwStart("add", {presetChild:presetChild||null});
}
function cwOpenEdit(child, choreId){
  if(currentRole !== "parent"){ showToast("Only parents can edit chores.","error"); return; }
  const ex=(((state.children||{})[child]||{}).chores||[]).find(c=>c.id===choreId);
  if(!ex){ showToast("Chore not found.","error"); return; }
  cwStart("edit", {child:child, choreId:choreId});
}
window.cwOpenAdd = cwOpenAdd;
window.cwOpenEdit = cwOpenEdit;
