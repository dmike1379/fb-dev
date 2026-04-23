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
const API_URL = "https://script.google.com/macros/s/AKfycbxvevlcClHWzRJeO4djJwlFOAfrp7AZGUN17uSBmbgjeAfcmSgg07yfV0WCfh-lirQP3Q/exec";

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
// v37.0 — No longer a hardcoded constant. Read from version.json at runtime
//         and stamped onto splash/login in stampVersion() below. Kept as a
//         non-authoritative fallback in case the fetch fails.
let APP_VERSION = "37.0";

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
// v37.0 — row-per-family routing. Every network call to the backend must carry
// this id. Persisted in sessionStorage ("fb_session_family") so a refresh
// re-enters the same family without re-hitting the listFamilies discovery flow.
let currentFamilyId     = null;
// v37.0 — Mirror Code.gs generateFamilyId(): "fam_" + 8 base36 chars.
// Client and server must format ids identically so handoff between the two
// (approve-pending flow posts a new family under a client-generated id) stays
// consistent.
function generateFamilyId(){
  let suffix = "";
  for(let i=0; i<8; i++){
    suffix += Math.floor(Math.random()*36).toString(36);
  }
  return "fam_" + suffix;
}
let pendingTransactions = [];
let editingChoreId      = null;
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
let wizardState         = null;   // {childName, step, mode:"new"|"edit", data:{...}, chores:[...]}
let wizardTotalSteps    = 9;  // v34.2 — streaks folded into step 7

// v33.0 — Proof photo buffer for pending chore submission (base64 data URL or null)
let pendingProofPhoto   = null;
let pendingProofChoreId = null;

// ════════════════════════════════════════════════════════════════════
// 3. UTILITIES
// ════════════════════════════════════════════════════════════════════
function fmt(v){ return "$"+(parseFloat(v)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
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

// ────────────────────────────────────────────────────────────────────
// v37.0 — REAUTH MODAL
// ────────────────────────────────────────────────────────────────────
// Friction gate against accidental clicks on destructive actions (Delete
// Own Account, Delete Child, Delete Family). Not a security boundary —
// the user is already authenticated. Intentionally low-stakes messaging:
// no "access denied" language, no attempt counter, no lockout.
//
// Usage:
//   confirmReauth("Delete Family", () => { /* proceed */ });
//
// Contract:
//   - Username is pre-filled with currentUser and read-only.
//   - PIN is the live input; validated against state.pins[currentUser].
//   - Wrong PIN: shows inline error, clears PIN, stays open for retry.
//   - Correct PIN: closes modal and fires callback().
//   - Cancel: closes modal, callback NOT fired.
//
// Markup lives in index.html (reauth-overlay + child elements). Until the
// index.html pass lands, calls to confirmReauth() will silently no-op if
// the DOM surface is missing — guarded below.
let reauthCallback = null;

function confirmReauth(actionLabel, callback){
  const overlay = document.getElementById("reauth-overlay");
  if(!overlay){
    // Index.html markup not yet in place — fail safe by running callback
    // directly so the app remains usable during frontend rollout. Once the
    // index.html pass lands this branch is dead code. Logging so QA can
    // catch it if markup ships broken.
    console.warn("[FamilyBank v37.0] confirmReauth: #reauth-overlay missing; firing callback directly for action:", actionLabel);
    if(typeof callback === "function") callback();
    return;
  }
  if(!currentUser || !state.pins || state.pins[currentUser] === undefined){
    // No logged-in user or no PIN on record — can't reauth. Shouldn't reach
    // here in practice since destructive actions are parent-gated.
    console.warn("[FamilyBank v37.0] confirmReauth called without valid currentUser");
    return;
  }
  reauthCallback = (typeof callback === "function") ? callback : null;

  const labelEl = document.getElementById("reauth-action-label");
  if(labelEl) labelEl.textContent = actionLabel || "this action";

  const userEl = document.getElementById("reauth-username");
  if(userEl){
    userEl.value = currentUser;
    userEl.readOnly = true;
  }

  const pinEl = document.getElementById("reauth-pin");
  if(pinEl){
    pinEl.value = "";
  }

  const errEl = document.getElementById("reauth-error");
  if(errEl){
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }

  overlay.classList.add("open");
  // Defer focus so the modal is painted first
  setTimeout(()=>{ document.getElementById("reauth-pin")?.focus(); }, 150);
}
window.confirmReauth = confirmReauth;

function closeReauth(){
  const overlay = document.getElementById("reauth-overlay");
  if(overlay) overlay.classList.remove("open");
  // Clear the PIN field on close so it never lingers in the DOM
  const pinEl = document.getElementById("reauth-pin");
  if(pinEl) pinEl.value = "";
  reauthCallback = null;
}
window.closeReauth = closeReauth;

function fireReauthConfirm(){
  const pinEl = document.getElementById("reauth-pin");
  const errEl = document.getElementById("reauth-error");
  const entered = pinEl ? (pinEl.value || "") : "";

  if(!entered){
    if(errEl){
      errEl.textContent = "Enter your PIN to continue.";
      errEl.classList.remove("hidden");
    }
    pinEl?.focus();
    return;
  }

  const expected = (state.pins && state.pins[currentUser] !== undefined)
    ? String(state.pins[currentUser]) : null;

  if(expected !== null && entered === expected){
    const cb = reauthCallback;
    closeReauth();
    if(typeof cb === "function") cb();
    return;
  }

  // Wrong PIN: stay open, clear field, show inline message.
  if(errEl){
    errEl.textContent = "PIN doesn't match. Try again.";
    errEl.classList.remove("hidden");
  }
  if(pinEl){
    pinEl.value = "";
    pinEl.focus();
  }
}
window.fireReauthConfirm = fireReauthConfirm;

function handleReauthOverlayClick(e){
  if(e.target === document.getElementById("reauth-overlay")) closeReauth();
}
window.handleReauthOverlayClick = handleReauthOverlayClick;

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
// v37.0 — Restore familyId from sessionStorage synchronously before the first
// network call, so the initial loadFromCloud fetches the right family's state
// instead of hitting listFamilies and bouncing through a picker on every refresh.
try {
  const savedFid = sessionStorage.getItem("fb_session_family");
  if(savedFid && /^fam_[a-z0-9]{4,}$/.test(savedFid)){
    currentFamilyId = savedFid;
  }
} catch(e){}

async function loadFromCloud(){
  setStatus("loading","Connecting to bank...");
  try{
    // v37.0 — If we don't have a familyId yet (fresh install / first visit /
    // cleared session), ask the backend which families exist. Zero → fresh
    // install, route to default/first-run. One → auto-adopt that family.
    // Many → surface a family picker. Code.gs v37.0 returns {familyIds:[...]}
    // for requests without familyId.
    if(!currentFamilyId){
      try {
        const discoverRes = await fetch(API_URL+"?action=listFamilies&t="+Date.now());
        const discover = await discoverRes.json();
        const ids = (discover && Array.isArray(discover.familyIds)) ? discover.familyIds : [];
        if(ids.length === 1){
          currentFamilyId = ids[0];
          try { sessionStorage.setItem("fb_session_family", currentFamilyId); } catch(e){}
        } else if(ids.length > 1){
          // Multi-family on this backend and no session — show picker UI.
          // Picker markup and handler land in a later index.html/app.js edit;
          // until then, default to the first id so the app still boots.
          // TODO v37.0 UI: showFamilyPicker(ids)
          currentFamilyId = ids[0];
          try { sessionStorage.setItem("fb_session_family", currentFamilyId); } catch(e){}
        }
        // else: zero families — fresh install path. Leave currentFamilyId null
        // and let the server's default-family response below hydrate state.
      } catch(e){
        console.warn("[FamilyBank] family discovery failed:", e);
      }
    }
    const url = API_URL + "?t=" + Date.now() +
      (currentFamilyId ? "&familyId=" + encodeURIComponent(currentFamilyId) : "");
    const res=await fetch(url);
    const data=await res.json();
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
        state.users.forEach(u=>{ state.roles[u] = u==="Dad" ? "parent" : "child"; });
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
      // v32.4 item #8: seed admin email on first load if empty.
      // TODO: STRIP THIS HARDCODED SEED BEFORE PUBLISHING TO INSTRUCTABLES.
      // Replace with `state.config.adminEmail = state.config.adminEmail || "";`
      if(!state.config.adminEmail) state.config.adminEmail = "michaelhdeleo@gmail.com";
      // v34.0 — BACKFILL createdAt for any child without one. Pre-v34.0 children
      // have no createdAt on their usersData entry, which would cause the
      // annualProjectionCheck trigger in Code.gs to skip them forever. Stamp
      // them with the v34.0 deploy date so their first anniversary email fires
      // a year from now. This runs every load; it's idempotent.
      try {
        state.usersData = state.usersData || {};
        const BACKFILL_DATE = "2026-04-17T00:00:00.000Z";
        (state.users || []).forEach(u => {
          if((state.roles||{})[u] !== "child") return;
          if(!state.usersData[u]) state.usersData[u] = {};
          if(!state.usersData[u].createdAt){
            state.usersData[u].createdAt = BACKFILL_DATE;
            state._needsCreatedAtBackfillSave = true;
          }
        });
      } catch(e) { /* best-effort */ }
      migrateIfNeeded();
      pendingTransactions=[];
      applyBranding();
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
// Before v34.0, two syncToCloud calls could race on Apps Script because POSTs
// don't serialize server-side. A fast cheap POST (e.g. "Login") could finish
// AFTER a big slow one (e.g. "Chore Submitted" with a proof photo) and
// overwrite the newer state. Fix is two-part:
//   1. Every payload carries a _savedAt ISO timestamp; Code.gs rejects any POST
//      whose _savedAt is older than what's already in A1 (stale-write guard).
//   2. Client-side, every syncToCloud awaits the previous one plus a small
//      buffer before firing, so same-client collisions never even leave.
// The chain lives on this module-scope variable.
let _syncChain = Promise.resolve();
const SYNC_BUFFER_MS = 2000;

async function syncToCloud(action){
  // Queue behind any in-flight sync. Each link awaits the previous one plus
  // a 2s server-processing buffer, then does its own fetch + optional reload.
  const prev = _syncChain;
  _syncChain = prev.then(async () => {
    await new Promise(r => setTimeout(r, SYNC_BUFFER_MS));
    return _doSyncToCloud(action);
  }).catch(err => {
    // Don't let one failed sync poison the chain for subsequent calls
    console.error("[FamilyBank] sync chain link failed:", err);
  });
  return _syncChain;
}

async function _doSyncToCloud(action){
  renderBalances();
  const payload={
    ...state,
    tempTransactions:pendingTransactions,
    lastAction:action,
    activeChild:activeChild,
    // v37.0 — Required by Code.gs. POSTs without familyId are rejected.
    // Null here (pre-login / discovery failed) is itself a signal the server
    // will reject — preferable to a silent overwrite of the wrong family.
    familyId: currentFamilyId,
    // v34.0 — Stale-write guard stamp. Server compares this to its own _savedAt
    // and rejects the POST if ours is older. Also re-stamps state._savedAt
    // server-side before saving so the next POST has a fresh baseline.
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
  // v33.0 — Attach pending proof photo (if any) to chore submissions only
  const hasProofPhoto = (action === "Chore Submitted" && !!pendingProofPhoto);
  if(hasProofPhoto){
    payload.proofPhoto = pendingProofPhoto;
  }
  pendingTransactions=[];
  try{
    await fetch(API_URL,{method:"POST",mode:"no-cors",body:JSON.stringify(payload)});
    // v33.0 — Clear photo buffer after a successful POST
    pendingProofPhoto = null;
    pendingProofChoreId = null;
    // v34.0 — Skip the reload roundtrip on proof-photo submissions. Apps Script
    // takes well over 1.8s to process a 200KB base64 payload, so the reload
    // was reading stale state and clobbering the just-submitted chore. State
    // we just sent is authoritative for the client; the monthly/chore triggers
    // will produce the server truth on schedule.
    if(!hasProofPhoto){
      setTimeout(loadFromCloud, 1800);
    }
  } catch(err){
    showToast("Sync error — change may not have saved!","error",5000);
  }
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
function attemptLogin(){
  clearFieldError("pin-input","pin-error");
  const userRaw=document.getElementById("username-input").value.trim();
  const pin=document.getElementById("pin-input").value;
  const user=state.users.find(u=>u.toLowerCase()===userRaw.toLowerCase());
  if(!user){ showFieldError("pin-input","pin-error","Name not recognised — check spelling."); return; }
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
  // v37.0 — Pin currentFamilyId to the authoritative value from the state that
  // was just authenticated against. By the time we get here, `state.familyId`
  // came from the server on the most recent loadFromCloud (Code.gs stamps it
  // on every loadFamilyState return). In practice currentFamilyId is already
  // correct (set by discovery or sessionStorage restore). This guard catches
  // drift in one scenario: loadFromCloud discovery auto-adopted family A, but
  // Code.gs (for any reason — cache miss, manual sheet edit) returned state
  // belonging to family B. Without this check we'd authenticate against B's
  // user list while posting under A's familyId, scrambling two families.
  try {
    if(state && state.familyId && state.familyId !== currentFamilyId){
      console.warn("[FamilyBank v37.0] familyId drift at login — session was "+currentFamilyId+", server state is "+state.familyId+". Pinning to server.");
      currentFamilyId = state.familyId;
      try { sessionStorage.setItem("fb_session_family", currentFamilyId); } catch(e){}
    }
  } catch(e){}
  // v33.1 — If the one-parent migration ran during loadFromCloud and this login
  // is that parent, persist the seeded parentChildren list now.
  try {
    if(state._needsSingleParentMigrationSave){
      delete state._needsSingleParentMigrationSave;
      if((state.roles||{})[user] === "parent"){
        syncToCloud("Single-parent migration");
      }
    }
    // v34.0 — Persist createdAt backfill on first parent login after upgrade.
    // Same pattern as the single-parent migration above: loadFromCloud ran
    // before anyone was logged in, so we defer the sync to here.
    if(state._needsCreatedAtBackfillSave){
      delete state._needsCreatedAtBackfillSave;
      if((state.roles||{})[user] === "parent"){
        syncToCloud("v34.1 createdAt backfill");
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
  // v37.0 — persist familyId so refresh skips the listFamilies round-trip
  try {
    if(currentFamilyId) sessionStorage.setItem("fb_session_family", currentFamilyId);
  } catch(e){}
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

    // v37.0 — Family Setup Wizard trigger. Must fire BEFORE any per-child
    // wizard trigger so we don't push a partially-setup family through the
    // child flow. Primary parent only; gated by familySetupComplete flag.
    // Migration stamps existing families' flag to true, so this only fires
    // on brand-new families approved post-v37.0.
    try {
      if(isPrimaryParent(currentUser)
         && state.config && state.config.familySetupComplete !== true){
        // Defer to next tick so the parent top bar paints first.
        setTimeout(openFamilyWizard, 40);
        return;  // Skip the rest of enterApp's parent-branch routing. The
                 // wizard's fwCommit() handles re-rendering after finish.
      }
    } catch(e){
      console.warn("[FamilyBank v37.0] Family wizard trigger check failed:", e);
    }

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
           && typeof startWizardForNewChild === "function"){
          startWizardForNewChild();
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
  // v37.0 — clear familyId so the next login re-discovers (handles family switching)
  try { sessionStorage.removeItem("fb_session_family"); } catch(e){}
  currentFamilyId = null;
  currentUser=null; currentRole=null; activeChild=null;
  pendingTransactions=[];
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("child-picker-screen").classList.add("hidden");
  document.getElementById("parent-panel").classList.add("hidden");
  document.getElementById("child-panel").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("pin-input").value="";
  clearTimeout(inactivityTimer);
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
  }catch(e){}
  const ni=document.getElementById("username-input");
  const rc=document.getElementById("remember-me");
  const ac=document.getElementById("auto-login-cb");
  const nb=document.getElementById("not-you-btn");
  const aw=document.getElementById("auto-login-wrap");
  if(ni){ ni.value=""; ni.focus(); }
  if(rc) rc.checked=false;
  if(ac) ac.checked=false;
  if(nb) nb.classList.add("hidden");
  if(aw) aw.style.display="none";
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
  document.getElementById("picker-welcome").innerHTML=renderAvatar(currentUser,"sm")+' <span>Hi '+currentUser+'! 👋</span>';
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("child-picker-screen").classList.remove("hidden");
  const list=document.getElementById("child-picker-list");

  // v37.0 — Compute deactivated children this parent would otherwise see
  // (assigned to them, currently in deactivatedChildren). Picker is the
  // only surface that can reveal them.
  const assigned = (state.config.parentChildren && state.config.parentChildren[currentUser]) || [];
  const deactivatedAll = (state.config.deactivatedChildren || []);
  const myDeactivated = getChildNames().filter(c =>
    assigned.indexOf(c) !== -1 && deactivatedAll.indexOf(c) !== -1
  );

  // Active children (unchanged shape)
  let html = "";
  if(!children.length){
    html += emptyState("children","No children assigned. Add one in Admin.");
  } else {
    html += children.map(name=>{
      const d=getChildData(name);
      const total=(d.balances?.checking||0)+(d.balances?.savings||0);
      return `<div class="child-btn-wrap">
        <button class="child-btn with-avatar" onclick="selectChild('${name}')">
          ${renderAvatar(name,"md")}
          ${name}
          <div class="child-btn-balance">Total: ${fmt(total)}</div>
          <span class="child-btn-arrow">›</span>
        </button>
        <button class="btn btn-sm btn-outline child-btn-wizard" onclick="startWizardForExistingChild('${name}')" title="Edit ${name} with Setup Wizard">🪄 Setup</button>
      </div>`;
    }).join("");
  }

  // v37.0 — Deactivated toggle + conditional section
  if(myDeactivated.length){
    const toggleLabel = showDeactivatedInPicker
      ? "Hide deactivated (" + myDeactivated.length + ")"
      : "Show deactivated (" + myDeactivated.length + ")";
    html += `<div class="picker-deactivated-toggle-wrap">
      <button class="btn btn-sm btn-ghost" onclick="toggleShowDeactivatedInPicker()">${toggleLabel}</button>
    </div>`;
    if(showDeactivatedInPicker){
      html += `<div class="picker-deactivated-section">
        <div class="picker-deactivated-label">Deactivated</div>`;
      html += myDeactivated.map(name => {
        return `<div class="child-btn-wrap deactivated">
          <div class="child-btn with-avatar deactivated-row">
            ${renderAvatar(name,"md")}
            <span class="deactivated-name">${name}</span>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="restoreChild('${name}')" title="Restore ${name}">↩ Restore</button>
        </div>`;
      }).join("");
      html += `</div>`;
    }
  }

  list.innerHTML = html;
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
  // v37.0 — Deactivated children are hidden globally (picker, switcher,
  // balances, week-at-a-glance, etc.). The child picker exposes a local
  // "Show deactivated" toggle that bypasses this filter for its own render.
  const deactivated = (state.config.deactivatedChildren || []);
  return all.filter(c => assigned.indexOf(c) !== -1 && deactivated.indexOf(c) === -1);
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
  el.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-bottom:10px;font-size:.78rem;color:#92400e;">
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
          <span class="chore-card-name">${d.note}</span>
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
  if(!data.pendingDeposits) data.pendingDeposits=[];
  data.pendingDeposits.push({
    id:"dep_"+Date.now(),
    amount:v.amt, note:v.note, splitChk,
    submittedBy:currentUser, submittedAt:fmtDate(new Date())
  });
  syncToCloud("Deposit Submitted");
  showToast("Deposit submitted for approval. 📥","success");
  document.getElementById("child-amt").value=""; document.getElementById("child-note").value="";
  renderPendingDeposits();
}

function renderPendingDeposits(){
  const child=activeChild||currentUser;
  const data=getChildData(child);
  const el=document.getElementById("deposit-pending-list");
  if(!el) return;
  const pending=(data.pendingDeposits||[]).filter(d=>d.submittedBy===currentUser);
  if(!pending.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-bottom:10px;font-size:.78rem;color:#92400e;">
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
          <span class="chore-card-name">${d.note}</span>
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
    `<div style="font-size:.75rem;color:var(--muted);margin-bottom:4px;">Projected in next 12 months</div>`+
    `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;">`+
      `<div><div style="font-size:.7rem;color:var(--muted);">Allowance</div><div style="font-weight:700;">${fmt(annualAllowance)}</div></div>`+
      `<div><div style="font-size:.7rem;color:var(--muted);">Interest</div><div style="font-weight:700;">${fmt(annualInterest)}</div></div>`+
      `<div><div style="font-size:.7rem;color:var(--muted);">Total</div><div style="font-weight:800;color:var(--primary);">${fmt(total)}</div></div>`+
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
  // v32.4 item #9: populate parent's own email + clear any prior message
  // v34.2 — email now in parent settings sheet (ps-email-input); legacy id removed from HTML
  const peInput = document.getElementById("ps-email-input") || document.getElementById("parent-email-input");
  const peMsg   = document.getElementById("ps-email-msg")   || document.getElementById("parent-email-msg");
  if(peInput && currentRole === "parent" && currentUser){
    peInput.value = (state.config.emails && state.config.emails[currentUser]) || "";
  } else if(peInput){
    peInput.value = "";
  }
  if(peMsg){ peMsg.className="field-msg"; peMsg.textContent=""; }
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
  const msgEl=document.getElementById("profile-msg"); msgEl.className="field-msg";
  const email=document.getElementById("profile-email").value.trim();
  const calId=document.getElementById("profile-calendar-id").value.trim();
  if(!state.config.emails)    state.config.emails={};
  if(!state.config.calendars) state.config.calendars={};
  if(!state.config.notify)    state.config.notify={};
  if(!state.config.tabs)      state.config.tabs={};
  state.config.emails[activeChild]=email;
  if(calId) state.config.calendars[activeChild]=calId;
  else      delete state.config.calendars[activeChild];
  state.config.notify[activeChild]={
    email:        document.getElementById("profile-notify-email").checked,
    calendar:     document.getElementById("profile-notify-cal").checked,
    choreRewards: document.getElementById("profile-chore-rewards").checked
  };
  // v32: per-user celebration sound
  if(!state.usersData) state.usersData={};
  if(!state.usersData[activeChild]) state.usersData[activeChild]={};
  const csProfile = document.getElementById("profile-celebration-sound");
  if(csProfile) state.usersData[activeChild].celebrationSound = !!csProfile.checked;
  const sel=getPickerSelections("profileTabs");
  state.config.tabs[activeChild]={
    money:  sel.indexOf("money")!==-1,
    chores: sel.indexOf("chores")!==-1,
    loans:  sel.indexOf("loans")!==-1
  };
  syncToCloud("Child Profile Updated");
  msgEl.className="field-msg success";
  msgEl.textContent="Profile saved.";
  showToast(activeChild+"'s profile updated. 💾","success");
  // If assigned tabs changed, the child's tab bar will reflect on their next login
  renderParentTabBar();  // loan tab may appear/disappear for parent too
  closeSheet("sheet-child-profile", true);
}

function openProfilePicker(){ openPicker("profileTabs"); }

// v32.4 item #9: Save parent's own email address (state.config.emails[currentUser]).
// Parent emails share the same emails map as child notification emails, keyed by
// display name. User renaming isn't supported so collision isn't a concern.
function saveParentEmail(){
  const input = document.getElementById("parent-email-input") || document.getElementById("ps-email-input");
  const msg   = document.getElementById("parent-email-msg")   || document.getElementById("ps-email-msg");
  if(!input || !currentUser || currentRole !== "parent") return;
  const val = input.value.trim();
  if(val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){
    if(msg){ msg.className="field-msg error"; msg.textContent="Please enter a valid email address."; }
    showToast("Invalid email.","error");
    return;
  }
  if(!state.config.emails) state.config.emails = {};
  if(val) state.config.emails[currentUser] = val;
  else    delete state.config.emails[currentUser];
  syncToCloud("Parent Email Updated");
  if(msg){ msg.className="field-msg success"; msg.textContent = val ? "Email saved." : "Email cleared."; }
  showToast(val ? "Your email was saved." : "Your email was cleared.","success");
}

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
function toggleDayBtn(btn){
  // v32.2: Both weekly AND biweekly are multi-select (was: weekly single only).
  // Lets parents schedule "weekly Mon/Wed/Fri" style chores.
  btn.classList.toggle("selected");
  document.getElementById("weekday-none-msg").classList.add("hidden");
  // Per-day-time editor visibility depends on selected days
  refreshPerDayTimeUI();
}

function getSelectedDays(){
  return Array.from(document.querySelectorAll("#chore-weekday-toggles .day-toggle.selected"))
    .map(b=>parseInt(b.dataset.day));
}

function setSelectedDays(days){
  document.querySelectorAll("#chore-weekday-toggles .day-toggle").forEach(b=>b.classList.remove("selected"));
  days.forEach(d=>{
    const el=document.querySelector(`#chore-weekday-toggles .day-toggle[data-day='${d}']`);
    if(el) el.classList.add("selected");
  });
}

function resetDayToggles(){
  document.querySelectorAll("#chore-weekday-toggles .day-toggle").forEach(b=>b.classList.remove("selected"));
}

function populateMonthlyDays(){
  const sel=document.getElementById("chore-monthly-day");
  if(!sel||sel.options.length>0) return;
  for(let i=1;i<=28;i++) sel.appendChild(new Option(i+(i===1?"st":i===2?"nd":i===3?"rd":"th"), String(i)));
  ["last-2","last-1","last"].forEach(v=>{
    const lbl = v==="last"?"Last day":v==="last-1"?"2nd to last":"3rd to last";
    sel.appendChild(new Option(lbl, v));
  });
}

function onScheduleChange(){
  const s=document.getElementById("chore-schedule").value;
  document.getElementById("chore-once-wrap").classList.toggle("hidden",s!=="once");
  document.getElementById("chore-weekday-wrap").classList.toggle("hidden",s!=="weekly" && s!=="biweekly");
  document.getElementById("chore-monthly-wrap").classList.toggle("hidden",s!=="monthly");

  // v30.1: skip-first-week checkbox is bi-weekly only
  document.getElementById("chore-skip-week-wrap").classList.toggle("hidden", s!=="biweekly");

  // Per-day-time editor: only meaningful for weekly/biweekly
  document.getElementById("chore-per-day-time-wrap").classList.toggle("hidden", s!=="weekly" && s!=="biweekly");
  refreshPerDayTimeUI();

  const wl=document.getElementById("chore-weekday-label");
  if(wl) wl.textContent = s==="biweekly"
    ? "Due Days (every other week — select one or more)"
    : "Due Days of Week (select one or more)";

  const streakWrap=document.getElementById("chore-streak-section");
  if(streakWrap) streakWrap.classList.toggle("hidden",s==="once");

  if(s==="once"){
    toggleOnceDateField();
  } else {
    const ec=document.getElementById("chore-enddate-col");
    if(ec) ec.classList.toggle("hidden",s==="daily");
    const endLabel=document.getElementById("end-date-label");
    if(endLabel) endLabel.textContent="End Date (optional)";
    document.getElementById("chore-once-hint").style.display="none";
    document.getElementById("chore-reminder-row")?.classList.remove("hidden");
  }
}

// ── PER-DAY TIME EDITOR ─────────────────────────────────────────────
// Logic: visible only when schedule is weekly/biweekly. Default "Same time
// for all days" is checked → use the single #chore-reminder-time. Uncheck →
// show one row per selected day with its own time.
function onSameTimeToggle(){ refreshPerDayTimeUI(); }

function refreshPerDayTimeUI(){
  const wrap=document.getElementById("chore-per-day-time-wrap");
  const grid=document.getElementById("chore-per-day-times");
  const sched=document.getElementById("chore-schedule").value;
  if(sched!=="weekly" && sched!=="biweekly"){
    wrap.classList.add("hidden");
    grid.classList.add("hidden");
    grid.innerHTML="";
    return;
  }
  const sameTime=document.getElementById("chore-same-time").checked;
  const selectedDays=getSelectedDays();

  // Hide single time picker when per-day mode is active and ≥1 day chosen
  const singleRow=document.getElementById("chore-reminder-row");
  if(!sameTime && selectedDays.length>0){
    singleRow.classList.add("hidden");
    grid.classList.remove("hidden");
    renderPerDayTimeRows(selectedDays);
  } else {
    singleRow.classList.remove("hidden");
    grid.classList.add("hidden");
    grid.innerHTML="";
  }
}

function renderPerDayTimeRows(days){
  const grid=document.getElementById("chore-per-day-times");
  const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  // Preserve any existing values when rebuilding
  const existing={};
  grid.querySelectorAll("select[data-day]").forEach(s=>{ existing[s.dataset.day]=s.value; });
  // Default time = current single-picker value
  const defaultHour=document.getElementById("chore-reminder-time").value || "8";
  grid.innerHTML=days.map(d=>{
    const val=existing[d] || defaultHour;
    return `<div class="per-day-time-row">
      <div class="day-label">${dayNames[d]}</div>
      <select data-day="${d}">
        ${TIME_OPTIONS.map(o=>`<option value="${o.v}"${o.v===val?" selected":""}>${o.l}</option>`).join("")}
      </select>
    </div>`;
  }).join("");
}

const TIME_OPTIONS = [
  {v:"6",  l:"6:00 AM"},{v:"7",  l:"7:00 AM"},{v:"8",  l:"8:00 AM"},
  {v:"9",  l:"9:00 AM"},{v:"10", l:"10:00 AM"},{v:"11", l:"11:00 AM"},
  {v:"12", l:"12:00 PM (Noon)"},{v:"13", l:"1:00 PM"},{v:"14", l:"2:00 PM"},
  {v:"15", l:"3:00 PM (After school)"},{v:"16", l:"4:00 PM"},{v:"17", l:"5:00 PM"},
  {v:"18", l:"6:00 PM (Evening)"},{v:"19", l:"7:00 PM"},{v:"20", l:"8:00 PM"}
];

// Read per-day times from the editor. Returns {} if "same time" is checked.
function readPerDayTimes(){
  const sameTime=document.getElementById("chore-same-time")?.checked;
  if(sameTime!==false) return {};  // checked or undefined → use single time
  const out={};
  document.querySelectorAll("#chore-per-day-times select[data-day]").forEach(s=>{
    out[s.dataset.day]=parseInt(s.value)||8;
  });
  return out;
}

// Pre-populate the per-day time editor when editing a chore
function setPerDayTimes(dayTimes){
  if(!dayTimes || !Object.keys(dayTimes).length){
    document.getElementById("chore-same-time").checked=true;
  } else {
    document.getElementById("chore-same-time").checked=false;
  }
  refreshPerDayTimeUI();
  if(dayTimes && Object.keys(dayTimes).length){
    Object.entries(dayTimes).forEach(([d,h])=>{
      const sel=document.querySelector(`#chore-per-day-times select[data-day="${d}"]`);
      if(sel) sel.value=String(h);
    });
  }
}

function updateSplitLabel(){
  const p=parseInt(document.getElementById("chore-split").value);
  document.getElementById("split-chk-label").textContent=p;
  document.getElementById("split-sav-label").textContent=100-p;
}

function toggleOnceDateField(){
  const typeEl=document.getElementById("chore-once-type");
  if(!typeEl) return;
  const type=typeEl.value;
  const endDateCol=document.getElementById("chore-enddate-col");
  const endLabel=document.getElementById("end-date-label");
  const hint=document.getElementById("chore-once-hint");
  const schedule=document.getElementById("chore-schedule").value;
  if(schedule!=="once"){
    if(endLabel) endLabel.textContent="End Date (optional)";
    if(hint) hint.style.display="none";
    return;
  }
  const reminderRow=document.getElementById("chore-reminder-row");
  if(type==="none"){
    if(endDateCol)   endDateCol.classList.add("hidden");
    if(reminderRow)  reminderRow.classList.add("hidden");
    if(hint)         hint.style.display="none";
    document.getElementById("chore-end-date").value="";
  } else if(type==="by"){
    if(endDateCol)  endDateCol.classList.remove("hidden");
    if(reminderRow) reminderRow.classList.remove("hidden");
    if(endLabel)    endLabel.textContent="Due By Date";
    if(hint){ hint.style.display="block"; hint.textContent="Available every day until this date. Expires after."; }
  } else {
    if(endDateCol)  endDateCol.classList.remove("hidden");
    if(reminderRow) reminderRow.classList.remove("hidden");
    if(endLabel)    endLabel.textContent="Due On Date";
    if(hint){ hint.style.display="block"; hint.textContent="Only appears on this specific day."; }
  }
}

// Human-readable schedule label for display in chore lists
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

function getStreakFormValues(){
  return {
    streakStart:     parseInt(document.getElementById("chore-streak-start").value)     || 0,
    streakMilestone: parseInt(document.getElementById("chore-streak-milestone").value) || 0,
    streakReward:    readMoney("chore-streak-reward")  || 0
  };
}
function populateStreakForm(chore){
  document.getElementById("chore-streak-start").value     = chore.streakStart     || 0;
  document.getElementById("chore-streak-milestone").value = chore.streakMilestone || "";
  const srEl = document.getElementById("chore-streak-reward");
  srEl.value = chore.streakReward || "";
  _reformatMoneyInput(srEl);  // v34.0
}
function clearStreakForm(){
  document.getElementById("chore-streak-start").value=0;
  document.getElementById("chore-streak-milestone").value="";
  document.getElementById("chore-streak-reward").value="";
}

function createChore(){
  const msgEl=document.getElementById("chore-form-msg"); msgEl.className="field-msg";
  const name=document.getElementById("chore-name").value.trim();
  const desc=document.getElementById("chore-desc").value.trim();
  const amount=readMoney("chore-amount");
  const schedule=document.getElementById("chore-schedule").value;
  const splitChk=parseInt(document.getElementById("chore-split").value);
  const childChooses=document.getElementById("chore-child-chooses").checked;
  const monthlyDay = schedule==="monthly" ? document.getElementById("chore-monthly-day").value : null;
  const weekdays = (schedule==="weekly"||schedule==="biweekly") ? getSelectedDays() : null;

  if((schedule==="weekly"||schedule==="biweekly") && (!weekdays||weekdays.length===0)){
    document.getElementById("weekday-none-msg").classList.remove("hidden");
    return;
  }
  const weekday = weekdays && weekdays.length>0 ? weekdays[0] : null; // legacy
  const onceDateType = schedule==="once" ? document.getElementById("chore-once-type").value : "none";
  const onceDate = (schedule==="once" && onceDateType!=="none")
    ? document.getElementById("chore-end-date").value || null
    : null;
  const onceDueOn = onceDateType==="on";
  const endDate = schedule!=="once" ? document.getElementById("chore-end-date").value || null : null;
  const reminderHour = parseInt(document.getElementById("chore-reminder-time").value) || 8;
  const dayTimes = readPerDayTimes();  // {} if "same time" is checked
  // v30.1: only meaningful for bi-weekly; stored as bool
  const skipFirstWeek = schedule==="biweekly" && document.getElementById("chore-skip-first-week").checked;

  if(!name){ msgEl.className="field-msg error"; msgEl.textContent="Chore name is required."; return; }
  if(amount===null||amount===undefined||isNaN(amount)||amount<0){
    msgEl.className="field-msg error"; msgEl.textContent="Enter a valid reward amount (0 or more)."; return;
  }

  // v33.0 — Require proof photo on submission?
  const requiresProof = !!(document.getElementById("chore-require-proof") && document.getElementById("chore-require-proof").checked);

  const data=getChildData(activeChild);
  const streakVals=getStreakFormValues();
  const choreFields = {
    name,desc,amount,schedule,monthlyDay,weekday,weekdays,
    onceDate,onceDueOn,reminderHour,dayTimes,skipFirstWeek,
    splitChk,childChooses,paused:false,endDate,
    requiresProof,
    streakStart:streakVals.streakStart,
    streakMilestone:streakVals.streakMilestone,
    streakReward:streakVals.streakReward
  };

  if(editingChoreId){
    const ex=data.chores.find(c=>c.id===editingChoreId);
    if(ex) Object.assign(ex,choreFields);
    state._editedChoreId = ex ? ex.id : null;
    editingChoreId=null;
    setChoreFormMode("create");
    syncToCloud("Chore Edited");
    delete state._editedChoreId;
    showToast("Chore updated! ✏️","success");
  } else {
    data.chores.push({
      id:"chore_"+Date.now(),
      ...choreFields,
      status:"available", completedBy:null, completedAt:null, denialNote:null,
      createdAt:fmtDate(new Date()), streakCount:0
    });
    syncToCloud("Chore Created");
    showToast('"'+name+'" added! 📋',"success");
  }
  resetChoreForm();
  renderParentChores(); renderChildChores(); updateChoreBadges();
  // v32.2: Auto-close the creator sheet after successful save (create or edit)
  closeSheet("sheet-chore-creator", true);
}

function resetChoreForm(){
  ["chore-name","chore-desc","chore-amount","chore-end-date"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("chore-reminder-time").value="8";
  document.getElementById("chore-schedule").value="once";
  document.getElementById("chore-split").value=50; // v32: 50/50 default (was 100)
  document.getElementById("chore-child-chooses").checked=true;
  document.getElementById("chore-same-time").checked=true;
  document.getElementById("chore-skip-first-week").checked=false;
  // v33.0 — reset proof-photo requirement
  const rp = document.getElementById("chore-require-proof");
  if(rp) rp.checked = false;
  clearStreakForm();
  resetDayToggles();
  updateSplitLabel();
  setChoreFormMode("create");
  onScheduleChange();
}

function editChore(choreId){
  const data=getChildData(activeChild);
  const chore=data.chores.find(c=>c.id===choreId);
  if(!chore) return;
  editingChoreId=choreId;
  document.getElementById("chore-name").value=chore.name||"";
  document.getElementById("chore-desc").value=chore.desc||"";
  const caEl = document.getElementById("chore-amount");
  caEl.value = chore.amount || "";
  _reformatMoneyInput(caEl);  // v34.0
  document.getElementById("chore-schedule").value=chore.schedule||"once";
  document.getElementById("chore-split").value=chore.splitChk!==undefined?chore.splitChk:50; // v32: 50/50 fallback
  document.getElementById("chore-child-chooses").checked=!!chore.childChooses;
  document.getElementById("chore-end-date").value=chore.endDate||"";
  const onceTypeEl=document.getElementById("chore-once-type");
  if(onceTypeEl){
    if(!chore.onceDate)    onceTypeEl.value="none";
    else if(chore.onceDueOn) onceTypeEl.value="on";
    else                     onceTypeEl.value="by";
    toggleOnceDateField();
    if(chore.onceDate) document.getElementById("chore-end-date").value=chore.onceDate;
  }
  document.getElementById("chore-reminder-time").value=String(chore.reminderHour||8);
  // v33.0 — repopulate requiresProof
  const rpEl = document.getElementById("chore-require-proof");
  if(rpEl) rpEl.checked = !!chore.requiresProof;
  onScheduleChange();
  if(chore.schedule==="monthly" && chore.monthlyDay){
    document.getElementById("chore-monthly-day").value=chore.monthlyDay;
  }
  if(chore.schedule==="weekly" || chore.schedule==="biweekly"){
    const days = chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : []);
    setSelectedDays(days);
    setPerDayTimes(chore.dayTimes);  // restores per-day mode if set
  }
  // v30.1
  document.getElementById("chore-skip-first-week").checked = !!chore.skipFirstWeek;
  updateSplitLabel(); populateStreakForm(chore);
  setChoreFormMode("edit",chore.name);
  // v32.1: Reuse the chore creator bottom sheet for editing (was: scroll to inline form)
  openSheet("sheet-chore-creator");
  // v34.1 Item 14 — kick off calendar lookup (only if this child has calendar enabled)
  try { checkChoreCalendar(chore); } catch(e){}
  showToast('Editing "'+chore.name+'" — make changes and tap Save.',"info",4000);
}

function cancelChoreEdit(){
  editingChoreId=null;
  resetChoreForm();
}

function setChoreFormMode(mode,name){
  const t=document.getElementById("chore-form-title");
  const sb=document.getElementById("chore-submit-btn");
  const cb=document.getElementById("chore-cancel-edit-btn");
  if(mode==="edit"){
    if(t)  t.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Editing: "+(name||"Chore");
    if(sb) sb.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-floppy-disk'/></svg> Save Changes";
    if(cb) cb.classList.remove("hidden");
  } else {
    if(t)  t.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-plus-circle'/></svg> Create New Chore";
    if(sb) sb.innerHTML="<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg> Add Chore";
    if(cb) cb.classList.add("hidden");
    // v34.1 Item 14 — clear calendar status block when leaving edit mode
    const cs = document.getElementById("chore-cal-status");
    if(cs){ cs.classList.add("hidden"); cs.innerHTML=""; }
  }
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
            <span class="chore-card-name">${c.name}</span>
            <span class="chore-card-amount">${c.amount>0 ? fmt(c.amount) : '<span style="color:var(--muted);font-size:.78rem;">No reward</span>'}</span>
          </div>
          <div class="chore-card-meta">
            Completed by <span class="completed-by-chip">${renderAvatar(c.completedBy,"xs")}<strong>${c.completedBy}</strong></span> at ${c.completedAt}<br>
            Split: ${c.splitChk}% Chk / ${100-c.splitChk}% Sav${c.desc?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> "+c.desc:""}
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
        <span class="chore-card-name">${c.name}</span>
        <span class="chore-card-amount">${fmt(c.amount)}</span>
      </div>
      <div class="chore-card-meta">
        ${badge} <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-calendar'/></svg> ${scheduleLabel(c)}<br>
        <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-currency-dollar'/></svg> ${c.splitChk}% Chk / ${100-c.splitChk}% Sav${c.childChooses?" (child chooses)":""}${c.endDate?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-clock'/></svg> Ends: "+c.endDate:""}${c.desc?"<br><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> "+c.desc:""}
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
      if(chore.schedule==="once"){
        data.chores=data.chores.filter(c=>c.id!==choreId);
      } else {
        Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote,lastCompleted:null});
      }
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
          <span class="chore-card-name">${c.status==="approved"?"<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-check-circle'/></svg>":"<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg>"} ${c.name}</span>
          <span class="chore-card-amount">${fmt(c.amount)}</span>
        </div>
        <div class="chore-card-meta">${c.status==="approved" ? "Great work! "+fmt(c.amount)+" added to your account! <svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-party-popper'/></svg>" : "Not approved this time."+(c.denialNote?" Reason: "+c.denialNote:"")+" Talk to your parent if you have questions."}</div>
        <button class="btn btn-ghost btn-sm" onclick="dismissChoreNotif('${c.id}')">Got it ✓</button>
      </div>`).join("") || "";
  }

  const available=chores.filter(c=>!c.paused && c.status==="available" && (!c.endDate||c.endDate>=todayStr()) && c.lastCompleted!==todayStr());
  if(!available.length){
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
    <div style="background:var(--bg);border-radius:10px;padding:8px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;font-size:.75rem;">
      <span style="color:var(--muted);font-weight:600;">${available.length} chore${available.length===1?"":"s"} available</span>
      ${showRew?`<span style="color:var(--secondary);font-weight:700;font-family:var(--mono);">Up to ${fmt(totalPossible)}</span>`:""}
    </div>
    <div id="chore-table-wrap"></div>
    <p style="font-size:.72rem;color:var(--muted);text-align:center;margin-top:8px;">Tap the checkbox when you've finished a chore ✓</p>`;
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
    if(isDueToday(c))    return `<span style="font-size:.6rem;font-weight:700;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:10px;margin-left:5px;">Today</span>`;
    if(isDueThisWeek(c)) return `<span style="font-size:.6rem;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:10px;margin-left:5px;">This Week</span>`;
    return "";
  }
  if(!filtered.length){
    const msg = choreFilter==="today" ? "No chores due today — check 'This Week' or 'All Chores'!"
              : choreFilter==="week"  ? "No chores due this week — check 'All Chores'!"
              : "No chores available right now!";
    wrap.innerHTML=emptyState("chores", msg);
    return;
  }
  const showRewards=choreRewardsEnabled(activeChild||currentUser);
  const expiredRows=expired.map(c=>`
    <tr style="opacity:.42;">
      <td class="chore-check-cell"><div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:.85rem;"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-x-circle'/></svg></div></td>
      <td class="chore-name-cell">${c.name}<div class="chore-desc-small" style="color:var(--danger);">Expired ${c.onceDate}</div></td>
      <td class="chore-schedule-cell">One-time</td>
      ${showRewards?`<td class="chore-amount-cell">${c.amount>0?fmt(c.amount):"—"}</td>`:""}
    </tr>`).join("");

  wrap.innerHTML=`
    <table class="chore-table">
      <thead><tr><th style="width:36px;"></th><th>Chore</th><th>Schedule</th>${showRewards?`<th style="text-align:right;">Earn</th>`:""}</tr></thead>
      <tbody>
        ${filtered.map(c=>`
          <tr class="chore-row" id="chore-row-${c.id}">
            <td class="chore-check-cell">${isDueToday(c) ? `<div class="chore-checkbox-wrap" id="chk-${c.id}" onclick="toggleChoreCheck('${c.id}')"></div>` : `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--muted);" title="Not due today"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-lock-simple'/></svg></div>`}</td>
            <td class="chore-name-cell">
              ${c.name}${dueBadge(c)}
              ${c.desc?`<div class="chore-desc-small">${c.desc}</div>`:""}
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
      de.innerHTML=`<div class="split-display"><span class="chk-pct">Checking: <span id="msc-chk">${p}</span>%</span><span class="sav-pct">Savings: <span id="msc-sav">${100-p}</span>%</span></div><input type="range" id="modal-split-slider" min="0" max="100" value="${p}" oninput="document.getElementById('msc-chk').textContent=this.value;document.getElementById('msc-sav').textContent=100-parseInt(this.value);"><p style="font-size:.73rem;color:var(--muted);margin:6px 0 0;text-align:center;">Drag to set your split</p>`;
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
        <span>${g.name}</span>
        <span style="font-family:var(--mono);">${fmt(sav)} / ${fmt(g.target)}</span>
      </div>
      <div style="background:var(--surface);height:8px;border-radius:4px;overflow:hidden;">
        <div style="background:var(--secondary);height:100%;width:${pct}%;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:.7rem;color:var(--muted);">
        <span>${pct}% there!</span>
        <button onclick="deleteGoal('${g.id}')" style="background:none;border:none;color:var(--danger);font-size:.7rem;cursor:pointer;font-family:var(--font);">Remove</button>
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
        <span>${g.name}</span>
        <span style="font-family:var(--mono);">${fmt(sav)} / ${fmt(g.target)}</span>
      </div>
      <div style="background:var(--surface);height:8px;border-radius:4px;overflow:hidden;">
        <div style="background:var(--secondary);height:100%;width:${pct}%;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:.7rem;color:var(--muted);">
        <span>${pct}% there!</span>
        <button onclick="deleteGoal('${g.id}')" style="background:none;border:none;color:var(--danger);font-size:.7rem;cursor:pointer;font-family:var(--font);">Remove</button>
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
    const goalBadge = goalName ? `<span class="goal-hit-badge" title="Goal reached: ${goalName}"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-target'/></svg> Goal: ${goalName}</span>` : "";
    return `<div class="ledger-row${goalName?' ledger-row-goal':''}">
      <div class="${pillCls}">${isChore?"CHORE":isSav?"SAV":"CHK"}</div>
      <div><span class="ledger-date">${h.date}</span><span class="ledger-who-wrap">${renderAvatar(h.user,"xs")}<span class="ledger-who">${h.user}</span></span><span class="ledger-note"> — ${h.note}</span>${goalBadge}</div>
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
    document.getElementById("nw-start").textContent="$0.00";
    document.getElementById("nw-current").textContent="$0.00";
    document.getElementById("nw-growth").textContent="+$0.00";
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
function openAdmin(){
  // v32.4: Admin is now a bottom sheet (sheet-admin), not a drawer.
  // Still reset to locked state every open.
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
function closeAdmin(){ closeSheet("sheet-admin", true); }

function attemptAdminLogin(){
  const pin=document.getElementById("admin-pin-input").value;
  const errEl=document.getElementById("admin-pin-error");
  if(pin !== (state.config.adminPin || DEFAULT_CONFIG.adminPin)){
    errEl.className="field-msg error";
    return;
  }
  errEl.className="field-msg";
  document.getElementById("admin-login-section").classList.add("hidden");
  document.getElementById("admin-settings-section").classList.remove("hidden");
  populateAdminForm();
  renderAdminUsers();
  renderPendingRequests(); // v33.0
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
    // v37.0 — Split single-line meta ("Last seen: {datetime} · {n} logins")
    // into 3 labeled lines: Last seen (date) / Time / Logins. Matches
    // locked scope decision on admin card layout.
    const hasStats = !!(stats && stats.lastAt);
    const lastDate = hasStats
      ? new Date(stats.lastAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
      : "never";
    const lastTime = hasStats
      ? new Date(stats.lastAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})
      : "—";
    const count = stats ? (parseInt(stats.count)||0) : 0;
    return `<div class="user-row">
      <div style="flex:1;display:flex;align-items:center;gap:8px;">
        ${renderAvatar(u,"sm")}
        <div class="user-row-info">
          <div>
            <strong>${u}</strong>
            <span class="user-role-badge ${role==="parent"?"role-parent":"role-child"}" style="margin-left:4px;">${role.charAt(0).toUpperCase()+role.slice(1)}</span>
          </div>
          <div class="user-row-substats user-row-meta"><span class="meta-label">Last seen</span> <span class="meta-val">${lastDate}</span></div>
          <div class="user-row-substats user-row-meta"><span class="meta-label">Time</span> <span class="meta-val">${lastTime}</span></div>
          <div class="user-row-substats user-row-meta"><span class="meta-label">Logins</span> <span class="meta-val">${count}</span></div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openUserEdit('${u}')"><svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Edit</button>
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

// v32.1: addUser is now unified with saveUserEdit via the sheet-user-edit sheet.
// Preserved as a stub in case legacy callers exist.
function addUser(){ openUserSheetForAdd(); }

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

// ── User edit form ─────────────────────────────────────────────────
// v32.1: Add and Edit share a single bottom sheet (#sheet-user-edit).
// editingUserName === null means we're in "add new user" mode.
let editingUserName = null;

/** v32.1: Open the unified user sheet in ADD mode (blank form). */
function openUserSheetForAdd(){
  editingUserName=null;
  // Title + button label for Add mode
  const title = document.getElementById("admin-edit-title");
  if(title) title.innerHTML = "<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-user-plus'/></svg> Add New User";
  const saveBtn = document.getElementById("user-edit-save-btn");
  if(saveBtn) saveBtn.innerHTML = "<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-plus-circle'/></svg> Add User";
  const pinLabel = document.getElementById("edit-user-pin-label");
  if(pinLabel) pinLabel.textContent = "PIN (4 digits)";
  // Clear form
  const nameEl = document.getElementById("edit-user-name");
  if(nameEl){ nameEl.value=""; nameEl.readOnly=false; nameEl.style.background=""; nameEl.style.color=""; nameEl.placeholder="e.g. Emma"; }
  document.getElementById("edit-user-role").value = "child";
  document.getElementById("edit-user-pin").value = "";
  document.getElementById("edit-user-email").value = "";
  document.getElementById("edit-cal-id") && (document.getElementById("edit-cal-id").value = "");
  ["edit-notify-email","edit-notify-cal","edit-chore-rewards","edit-celebration-sound"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.checked = (id==="edit-notify-email" || id==="edit-chore-rewards" || id==="edit-celebration-sound");
  });
  document.getElementById("new-user-msg").className="field-msg";
  document.getElementById("new-user-msg").textContent="";
  // Default to child — show child fields, hide parent assignment + avatar (until created)
  document.getElementById("edit-child-fields").style.display = "";
  document.getElementById("edit-parent-assignment").style.display = "none";
  document.getElementById("edit-tab-visibility").style.display = "";
  // v34.1 Item 16 — show Assign-to-Parent(s) picker for add-child (not in edit mode)
  const assignP = document.getElementById("edit-child-parent-assignment");
  if(assignP) assignP.style.display = "";
  // Reset picker selection so last session's choices don't leak in
  if(window._pickerSelections) delete window._pickerSelections.assignParents;
  const assignDisp = document.getElementById("edit-child-parents-display");
  if(assignDisp) assignDisp.innerHTML = `<span style="font-size:.75rem;color:var(--muted);font-style:italic;">None selected</span>`;
  const avatarWrap = document.getElementById("edit-avatar-wrap");
  if(avatarWrap) avatarWrap.style.display = "none"; // avatar picker needs an existing user
  toggleEditCalField();
  openSheet("sheet-user-edit");
}

/** Role switcher (during Add). During Edit, role is locked to current. */
function onUserEditRoleChange(){
  const role = document.getElementById("edit-user-role").value;
  document.getElementById("edit-child-fields").style.display      = role==="child"  ? "" : "none";
  document.getElementById("edit-parent-assignment").style.display = role==="parent" ? "" : "none";
  document.getElementById("edit-tab-visibility").style.display    = role==="child"  ? "" : "none";
  // v34.1 Item 16 — Assign-to-Parent(s) only visible when adding a child (not edit, not parent)
  const assignP = document.getElementById("edit-child-parent-assignment");
  if(assignP) assignP.style.display = (role==="child" && !editingUserName) ? "" : "none";
}

function openUserEdit(username){
  editingUserName=username;
  const role=state.roles[username]||"child";
  const cfg=state.config;
  // Title + button label for Edit mode
  const title = document.getElementById("admin-edit-title");
  if(title) title.innerHTML = "<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-pencil'/></svg> Edit "+username;
  const saveBtn = document.getElementById("user-edit-save-btn");
  if(saveBtn) saveBtn.innerHTML = "<svg class='icon' aria-hidden='true'><use href='vendor/phosphor-sprite.svg#ph-floppy-disk'/></svg> Save Changes";
  const pinLabel = document.getElementById("edit-user-pin-label");
  if(pinLabel) pinLabel.textContent = "New PIN (leave blank to keep current)";
  // Lock name field in edit mode
  const nameEl = document.getElementById("edit-user-name");
  if(nameEl){ nameEl.value=username; nameEl.readOnly=true; nameEl.style.background="#f8fafc"; nameEl.style.color="var(--muted)"; }
  document.getElementById("edit-user-role").value=role;
  document.getElementById("edit-user-pin").value="";
  document.getElementById("edit-user-email").value=(cfg.emails&&cfg.emails[username])||"";
  const notify=(cfg.notify&&cfg.notify[username])||{};
  document.getElementById("edit-notify-email").checked   = notify.email   !== false;
  document.getElementById("edit-notify-cal").checked     = !!notify.calendar;
  document.getElementById("edit-chore-rewards").checked  = notify.choreRewards !== false;
  const ud = (state.usersData && state.usersData[username]) || {};
  const csEdit = document.getElementById("edit-celebration-sound");
  if(csEdit) csEdit.checked = (ud.celebrationSound !== false);
  document.getElementById("edit-cal-id").value=(cfg.calendars&&cfg.calendars[username])||"";
  toggleEditCalField();
  // Show role-specific sections
  onUserEditRoleChange();
  // Populate picker displays
  if(role==="parent"){
    const assigned=(cfg.parentChildren && cfg.parentChildren[username]) || [];
    if(!window._pickerSelections) window._pickerSelections={};
    window._pickerSelections.children=[...assigned];
    updatePickerDisplay("children", assigned, PICKER_CONFIG.children);
  }
  if(role==="child"){
    const tabs=getChildTabs(username);
    const selected=[];
    if(tabs.money)  selected.push("money");
    if(tabs.chores) selected.push("chores");
    if(tabs.loans)  selected.push("loans");
    if(!window._pickerSelections) window._pickerSelections={};
    window._pickerSelections.tabs=[...selected];
    updatePickerDisplay("tabs", selected, PICKER_CONFIG.tabs);
  }
  // Show avatar picker (only available for existing users)
  const avatarWrap = document.getElementById("edit-avatar-wrap");
  if(avatarWrap) avatarWrap.style.display = "";
  renderAvatarPicker(username);
  openSheet("sheet-user-edit");
}

// v31: avatar picker (emoji grid + photo upload)
let _editAvatarEmoji = null;  // staged selection, applied on saveUserEdit

function renderAvatarPicker(username){
  _editAvatarEmoji = getAvatarEmoji(username);
  const cur = document.getElementById("edit-avatar-current");
  const grid = document.getElementById("edit-avatar-grid");
  if(!cur || !grid) return;
  const hasPhoto = !!getAvatarPhoto(username);
  cur.innerHTML = renderAvatar(username,"lg") +
    `<div class="label-stack">
       <div class="who">${username}</div>
       <div class="src">${hasPhoto ? "Using device photo — emoji shown if photo removed" : "Using emoji"}</div>
     </div>`;
  grid.innerHTML = AVATAR_EMOJIS.map(e =>
    `<button type="button" class="${e===_editAvatarEmoji?"selected":""}" onclick="selectAvatarEmoji('${e}')">${e}</button>`
  ).join("");
}

function selectAvatarEmoji(emoji){
  _editAvatarEmoji = emoji;
  // Update grid selection state
  const grid = document.getElementById("edit-avatar-grid");
  if(grid){
    grid.querySelectorAll("button").forEach(b=>{
      b.classList.toggle("selected", b.textContent===emoji);
    });
  }
  // Stage the emoji in state.config so renderAvatar reflects it in the preview
  if(editingUserName){
    setAvatarEmoji(editingUserName, emoji);
    // Refresh preview chip
    const cur = document.getElementById("edit-avatar-current");
    if(cur){
      const hasPhoto = !!getAvatarPhoto(editingUserName);
      cur.innerHTML = renderAvatar(editingUserName,"lg") +
        `<div class="label-stack">
           <div class="who">${editingUserName}</div>
           <div class="src">${hasPhoto ? "Using device photo — emoji shown if photo removed" : "Using emoji"}</div>
         </div>`;
    }
  }
}

async function onAvatarPhotoChosen(event){
  if(!editingUserName) return;
  const file = event.target.files && event.target.files[0];
  if(!file) return;
  try {
    const dataUrl = await resizeImageFileTo200(file);
    setAvatarPhoto(editingUserName, dataUrl);
    showToast("Photo saved on this device.","success");
    renderAvatarPicker(editingUserName);
    // Refresh any live avatars
    refreshVisibleAvatars();
  } catch(e){
    showToast("Could not process photo.","error");
  }
  event.target.value = "";
}

function removeAvatarPhoto(){
  if(!editingUserName) return;
  clearAvatarPhoto(editingUserName);
  showToast("Photo removed from this device.","info");
  renderAvatarPicker(editingUserName);
  refreshVisibleAvatars();
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
  if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+currentUser+'! 👋</span>';
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
    if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+currentUser+'! 👋</span>';
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
  if(wm) wm.innerHTML = renderAvatar(currentUser,"sm") + ' <span>Hi, '+currentUser+'! 👋</span>';
}

function toggleEditCalField(){
  const checked=document.getElementById("edit-notify-cal").checked;
  document.getElementById("edit-cal-wrap").style.display = checked ? "" : "none";
}

function cancelUserEdit(){
  editingUserName=null;
  closeSheet("sheet-user-edit", true);
}

function saveUserEdit(){
  const msgEl = document.getElementById("new-user-msg");
  if(msgEl) msgEl.className = "field-msg";

  // v32.1: If editingUserName is null we're in ADD mode — create the user
  if(!editingUserName){
    const name = document.getElementById("edit-user-name").value.trim();
    const role = document.getElementById("edit-user-role").value;
    const pin  = document.getElementById("edit-user-pin").value;
    const email= document.getElementById("edit-user-email").value.trim();
    if(!name){ if(msgEl){msgEl.className="field-msg error"; msgEl.textContent="Name is required.";} return; }
    if(state.users.includes(name)){ if(msgEl){msgEl.className="field-msg error"; msgEl.textContent='"'+name+'" already exists.';} return; }
    if(!pin||pin.length!==4||!/^\d{4}$/.test(pin)){ if(msgEl){msgEl.className="field-msg error"; msgEl.textContent="PIN must be exactly 4 digits.";} return; }
    state.users.push(name);
    state.pins[name] = pin;
    state.roles[name] = role;
    if(!state.config.emails) state.config.emails = {};
    if(email) state.config.emails[name] = email;
    if(!state.config.notify) state.config.notify = {};
    state.config.notify[name] = {
      email:        document.getElementById("edit-notify-email").checked,
      calendar:     document.getElementById("edit-notify-cal").checked,
      choreRewards: document.getElementById("edit-chore-rewards").checked
    };
    if(!state.config.calendars) state.config.calendars = {};
    const calId = document.getElementById("edit-cal-id")?.value.trim();
    if(calId) state.config.calendars[name] = calId;
    // v32: per-user celebration sound (default true)
    if(!state.usersData) state.usersData = {};
    state.usersData[name] = state.usersData[name] || {};
    const csEdit = document.getElementById("edit-celebration-sound");
    state.usersData[name].celebrationSound = csEdit ? !!csEdit.checked : true;
    // Parent: assigned children
    if(role==="parent"){
      if(!state.config.parentChildren) state.config.parentChildren = {};
      state.config.parentChildren[name] = getPickerSelections("children");
    }
    // Child: visible tabs + seed data
    if(role==="child"){
      if(!state.config.tabs) state.config.tabs = {};
      const sel = getPickerSelections("tabs");
      // Default: money+chores ON if user didn't pick any; otherwise their selection
      state.config.tabs[name] = sel.length ? {
        money:  sel.indexOf("money")!==-1,
        chores: sel.indexOf("chores")!==-1,
        loans:  sel.indexOf("loans")!==-1
      } : {money:true,chores:true,loans:false};
      getChildData(name); // seed balances/chores
      // v34.1 C7 coverage — stamp createdAt so annual projection email fires at the 1-yr mark
      state.usersData[name].createdAt = fmtDate(new Date());
      // v34.1 Item 16 — assign this new child to one or more parents.
      // Picker empty → auto-assign to currentUser only. Non-empty → assign to each.
      if(!state.config.parentChildren) state.config.parentChildren = {};
      const selectedParents = getPickerSelections("assignParents");
      const assignTo = selectedParents.length ? selectedParents : [currentUser];
      assignTo.forEach(p => {
        if(!p) return;
        if(!state.config.parentChildren[p]) state.config.parentChildren[p] = [];
        if(state.config.parentChildren[p].indexOf(name) === -1){
          state.config.parentChildren[p].push(name);
        }
      });
    }
    renderAdminUsers();
    syncToCloud("User Added");
    showToast('"'+name+'" added!',"success");
    closeSheet("sheet-user-edit", true);
    return;
  }

  // EDIT mode — existing flow
  const u=editingUserName;
  const role=document.getElementById("edit-user-role").value;
  const pin=document.getElementById("edit-user-pin").value;
  const email=document.getElementById("edit-user-email").value.trim();
  if(pin){
    if(pin.length!==4||!/^\d{4}$/.test(pin)){ showToast("PIN must be exactly 4 digits.","error"); return; }
    state.pins[u]=pin;
  }
  state.roles[u]=role;
  if(!state.config.emails) state.config.emails={};
  state.config.emails[u]=email;
  if(!state.config.notify) state.config.notify={};
  state.config.notify[u]={
    email:        document.getElementById("edit-notify-email").checked,
    calendar:     document.getElementById("edit-notify-cal").checked,
    choreRewards: document.getElementById("edit-chore-rewards").checked
  };
  if(!state.config.calendars) state.config.calendars={};
  const calId=document.getElementById("edit-cal-id").value.trim();
  if(calId) state.config.calendars[u]=calId;
  else delete state.config.calendars[u];
  // v32: per-user celebration sound
  if(!state.usersData) state.usersData={};
  if(!state.usersData[u]) state.usersData[u]={};
  const csEdit = document.getElementById("edit-celebration-sound");
  if(csEdit) state.usersData[u].celebrationSound = !!csEdit.checked;
  // Parent: assigned children
  if(role==="parent"){
    if(!state.config.parentChildren) state.config.parentChildren={};
    state.config.parentChildren[u]=getPickerSelections("children");
  }
  // Child: visible tabs
  if(role==="child"){
    if(!state.config.tabs) state.config.tabs={};
    const sel=getPickerSelections("tabs");
    state.config.tabs[u]={
      money:  sel.indexOf("money")!==-1,
      chores: sel.indexOf("chores")!==-1,
      loans:  sel.indexOf("loans")!==-1
    };
  }
  syncToCloud("User Edited");
  showToast(u+" updated.","success");
  closeSheet("sheet-user-edit", true);
  renderAdminUsers();
  editingUserName=null;
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
    listEl.innerHTML=`<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:20px 0;">${cfg.noItemsText}</p>`;
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
    displayEl.innerHTML=`<span style="font-size:.75rem;color:var(--muted);font-style:italic;">None selected</span>`;
    return;
  }
  const items=cfg.getItems();
  displayEl.innerHTML=selected.map(v=>{
    const item=items.find(i=>i.value===v);
    return item ? `<span style="background:var(--primary);color:white;border-radius:20px;padding:4px 12px;font-size:.75rem;font-weight:700;">${item.label}</span>` : "";
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
      setTimeout(()=>location.reload(),1500);
    }
  }, 1000);
}

function resetInactivityTimer(){
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
      <p><strong>For parents:</strong> Money lets you add or remove money directly, see reports, and configure allowance, interest, and savings goals. Chores is where you approve submissions. Settings handles profile, parent email, and PDF statements.</p>
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
        <div class="qa-name">${c.name}</div>
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
  if(chore.schedule==="once"){
    data.chores = data.chores.filter(c=>c.id!==choreId);
  } else {
    Object.assign(chore,{status:"available",completedBy:null,completedAt:null,denialNote:null,lastCompleted:null});
  }
  syncToCloud("Chore Denied (Quick)");
  showToast("Chore denied.","error");
  renderParentChores(); renderChildChores(); updateChoreBadges(); renderWeekAtGlance();
  const remaining = (data.chores||[]).filter(c=>c.status==="pending");
  if(remaining.length) openQuickApprove();
  else closeQuickApprove();
}

// ── PDF monthly statement ────────────────────────────────────────────


// v31.3: stamp version on splash + login (runs before loadFromCloud)
// v37.0 — Fetch version from version.json so splash/login never drift.
(function stampVersion(){
  const paint = (v) => {
    const tag = "v" + v;
    const sv = document.getElementById("splash-version");
    const lv = document.getElementById("login-version");
    if(sv) sv.textContent = tag;
    if(lv) lv.textContent = tag;
  };
  // Paint fallback immediately so we never show blank
  paint(APP_VERSION);
  // Async fetch — authoritative source
  try {
    fetch("version.json?t=" + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.version) {
          APP_VERSION = String(j.version);
          paint(APP_VERSION);
        }
      })
      .catch(()=>{});
  } catch(e) {}
})();

populateMonthlyDays();
populateAllowanceMonthlyDays();
populateLoanDueDayPicker();
onScheduleChange();          // show/hide fields for default "One-time"
onAllowanceScheduleChange();
document.querySelector("#allow-day-toggles .day-toggle[data-day='1']")?.classList.add("selected");
updateSplitLabel();
updateDepositSplitLabel();
onChildActionChange();
document.getElementById("username-input").addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("pin-input").focus(); });
document.getElementById("pin-input").addEventListener("keydown",      e=>{ if(e.key==="Enter") attemptLogin(); });
document.getElementById("admin-pin-input").addEventListener("keydown",e=>{ if(e.key==="Enter") attemptAdminLogin(); });
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
  "sheet-chore-creator",
  "sheet-loan-creator",
  "sheet-adjust",
  "sheet-user-edit",
  "sheet-allowance-interest",
  "sheet-manage-money",
  "sheet-child-profile",
  "sheet-add-child",
  "sheet-share-child",
  // v33.0
  "sheet-wizard",
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
function openChoreCreator(){
  // v32.3: Always reset to fresh form when not editing. Belt-and-suspenders:
  // also force the split slider to 50 explicitly in case a stale value lingers.
  if(typeof editingChoreId === "undefined" || !editingChoreId){
    try { resetChoreForm(); } catch(e){}
    const sp = document.getElementById("chore-split");
    if(sp) sp.value = 50;
    try { updateSplitLabel(); } catch(e){}
  }
  openSheet("sheet-chore-creator");
}
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

// v32: Auto-close chore/loan sheets when the Cancel/Save handlers finish their work.
// We don't need to modify those handlers — instead, hook into the hidden-attribute
// changes on the edit wrappers, which is what their existing cancel/reset code touches.
// (Handled implicitly by form-submit flows calling resetChoreForm / cancelChoreEdit.)
// If you want the sheet to auto-close on successful chore creation, extend createChore()
// accordingly. For now, the user taps ✕ Close or the backdrop.

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
    el.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:.85rem;text-align:center;">No children yet. Tap "Add Child" below to create one.</div>';
    return;
  }
  el.innerHTML = mine.map(name => {
    const shared = getParentsOfChild(name).length > 1;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
        <div style="flex-shrink:0;">${renderAvatar(name,"sm")}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.92rem;">${name}</div>
          ${shared ? '<div style="font-size:.68rem;color:var(--muted);">Shared with '+(getParentsOfChild(name).length-1)+' other parent'+(getParentsOfChild(name).length>2?'s':'')+'</div>' : '<div style="font-size:.68rem;color:var(--muted);">Only on your account</div>'}
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

function submitSignupRequest(){
  const msgEl=document.getElementById("signup-msg");
  msgEl.className="field-msg";
  const name = (document.getElementById("signup-name").value||"").trim();
  const email= (document.getElementById("signup-email").value||"").trim();
  const pin  = (document.getElementById("signup-pin").value||"").trim();
  const hp   = (document.getElementById("signup-honeypot").value||"").trim();

  // Honeypot — silently drop
  if(hp){ msgEl.className="field-msg info"; msgEl.textContent="Thanks — we'll review your request."; return; }

  if(!name){ msgEl.className="field-msg error"; msgEl.textContent="Display name is required."; return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    msgEl.className="field-msg error"; msgEl.textContent="Valid email is required."; return;
  }
  if(!pin || pin.length!==4 || !/^\d{4}$/.test(pin)){
    msgEl.className="field-msg error"; msgEl.textContent="PIN must be exactly 4 digits."; return;
  }

  if(!state.config.adminEmail){
    showToast("Admin email not configured — ask admin to set it up first.","error",5000);
    return;
  }

  state.config.pendingUsers = Array.isArray(state.config.pendingUsers) ? state.config.pendingUsers : [];

  if(state.config.pendingUsers.length >= SIGNUP_QUEUE_CAP){
    msgEl.className="field-msg error";
    msgEl.textContent="The request queue is full right now. Please try again later.";
    return;
  }

  const emailLower = email.toLowerCase();
  const dupe = state.config.pendingUsers.some(p => (p.email||"").toLowerCase() === emailLower);
  if(dupe){
    msgEl.className="field-msg error";
    msgEl.textContent="A request from this email is already pending.";
    return;
  }

  // Also block if an account with that display name already exists
  if((state.users||[]).indexOf(name) !== -1){
    msgEl.className="field-msg error";
    msgEl.textContent='"'+name+'" is already taken. Pick a different display name.';
    return;
  }

  state.config.pendingUsers.push({
    id:          "pu_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    name:        name,
    email:       email,
    pin:         pin,
    requestedAt: fmtDate(new Date()),
    honeypot:    ""
  });

  syncToCloud("Signup Requested");
  closeSheet("sheet-signup-request", true);
  showToast("Request submitted! You'll get an email when it's reviewed.","success",4200);
}

function renderPendingRequests(){
  const listEl = document.getElementById("pending-requests-list");
  const badgeEl= document.getElementById("pending-requests-badge");
  if(!listEl || !badgeEl) return;
  const arr = (state.config && state.config.pendingUsers) || [];
  const n = arr.length;
  badgeEl.textContent = String(n);
  badgeEl.classList.toggle("hidden", n===0);

  // v37.0 — Auto-expand the Pending Requests card when there's something to
  // review. Does NOT auto-collapse when it goes to zero — respects the admin's
  // current expand state for other cards. toggleCollapsible enforces the
  // "only one expanded sibling" rule, but direct class toggles bypass it.
  if(n > 0){
    const card = document.getElementById("cc-pending-requests");
    if(card) card.classList.add("expanded");
  }

  if(!n){
    listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:.85rem;text-align:center;">No pending requests.</div>';
    return;
  }

  listEl.innerHTML = arr.map(req => {
    const rid = (req.id||"").replace(/'/g,"\\'");
    return `
      <div class="pending-request-card">
        <div class="pending-request-meta">
          <div class="pr-name">${(req.name||"").replace(/</g,"&lt;")}</div>
          <div class="pr-line"><span class="pr-label">Email</span> <span>${(req.email||"").replace(/</g,"&lt;")}</span></div>
          <div class="pr-line"><span class="pr-label">Requested</span> <span>${(req.requestedAt||"")}</span></div>
        </div>
        <div class="pending-request-actions">
          <button class="btn btn-sm btn-secondary" style="width:auto;margin:0;" onclick="approvePendingRequest('${rid}')">✅ Approve</button>
          <button class="btn btn-sm btn-danger" style="width:auto;margin:0;" onclick="denyPendingRequest('${rid}')">❌ Deny</button>
        </div>
      </div>`;
  }).join("");
}

// v37.0 — MULTI-FAMILY APPROVE
// Row-per-family: approved signups become their OWN family, not rows inside
// the admin's. Ordering below is deliberate for partial-failure recovery:
//
//   1. POST new-family row FIRST, under a freshly generated familyId.
//   2. If that succeeds, mutate admin state (remove from pendingUsers) and
//      POST admin state SECOND.
//   3. If step 2 fails: new family exists in the Sheet, but pendingUsers
//      still lists the signup. The admin sees the request as un-approved and
//      can retry. Retry will generate a NEW familyId and create a DUPLICATE
//      family row — undesirable but recoverable (admin can delete the
//      orphaned row via Sheet or the audit-log-driven delete family tool).
//
// The inverse ordering (admin cleanup first, then new family) has a worse
// failure mode: if new-family POST fails after admin cleanup succeeds, the
// signup is silently lost with no record.
//
// Welcome email: Code.gs fires it on wizard completion in v37.0, NOT on
// approval. The approved parent gets {familySetupComplete: false} and hits
// the wizard on first login.
async function approvePendingRequest(id){
  const arr = (state.config && state.config.pendingUsers) || [];
  const idx = arr.findIndex(p => p.id === id);
  if(idx === -1) return;
  const req = arr[idx];

  // Pre-flight: name uniqueness is scoped per-family in v37.0 (each family
  // has its own users[] list), but a name collision inside that family's
  // fresh state is impossible — a brand-new family has zero existing users.
  // We still defensively check req.name isn't empty.
  if(!req.name || typeof req.name !== "string"){
    showToast("Cannot approve — malformed request.", "error", 4500);
    return;
  }

  // STEP 1 — Build the new family's initial state and POST under a NEW familyId.
  const newFamilyId = generateFamilyId();
  const newFamilyState = {
    config: {
      ...DEFAULT_CONFIG,
      // Admin email of the NEW family = the approved parent's email (they
      // are primary and solo — matches locked decision: solo parents are
      // primary of their own family).
      adminEmail: req.email || "",
      emails: { [req.name]: req.email || "" },
      // Notify defaults lifted from v36's approve flow.
      notify: { [req.name]: { email: true, calendar: false, choreRewards: true } },
      loginStats: {},
      pendingUsers: [],
      avatars: {},
      parentChildren: { [req.name]: [] },
      // v37.0 locked: primary = creator. Wizard stores primaryParent in config
      // but we set it now so Transfer Primary UI finds a value before the
      // wizard runs.
      primaryParent: req.name,
      // v37.0 locked: wizard fires on primary's first login when this is false.
      familySetupComplete: false,
      // v37.0 locked: per-child email digest prefs + child-email gates live in
      // config, but they're seeded lazily by the wizard. Leave them off here.
      deactivatedChildren: []
    },
    users: [req.name],
    pins:  { [req.name]: req.pin },
    roles: { [req.name]: "parent" },
    children: {},
    history:  {},
    usersData: { [req.name]: { createdAt: new Date().toISOString() } },
    _savedAt: new Date().toISOString(),
    // Signal to Code.gs that this POST is creating a brand-new family row, not
    // overwriting an existing one. Code.gs v37.0 tolerates a POST with a
    // familyId that doesn't yet exist — it creates the row — so this flag is
    // informational for the server-side audit log. Stripped before save.
    _newFamilyCreate: true,
    // v37.0 — last action tag so the server logs this as a provisioning event,
    // not a generic save.
    lastAction: "Family Provisioned (Signup Approved)",
    familyId: newFamilyId
  };

  let step1Ok = false;
  try {
    await fetch(API_URL, {
      method: "POST",
      mode:   "no-cors",
      body:   JSON.stringify(newFamilyState)
    });
    // no-cors gives no response visibility; assume success absent a thrown error.
    step1Ok = true;
  } catch(err){
    console.error("[FamilyBank] approve step 1 (new family POST) failed:", err);
    showToast("Could not create family — please retry.", "error", 5000);
    return;
  }

  if(!step1Ok) return;  // belt-and-suspenders; unreachable

  // STEP 2 — Clean up admin's pendingUsers and sync admin state.
  // If this throws/fails, the pending request stays visible to admin and can
  // be retried. Retry will create a duplicate family row (known limitation,
  // logged above).
  arr.splice(idx, 1);
  state.config.pendingUsers = arr;

  // v37.0.2 — Suppress server-side processSignupDiff on this cleanup POST.
  // The diff engine (Code.gs processSignupDiff) looks at the request leaving
  // pendingUsers and checks whether the approved name is in newState.users.
  // In multi-family world it won't be — approved user lives in a separate
  // family row — so the diff falls through to the denial branch and emails
  // the user "request denied." The sentinel flag skips the diff entirely
  // for this specific POST. Code.gs v37.0.2+ strips the flag before saving,
  // so it never persists in state.
  state._suppressSignupDiff = true;

  try {
    // syncToCloud chains behind any in-flight syncs and attaches the admin's
    // currentFamilyId automatically.
    await syncToCloud("Signup Approved — Admin Cleanup");
  } catch(err){
    console.error("[FamilyBank] approve step 2 (admin cleanup sync) failed:", err);
    // Restore pendingUsers locally so admin UI reflects the still-pending state.
    // The authoritative truth on next loadFromCloud will match whichever of
    // local vs. server won — if the admin-side POST silently failed in no-cors
    // land (no throw), the next load will re-hydrate pendingUsers from server.
    arr.splice(idx, 0, req);
    state.config.pendingUsers = arr;
    showToast("Family created, but admin cleanup failed. Please retry to clear the request.", "error", 6000);
    renderPendingRequests();
    // v37.0.2 — Strip the flag so a retry doesn't ship a stale sentinel.
    delete state._suppressSignupDiff;
    return;
  }

  // v37.0.2 — Flag already shipped in the sync above. Strip locally so a
  // subsequent unrelated sync doesn't carry it.
  delete state._suppressSignupDiff;

  renderPendingRequests();
  try { renderAdminUsers(); } catch(e){}
  showToast('"'+req.name+'" approved as primary of a new family. They\'ll complete setup on first login.',"success",4500);
}

function denyPendingRequest(id){
  const arr = (state.config && state.config.pendingUsers) || [];
  const idx = arr.findIndex(p => p.id === id);
  if(idx === -1) return;
  const req = arr[idx];

  openInputModal({
    icon:"❌", title:"Deny request?",
    body:"Optional reason (the requester will see this in their denial email):",
    inputType:"text",
    inputAttrs:'placeholder="e.g. Please confirm your identity first" maxlength="200"',
    confirmText:"Deny", confirmClass:"btn-danger",
    onConfirm:(reason)=>{
      // v37.0 — Deny is SINGLE-POST: no new family is created. Just remove
      // from admin's pendingUsers and sync admin state under admin's familyId.
      // Attach reason via the transient key that Code.gs consumes & strips.
      const cleaned = (reason||"").toString().trim().slice(0,200);
      state._denialReasons = state._denialReasons || {};
      if(cleaned) state._denialReasons[req.id] = cleaned;

      // Remove from pending
      arr.splice(idx, 1);
      state.config.pendingUsers = arr;

      syncToCloud("Signup Denied");
      renderPendingRequests();
      showToast("Request denied. Notification email sent.","info",3600);
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// v37.0 — DELETE FAMILY (primary parent only, irreversible)
// ────────────────────────────────────────────────────────────────────
// Scrubs the current family's row, ledger rows, audit log rows, and
// calendar events via Code.gs deleteFamilyFull(). Primary-only; UI
// visibility is gated on state.config.primaryParent === currentUser.
//
// Not routed through _doSyncToCloud — that ships the full state and
// strips _* keys. This is a minimal one-shot POST with only the two
// required fields. Backend validates equality as a safety interlock:
// body._deleteFamilyFullRequest must === body.familyId.
//
// No audit log write — the family row is about to be deleted; writing
// to a sheet that's being scrubbed is wasted work and the write itself
// could race with the scrub.
//
// Reauth is the sole confirmation. No stacked "are you sure?" prompt.
async function deleteFamily(){
  // Defense-in-depth: re-check primary gate at action time in case the UI
  // was manipulated or stale. The render-side visibility gate is the
  // first line; this is the second.
  if(!state.config || state.config.primaryParent !== currentUser){
    showToast("Only the primary parent can delete the family.", "error", 4500);
    return;
  }
  if(!currentFamilyId){
    showToast("No family loaded — nothing to delete.", "error", 4000);
    return;
  }

  confirmReauth("Delete Family", async () => {
    const fid = currentFamilyId;  // capture before we null it below
    try {
      await fetch(API_URL, {
        method: "POST",
        mode:   "no-cors",
        body:   JSON.stringify({
          _deleteFamilyFullRequest: fid,
          familyId: fid
        })
      });
    } catch(err){
      console.error("[FamilyBank v37.0] deleteFamily POST failed:", err);
      showToast("Could not reach the bank — please try again.", "error", 5000);
      return;
    }

    // Scrub client-side: sessionStorage, globals, in-memory state. After
    // the POST the family row is gone; continuing with the old familyId
    // would surface "familyId required" errors on every subsequent read.
    try {
      sessionStorage.removeItem("fb_session_user");
      sessionStorage.removeItem("fb_session_child");
      sessionStorage.removeItem("fb_session_family");
    } catch(e){}
    currentFamilyId = null;
    currentUser = null;
    currentRole = null;
    activeChild = null;
    state = {
      config:   {...DEFAULT_CONFIG},
      pins: {}, roles: {}, users: [],
      children: {},
      history:  {}
    };

    showToast("Family deleted. Reloading…", "info", 2500);
    // Hard reload to re-run the discovery flow cleanly. Short delay so
    // the toast is visible and the server has a moment to finalize the
    // scrub before the next listFamilies call.
    setTimeout(() => { location.reload(); }, 1500);
  });
}
window.deleteFamily = deleteFamily;

// ────────────────────────────────────────────────────────────────────
// v37.0 — PRIMARY PARENT ROLE
// ────────────────────────────────────────────────────────────────────
// Exactly one parent per family holds the "primary" role, tracked at
// state.config.primaryParent. The wizard seeds this as the parent who
// completes setup; the approve-pending flow seeds it as the approved
// signup. Role powers:
//   - Can Transfer Primary to another parent in the family
//   - Can Delete Family (render-gated + action-gated)
//   - Cannot delete their own parent account without transferring first
//
// These are all soft UX rails — the authoritative source is config.
// No server-side enforcement in v37.0; trust is per-device.

function isPrimaryParent(name){
  if(!name || !state || !state.config) return false;
  return state.config.primaryParent === name;
}
window.isPrimaryParent = isPrimaryParent;

// Returns the list of OTHER parents (not currentUser) eligible to
// receive the primary role. A single-parent family has none.
function getTransferablePrimaryCandidates(){
  const parents = (state.users || []).filter(u =>
    (state.roles || {})[u] === "parent" && u !== currentUser
  );
  return parents;
}

function openTransferPrimary(){
  if(!isPrimaryParent(currentUser)){
    showToast("Only the primary parent can transfer the role.", "error", 4000);
    return;
  }
  const candidates = getTransferablePrimaryCandidates();
  if(!candidates.length){
    openModal({
      icon: "ℹ️",
      title: "No one to transfer to",
      body: "You're the only parent in this family. Add another parent first, then come back to transfer the primary role.",
      confirmText: "OK",
      hideCancel: true
    });
    return;
  }
  // Simple picker: if one candidate, use the modal confirm path. If
  // multiple, render a sheet with buttons. Wizard patterns (sheets)
  // require index.html markup — for now, fall back to a chained prompt
  // flow that works with only the core modal surface.
  if(candidates.length === 1){
    _transferPrimaryTo(candidates[0]);
    return;
  }
  // Multi-candidate: sheet-based picker. Markup for #transfer-primary-sheet
  // lands in the index.html pass. Graceful-degrade to modal with numbered
  // list so the action is still reachable.
  const sheet = document.getElementById("transfer-primary-sheet");
  if(sheet){
    const list = document.getElementById("transfer-primary-list");
    if(list){
      list.innerHTML = candidates.map(name => `
        <button class="btn btn-outline" style="width:100%;margin:6px 0;text-align:left;"
                onclick="_transferPrimaryTo('${name.replace(/'/g, "\\'")}')">
          ${renderAvatar(name,"sm")} ${name}
        </button>
      `).join("");
    }
    openSheet("transfer-primary-sheet");
    return;
  }
  // Markup missing — fall back to a plain prompt so the flow is still usable.
  const labeled = candidates.map((n, i) => (i+1) + ". " + n).join("\n");
  const choice = prompt("Transfer primary role to which parent?\n\n" + labeled + "\n\nEnter the number:");
  const idx = parseInt(choice, 10) - 1;
  if(isNaN(idx) || idx < 0 || idx >= candidates.length){
    showToast("Transfer cancelled.", "info", 2500);
    return;
  }
  _transferPrimaryTo(candidates[idx]);
}
window.openTransferPrimary = openTransferPrimary;

function _transferPrimaryTo(newPrimary){
  if(!newPrimary) return;
  if(!isPrimaryParent(currentUser)){
    showToast("Only the primary parent can transfer the role.", "error", 4000);
    return;
  }
  const candidates = getTransferablePrimaryCandidates();
  if(candidates.indexOf(newPrimary) === -1){
    showToast('"' + newPrimary + '" is not eligible.', "error", 4000);
    return;
  }
  // Close the transfer picker sheet if it was open
  try { closeSheet("transfer-primary-sheet"); } catch(e){}

  confirmReauth("Transfer Primary to " + newPrimary, () => {
    state.config.primaryParent = newPrimary;
    appendAuditLog("Transfer Primary", currentUser + " → " + newPrimary);
    syncToCloud("Primary Transferred");
    showToast('"' + newPrimary + '" is now the primary parent.', "success", 4500);
    // Re-render settings so the Transfer/Delete Family buttons update their
    // visibility based on the new primaryParent.
    try { renderParentSettings(); } catch(e){}
  });
}
window._transferPrimaryTo = _transferPrimaryTo;

// ────────────────────────────────────────────────────────────────────
// 22.2 — PROOF PHOTO CAPTURE
// ────────────────────────────────────────────────────────────────────

const PROOF_MAX_EDGE = 1200;
const PROOF_JPEG_QUALITY = 0.7;

function openProofPhotoCapture(choreId){
  pendingProofChoreId = choreId;
  // Wipe previous preview
  const prev = document.getElementById("proof-preview");
  if(prev) prev.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:.8rem;text-align:center;">No photo yet — tap "Take Photo" to capture.</div>';
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
            '<div style="font-size:.7rem;color:var(--muted);margin-top:6px;text-align:center;">'+w+'×'+h+' • ~'+approxKb+' KB</div>';
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
  if(!childName){ el.innerHTML = '<div style="color:var(--muted);font-size:.8rem;">Select a child to see projections.</div>'; return; }
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
    <div style="font-size:.68rem;color:var(--muted);margin-top:8px;">
      Compounded monthly using each account's APR. "Games it" assumes every dollar routes to the higher-yield account.
    </div>`;
}

// ────────────────────────────────────────────────────────────────────
// 22.3 — v37.0 FAMILY SETUP WIZARD (new-family first-login flow)
// ────────────────────────────────────────────────────────────────────
// Trigger: primary parent's first login when familySetupComplete !== true.
// Fired from enterApp() BEFORE the per-child wizard trigger.
//
// Design notes:
//   • Holds all edits client-side across Steps 1-3. ONE syncToCloud on
//     Step 4 Finish — Code.gs sees one transition (skeleton → full family),
//     so welcome emails fire predictably (see Step 4 commit below).
//   • Welcome emails go out via the v37.0.1 _sendWelcomeEmail intercept
//     (added to Code.gs this session). One fire-and-forget POST per new
//     co-parent and child. Primary already got their welcome at signup
//     approval — wizard does NOT re-email them.
//   • Step 3 captures the MINIMUM viable child record (name, PIN, avatar,
//     assigned-parents). Does NOT set childSetupComplete[name]=true, so
//     the full 9-step per-child wizard still fires on first open of each
//     child. That's locked scope.
//   • Graceful-degrade: if the wizard markup isn't present in index.html
//     yet, opener logs a warning and flips familySetupComplete to true
//     with a minimal commit (so a beta without the HTML doesn't
//     infinite-loop the trigger). Real users won't hit this once the
//     markup ships in the same release.

// In-memory wizard buffer. Lives only while wizard is open.
let familyWizardState = null;

const FW_MAX_PARENTS = 6;   // primary + 5 co-parents (arbitrary sane cap)
const FW_MAX_CHILDREN = 6;  // matches MAX_CHILDREN_PER_PARENT

// Local HTML escape — used for safe rendering of user-entered names/emails
// in the wizard's list and review DOM. No global `escapeHtml` in this file,
// and we don't want to introduce one this session without wider audit.
function fwEscapeHtml(s){
  if(s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fire-and-forget welcome email POST. Mirrors appendAuditLog shape.
// Code.gs v37.0.1 intercept handler: sendWelcomeEmail_().
function sendWelcomeEmail(recipient, name, role, defaultPin){
  if(!currentFamilyId) return;
  if(!recipient || !name || !role) return;
  const body = {
    _sendWelcomeEmail: {
      recipient: String(recipient),
      name:      String(name),
      role:      String(role),       // "parent" | "child"
      defaultPin: String(defaultPin || "0000")
    },
    familyId: currentFamilyId
  };
  try {
    fetch(API_URL, {
      method: "POST",
      mode:   "no-cors",
      body:   JSON.stringify(body)
    }).catch(err => {
      console.warn("[FamilyBank v37.0] sendWelcomeEmail failed:", recipient, err);
    });
  } catch(err){
    console.warn("[FamilyBank v37.0] sendWelcomeEmail threw:", recipient, err);
  }
}
window.sendWelcomeEmail = sendWelcomeEmail;

// Entry — called from enterApp when trigger conditions met.
function openFamilyWizard(){
  // Idempotency: if wizard is already open or already completed, bail.
  if(familyWizardState && familyWizardState.open) return;
  if(state && state.config && state.config.familySetupComplete === true) return;
  if(!isPrimaryParent(currentUser)){
    console.warn("[FamilyBank v37.0] openFamilyWizard called for non-primary; skipping.");
    return;
  }

  // Graceful-degrade: check markup exists. If not, flip the flag and sync
  // so the trigger doesn't fire on every subsequent login. This is a beta
  // safety net; production ship has the markup.
  const sheet = document.getElementById("family-wizard-sheet");
  if(!sheet){
    console.warn("[FamilyBank v37.0] Family wizard markup missing — auto-completing.");
    if(!state.config) state.config = {};
    state.config.familySetupComplete = true;
    try { syncToCloud("Family Setup Auto-Complete (no markup)"); } catch(e){}
    return;
  }

  // Seed buffer from current state (primary already exists; we let the
  // user edit identity fields but keep the primary's own entry fixed).
  const cfg = state.config || {};
  familyWizardState = {
    open: true,
    step: 1,
    // Step 1 — identity (pre-fill from current config; user edits)
    identity: {
      bankName:       cfg.bankName       || CFG_BANK_NAME,
      tagline:        cfg.tagline        || CFG_BANK_TAGLINE,
      colorPrimary:   cfg.colorPrimary   || CFG_COLOR_PRIMARY,
      colorSecondary: cfg.colorSecondary || CFG_COLOR_SECONDARY,
      imgLogo:        cfg.imgLogo        || "",
      imgBanner:      cfg.imgBanner      || ""
    },
    // Step 2 — parents (primary is fixed; coParents are wizard-added)
    primaryName: currentUser,
    primaryEmail: (cfg.emails && cfg.emails[currentUser]) || "",
    coParents: [],   // [{name, email}]
    // Step 3 — children
    children: []     // [{name, pin, avatar, assignedParents:[names]}]
  };

  // Show the sheet, render Step 1.
  try { closeAllSheets(); } catch(e){}
  openSheet("family-wizard-sheet");
  fwRenderStep(1);
}
window.openFamilyWizard = openFamilyWizard;

function fwCloseSheet(){
  try { closeSheet("family-wizard-sheet", true); } catch(e){}
  if(familyWizardState) familyWizardState.open = false;
}

// Navigation
function fwStepNext(){
  if(!familyWizardState) return;
  // Validate current step before advancing
  if(!fwValidateStep(familyWizardState.step)) return;
  if(familyWizardState.step < 4){
    familyWizardState.step += 1;
    fwRenderStep(familyWizardState.step);
  }
}
window.fwStepNext = fwStepNext;

function fwStepBack(){
  if(!familyWizardState) return;
  if(familyWizardState.step > 1){
    familyWizardState.step -= 1;
    fwRenderStep(familyWizardState.step);
  }
}
window.fwStepBack = fwStepBack;

// Dispatcher — reads current step, writes fields back into buffer before
// render (so "Back" preserves user input), paints the target step content.
function fwRenderStep(n){
  if(!familyWizardState) return;
  // Persist any edits from the step we're leaving (in case caller skipped
  // fwValidateStep — defensive).
  fwCaptureStepInputs(familyWizardState.step);

  // Flip step dots / step number display if present
  const indicator = document.getElementById("fw-step-indicator");
  if(indicator) indicator.textContent = "Step " + n + " of 4";

  // Hide all step bodies, show the target
  for(let i = 1; i <= 4; i++){
    const el = document.getElementById("fw-step-" + i);
    if(el) el.classList.toggle("hidden", i !== n);
  }

  // Toggle nav buttons: no Back on Step 1, no Next on Step 4, Finish only on Step 4
  const backBtn   = document.getElementById("fw-back-btn");
  const nextBtn   = document.getElementById("fw-next-btn");
  const finishBtn = document.getElementById("fw-finish-btn");
  if(backBtn)   backBtn.classList.toggle("hidden",   n === 1);
  if(nextBtn)   nextBtn.classList.toggle("hidden",   n === 4);
  if(finishBtn) finishBtn.classList.toggle("hidden", n !== 4);

  if(n === 1) fwRenderStep1();
  else if(n === 2) fwRenderStep2();
  else if(n === 3) fwRenderStep3();
  else if(n === 4) fwRenderStep4();
}

// Capture inputs from current DOM step into the buffer. Called before any
// step transition. Silent on missing fields (they just keep their previous
// buffer value).
function fwCaptureStepInputs(step){
  if(!familyWizardState) return;
  const id = familyWizardState.identity;
  if(step === 1){
    const v = k => { const el = document.getElementById(k); return el ? el.value.trim() : ""; };
    if(document.getElementById("fw-bank-name"))       id.bankName       = v("fw-bank-name")       || id.bankName;
    if(document.getElementById("fw-tagline"))         id.tagline        = v("fw-tagline")         || id.tagline;
    if(document.getElementById("fw-color-primary"))   id.colorPrimary   = v("fw-color-primary")   || id.colorPrimary;
    if(document.getElementById("fw-color-secondary")) id.colorSecondary = v("fw-color-secondary") || id.colorSecondary;
    if(document.getElementById("fw-img-logo"))        id.imgLogo        = v("fw-img-logo");
    if(document.getElementById("fw-img-banner"))      id.imgBanner      = v("fw-img-banner");
  }
  // Step 2/3 edits are captured by add/remove actions in real time; no
  // bulk read needed here. Primary's own email IS editable on Step 2:
  if(step === 2){
    const primEmailEl = document.getElementById("fw-primary-email");
    if(primEmailEl) familyWizardState.primaryEmail = primEmailEl.value.trim();
  }
}

// STEP 1 — Family Identity
function fwRenderStep1(){
  const id = familyWizardState.identity;
  const set = (k, v) => { const el = document.getElementById(k); if(el) el.value = v || ""; };
  set("fw-bank-name",       id.bankName);
  set("fw-tagline",          id.tagline);
  set("fw-color-primary",   id.colorPrimary);
  set("fw-color-secondary", id.colorSecondary);
  set("fw-img-logo",         id.imgLogo);
  set("fw-img-banner",       id.imgBanner);
}

// STEP 2 — Parents
function fwRenderStep2(){
  // Primary (fixed name, editable email)
  const primNameEl = document.getElementById("fw-primary-name");
  if(primNameEl) primNameEl.textContent = familyWizardState.primaryName;
  const primEmailEl = document.getElementById("fw-primary-email");
  if(primEmailEl) primEmailEl.value = familyWizardState.primaryEmail || "";

  // Co-parent list
  const list = document.getElementById("fw-coparent-list");
  if(list){
    if(!familyWizardState.coParents.length){
      list.innerHTML = '<p class="fw-empty-hint">No co-parents yet. You can add them now or later in Settings.</p>';
    } else {
      list.innerHTML = familyWizardState.coParents.map((p, i) =>
        '<div class="fw-row">'
        + '<div class="fw-row-main"><strong>'+fwEscapeHtml(p.name)+'</strong>'
        + '<div class="fw-row-sub">'+fwEscapeHtml(p.email || "(no email)")+'</div></div>'
        + '<button type="button" class="fw-row-remove" onclick="fwRemoveCoParent('+i+')">Remove</button>'
        + '</div>'
      ).join("");
    }
  }

  // Hide add form if at cap
  const addBtn = document.getElementById("fw-add-coparent-btn");
  if(addBtn){
    const atCap = familyWizardState.coParents.length >= (FW_MAX_PARENTS - 1);
    addBtn.disabled = atCap;
    addBtn.textContent = atCap ? "Max co-parents reached" : "+ Add co-parent";
  }
}

function fwAddCoParent(){
  if(!familyWizardState) return;
  const nameEl  = document.getElementById("fw-new-coparent-name");
  const emailEl = document.getElementById("fw-new-coparent-email");
  const name  = nameEl  ? nameEl.value.trim()  : "";
  const email = emailEl ? emailEl.value.trim() : "";
  if(!name){ showToast("Enter a name.", "error"); return; }
  if(familyWizardState.coParents.length >= (FW_MAX_PARENTS - 1)){
    showToast("Max co-parents reached.", "error"); return;
  }
  // Name collision (against primary + existing co-parents)
  const taken = new Set([familyWizardState.primaryName.toLowerCase()]);
  familyWizardState.coParents.forEach(p => taken.add(p.name.toLowerCase()));
  if(taken.has(name.toLowerCase())){
    showToast("That name is already used.", "error"); return;
  }
  familyWizardState.coParents.push({ name, email });
  if(nameEl)  nameEl.value  = "";
  if(emailEl) emailEl.value = "";
  fwRenderStep2();
}
window.fwAddCoParent = fwAddCoParent;

function fwRemoveCoParent(i){
  if(!familyWizardState) return;
  familyWizardState.coParents.splice(i, 1);
  fwRenderStep2();
}
window.fwRemoveCoParent = fwRemoveCoParent;

// STEP 3 — Children (minimal inline add; per-child wizard runs later)
function fwRenderStep3(){
  const list = document.getElementById("fw-child-list");
  if(list){
    if(!familyWizardState.children.length){
      list.innerHTML = '<p class="fw-empty-hint">No children yet. You can add them now or later from the main screen.</p>';
    } else {
      list.innerHTML = familyWizardState.children.map((c, i) =>
        '<div class="fw-row">'
        + '<div class="fw-row-main"><strong>'+fwEscapeHtml(c.name)+'</strong>'
        + '<div class="fw-row-sub">PIN: '+fwEscapeHtml(c.pin)+' · Assigned to: '+fwEscapeHtml(c.assignedParents.join(", "))+'</div></div>'
        + '<button type="button" class="fw-row-remove" onclick="fwRemoveChild('+i+')">Remove</button>'
        + '</div>'
      ).join("");
    }
  }
  const addBtn = document.getElementById("fw-add-child-btn");
  if(addBtn){
    const atCap = familyWizardState.children.length >= FW_MAX_CHILDREN;
    addBtn.disabled = atCap;
    addBtn.textContent = atCap ? "Max children reached" : "+ Add child";
  }
}

function fwAddChild(){
  if(!familyWizardState) return;
  const nameEl = document.getElementById("fw-new-child-name");
  const pinEl  = document.getElementById("fw-new-child-pin");
  const avEl   = document.getElementById("fw-new-child-avatar");
  const name = nameEl ? nameEl.value.trim() : "";
  const pin  = pinEl  ? (pinEl.value.trim() || "0000") : "0000";
  const av   = avEl   ? avEl.value.trim() : "";
  if(!name){ showToast("Enter a name.", "error"); return; }
  if(familyWizardState.children.length >= FW_MAX_CHILDREN){
    showToast("Max children reached.", "error"); return;
  }
  // Collision check across the whole family (parents + existing children)
  const taken = new Set([familyWizardState.primaryName.toLowerCase()]);
  familyWizardState.coParents.forEach(p => taken.add(p.name.toLowerCase()));
  familyWizardState.children.forEach(c => taken.add(c.name.toLowerCase()));
  if(taken.has(name.toLowerCase())){
    showToast("That name is already used.", "error"); return;
  }
  // Default: all parents assigned to this child
  const allParents = [familyWizardState.primaryName].concat(
    familyWizardState.coParents.map(p => p.name)
  );
  familyWizardState.children.push({
    name,
    pin,
    avatar: av,
    assignedParents: allParents.slice()
  });
  if(nameEl) nameEl.value = "";
  if(pinEl)  pinEl.value  = "";
  if(avEl)   avEl.value   = "";
  fwRenderStep3();
}
window.fwAddChild = fwAddChild;

function fwRemoveChild(i){
  if(!familyWizardState) return;
  familyWizardState.children.splice(i, 1);
  fwRenderStep3();
}
window.fwRemoveChild = fwRemoveChild;

// STEP 4 — Review
function fwRenderStep4(){
  const id = familyWizardState.identity;
  const esc = s => fwEscapeHtml(s || "");

  // Identity summary
  const idSummary = document.getElementById("fw-review-identity");
  if(idSummary){
    idSummary.innerHTML =
      '<div class="fw-review-row"><span class="fw-review-label">Bank name</span><span class="fw-review-val">'+esc(id.bankName)+'</span></div>'
      + '<div class="fw-review-row"><span class="fw-review-label">Tagline</span><span class="fw-review-val">'+esc(id.tagline)+'</span></div>'
      + '<div class="fw-review-row"><span class="fw-review-label">Primary color</span><span class="fw-review-val">'+esc(id.colorPrimary)+'</span></div>'
      + '<div class="fw-review-row"><span class="fw-review-label">Secondary color</span><span class="fw-review-val">'+esc(id.colorSecondary)+'</span></div>'
      + (id.imgLogo   ? '<div class="fw-review-row"><span class="fw-review-label">Logo URL</span><span class="fw-review-val">'+esc(id.imgLogo)+'</span></div>'   : "")
      + (id.imgBanner ? '<div class="fw-review-row"><span class="fw-review-label">Banner URL</span><span class="fw-review-val">'+esc(id.imgBanner)+'</span></div>' : "");
  }

  // Parents summary
  const parSummary = document.getElementById("fw-review-parents");
  if(parSummary){
    const lines = [
      '<div class="fw-review-row"><span class="fw-review-label">'+esc(familyWizardState.primaryName)+' (primary)</span><span class="fw-review-val">'+esc(familyWizardState.primaryEmail || "no email")+'</span></div>'
    ].concat(
      familyWizardState.coParents.map(p =>
        '<div class="fw-review-row"><span class="fw-review-label">'+esc(p.name)+'</span><span class="fw-review-val">'+esc(p.email || "no email")+'</span></div>'
      )
    );
    parSummary.innerHTML = lines.join("");
  }

  // Children summary
  const chSummary = document.getElementById("fw-review-children");
  if(chSummary){
    if(!familyWizardState.children.length){
      chSummary.innerHTML = '<p class="fw-empty-hint">No children added. You can add them anytime from the main screen.</p>';
    } else {
      chSummary.innerHTML = familyWizardState.children.map(c =>
        '<div class="fw-review-row"><span class="fw-review-label">'+esc(c.name)+'</span><span class="fw-review-val">PIN '+esc(c.pin)+'</span></div>'
      ).join("");
    }
  }
}

function fwValidateStep(n){
  if(!familyWizardState) return false;
  fwCaptureStepInputs(n);
  if(n === 1){
    const id = familyWizardState.identity;
    if(!id.bankName){ showToast("Bank name is required.", "error"); return false; }
    return true;
  }
  // Steps 2 and 3 accept zero additions (co-parents and children both optional).
  // Step 4 is terminal — fwCommit handles finish.
  return true;
}

// STEP 4 — Finish: commit everything in one syncToCloud, then fire
// welcome emails to co-parents and children (primary already received
// their welcome at signup approval).
async function fwCommit(){
  if(!familyWizardState) return;
  // Final capture in case user clicks Finish without tabbing out of a field.
  fwCaptureStepInputs(familyWizardState.step);

  const id = familyWizardState.identity;
  const cfg = state.config || (state.config = {});

  // --- Apply Step 1: identity ---
  cfg.bankName       = id.bankName;
  cfg.tagline        = id.tagline;
  cfg.colorPrimary   = id.colorPrimary;
  cfg.colorSecondary = id.colorSecondary;
  cfg.imgLogo        = id.imgLogo;
  cfg.imgBanner      = id.imgBanner;

  // --- Apply Step 2: primary email edits + co-parents ---
  if(!cfg.emails) cfg.emails = {};
  if(!cfg.notify) cfg.notify = {};
  if(!cfg.parentChildren) cfg.parentChildren = {};
  if(!state.users) state.users = [];
  if(!state.pins)  state.pins  = {};
  if(!state.roles) state.roles = {};
  if(!state.usersData) state.usersData = {};

  // Primary email update (keep existing notify settings; default Instant
  // for primary per locked scope — if already set, leave alone)
  cfg.emails[familyWizardState.primaryName] = familyWizardState.primaryEmail || "";
  if(!cfg.notify[familyWizardState.primaryName]){
    cfg.notify[familyWizardState.primaryName] = {
      email: true, calendar: false, choreRewards: true,
      digestFrequency: "instant"
    };
  } else if(cfg.notify[familyWizardState.primaryName].digestFrequency == null){
    cfg.notify[familyWizardState.primaryName].digestFrequency = "instant";
  }

  // Collect new parents for post-sync welcome emails
  const newParentEmails = [];
  familyWizardState.coParents.forEach(p => {
    if(state.users.indexOf(p.name) === -1) state.users.push(p.name);
    state.pins[p.name]  = "0000";
    state.roles[p.name] = "parent";
    state.usersData[p.name] = { createdAt: new Date().toISOString() };
    cfg.emails[p.name] = p.email || "";
    cfg.notify[p.name] = {
      email: true, calendar: false, choreRewards: true,
      digestFrequency: "daily",
      digestTimeOfDay: "08:00"
    };
    if(!cfg.parentChildren[p.name]) cfg.parentChildren[p.name] = [];
    if(p.email) newParentEmails.push({ recipient: p.email, name: p.name });
  });

  // --- Apply Step 3: children ---
  if(!state.children) state.children = {};
  if(!cfg.avatars) cfg.avatars = {};
  if(!cfg.childSetupComplete) cfg.childSetupComplete = {};
  if(!cfg.childEmails){
    // v37.0 locked defaults — see scope doc "Child email gating"
    cfg.childEmails = {
      choreCreated: true, choreApproved: false, choreDenied: true,
      depositApproved: false, depositDenied: false,
      withdrawalApproved: true, withdrawalDenied: true
    };
  }

  const newChildEmails = [];  // children don't have emails in v37 typical flow;
                              // wizard doesn't collect child emails, so this
                              // list stays empty. Kept for future use.

  familyWizardState.children.forEach(c => {
    if(state.users.indexOf(c.name) === -1) state.users.push(c.name);
    state.pins[c.name]  = c.pin || "0000";
    state.roles[c.name] = "child";
    state.usersData[c.name] = { createdAt: new Date().toISOString() };
    if(!state.children[c.name]){
      state.children[c.name] = { balance: 0, balanceSav: 0, chores: [], goals: [] };
    }
    if(c.avatar) cfg.avatars[c.name] = c.avatar;
    // Wire to parentChildren — all selected parents get this child in their list
    (c.assignedParents || []).forEach(pn => {
      if(!cfg.parentChildren[pn]) cfg.parentChildren[pn] = [];
      if(cfg.parentChildren[pn].indexOf(c.name) === -1){
        cfg.parentChildren[pn].push(c.name);
      }
    });
    // DELIBERATE: do NOT set cfg.childSetupComplete[c.name] = true.
    // Locked scope: per-child 9-step wizard must still fire on first open.
  });

  // --- Flip the completion flag ---
  cfg.familySetupComplete = true;
  if(!cfg.primaryParent) cfg.primaryParent = familyWizardState.primaryName;

  // --- Commit: ONE sync. ---
  try {
    await syncToCloud("Family Provisioned");
  } catch(err){
    console.error("[FamilyBank v37.0] Family wizard sync failed:", err);
    showToast("Couldn't save family — please retry.", "error", 5000);
    return;
  }

  // --- Post-commit side effects ---
  // Audit log (fire-and-forget)
  try { appendAuditLog("Family Setup Complete", currentFamilyId || ""); } catch(e){}

  // Welcome emails (fire-and-forget). One POST per recipient.
  newParentEmails.forEach(p => {
    sendWelcomeEmail(p.recipient, p.name, "parent", "0000");
  });
  newChildEmails.forEach(c => {
    sendWelcomeEmail(c.recipient, c.name, "child", c.pin || "0000");
  });

  // --- UI close + land user somewhere sensible ---
  fwCloseSheet();
  familyWizardState = null;

  showToast("Family setup complete! 🎉", "success", 4000);

  // Re-render the parent view. If children were added, this will show
  // the picker; if not, main screen with the empty-children prompt
  // (which will trigger the per-child wizard path for future adds).
  try { applyBranding(); } catch(e){}
  try { renderAll && renderAll(); } catch(e){}
  try {
    const kids = getAssignedChildren();
    if(kids.length === 1){
      selectChild(kids[0]);
    } else if(kids.length > 1){
      document.getElementById("main-screen").classList.add("hidden");
      document.getElementById("child-picker-screen").classList.remove("hidden");
      showChildPicker();
    }
    // kids.length === 0 → user stays on main/parent-panel view
  } catch(e){}
}
window.fwCommit = fwCommit;

// ────────────────────────────────────────────────────────────────────
// 22.4 — GUIDED CHILD SETUP WIZARD
// ────────────────────────────────────────────────────────────────────

/** Start wizard for a brand-new child. Step 1 will create the child on Next. */
function startWizardForNewChild(){
  if(currentRole !== "parent"){ showToast("Wizard is parent-only.","error"); return; }
  const mine = getMyChildrenList();
  if(mine.length >= MAX_CHILDREN_PER_PARENT){
    showToast("You've hit the "+MAX_CHILDREN_PER_PARENT+"-child limit.","error");
    return;
  }
  wizardState = {
    mode: "new",
    step: 1,
    childName: null,            // populated after Step 1 save
    data: {
      name: "",
      pin:  "",
      tabs: {money:false, chores:false, loans:false}, // v35.0 — no default selection
      useAllowance: undefined,                        // v35.0 — no default
      structure: "both",
      schedule: "weekly",
      allowWeekday: 1,  // Monday default
      allowMonthlyDay: "1",
      choreRewards: undefined,                        // v35.0 — no default
      allowChk: 0,
      allowSav: 0,
      rateChk: "",
      rateSav: "",
      email: "",
      notifyEmail: undefined,                         // v35.0 — no default
      notifyChoreRewards: undefined,                  // v35.0 — no default
      useCalendar: undefined,                         // v35.0 — no default
      calendarId: "",
      celebrationSound: undefined,                    // v35.0 — no default
      avatar: ""
    },
    chores: [],                 // wizard-only scratchpad; once child is created,
                                // chores live directly on state.children[name].chores
    editingFromSummary: 0       // step number we came from in summary mode (0 = not editing)
  };
  openSheet("sheet-wizard");
  wizardRender();
}

/** Start wizard for an existing child — pre-populates from state. */
function startWizardForExistingChild(name){
  if(!name || !state.children || !state.children[name]){ showToast("Child not found.","error"); return; }
  const data = state.children[name];
  const ad = data.autoDeposit || {};
  const rates = data.rates || {};
  const tabs = (state.config.tabs && state.config.tabs[name]) || {money:true, chores:true, loans:false};
  const notify = (state.config.notify && state.config.notify[name]) || {email:true, choreRewards:true};
  const email = (state.config.emails && state.config.emails[name]) || "";
  const structure = (ad.checking>0 && ad.savings>0) ? "both" : (ad.savings>0 ? "savings" : "checking");
  wizardState = {
    mode: "edit",
    step: 1,
    childName: name,
    data: {
      name: name,
      pin:  state.pins[name] || "",
      tabs: {...tabs},
      useAllowance: !!((ad.checking||0) + (ad.savings||0)),
      structure: structure,
      schedule: ad.schedule || "weekly",
      allowWeekday: ad.weekday !== undefined ? ad.weekday : 1,
      allowMonthlyDay: ad.monthlyDay || "1",
      choreRewards: !!(state.config.notify && state.config.notify[name] && state.config.notify[name].choreRewards !== false),
      allowChk: ad.checking || 0,
      allowSav: ad.savings  || 0,
      rateChk: rates.checking || "",
      rateSav: rates.savings  || "",
      email: email,
      notifyEmail: notify.email !== false,
      notifyChoreRewards: notify.choreRewards !== false,
      useCalendar: !!(state.config.calendars && state.config.calendars[name]),
      calendarId: (state.config.calendars && state.config.calendars[name]) || "",
      celebrationSound: !!(state.usersData && state.usersData[name] && state.usersData[name].celebrationSound),
      avatar: (state.config.avatars && state.config.avatars[name]) || ""
    },
    chores: [], // for existing child we don't touch existing chores from wizard
    editingFromSummary: 0
  };
  openSheet("sheet-wizard");
  wizardRender();
}

function wizardClose(){
  // EXIT_WARN_SHEETS covers the dirty-confirm; we just close gracefully
  closeSheet("sheet-wizard", false);
}

function wizardRender(){
  const wrap = document.getElementById("wizard-body");
  const progEl = document.getElementById("wizard-progress");
  const navEl  = document.getElementById("wizard-nav");
  if(!wrap || !progEl || !navEl) return;
  const st = wizardState; if(!st) return;

  progEl.innerHTML = `
    <div class="wizard-progress-bar"><div class="wizard-progress-fill" style="width:${Math.round((st.step/wizardTotalSteps)*100)}%"></div></div>
    <div class="wizard-progress-text">Step ${st.step} of ${wizardTotalSteps}</div>`;

  // Dispatch per step (v34.1 reorder: 1 Basic, 2 Tabs, 3 Allow?, 4 Allow&Rates,
  // 5 Email, 6 Calendar, 7 Chores, 8 Streaks, 9 Celebration, 10 Summary)
  let stepHtml = "";
  switch(st.step){
    case 1:  stepHtml = wizardRenderStep1();  break;
    case 2:  stepHtml = wizardRenderStep2();  break;
    case 3:  stepHtml = wizardRenderStep3();  break;
    case 4:  stepHtml = wizardRenderStep4();  break;
    case 5:  stepHtml = wizardRenderStep5();  break;
    case 6:  stepHtml = wizardRenderStep6();  break;
    case 7:  stepHtml = wizardRenderStep7();  break;  // Chores + streak review
    case 8:  stepHtml = wizardRenderStep8();  break;  // Celebration (was 9)
    case 9:  stepHtml = wizardRenderStep9();  break;  // Summary (was 10)
  }
  wrap.innerHTML = stepHtml;

  // Nav buttons
  const backDisabled = (st.step === 1);
  const nextLabel    = st.editingFromSummary ? "Save & Return to Summary" :
                       (st.step === wizardTotalSteps ? "Done" : "Next");
  navEl.innerHTML = `
    <button class="btn btn-ghost" ${backDisabled?"disabled":""} onclick="wizardBack()">‹ Back</button>
    <button class="btn btn-primary" onclick="wizardNext()">${nextLabel}</button>`;

  // Post-render hooks
  if(st.step === 1) wizardStep1WireAvatar();        // avatar picker
  if(st.step === 4) wizardStep4WireLive();
  if(st.step === 7) wizardStep7RenderChoreList();   // v34.2 — chores step 7 (with streak inline)
  if(st.step === 9) wizardRenderSummary();           // v34.2 — summary is step 9
}

function wizardBack(){
  if(!wizardState) return;
  if(wizardState.step > 1){ wizardState.step--; wizardRender(); }
}

function wizardNext(){
  if(!wizardState) return;
  if(!wizardValidateCurrentStep()) return;
  wizardSaveCurrentStep();

  // Handle summary-edit short-circuit (v34.2: summary is now step 9)
  if(wizardState.editingFromSummary){
    wizardState.editingFromSummary = 0;
    wizardState.step = 9;
    wizardRender();
    return;
  }

  // Linear flow with v34.1 branching:
  //   Step 3 "No allowance" → skip Step 4 (Allowance & Rates), jump to Step 5 (Email)
  //   Step 6 (Calendar) → if chores tab OFF, skip Steps 7 (Chores) + 8 (Streaks), jump to Step 9 (Celebration)
  //   Step 9 Done → finish
  const st = wizardState;
  if(st.step === 3 && !st.data.useAllowance){ st.step = 5; wizardRender(); return; }
  if(st.step === 6 && !st.data.tabs.chores){  st.step = 8; wizardRender(); return; } // v34.2 — skip chores→streak, go to celebration
  if(st.step === wizardTotalSteps){ wizardFinish(); return; }

  st.step++;
  wizardRender();
}

function wizardValidateCurrentStep(){
  const st = wizardState;
  if(!st) return false;
  if(st.step === 1){
    const nameEl = document.getElementById("wiz-name");
    const pinEl  = document.getElementById("wiz-pin");
    const msgEl  = document.getElementById("wiz-msg");
    const name = (nameEl.value||"").trim();
    const pin  = (pinEl.value||"").trim();
    if(!name){ msgEl.className="field-msg error"; msgEl.textContent="Display name is required."; return false; }
    if(!pin || pin.length!==4 || !/^\d{4}$/.test(pin)){ msgEl.className="field-msg error"; msgEl.textContent="PIN must be 4 digits."; return false; }
    // v35.0 — chore rewards pill required (no default)
    const cr = document.querySelector('input[name="wiz-chore-rewards"]:checked');
    if(!cr){ msgEl.className="field-msg error"; msgEl.textContent='Pick Yes or No for chore rewards.'; return false; }
    // Only validate uniqueness on the FIRST time we create the child
    if(st.mode === "new" && !st.childName){
      if((state.users||[]).indexOf(name) !== -1){
        msgEl.className="field-msg error"; msgEl.textContent='"'+name+'" is already taken.'; return false;
      }
      // pin+name collision guard
      const col = (typeof checkNamePinCollision === "function") ? checkNamePinCollision(name, pin) : {collision:false};
      if(col.collision){ msgEl.className="field-msg error"; msgEl.textContent=col.reason||"Name/PIN conflict."; return false; }
    }
  }
  // v35.0 — pill requirement validations (no default means user must pick)
  if(st.step === 2){
    const d = st.data;
    if(!d.tabs || (!d.tabs.money && !d.tabs.chores && !d.tabs.loans)){
      showToast("Pick at least one tab.","error"); return false;
    }
  }
  if(st.step === 3){
    if(!document.querySelector('input[name="wiz-allow"]:checked')){
      showToast("Pick Yes or No for allowance.","error"); return false;
    }
  }
  if(st.step === 5){
    const ne = document.querySelector('input[name="wiz-notify-email-r"]:checked');
    const nr = document.querySelector('input[name="wiz-notify-rewards-r"]:checked');
    if(!ne || !nr){ showToast("Pick Yes or No for both email options.","error"); return false; }
  }
  if(st.step === 6){
    if(!document.querySelector('input[name="wiz-cal"]:checked')){
      showToast("Pick Yes or No for calendar.","error"); return false;
    }
  }
  if(st.step === 8){
    if(!document.querySelector('input[name="wiz-cele"]:checked')){
      showToast("Pick Yes or No for celebration sound.","error"); return false;
    }
  }
  return true;
}

function wizardSaveCurrentStep(){
  const st = wizardState; if(!st) return;
  const d = st.data;
  switch(st.step){
    case 1: {
      d.name = (document.getElementById("wiz-name").value||"").trim();
      d.pin  = (document.getElementById("wiz-pin").value||"").trim();
      const crEl = document.querySelector('input[name="wiz-chore-rewards"]:checked');
      d.choreRewards = crEl ? (crEl.value !== "no") : undefined; // v35.0 — undefined when no pick
      // Progressive save: create child on first time through Step 1
      if(st.mode === "new" && !st.childName){
        state.users = state.users || [];
        state.users.push(d.name);
        state.pins[d.name]  = d.pin;
        state.roles[d.name] = "child";
        getChildData(d.name); // seed empty data
        state.config.tabs = state.config.tabs || {};
        state.config.tabs[d.name] = {...d.tabs};
        state.config.notify = state.config.notify || {};
        state.config.notify[d.name] = {email:d.notifyEmail, calendar:false, choreRewards:d.notifyChoreRewards && d.choreRewards!==false};
        // v34.2 — also persist choreRewards display flag set in step 1
        state.config.notify[d.name].choreRewards = d.choreRewards !== false;
        state.usersData = state.usersData || {};
        state.usersData[d.name] = {
          celebrationSound: d.celebrationSound,
          createdAt: new Date().toISOString()  // v34.0 — anchor for annual projection anniversary
        };
        state.config.parentChildren = state.config.parentChildren || {};
        state.config.parentChildren[currentUser] = state.config.parentChildren[currentUser] || [];
        if(state.config.parentChildren[currentUser].indexOf(d.name) === -1){
          state.config.parentChildren[currentUser].push(d.name);
        }
        st.childName = d.name;
        syncToCloud("Child Created (Wizard Step 1)");
      } else if(st.mode === "edit" && st.childName && d.name !== st.childName){
        // Renames not supported by wizard — ignore silently.
      } else if(st.childName){
        state.pins[st.childName] = d.pin;
        syncToCloud("Child PIN Updated (Wizard)");
      }
      // v34.1 Item 1 — persist avatar emoji (photo is stored local-only on select)
      if(st.childName && d._avatarEmoji){
        state.avatars = state.avatars || {};
        state.avatars[st.childName] = d._avatarEmoji;
        syncToCloud("Child Avatar (Wizard)");
      }
      break;
    }
    case 2: {
      // v35.0 — tabs already tracked in wizardState.data.tabs via wizardToggleTab; just persist
      if(st.childName){
        state.config.tabs[st.childName] = {...d.tabs};
        syncToCloud("Child Tabs (Wizard)");
      }
      break;
    }
    case 3: {
      const yes = document.querySelector('input[name="wiz-allow"]:checked');
      d.useAllowance = yes && yes.value === "yes";
      if(!d.useAllowance && st.childName){
        const data = getChildData(st.childName);
        data.autoDeposit = {checking:0, savings:0};
        syncToCloud("Allowance Disabled (Wizard)");
      }
      break;
    }
    case 4: {
      const struct = document.querySelector('input[name="wiz-struct"]:checked');
      d.structure = struct ? struct.value : "both";
      const sched = document.querySelector('input[name="wiz-sched"]:checked');
      d.schedule = sched ? sched.value : "weekly";
      // v34.2 — capture payment day
      if(d.schedule === "monthly"){
        d.allowMonthlyDay = document.getElementById("wiz-monthly-day")?.value || "1";
        d.allowWeekday = undefined;
      } else {
        const selDay = document.querySelector("#wiz-day-toggles .day-toggle.selected");
        d.allowWeekday = selDay ? parseInt(selDay.dataset.day) : 1;
        d.allowMonthlyDay = undefined;
      }
      d.allowChk = readMoney("wiz-allow-chk")||0;
      d.allowSav = readMoney("wiz-allow-sav")||0;
      // v34.1 Item 8 — percent inputs now use readPercent helper
      d.rateChk  = readPercent("wiz-rate-chk");
      d.rateSav  = readPercent("wiz-rate-sav");
      if(isNaN(d.rateChk)) d.rateChk = "";
      if(isNaN(d.rateSav)) d.rateSav = "";
      if(d.structure === "checking") d.allowSav = 0;
      if(d.structure === "savings")  d.allowChk = 0;
      if(st.childName){
        const data = getChildData(st.childName);
        data.autoDeposit = data.autoDeposit || {};
        data.autoDeposit.checking = d.allowChk;
        data.autoDeposit.savings  = d.allowSav;
        data.autoDeposit.schedule = d.schedule;
        if(d.schedule === "monthly") data.autoDeposit.monthlyDay = d.allowMonthlyDay;
        else                         data.autoDeposit.weekday = (d.allowWeekday !== undefined ? d.allowWeekday : 1);
        data.rates = data.rates || {};
        data.rates.checking = (d.rateChk === "" ? 0 : d.rateChk);
        data.rates.savings  = (d.rateSav === "" ? 0 : d.rateSav);
        syncToCloud("Allowance & Rates (Wizard)");
      }
      break;
    }
    case 5: {
      // Email (v34.1 — was step 6)
      d.email = (document.getElementById("wiz-email").value||"").trim();
      d.email                 = (document.getElementById("wiz-email") && document.getElementById("wiz-email").value.trim()) || "";
      const ne = document.querySelector('input[name="wiz-notify-email-r"]:checked');
      const nr = document.querySelector('input[name="wiz-notify-rewards-r"]:checked');
      d.notifyEmail           = ne ? (ne.value === "yes") : undefined;
      d.notifyChoreRewards    = nr ? (nr.value === "yes") : undefined;
      if(st.childName){
        state.config.emails = state.config.emails || {};
        state.config.emails[st.childName] = d.email;
        state.config.notify = state.config.notify || {};
        state.config.notify[st.childName] = state.config.notify[st.childName] || {};
        state.config.notify[st.childName].email = d.notifyEmail;
        state.config.notify[st.childName].choreRewards = d.notifyChoreRewards;
        syncToCloud("Child Email Prefs (Wizard)");
      }
      break;
    }
    case 6: {
      // Calendar (v34.1 — was step 7); v35.0 — undefined when no pill selected
      const yes = document.querySelector('input[name="wiz-cal"]:checked');
      d.useCalendar = yes ? (yes.value === "yes") : undefined;
      d.calendarId  = (document.getElementById("wiz-cal-id") && document.getElementById("wiz-cal-id").value.trim()) || "";
      if(st.childName){
        state.config.calendars = state.config.calendars || {};
        state.config.notify    = state.config.notify    || {};
        state.config.notify[st.childName] = state.config.notify[st.childName] || {};
        if(d.useCalendar && d.calendarId){
          state.config.calendars[st.childName] = d.calendarId;
          state.config.notify[st.childName].calendar = true;
        } else {
          delete state.config.calendars[st.childName];
          state.config.notify[st.childName].calendar = false;
        }
        syncToCloud("Child Calendar (Wizard)");
      }
      break;
    }
    case 7: {
      // Chores (v34.1 — was step 5; chores persist as they're added)
      break;
    }
    case 8: {
      // Streak review (v34.1 — new step; edits happen via inline re-open of the chore sheet)
      break;
    }
    case 8: {
      // Celebration sound (v34.2 — was step 9)
      const ce = document.querySelector('input[name="wiz-cele"]:checked');
      d.celebrationSound = ce ? (ce.value === "yes") : undefined;
      if(st.childName){
        state.usersData = state.usersData || {};
        state.usersData[st.childName] = state.usersData[st.childName] || {};
        state.usersData[st.childName].celebrationSound = d.celebrationSound;
        syncToCloud("Child Finishing Touches (Wizard)");
      }
      break;
    }
    case 9: {
      // Summary (v34.2) — no inputs to save, wizardFinish() handles commit
      break;
    }
  }
}

function wizardFinish(){
  const name = wizardState && wizardState.childName;
  // Close the wizard sheet first so the setup-complete sheet layers over the
  // parent panel cleanly.
  wizardState = null;
  closeSheet("sheet-wizard", true);
  if(name){
    syncToCloud("Child Setup Complete");
    showToast('Setup complete for "'+name+'". 🎉',"success",3000);
  }
  try { renderMyChildren && renderMyChildren(); } catch(e){}
  try { renderParentTabBar && renderParentTabBar(); } catch(e){}

  // v34.0 — Open the setup-complete BOTTOM SHEET (was an openModal prompt
  // in v33.1; modal was centered/short and didn't match the rest of the
  // wizard flow). Deferred via setTimeout so the wizard's close animation
  // can finish before this sheet slides up.
  setTimeout(()=>{
    const nameEl = document.getElementById("setup-complete-child-name");
    if(nameEl) nameEl.textContent = name || "Child";
    openSheet("sheet-setup-complete");
  }, 350);
}

// v34.0 — Handler for "Yes, add another" on the setup-complete sheet.
// Closes this sheet, then opens the wizard for another child.
function setupCompleteAddAnother(){
  closeSheet("sheet-setup-complete", true);
  setTimeout(()=>{
    try { startWizardForNewChild(); } catch(e){}
  }, 250);
}

function wizardJumpFromSummary(stepN){
  if(!wizardState) return;
  wizardState.editingFromSummary = stepN;
  wizardState.step = stepN;
  wizardRender();
}

// ── Step renderers ────────────────────────────────────────────────

function wizardRenderStep1(){
  const d = wizardState.data;
  const childName = wizardState.childName || d.name || "";
  const curEmoji = d._avatarEmoji || (childName && state.avatars && state.avatars[childName]) || "🙂";
  const hasPhoto = childName ? !!(typeof getAvatarPhoto === "function" && getAvatarPhoto(childName)) : false;
  const emojiGrid = (typeof AVATAR_EMOJIS !== "undefined" ? AVATAR_EMOJIS : ["🙂","😀","😎","🐱","🐶","🦊","🐼","🐸","🦄","🐵","🐯","🦁"])
    .map(e => `<button type="button" class="${e===curEmoji?"selected":""}" onclick="wizardStep1PickEmoji('${e}')">${e}</button>`)
    .join("");
  const photoBtn = childName
    ? (hasPhoto
        ? `<button type="button" class="btn btn-outline btn-sm" style="width:auto;margin:0;" onclick="wizardStep1RemovePhoto()">Remove Photo</button>`
        : `<button type="button" class="btn btn-outline btn-sm" style="width:auto;margin:0;" onclick="document.getElementById('wiz-avatar-file').click()">Upload Photo</button>`)
    : `<button type="button" class="btn btn-outline btn-sm" style="width:auto;margin:0;" onclick="wizardStep1StartPhotoFlow()">Add Photo</button>`;
  return `
    <h3 class="wizard-step-title">${wizardState.mode==="edit" ? "Edit " + (wizardState.childName||"Child") + "'s Account" : "Set Up Your Child's Account"}</h3>
    <div class="wizard-helper" style="margin-bottom:14px;">${wizardState.mode==="edit" ? "Update the settings below. Changes save as you go." : "Let's get started! We'll walk through your child's profile, allowance, chores, and more."}</div>
    <label class="field-label">Display Name <span class="req-star">*</span></label>
    <input type="text" id="wiz-name" value="${(d.name||"").replace(/"/g,"&quot;")}" placeholder="e.g. Linnea">
    <label class="field-label">PIN (4 digits) <span class="req-star">*</span></label>
    <input type="text" id="wiz-pin" class="pin-input" maxlength="4" inputmode="numeric" autocomplete="off" value="${(d.pin||"")}" placeholder="••••">
    <div class="field-msg" id="wiz-msg"></div>
    <label class="field-label" style="margin-top:14px;">Do you want your child to earn rewards for chores?</label>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-chore-rewards" value="yes" ${d.choreRewards===true?"checked":""}> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-chore-rewards" value="no"  ${d.choreRewards===false?"checked":""}> No</label>
    </div>
    <div class="wizard-helper">Your child can change their PIN from their own settings. If they forget it, you can reset it from Settings → My Children.</div>
    <label class="field-label" style="margin-top:14px;"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-user"/></svg> Avatar</label>
    <div class="avatar-picker-current" id="wiz-avatar-current">${curEmoji}</div>
    <div class="avatar-picker-grid" id="wiz-avatar-grid">${emojiGrid}</div>
    <div style="margin-top:8px;">${photoBtn}</div>
    <input type="file" id="wiz-avatar-file" accept="image/*" style="display:none;" onchange="wizardStep1UploadPhoto(event)">`;
}

function wizardStep1WireAvatar(){ /* no-op — rendering does the work */ }

// v35.0 — Item 7: Allow adding photo from Step 1 BEFORE advancing.
// If the child hasn't been created yet, validate + save Step 1 first
// (which creates the child without advancing), then open the file picker.
function wizardStep1StartPhotoFlow(){
  const st = wizardState; if(!st) return;
  if(!wizardValidateCurrentStep()) return;
  if(!st.childName){
    wizardSaveCurrentStep();  // persists child creation; does NOT advance step
    wizardRender();           // re-render so photo button reflects new childName
    // Defer file picker click to next tick so DOM is fresh
    setTimeout(()=>{
      const el = document.getElementById("wiz-avatar-file");
      if(el) el.click();
    }, 30);
  } else {
    const el = document.getElementById("wiz-avatar-file");
    if(el) el.click();
  }
}
window.wizardStep1StartPhotoFlow = wizardStep1StartPhotoFlow;

function wizardStep1PickEmoji(emoji){
  if(!wizardState) return;
  wizardState.data._avatarEmoji = emoji;
  // Live update selected class without re-render
  const grid = document.getElementById("wiz-avatar-grid");
  if(grid){
    grid.querySelectorAll("button").forEach(btn => {
      btn.classList.toggle("selected", btn.textContent === emoji);
    });
  }
  const cur = document.getElementById("wiz-avatar-current");
  if(cur) cur.innerHTML = emoji + ' <span style="font-size:.78rem;color:var(--muted);margin-left:8px;">Emoji selected</span>';
  // Persist immediately if the child record already exists
  if(wizardState.childName){
    state.avatars = state.avatars || {};
    state.avatars[wizardState.childName] = emoji;
    syncToCloud("Child Avatar (Wizard)");
  }
}
window.wizardStep1PickEmoji = wizardStep1PickEmoji;

function wizardStep1UploadPhoto(ev){
  if(!wizardState || !wizardState.childName) return;
  const file = ev && ev.target && ev.target.files && ev.target.files[0];
  if(!file) return;
  if(typeof resizeImageFileTo200 !== "function"){ showToast("Image resize unavailable.", "error"); return; }
  resizeImageFileTo200(file).then(dataUrl => {
    try { localStorage.setItem("fb_avatar_" + wizardState.childName, dataUrl); } catch(e){}
    wizardRender();
    showToast("Photo set.", "success");
  }).catch(()=>{
    showToast("Couldn't process image.", "error");
  });
}
window.wizardStep1UploadPhoto = wizardStep1UploadPhoto;

function wizardStep1RemovePhoto(){
  if(!wizardState || !wizardState.childName) return;
  try { localStorage.removeItem("fb_avatar_" + wizardState.childName); } catch(e){}
  wizardRender();
  showToast("Photo removed.", "success");
}
window.wizardStep1RemovePhoto = wizardStep1RemovePhoto;

function wizardRenderStep2(){
  const d = wizardState.data;
  // v35.0 — multi-select button pills (was checkboxes). No default selection.
  // This also eliminates the v34.3 "Loans checkbox crashes wizard" regression.
  return `
    <h3 class="wizard-step-title">Tabs</h3>
    <div class="wizard-helper">Decide which features ${d.name||"this child"} will see. Tap to toggle. Pick at least one.</div>
    <div class="wizard-pill-group wizard-pill-multi">
      <button type="button" class="wizard-pill-btn ${d.tabs.money?"selected":""}"  onclick="wizardToggleTab('money',this)">Money</button>
      <button type="button" class="wizard-pill-btn ${d.tabs.chores?"selected":""}" onclick="wizardToggleTab('chores',this)">Chores</button>
      <button type="button" class="wizard-pill-btn ${d.tabs.loans?"selected":""}"  onclick="wizardToggleTab('loans',this)">Loans</button>
    </div>`;
}

// v35.0 — toggle a tab pill; updates wizardState.data.tabs without re-rendering
function wizardToggleTab(tab, btn){
  const d = wizardState.data;
  d.tabs = d.tabs || {};
  d.tabs[tab] = !d.tabs[tab];
  btn.classList.toggle("selected", !!d.tabs[tab]);
}

function wizardRenderStep3(){
  const d = wizardState.data;
  return `
    <h3 class="wizard-step-title">Allowance</h3>
    <div class="wizard-helper">Do you want to use this app to manage ${d.name||"this child"}'s allowance?</div>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-allow" value="yes" ${d.useAllowance===true?"checked":""}> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-allow" value="no"  ${d.useAllowance===false?"checked":""}> No</label>
    </div>`;
}

function wizardRenderStep4(){
  const d = wizardState.data;
  return `
    <h3 class="wizard-step-title">Allowance & Interest</h3>
    <div class="wizard-helper">Account structure</div>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-struct" value="checking" ${d.structure==="checking"?"checked":""}> Checking</label>
      <label class="wizard-pill"><input type="radio" name="wiz-struct" value="savings"  ${d.structure==="savings"?"checked":""}> Savings</label>
      <label class="wizard-pill"><input type="radio" name="wiz-struct" value="both"     ${d.structure==="both"?"checked":""}> Both</label>
    </div>
    <div class="wizard-helper">Schedule</div>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-sched" value="weekly"   ${d.schedule==="weekly"?"checked":""} onchange="wizardStep4UpdateSchedUI()"> Weekly</label>
      <label class="wizard-pill"><input type="radio" name="wiz-sched" value="biweekly" ${d.schedule==="biweekly"?"checked":""} onchange="wizardStep4UpdateSchedUI()"> Biweekly</label>
      <label class="wizard-pill"><input type="radio" name="wiz-sched" value="monthly"  ${d.schedule==="monthly"?"checked":""} onchange="wizardStep4UpdateSchedUI()"> Monthly</label>
    </div>
    <!-- v34.2 — Payment day selector (weekly/biweekly: day-of-week toggles; monthly: day-of-month select) -->
    <div id="wiz-day-wrap" style="${d.schedule==="monthly"?"display:none":""}">
      <label class="field-label" id="wiz-day-label">${d.schedule==="biweekly"?"Day of Week (every other week)":"Day of Week"}</label>
      <div class="day-toggles" id="wiz-day-toggles">
        ${["Su","Mo","Tu","We","Th","Fr","Sa"].map((lbl,i)=>`<button type="button" class="day-toggle${(d.allowWeekday!==undefined&&d.allowWeekday===i)||(d.allowWeekday===undefined&&i===1)?" selected":""}" data-day="${i}" onclick="wizardToggleAllowDay(this)">${lbl}</button>`).join("")}
      </div>
    </div>
    <div id="wiz-monthly-wrap" style="${d.schedule==="monthly"?"":"display:none"}">
      <label class="field-label">Day of Month</label>
      <select id="wiz-monthly-day" onchange=""></select>
    </div>
    <div class="row">
      <div class="col" id="wiz-col-chk"><label class="field-label">Checking each allowance payment</label><input type="number" class="money-input" id="wiz-allow-chk" step="0.01" min="0" value="${d.allowChk||""}"></div>
      <div class="col" id="wiz-col-sav"><label class="field-label">Savings each allowance payment</label><input type="number" class="money-input" id="wiz-allow-sav" step="0.01" min="0" value="${d.allowSav||""}"></div>
    </div>
    <div class="row">
      <div class="col"><label class="field-label">Checking APR %</label><input type="number" class="percent-input" id="wiz-rate-chk" step="0.01" min="0" value="${d.rateChk===""?"":d.rateChk}" placeholder="e.g. 1.0"></div>
      <div class="col"><label class="field-label">Savings APR %</label><input type="number" class="percent-input" id="wiz-rate-sav" step="0.01" min="0" value="${d.rateSav===""?"":d.rateSav}" placeholder="e.g. 5.0"></div>
    </div>
    <div class="wizard-live-calc" id="wiz-live-calc"></div>`;
}

function wizardStep4WireLive(){
  const ids = ["wiz-allow-chk","wiz-allow-sav","wiz-rate-chk","wiz-rate-sav"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", wizardStep4UpdateLive);
  });
  document.querySelectorAll('input[name="wiz-struct"], input[name="wiz-sched"]').forEach(r=>{
    r.addEventListener("change", ()=>{ wizardStep4ToggleStructCols(); wizardStep4UpdateLive(); });
  });
  wizardStep4ToggleStructCols();
  wizardStep4UpdateLive();
  wizardStep4PopulateMonthlyDay(); // v34.2 — populate day-of-month options
}

// v34.2 — Toggle between day-of-week and day-of-month pickers when schedule changes
function wizardStep4UpdateSchedUI(){
  const sched = (document.querySelector('input[name="wiz-sched"]:checked')||{}).value||"weekly";
  const dayWrap = document.getElementById("wiz-day-wrap");
  const monWrap = document.getElementById("wiz-monthly-wrap");
  const dayLbl  = document.getElementById("wiz-day-label");
  if(dayWrap) dayWrap.style.display = sched==="monthly" ? "none" : "";
  if(monWrap) monWrap.style.display = sched==="monthly" ? "" : "none";
  if(dayLbl)  dayLbl.textContent = sched==="biweekly" ? "Day of Week (every other week)" : "Day of Week";
  wizardStep4UpdateLive();
}

function wizardStep4PopulateMonthlyDay(){
  const sel = document.getElementById("wiz-monthly-day");
  if(!sel || sel.options.length > 0) return;
  for(let i=1;i<=28;i++) sel.appendChild(new Option(i+(i===1?"st":i===2?"nd":i===3?"rd":"th"), String(i)));
  ["last-2","last-1","last"].forEach(v=>{
    const lbl = v==="last"?"Last day":v==="last-1"?"2nd to last":"3rd to last";
    sel.appendChild(new Option(lbl, v));
  });
  // restore saved value
  const saved = wizardState && wizardState.data && wizardState.data.allowMonthlyDay;
  if(saved) sel.value = String(saved);
}

function wizardToggleAllowDay(btn){
  document.querySelectorAll("#wiz-day-toggles .day-toggle").forEach(b=>b.classList.remove("selected"));
  btn.classList.add("selected");
}

function wizardStep4ToggleStructCols(){
  const struct = (document.querySelector('input[name="wiz-struct"]:checked')||{}).value || "both";
  const chkCol = document.getElementById("wiz-col-chk");
  const savCol = document.getElementById("wiz-col-sav");
  if(chkCol) chkCol.style.display = (struct === "savings") ? "none" : "";
  if(savCol) savCol.style.display = (struct === "checking") ? "none" : "";
}

function wizardStep4UpdateLive(){
  const calcEl = document.getElementById("wiz-live-calc");
  if(!calcEl) return;
  // Push form values into a temp child for the calc engine, without touching state.
  // We do a quick inline FV calc instead to keep this cheap and avoid mutating state.
  const struct = (document.querySelector('input[name="wiz-struct"]:checked')||{}).value || "both";
  const sched  = (document.querySelector('input[name="wiz-sched"]:checked')||{}).value  || "weekly";
  const chk    = readMoney("wiz-allow-chk")||0;
  const sav    = readMoney("wiz-allow-sav")||0;
  const rChk   = (parseFloat((document.getElementById("wiz-rate-chk")||{}).value)||0)/100/12;
  const rSav   = (parseFloat((document.getElementById("wiz-rate-sav")||{}).value)||0)/100/12;
  const rHigh  = Math.max(rChk, rSav);
  const cycles = {weekly:52, biweekly:26, monthly:12}[sched] || 0;
  const chkUse = (struct==="savings")  ? 0 : chk;
  const savUse = (struct==="checking") ? 0 : sav;
  const annualDeposited = (chkUse + savUse) * cycles;
  const perWeek = cycles ? (annualDeposited / 52) : 0;

  function fv(perCycle, n, rate){
    if(!perCycle || !n) return 0;
    let t = 0;
    for(let k=1; k<=n; k++){
      const monthsRem = Math.max(0, 12 - k*(12/n));
      t += perCycle * Math.pow(1+rate, monthsRem);
    }
    return t;
  }
  const staysPut = fv(chkUse, cycles, rChk) + fv(savUse, cycles, rSav);
  const gamesIt  = fv(chkUse + savUse, cycles, rHigh);

  calcEl.innerHTML = `
    <div class="wizard-calc-row"><span>Annual allowance deposited</span><strong>${fmt(annualDeposited)}</strong></div>
    <div class="wizard-calc-row"><span>Per-week equivalent</span><strong>${fmt(perWeek)}</strong></div>
    <div class="wizard-calc-row"><span>Max annual — stays put</span><strong>${fmt(staysPut)}</strong></div>
    <div class="wizard-calc-row wizard-calc-row-warn"><span>Max annual — games it (highest-yield)</span><strong>${fmt(gamesIt)}</strong></div>`;
}

function wizardRenderStep5(){
  const d = wizardState.data;
  return `
    <h3 class="wizard-step-title">Email Notifications</h3>
    <label class="field-label">Child email address</label>
    <input type="email" id="wiz-email" value="${(d.email||"").replace(/"/g,"&quot;")}" placeholder="optional">
    <label class="field-label" style="margin-top:12px;">Email on events?</label>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-notify-email-r" value="yes" ${d.notifyEmail===true?"checked":""}> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-notify-email-r" value="no"  ${d.notifyEmail===false?"checked":""}> No</label>
    </div>
    <label class="field-label" style="margin-top:12px;">Chore reward emails?</label>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-notify-rewards-r" value="yes" ${d.notifyChoreRewards===true?"checked":""}> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-notify-rewards-r" value="no"  ${d.notifyChoreRewards===false?"checked":""}> No</label>
    </div>
    <div class="wizard-helper">Monthly statements and event alerts go to this address.</div>`;
}

function wizardRenderStep6(){
  const d = wizardState.data;
  return `
    <h3 class="wizard-step-title">Google Calendar</h3>
    <div class="wizard-helper">Would you like to integrate chores into Google Calendar? Chores can sync as events with reminders; recurring schedules show up automatically.</div>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-cal" value="yes" ${d.useCalendar===true?"checked":""} onchange="document.getElementById('wiz-cal-row').style.display=''"> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-cal" value="no"  ${d.useCalendar===false?"checked":""} onchange="document.getElementById('wiz-cal-row').style.display='none'"> No</label>
    </div>
    <div id="wiz-cal-row" style="display:${d.useCalendar===true?"":"none"}">
      <label class="field-label">Calendar ID</label>
      <input type="text" id="wiz-cal-id" value="${(d.calendarId||"").replace(/"/g,"&quot;")}" placeholder="childname@group.calendar.google.com">
      <a class="btn btn-outline" href="docs/calendar-setup-guide.pdf" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-download-simple"/></svg> Download Setup Guide</a>
    </div>`;
}

// v34.2 — Step 7: Chores + inline streak review. Calendar reminder option only shown if
// calendar was configured in step 6. Streak bonus shown per-chore inline.
function wizardRenderStep7(){
  const d = wizardState.data;
  const hasCalendar = !!(d.useCalendar && d.calendarId);
  return `
    <h3 class="wizard-step-title">Chores</h3>
    <div class="wizard-helper">Add recurring chores for ${d.name||"this child"}. One-offs can be added later. Tap a chore to set streak bonuses inline.</div>
    ${!hasCalendar ? '<div class="info-box" style="margin-bottom:8px;font-size:.75rem;">Calendar reminders unavailable — no calendar was set up in Step 6.</div>' : ""}
    <div class="wizard-chore-list" id="wiz-chore-list"></div>
    <button class="btn btn-secondary" onclick="wizardAddChoreStart()"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-plus-circle"/></svg> Add Chore</button>
    <div class="wizard-chore-totals" id="wiz-chore-totals"></div>`;
}

// v34.2 — Step 8 = Celebration + Share Child
function wizardRenderStep8(){
  const d = wizardState.data;
  const childName = wizardState.childName || "";
  return `
    <h3 class="wizard-step-title">Celebration &amp; Sharing 🎉</h3>
    <div class="wizard-helper">When ${d.name||"your child"} completes a chore, a celebration plays. Milestones like savings goals and streak rewards also celebrate.</div>
    <label class="field-label">Celebration sound?</label>
    <div class="wizard-pill-group">
      <label class="wizard-pill"><input type="radio" name="wiz-cele" value="yes" ${d.celebrationSound===true?"checked":""}> Yes</label>
      <label class="wizard-pill"><input type="radio" name="wiz-cele" value="no"  ${d.celebrationSound===false?"checked":""}> No</label>
    </div>
    ${childName ? `
    <div class="reports-divider" style="margin-top:20px;">Share Child</div>
    <div class="wizard-helper">Share ${childName} with another parent account so they can also manage this child.</div>
    <button class="btn btn-outline" onclick="openShareChildSheet('${childName}')" style="margin-top:4px;"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-share-network"/></svg> Share ${childName}</button>` : ""}`;
}

function wizardStep8RenderStreaksList(){
  const listEl = document.getElementById("wiz-streaks-list");
  const emptyEl = document.getElementById("wiz-streaks-empty");
  if(!listEl) return;
  const name = wizardState.childName;
  const data = name ? getChildData(name) : {chores:[]};
  const chores = (data.chores||[]).filter(c => c.schedule && c.schedule !== "once");
  if(!chores.length){
    listEl.innerHTML = "";
    if(emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if(emptyEl) emptyEl.classList.add("hidden");
  listEl.innerHTML = chores.map(c => {
    const hasStreak = !!(c.streakMilestone && c.streakReward);
    const streakTxt = hasStreak
      ? `Every ${c.streakMilestone} in a row → +${fmt(c.streakReward)}`
      : `<span style="color:var(--muted);font-style:italic;">No streak bonus</span>`;
    return `
      <div class="wizard-chore-item">
        <div class="wiz-chore-main">
          <div class="wiz-chore-name">${c.name||""}</div>
          <div class="wiz-chore-meta">${streakTxt}</div>
        </div>
        <div class="wiz-chore-actions">
          <button class="btn btn-sm btn-outline" style="width:auto;margin:0;padding:6px 10px;" onclick="wizardEditChoreStart('${c.id}')">Edit</button>
        </div>
      </div>`;
  }).join("");
}

// v34.2 — Step 9 = Summary (was step 10)
function wizardRenderStep9(){
  return `
    <h3 class="wizard-step-title">Review & Confirm</h3>
    <div id="wiz-summary"></div>`;
}

function wizardRenderStep9_DELETED(){
  return `
    <h3 class="wizard-step-title">Review & Confirm</h3>
    <div id="wiz-summary"></div>`;
}

function wizardRenderSummary(){
  const wrap = document.getElementById("wiz-summary");
  if(!wrap) return;
  const d = wizardState.data;
  const name = wizardState.childName || d.name;
  const r = name ? calcMaxAnnualEarnings(name) : {allowance:0,chores:0,staysPut:0,gamesIt:0};
  const schedLabel = {weekly:"Weekly",biweekly:"Biweekly",monthly:"Monthly"}[d.schedule] || d.schedule;
  const choresArr = name ? (getChildData(name).chores||[]).filter(c=>c.schedule!=="once") : [];
  const streakCount = choresArr.filter(c => c.streakMilestone && c.streakReward).length;
  wrap.innerHTML = `
    <div class="wiz-summary-totals">
      <div class="wizard-calc-row"><span>Allowance / yr</span><strong>${fmt(r.allowance)}</strong></div>
      <div class="wizard-calc-row"><span>Chores / yr (max)</span><strong>${fmt(r.chores)}</strong></div>
      <div class="wizard-calc-row"><span>Stays put</span><strong>${fmt(r.staysPut)}</strong></div>
      <div class="wizard-calc-row wizard-calc-row-warn"><span>Games it</span><strong>${fmt(r.gamesIt)}</strong></div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Basic</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(1)">Edit</button></div>
      <div>Name: ${d.name||"—"} • PIN: ••••</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Tabs</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(2)">Edit</button></div>
      <div>${d.tabs.money?"Money ":""}${d.tabs.chores?"Chores ":""}${d.tabs.loans?"Loans":""}</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Allowance</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(3)">Edit</button></div>
      <div>${d.useAllowance ? (schedLabel+" • Chk "+fmt(d.allowChk)+" • Sav "+fmt(d.allowSav)+" • APR "+(d.rateChk||0)+"% / "+(d.rateSav||0)+"%") : "Disabled"}</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Email</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(5)">Edit</button></div>
      <div>${d.email||"(none)"} • ${d.notifyEmail?"events on":"events off"}</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Calendar</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(6)">Edit</button></div>
      <div>${d.useCalendar ? (d.calendarId||"(yes)") : "No"}</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Chores</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(7)">Edit</button></div>
      <div>${choresArr.length} recurring chore(s)</div>
    </div>
    <div class="wiz-summary-section">
      <div class="wiz-sum-head"><strong>Celebration</strong><button class="btn btn-sm btn-outline" style="width:auto;margin:0;" onclick="wizardJumpFromSummary(8)">Edit</button></div>
      <div>Celebration sound: ${d.celebrationSound?"on":"off"}</div>
    </div>`;
}

function wizardStep7RenderChoreList(){
  const listEl = document.getElementById("wiz-chore-list");
  const totalsEl = document.getElementById("wiz-chore-totals");
  if(!listEl || !totalsEl) return;
  const name = wizardState.childName;
  const data = name ? getChildData(name) : {chores:[]};
  const chores = (data.chores||[]).filter(c => c.schedule && c.schedule !== "once");
  if(!chores.length){
    listEl.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:10px 0;">No chores yet.</div>';
  } else {
    listEl.innerHTML = chores.map(c => {
      const occ =
        c.schedule === "daily"    ? 365 :
        c.schedule === "weekly"   ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length*52 : 52) :
        c.schedule === "biweekly" ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length*26 : 26) :
        c.schedule === "monthly"  ? 12 : 0;
      const annual = (parseFloat(c.amount)||0) * occ;
      const hasStreak = !!(c.streakMilestone && c.streakReward);
      const streakTxt = hasStreak
        ? `<span style="color:var(--secondary);font-size:.72rem;">⚡ Every ${c.streakMilestone} → +${fmt(c.streakReward)}</span>`
        : `<span style="color:var(--muted);font-size:.72rem;font-style:italic;">No streak bonus — Edit to add</span>`;
      return `
        <div class="wizard-chore-item">
          <div class="wiz-chore-main">
            <div class="wiz-chore-name">${c.name||""}</div>
            <div class="wiz-chore-meta">${({daily:"Daily",weekly:"Weekly",biweekly:"Biweekly",monthly:"Monthly"})[c.schedule]||c.schedule} • ${fmt(c.amount)} • max ${fmt(annual)}/yr</div>
            <div style="margin-top:2px;">${streakTxt}</div>
          </div>
          <div class="wiz-chore-actions">
            <button class="btn btn-sm btn-outline" style="width:auto;margin:0;padding:6px 10px;" onclick="wizardEditChoreStart('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-ghost" style="width:auto;margin:0;padding:6px 10px;color:var(--danger);" onclick="wizardDeleteChore('${c.id}')"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-trash"/></svg></button>
          </div>
        </div>`;
    }).join("");
  }
  // Totals card
  let totalAnnual = 0;
  chores.forEach(c => {
    const occ =
      c.schedule === "daily"    ? 365 :
      c.schedule === "weekly"   ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length*52 : 52) :
      c.schedule === "biweekly" ? ((c.weekdays && c.weekdays.length) ? c.weekdays.length*26 : 26) :
      c.schedule === "monthly"  ? 12 : 0;
    totalAnnual += (parseFloat(c.amount)||0) * occ;
  });
  totalsEl.innerHTML = chores.length ? `<div class="wizard-calc-row"><span>Max annual chore earnings</span><strong>${fmt(totalAnnual)}</strong></div>` : "";
}

function wizardAddChoreStart(){
  if(!wizardState || !wizardState.childName){ showToast("Finish Step 1 first.","error"); return; }
  // Reuse the main chore creator sheet with the activeChild temporarily set to
  // this wizard child, so createChore() targets the right data.
  activeChild = wizardState.childName;
  editingChoreId = null;
  try { resetChoreForm(); } catch(e){}
  // Hide the One-time option inside the wizard flow (recurring only)
  const schedSel = document.getElementById("chore-schedule");
  if(schedSel){
    schedSel.value = "weekly";
    const onceOpt = schedSel.querySelector('option[value="once"]');
    if(onceOpt){ onceOpt.dataset.wizardHidden="1"; onceOpt.style.display="none"; }
    try { onScheduleChange(); } catch(e){}
  }
  // v34.2 — hide reminder-time if wizard has no calendar configured
  const hasCalendar = !!(wizardState.data.useCalendar && wizardState.data.calendarId);
  const reminderRow = document.getElementById("chore-reminder-time")?.closest(".row,.section-block") ||
                      document.getElementById("chore-reminder-time")?.parentElement;
  if(reminderRow) reminderRow.style.display = hasCalendar ? "" : "none";
  // v34.2 — hide streak start-at field in wizard
  const streakStartRow = document.getElementById("chore-streak-start")?.closest(".row,.section-block") ||
                         document.getElementById("chore-streak-start")?.parentElement;
  if(streakStartRow) streakStartRow.style.display = "none";
  // v34.2 — hide reward $ and streak reward when choreRewards=false; show $0 hint when true
  const noRewards = wizardState.data.choreRewards === false;
  const amtRow = document.getElementById("chore-amount")?.closest(".row");
  if(amtRow) amtRow.style.display = noRewards ? "none" : "";
  const streakRewardRow = document.getElementById("chore-streak-reward")?.closest(".row,.section-block") ||
                          document.getElementById("chore-streak-reward")?.parentElement;
  if(streakRewardRow) streakRewardRow.style.display = noRewards ? "none" : "";
  // $0 hint
  const amtHint = document.getElementById("chore-amount-wiz-hint");
  if(!amtHint && !noRewards){
    const amtEl = document.getElementById("chore-amount");
    if(amtEl){ const h=document.createElement("div"); h.id="chore-amount-wiz-hint"; h.className="wizard-helper"; h.style.marginTop="-8px"; h.style.marginBottom="8px"; h.textContent="$0 is OK for unpaid chores."; amtEl.closest(".row")?.after(h); }
  }
  openSheet("sheet-chore-creator");
}

function wizardEditChoreStart(choreId){
  if(!wizardState || !wizardState.childName) return;
  activeChild = wizardState.childName;
  try { editChore(choreId); } catch(e){}
  // v34.2 — gate reminder-time visibility on calendar config
  const hasCalendar = !!(wizardState.data.useCalendar && wizardState.data.calendarId);
  const reminderRow = document.getElementById("chore-reminder-time")?.closest(".row,.section-block") ||
                      document.getElementById("chore-reminder-time")?.parentElement;
  if(reminderRow) reminderRow.style.display = hasCalendar ? "" : "none";
  const streakStartRow2 = document.getElementById("chore-streak-start")?.closest(".row,.section-block") ||
                          document.getElementById("chore-streak-start")?.parentElement;
  if(streakStartRow2) streakStartRow2.style.display = "none";
  const schedSel = document.getElementById("chore-schedule");
  if(schedSel){
    const onceOpt = schedSel.querySelector('option[value="once"]');
    if(onceOpt){ onceOpt.dataset.wizardHidden="1"; onceOpt.style.display="none"; }
  }
  openSheet("sheet-chore-creator");
}

function wizardDeleteChore(choreId){
  if(!wizardState || !wizardState.childName) return;
  const data = getChildData(wizardState.childName);
  openModal({
    icon:"🗑️", title:"Delete chore?", body:"This cannot be undone.",
    confirmText:"Delete", confirmClass:"btn-danger",
    onConfirm:()=>{
      data.chores = (data.chores||[]).filter(c => c.id !== choreId);
      syncToCloud("Chore Deleted (Wizard)");
      wizardStep7RenderChoreList();
    }
  });
}

// Hook: when the chore creator sheet closes, if we're in the wizard re-render the list
(function wireWizardChoreCreatorClose(){
  const origCreate = typeof createChore === "function" ? createChore : null;
  if(!origCreate) return;
  window.createChore = function(){
    const r = origCreate.apply(this, arguments);
    try {
      // v34.1 — chore editor is reachable from Step 7 (Chores) AND Step 8 (Streaks)
      if(wizardState && (wizardState.step === 7 || wizardState.step === 8)){
        // restore hidden once option so non-wizard flows still work
        const schedSel = document.getElementById("chore-schedule");
        if(schedSel){
          const onceOpt = schedSel.querySelector('option[value="once"]');
          if(onceOpt && onceOpt.dataset.wizardHidden){ onceOpt.style.display=""; delete onceOpt.dataset.wizardHidden; }
        }
        if(wizardState.step === 7) wizardStep7RenderChoreList();
        // v34.2 — step 8 is Celebration+Share, no streak list
      }
    } catch(e){}
    return r;
  };
})();


// ── Hook Guided Setup buttons into My Children list ───────────────
// v34.2 — wireGuidedSetupButton removed; Guided Setup is now in the Parent Settings sheet

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
// rendered wizard inputs (tagged in the wizardRenderStep4 template string).
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

// Re-install after wizard renders (wizard generates its own money inputs)
(function wireWizardMoneyInputs(){
  const orig = typeof wizardRender === "function" ? wizardRender : null;
  if(!orig) return;
  window.wizardRender = function(){
    const r = orig.apply(this, arguments);
    try { installMoneyInputs(document.getElementById("sheet-wizard")); } catch(e){}
    return r;
  };
})();

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
(function wireWizardPercentInputs(){
  const orig = typeof window.wizardRender === "function" ? window.wizardRender : null;
  if(!orig) return;
  const already = orig;
  window.wizardRender = function(){
    const r = already.apply(this, arguments);
    try { installPercentInputs(document.getElementById("sheet-wizard")); } catch(e){}
    return r;
  };
})();

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

// ════════════════════════════════════════════════════════════════════
// v37.0 — AUDIT LOG + CHILD LIFECYCLE
// ════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────
// appendAuditLog(action, target)
// ──────────────────────────────────────────────────────────────────
// Fire-and-forget POST to the _auditLogAppend interceptor in Code.gs.
// Called from the client for structural changes that MODIFY a family
// which continues to exist (child deactivate/delete/restore, parent
// add/remove, PIN reset, config changes, etc.). NOT called from Delete
// Family — that scrubs the log alongside the family.
//
// Shape server expects:
//   body._auditLogAppend = {parent, action, target}
//   body.familyId        = currentFamilyId   // required by doPost gate
//
// Dedicated fetch path (same pattern as deleteFamily). Does not go
// through _doSyncToCloud — the log write is a side-event, not a state
// sync, and coupling the two would mean every audit write also pushes
// the entire family state to the server.
//
// No await at call sites — the log write should never block UI. If
// the fetch fails, we log to console and move on. Audit completeness
// is best-effort; the user's action still happened.
function appendAuditLog(action, target){
  if(!currentFamilyId || !currentUser) return;
  const body = {
    _auditLogAppend: {
      parent: currentUser,
      action: String(action || ""),
      target: String(target || "")
    },
    familyId: currentFamilyId
  };
  try {
    fetch(API_URL, {
      method: "POST",
      mode:   "no-cors",
      body:   JSON.stringify(body)
    }).catch(err => {
      console.warn("[FamilyBank v37.0] appendAuditLog failed:", action, target, err);
    });
  } catch(err){
    console.warn("[FamilyBank v37.0] appendAuditLog threw:", action, target, err);
  }
}
window.appendAuditLog = appendAuditLog;

// ──────────────────────────────────────────────────────────────────
// _purgeChildFromState(name)
// ──────────────────────────────────────────────────────────────────
// v37.0 — Purges in-memory state only. Ledger rows tagged with this
// child's name remain in the sheet (visible to the Sheet owner, invisible
// to the app since the child is no longer in state.users). Server-side
// orphan row cleanup deferred to v37.1+ to avoid a Code.gs touch this
// session. Harmless: reports scan via getChildNames() which no longer
// includes the deleted child.
//
// KNOWN EDGE CASE (v37.1+ backlog): name collision. Deleting "Linnea"
// then creating a new child also named "Linnea" means the new child
// inherits the old child's ledger history. PDF export, YTD interest,
// and net worth history all roll up by child name. Rare in practice
// (same family, same name reuse) but worth a guard in a future pass.
//
// Child-specific scrub. Mirrors _purgeUserFromState but hits the
// child-only config slots (avatarPhotos, childSetupComplete,
// deactivatedChildren) too. Children ARE shared across parents via
// parentChildren, so the remove-from-every-parent's-list loop stays.
function _purgeChildFromState(name){
  if(!name || !state) return;
  if(state.users){
    const i = state.users.indexOf(name);
    if(i !== -1) state.users.splice(i, 1);
  }
  ["pins","roles","children","usersData","history"].forEach(k => {
    if(state[k] && state[k][name] !== undefined) delete state[k][name];
  });
  if(state.config){
    ["emails","avatars","avatarPhotos","calendars","tabs","notify"].forEach(k => {
      if(state.config[k] && state.config[k][name] !== undefined) delete state.config[k][name];
    });
    // v37.0 — new per-child config slot for wizard completion tracking
    if(state.config.childSetupComplete && state.config.childSetupComplete[name] !== undefined){
      delete state.config.childSetupComplete[name];
    }
    // Remove from every parent's assigned-children list
    if(state.config.parentChildren){
      Object.keys(state.config.parentChildren).forEach(p => {
        const list = state.config.parentChildren[p] || [];
        const idx = list.indexOf(name);
        if(idx !== -1) list.splice(idx, 1);
      });
    }
    // Clear from deactivated list in case we're hard-deleting a deactivated child
    if(Array.isArray(state.config.deactivatedChildren)){
      state.config.deactivatedChildren = state.config.deactivatedChildren.filter(x => x !== name);
    }
  }
  if(state.config && state.config.loginStats && state.config.loginStats[name]){
    delete state.config.loginStats[name];
  }
  // Remove local-only avatar photo
  try { localStorage.removeItem("fb_avatar_" + name); } catch(e){}
}
window._purgeChildFromState = _purgeChildFromState;

// ──────────────────────────────────────────────────────────────────
// deactivateChild(name)
// ──────────────────────────────────────────────────────────────────
// Soft-hide a child. Data preserved. Re-entry via restoreChild.
function deactivateChild(name){
  if(!name) return;
  if(!state.config.deactivatedChildren) state.config.deactivatedChildren = [];
  if(state.config.deactivatedChildren.indexOf(name) === -1){
    state.config.deactivatedChildren.push(name);
  }
  // If this was the active child, clear it so the next render doesn't try
  // to load a child that's now hidden from getAssignedChildren().
  if(activeChild === name){
    activeChild = null;
    try { sessionStorage.removeItem("fb_session_child"); } catch(e){}
  }
  appendAuditLog("Deactivate Child", name);
  syncToCloud("Child Deactivated");
  showToast('"' + name + '" deactivated. Restore anytime from the child picker.', "info", 4000);
  // Re-render surfaces that show child lists
  try { renderAdminUsers(); } catch(e){}
  try { showChildPicker(); } catch(e){}
}
window.deactivateChild = deactivateChild;

// ──────────────────────────────────────────────────────────────────
// restoreChild(name)
// ──────────────────────────────────────────────────────────────────
function restoreChild(name){
  if(!name) return;
  if(Array.isArray(state.config.deactivatedChildren)){
    state.config.deactivatedChildren = state.config.deactivatedChildren.filter(x => x !== name);
  }
  appendAuditLog("Restore Child", name);
  syncToCloud("Child Restored");
  showToast('"' + name + '" restored.', "success", 3500);
  try { showChildPicker(); } catch(e){}
  try { renderAdminUsers(); } catch(e){}
}
window.restoreChild = restoreChild;

// ──────────────────────────────────────────────────────────────────
// deleteChild(name) — hard delete, irreversible. Reauth-gated.
// ──────────────────────────────────────────────────────────────────
// Per v37.0 locked scope: invoked from the child profile page, not
// the Admin Panel. NOT available from the deactivated view — users
// must restore first, then delete from the profile. Two-step path
// is deliberate friction.
function deleteChild(name){
  if(!name) return;
  if(currentRole !== "parent"){
    showToast("Only a parent can delete a child.", "error", 4000);
    return;
  }
  const names = getChildNames();
  if(names.indexOf(name) === -1){
    showToast('"' + name + '" not found.', "error", 3500);
    return;
  }

  confirmReauth("Delete " + name + " permanently", () => {
    _purgeChildFromState(name);
    if(activeChild === name){
      activeChild = null;
      try { sessionStorage.removeItem("fb_session_child"); } catch(e){}
    }
    appendAuditLog("Delete Child", name);
    syncToCloud("Child Deleted");
    showToast('"' + name + '" permanently deleted.', "info", 4000);
    // Return to picker (or main if there's still one child left)
    try {
      document.getElementById("parent-panel")?.classList.add("hidden");
      document.getElementById("child-panel")?.classList.add("hidden");
      const remaining = getAssignedChildren();
      if(remaining.length === 1){
        selectChild(remaining[0]);
      } else if(remaining.length > 1){
        document.getElementById("main-screen")?.classList.add("hidden");
        showChildPicker();
      } else {
        // No children left — stay on main-screen with the parent panel,
        // label will show "—" via existing empty-assigned path on re-render.
        document.getElementById("main-screen")?.classList.remove("hidden");
        const ptb = document.getElementById("ptb-child-name");
        if(ptb) ptb.textContent = "—";
      }
    } catch(e){
      console.warn("[FamilyBank v37.0] deleteChild post-delete render failed:", e);
    }
  });
}
window.deleteChild = deleteChild;

// ──────────────────────────────────────────────────────────────────
// Child picker "Show deactivated" toggle — session-local UI state
// ──────────────────────────────────────────────────────────────────
// Intentionally NOT persisted (sessionStorage or state). Resets per
// session so deactivated kids don't keep leaking into view across
// reloads. The picker's re-render reads this flag and appends a
// deactivated section below the active list when true.
let showDeactivatedInPicker = false;
function toggleShowDeactivatedInPicker(){
  showDeactivatedInPicker = !showDeactivatedInPicker;
  try { showChildPicker(); } catch(e){}
}
window.toggleShowDeactivatedInPicker = toggleShowDeactivatedInPicker;

// ──────────────────────────────────────────────────────────────────
// v37.0 — AUDIT LOG VIEWER (STUB)
// ──────────────────────────────────────────────────────────────────
// Deferred to v37.1. appendAuditLog() above is fully wired and
// accumulates entries in the server-side AuditLog sheet. This viewer
// just reads them for display — low operational value, and requires
// either a Code.gs doGet handler (touches the sealed v37.0 Code.gs)
// or cross-origin POST-response reading (untested in this deployment).
//
// v37.1 decision: add a GET-based doGet handler path like
// ?action=auditLog&familyId=X&limit=50. Simpler than fighting CORS
// on POST and matches the existing checkCalendar GET pattern.
//
// Today: button in Parent Settings opens a sheet with an explainer.
function openAuditLogViewer(){
  const sheet = document.getElementById("audit-log-sheet");
  if(!sheet){
    // Markup not yet in place — fall back to modal so the button still works.
    openModal({
      icon: "📜",
      title: "Activity Log",
      body: "Activity log viewer is coming in v37.1. Audit events are being recorded correctly — you can view them directly in the AuditLog tab of the Google Sheet in the meantime.",
      confirmText: "OK",
      hideCancel: true
    });
    return;
  }
  openSheet("audit-log-sheet");
}
window.openAuditLogViewer = openAuditLogViewer;


// v34.2 — Parent Settings sheet
function openParentSettingsSheet(){
  // Populate email
  const emailEl = document.getElementById("ps-email-input");
  const msgEl   = document.getElementById("ps-email-msg");
  if(emailEl && currentUser) emailEl.value = (state.config.emails && state.config.emails[currentUser]) || "";
  if(msgEl) { msgEl.className="field-msg"; msgEl.textContent=""; }
  // Render children list (mirrors renderMyChildren but targets ps-specific container)
  renderMyChildrenInSheet("my-children-list-ps");
  // v37.0 — Hide primary-only buttons (Transfer Primary, Delete Family)
  // from non-primary parents. Scoped to this sheet so it doesn't affect
  // other surfaces that reuse the same JS hooks.
  try {
    const sheet = document.getElementById("sheet-parent-settings");
    const isPrim = isPrimaryParent(currentUser);
    if(sheet){
      sheet.querySelectorAll("[data-primary-only]").forEach(btn => {
        btn.classList.toggle("hidden", !isPrim);
      });
    }
  } catch(e){}
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
        <span style="font-weight:700;">${name}</span>
        <div class="child-btn-balance" style="font-size:.72rem;">${shared?"Shared":"Only on your account"}</div>
      </div>
      <button class="btn btn-sm btn-outline child-btn-wizard" onclick="startWizardForExistingChild('${name}');closeSheet('sheet-parent-settings',true);" title="Edit with Wizard">🪄</button>
      <button class="btn btn-sm btn-outline" style="width:auto;margin:0;padding:6px 10px;" onclick="openShareChildSheet('${name}')">Share</button>
      <button class="btn btn-sm btn-ghost" style="width:auto;margin:0;padding:6px 10px;color:var(--danger);" onclick="confirmRemoveChild('${name}')"><svg class="icon" aria-hidden="true"><use href="vendor/phosphor-sprite.svg#ph-trash"/></svg></button>
    </div>`;
  }).join("");
}

function saveParentEmailFromSheet(){
  const input = document.getElementById("ps-email-input");
  const msg   = document.getElementById("ps-email-msg");
  if(!input || !currentUser || currentRole !== "parent") return;
  const val = input.value.trim();
  if(val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){
    if(msg){ msg.className="field-msg error"; msg.textContent="Please enter a valid email."; }
    return;
  }
  if(!state.config.emails) state.config.emails = {};
  if(val) state.config.emails[currentUser] = val;
  else    delete state.config.emails[currentUser];
  syncToCloud("Parent Email Updated");
  if(msg){ msg.className="field-msg success"; msg.textContent = val ? "Email saved." : "Email cleared."; }
  showToast(val ? "Your email was saved." : "Your email was cleared.","success");
}
function openDeleteMyAccount(){
  if(!currentUser){ return; }
  // v37.0 — Block primary-parent self-delete. Primary must transfer the
  // role to another parent before deleting their own account. Without
  // this, a primary's self-delete would leave the family with no primary,
  // breaking Delete Family visibility (render-gated on primaryParent)
  // and the wizard's primary-completion invariant.
  if(isPrimaryParent(currentUser)){
    openModal({
      icon: "⚠️",
      title: "Transfer primary first",
      body: "You're the primary parent of this family. Transfer the primary role to another parent before deleting your own account. (Parent Settings → Transfer Primary.)",
      confirmText: "OK",
      hideCancel: true
    });
    return;
  }
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
      // v37.0 — audit trail before the sync. Note the log row lands in
      // AuditLog keyed to this familyId; the self-delete doesn't remove
      // the family row so the log entry persists.
      appendAuditLog("Delete Own Account", currentUser);
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
      // v37.0 — familyId required for all backend reads
      "&familyId="  + encodeURIComponent(currentFamilyId || "") +
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
      // v37.0 — familyId required for all backend reads
      "&familyId=" + encodeURIComponent(currentFamilyId || "") +
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
  // Trigger a server-side rebuild by submitting an edit with _editedChoreId
  state._editedChoreId = chore.id;
  syncToCloud("Chore Edited (calendar re-add)");
  delete state._editedChoreId;
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
  // v35.0 — EXCEPTION: sheet-wizard uses its own in-wizard Back button
  // (user requested system back NOT interfere with wizard navigation).
  const NO_STACK = {"sheet-wizard": true};
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
