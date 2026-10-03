const KEY = "dailyHealthTracker.v1";

const defaultState = {
  exercise: {},       // YYYY-MM-DD -> upper | lower | cardio
  medicines: [],      // {id,name,dosage}
  medicineTaken: [],  // {id,date,time,medicineId,medicineName,dosage}
  medicineReminders: {},
  reminderLastFired: {}
};

let state = loadState();
let currentPage = "dashboard";
let hideMedicines = false;
let exerciseMonth = new Date();
let medicineMonth = new Date();

const $ = (s) => document.querySelector(s);
const app = $("#app");

const PUSH_CONFIG = window.PUSH_CONFIG || {};
const PUSH_CLIENT_KEY = "dailyHealthTracker.pushClientId.v1";
function getPushClientId(){
  let id = localStorage.getItem(PUSH_CLIENT_KEY);
  if(!id){
    id = (crypto.randomUUID ? crypto.randomUUID() : uid());
    localStorage.setItem(PUSH_CLIENT_KEY, id);
  }
  return id;
}
function pushConfigured(){
  return !!(PUSH_CONFIG.apiBase && PUSH_CONFIG.vapidPublicKey &&
    !PUSH_CONFIG.apiBase.includes("YOUR-WORKER") &&
    !PUSH_CONFIG.vapidPublicKey.includes("PASTE_YOUR"));
}
function getPushTimezone(){
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";}catch{return "UTC";}
}
function base64UrlToUint8Array(base64UrlString){
  const padding = "=".repeat((4 - base64UrlString.length % 4) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
async function getServiceWorkerRegistration(){
  if(!("serviceWorker" in navigator)) throw new Error("Service workers are not supported");
  return await navigator.serviceWorker.ready;
}
async function ensureWebPushSubscription(){
  if(!pushConfigured()) throw new Error("Push backend is not configured yet");
  if(!("PushManager" in window) || !("Notification" in window)) throw new Error("Web Push is not supported here");
  if(Notification.permission === "denied") throw new Error("Notifications are blocked in iPhone settings");
  if(Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if(permission !== "granted") throw new Error("Notification permission was not granted");
  }
  const reg = await getServiceWorkerRegistration();
  let sub = await reg.pushManager.getSubscription();
  if(!sub){
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(PUSH_CONFIG.vapidPublicKey)
    });
  }
  const response = await fetch(PUSH_CONFIG.apiBase.replace(/\/$/, "") + "/api/subscribe", {
    method:"POST",
    headers:{"content-type":"application/json","x-client-token":getPushClientId()},
    body:JSON.stringify({subscription:sub.toJSON()})
  });
  if(!response.ok) throw new Error("Could not register this device for push notifications");
  return sub;
}
function buildPushReminders(){
  const reminders=[];
  const timezone=getPushTimezone();
  for(const m of state.medicines){
    const r=getReminderSettings(m.id);
    for(const time of (r.times||[])){
      reminders.push({
        id:`${m.id}_${String(time).replace(":","")}`,
        time,
        timezone,
        enabled:!!r.enabled,
        message:(r.message||"Monster needs med").trim().slice(0,120) || "Monster needs med"
      });
    }
  }
  return reminders;
}
async function syncWebPushReminders(){
  if(!pushConfigured()) return false;
  const reminders=buildPushReminders();
  const response=await fetch(PUSH_CONFIG.apiBase.replace(/\/$/, "") + "/api/reminders/sync", {
    method:"POST",
    headers:{"content-type":"application/json","x-client-token":getPushClientId()},
    body:JSON.stringify({reminders})
  });
  if(!response.ok) throw new Error("Could not sync reminders with push server");
  return true;
}
async function unregisterPushClient(){
  if(!pushConfigured()) return;
  try{await fetch(PUSH_CONFIG.apiBase.replace(/\/$/, "") + "/api/client",{method:"DELETE",headers:{"x-client-token":getPushClientId()}});}catch{}
}
function pushStatusText(){
  if(!pushConfigured()) return "Web Push setup is not connected yet. The app can still save reminders locally, but closed-app notifications are not active.";
  if("Notification" in window && Notification.permission==="denied") return "Notifications are blocked. Enable them in iPhone Settings to receive reminders.";
  return "Web Push is ready for this device. The server can send reminders even when the app is not open.";
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
    ...structuredClone(defaultState),
    ...parsed,
    medicineReminders: parsed.medicineReminders || {},
    reminderLastFired: parsed.reminderLastFired || {}
  };
  } catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function isoDate(d) {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function prettyDate(dateStr) {
  return new Date(dateStr+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthName(d) { return d.toLocaleDateString(undefined,{month:"long",year:"numeric"}); }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t=document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>t.classList.remove("show"),1800);
}
function openModal(html) { $("#modal").innerHTML=html; $("#modalBackdrop").classList.remove("hidden"); }
function closeModal() { $("#modalBackdrop").classList.add("hidden"); $("#modal").innerHTML=""; }

function setPage(page) {
  currentPage=page;
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Dashboard",exercise:"Exercise",medicine:"Medicine",records:"Monthly Records",backup:"Backup / Import",clear:"Clear Data"};
  $("#pageTitle").textContent=titles[page]||"Dashboard";
  closeSidebar();
  render();
}
function closeSidebar() { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("show"); }

function render() {
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
  const views={dashboard:renderDashboard,exercise:renderExercise,medicine:renderMedicine,records:renderRecords,backup:renderBackup,clear:renderClear};
  app.innerHTML=views[currentPage]();
  bindDynamic();
}

function exerciseCounts(d=new Date()) {
  const prefix=monthKey(d), vals=Object.entries(state.exercise).filter(([date,v])=>date.startsWith(prefix)).map(x=>x[1]);
  return { total:vals.length, upper:vals.filter(x=>x==="upper").length, lower:vals.filter(x=>x==="lower").length, cardio:vals.filter(x=>x==="cardio").length };
}
function medicineMonthRecords(d=new Date()) {
  const prefix=monthKey(d);
  return state.medicineTaken.filter(r=>r.date.startsWith(prefix));
}

function renderDashboard() {
  const today=isoDate(new Date());
  const workout=state.exercise[today];
  const doses=state.medicineTaken.filter(r=>r.date===today);
  const counts=exerciseCounts();
  const monthDoses=medicineMonthRecords().length;
  return `<div class="page">
    <section class="hero">
      <h2>Stay consistent. Keep it simple.</h2>
      <p>Tap your workout. Record your medicine. Your progress is saved automatically on this device.</p>
    </section>
    <div class="grid stats-grid" style="margin-bottom:18px">
      <div class="card stat-card"><div class="stat-top">This month <span>⚡</span></div><div class="stat-number neon-cyan">${counts.total}</div><div class="muted small">workout days</div></div>
      <div class="card stat-card"><div class="stat-top">Upper body <span>◉</span></div><div class="stat-number neon-cyan">${counts.upper}</div><div class="muted small">days</div></div>
      <div class="card stat-card"><div class="stat-top">Cardio <span>↗</span></div><div class="stat-number neon-moss">${counts.cardio}</div><div class="muted small">days</div></div>
      <div class="card stat-card"><div class="stat-top">Medicine <span>✚</span></div><div class="stat-number neon-pink">${monthDoses}</div><div class="muted small">records this month</div></div>
    </div>
    <div class="grid two-col">
      <section class="card">
        <div class="section-head"><h3>Today</h3><span class="muted small">${prettyDate(today)}</span></div>
        <div class="today-list">
          <div class="today-row">
            <div class="left"><span class="dot ${workout==="upper"?"cyan":workout==="lower"?"saffron":workout==="cardio"?"moss":""}" style="${workout?"":"background:#526176"}"></span><div><strong>Exercise</strong><div class="muted small">${workout ? labelExercise(workout) : "No workout recorded"}</div></div></div>
            <button class="btn btn-primary" data-action="exercise-today">${workout ? "Change" : "Record"}</button>
          </div>
          <div class="today-row">
            <div class="left"><span class="dot pink"></span><div><strong>Medicine</strong><div class="muted small">${doses.length ? `${doses.length} dose${doses.length===1?"":"s"} recorded` : "Nothing recorded yet"}</div></div></div>
            <button class="btn btn-pink" data-action="medicine-today">Open</button>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="section-head"><h3>Color guide</h3></div>
        <div class="legend" style="margin-top:0">
          ${legendItem("cyan","Upper Body")}
          ${legendItem("saffron","Lower Body")}
          ${legendItem("moss","Jogging / Cardio")}
          ${legendItem("","Day Off / No workout")}
        </div>
      </section>
    </div>
  </div>`;
}
function legendItem(c,text) { return `<div class="legend-item"><span class="legend-swatch" style="background:${c==="cyan"?"var(--cyan)":c==="saffron"?"var(--saffron)":c==="moss"?"var(--moss)":"#526176"}"></span>${text}</div>`; }
function labelExercise(v) { return ({upper:"Upper Body",lower:"Lower Body",cardio:"Jogging / Cardio"})[v] || "Day Off"; }

function calendarHtml(d, type) {
  const year=d.getFullYear(), month=d.getMonth(), first=new Date(year,month,1), days=new Date(year,month+1,0).getDate();
  const offset=first.getDay(), today=isoDate(new Date());
  let cells="";
  for(let i=0;i<offset;i++) cells+=`<div class="day empty"></div>`;
  for(let day=1;day<=days;day++){
    const date=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if(type==="exercise"){
      const v=state.exercise[date];
      const cls=v?`completed-${v==="upper"?"cyan":v==="lower"?"saffron":"moss"}`:"";
      cells+=`<button class="day ${cls} ${date===today?"today":""}" data-date="${date}" data-action="exercise-date"><span class="day-num">${day}</span>${v?`<span class="day-label">${labelExercise(v)}</span>`:""}</button>`;
    } else {
      const count=state.medicineTaken.filter(r=>r.date===date).length;
      cells+=`<button class="day ${date===today?"today":""}" data-date="${date}" data-action="medicine-date"><span class="day-num">${day}</span>${count?`<span class="medicine-count">${count}</span>`:""}</button>`;
    }
  }
  return `<div class="weekdays"><div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div></div><div class="calendar-grid">${cells}</div>`;
}

function renderExercise() {
  const c=exerciseCounts(exerciseMonth);
  return `<div class="page">
    <div class="section-head"><div><h2 style="margin:0">Exercise Tracker</h2><div class="muted small">Tap a date and choose the workout type.</div></div></div>
    <div class="grid two-col">
      <section class="card calendar-card">
        <div class="calendar-nav"><button class="month-arrow" data-action="exercise-prev">‹</button><div class="month-title">${monthName(exerciseMonth)}</div><button class="month-arrow" data-action="exercise-next">›</button></div>
        ${calendarHtml(exerciseMonth,"exercise")}
        <div class="legend">${legendItem("cyan","Upper Body")}${legendItem("saffron","Lower Body")}${legendItem("moss","Jogging / Cardio")}${legendItem("","Day Off")}</div>
      </section>
      <section class="card">
        <div class="section-head"><h3>${monthName(exerciseMonth)} Summary</h3></div>
        <div class="grid" style="gap:9px">
          <div class="today-row"><strong>Total Workout</strong><span class="pill pill-cyan">${c.total} days</span></div>
          <div class="today-row"><strong>Upper Body</strong><span class="pill pill-cyan">${c.upper}</span></div>
          <div class="today-row"><strong>Lower Body</strong><span class="pill pill-saffron">${c.lower}</span></div>
          <div class="today-row"><strong>Jogging / Cardio</strong><span class="pill pill-moss">${c.cardio}</span></div>
          <div class="today-row"><strong>Day Off</strong><span class="pill">${new Date(exerciseMonth.getFullYear(),exerciseMonth.getMonth()+1,0).getDate()-c.total}</span></div>
        </div>
        <div style="margin-top:15px"><button class="btn btn-primary btn-block" data-action="export-exercise">Export Exercise Excel/CSV</button></div>
      </section>
    </div>
  </div>`;
}

function renderMedicine() {
  return `<div class="page">
    <div class="section-head"><div><h2 style="margin:0">Medicine Tracker</h2><div class="muted small">Tap a date to record one or more doses.</div></div><button class="btn btn-pink" data-action="add-medicine">＋ Add Medicine</button></div>
    <div class="grid two-col" style="margin-bottom:16px">
      <section class="card calendar-card">
        <div class="calendar-nav"><button class="month-arrow" data-action="medicine-prev">‹</button><div class="month-title">${monthName(medicineMonth)}</div><button class="month-arrow" data-action="medicine-next">›</button></div>
        ${calendarHtml(medicineMonth,"medicine")}
      </section>
      <section class="card">
        <div class="section-head">
          <div>
            <h3>My Medicines</h3>
            <span class="muted small">${state.medicines.length} added</span>
          </div>
          <button class="privacy-toggle ${hideMedicines ? "is-hidden" : ""}" data-action="toggle-medicines" title="${hideMedicines ? "Show medicines" : "Hide medicines"}">${hideMedicines ? "◉ Show" : "◌ Hide"}</button>
        </div>
        <div class="medicine-list">
          ${state.medicines.length ? (hideMedicines
            ? `<div class="privacy-hidden-card"><div class="privacy-icon">◉</div><strong>Medicines hidden</strong><span>Names and dosages are concealed for privacy.</span><button class="btn btn-pink" data-action="toggle-medicines">Show Medicines</button></div>`
            : state.medicines.map(m=>`<div class="med-item"><div><div class="med-name">${escapeHtml(m.name)}</div><div class="med-dose">${escapeHtml(m.dosage||"No dosage entered")}</div></div><div class="med-actions"><button class="btn btn-primary" data-action="reminder-settings" data-id="${m.id}">⏰</button><button class="btn" data-action="edit-medicine" data-id="${m.id}">Edit</button><button class="btn btn-danger" data-action="delete-medicine" data-id="${m.id}">Delete</button></div></div>`).join(""))
            : `<div class="empty-state">No medicines added yet.<br><br>Tap <b>＋ Add Medicine</b> to begin.</div>`}
        </div>
      </section>
    </div>
    <section class="card">
      <div class="section-head"><h3>${monthName(medicineMonth)} Medicine Records</h3><button class="btn btn-primary" data-action="export-medicine">Export Medicine Excel/CSV</button></div>
      ${renderMedicineRows(medicineMonth)}
    </section>
  </div>`;
}
function renderMedicineRows(d) {
  const rows=medicineMonthRecords(d).slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  if(!rows.length) return `<div class="empty-state">No medicine records for this month.</div>`;
  return `<div class="medicine-records-scroll"><table class="records-table"><thead><tr><th>Date</th><th>Time</th><th>Medicine</th><th>Dosage</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${prettyDate(r.date)}</td><td class="taken-time">${escapeHtml(formatTime(r.time))}</td><td>${escapeHtml(r.medicineName)}</td><td class="muted">${escapeHtml(r.dosage||"")}</td><td><button class="btn btn-danger" data-action="delete-dose" data-id="${r.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>`;
}
function formatTime(t) {
  if(!t) return "";
  const [h,m]=t.split(":").map(Number);
  const d=new Date(); d.setHours(h,m);
  return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
}

function renderRecords() {
  const months=[...new Set([...Object.keys(state.exercise),...state.medicineTaken.map(r=>r.date)].map(x=>x.slice(0,7)))].sort().reverse();
  const data=months.length?months.map(k=>{
    const [y,m]=k.split("-").map(Number), d=new Date(y,m-1,1), c=exerciseCounts(d), meds=medicineMonthRecords(d).length;
    return {k,d,c,meds};
  }):[];
  return `<div class="page">
    <div class="section-head"><div><h2 style="margin:0">Monthly Records</h2><div class="muted small">Simple history of your exercise and medicine activity.</div></div></div>
    ${data.length?`<div class="grid">${data.map(x=>`<section class="card">
      <div class="section-head"><h3>${monthName(x.d)}</h3><span class="pill pill-pink">${x.meds} medicine records</span></div>
      <div class="grid stats-grid">
        <div class="today-row"><span>Workout</span><strong class="neon-cyan">${x.c.total}</strong></div>
        <div class="today-row"><span>Upper</span><strong class="neon-cyan">${x.c.upper}</strong></div>
        <div class="today-row"><span>Lower</span><strong class="neon-saffron">${x.c.lower}</strong></div>
        <div class="today-row"><span>Cardio</span><strong class="neon-moss">${x.c.cardio}</strong></div>
      </div>
    </section>`).join("")}</div>`:`<div class="card empty-state">Your monthly history will appear here after you record activity.</div>`}
  </div>`;
}

function renderBackup() {
  return `<div class="page">
    <section class="hero"><h2>Backup & Data</h2><p>Use a JSON backup to move or restore everything: exercise records, medicines, and medicine history.</p></section>
    <div class="grid">
      <section class="card action-card"><div><h3>💾 Export Backup</h3><p>Save a complete copy of your tracker data as a JSON file.</p></div><button class="btn btn-primary" data-action="export-backup">Export Backup</button></section>
      <section class="card action-card"><div><h3>↥ Import Backup</h3><p>Restore a previously exported JSON backup. Your current data will be replaced.</p></div><button class="btn btn-primary" data-action="import-backup">Import Backup</button></section>
      <section class="card action-card danger-card"><div><h3>⌫ Clear All Data</h3><p>Delete exercise records, medicine records, and your medicine list.</p></div><button class="btn btn-danger" data-action="clear-confirm">Clear Data</button></section>
      <div class="notice">Tip: Keep your JSON backup somewhere safe before clearing data or changing devices.</div>
    </div>
  </div>`;
}
function renderClear() {
  return `<div class="page"><section class="card danger-card"><h2 style="margin-top:0">Clear Data</h2><p class="muted">This permanently removes all locally saved tracker data from this browser.</p><button class="btn btn-danger" data-action="clear-confirm">Clear Everything</button></section></div>`;
}

function openExercisePicker(date) {
  const current=state.exercise[date];
  openModal(`<h3>${prettyDate(date)}</h3><div class="modal-sub">${current ? `Current: ${labelExercise(current)}` : "What did you do?"}</div>
    <div class="option-grid">
      <button class="option-btn cyan" data-modal-action="set-exercise" data-date="${date}" data-value="upper">● Upper Body</button>
      <button class="option-btn saffron" data-modal-action="set-exercise" data-date="${date}" data-value="lower">● Lower Body</button>
      <button class="option-btn moss" data-modal-action="set-exercise" data-date="${date}" data-value="cardio">● Jogging / Cardio</button>
      <button class="option-btn off" data-modal-action="set-exercise" data-date="${date}" data-value="off">○ Day Off / No Workout</button>
    </div>
    <button class="btn modal-close" data-modal-action="close">Cancel</button>`);
}

function openMedicineDate(date) {
  const rows=state.medicineTaken.filter(r=>r.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  openModal(`<h3>${prettyDate(date)}</h3><div class="modal-sub">${rows.length ? `${rows.length} medicine record${rows.length===1?"":"s"}` : "No medicine recorded yet."}</div>
    ${rows.length?`<div class="taken-list">${rows.map(r=>`<div class="taken-row"><div class="taken-time">${escapeHtml(formatTime(r.time))}</div><div><strong>${escapeHtml(r.medicineName)}</strong><div class="muted small">${escapeHtml(r.dosage||"")}</div></div><button class="btn btn-danger delete-dose" data-modal-action="delete-dose" data-id="${r.id}" data-date="${date}">Remove</button></div>`).join("")}</div>`:""}
    <div style="margin-top:15px"><button class="btn btn-pink btn-block" data-modal-action="record-dose" data-date="${date}">＋ Record Medicine</button></div>
    <button class="btn modal-close" data-modal-action="close">Done</button>`);
}


function getReminderSettings(medicineId){
  return state.medicineReminders[medicineId]||{enabled:false,times:[],message:"Monster needs med"};
}
async function requestNotificationPermission(){
  if(!("Notification" in window)){toast("Notifications are not supported by this browser");return false;}
  if(Notification.permission==="granted")return true;
  if(Notification.permission==="denied"){toast("Notifications are blocked in browser settings");return false;}
  try{return (await Notification.requestPermission())==="granted";}catch{return false;}
}
function openReminderSettings(id){
  const med=state.medicines.find(m=>m.id===id); if(!med)return;
  const r=getReminderSettings(id);
  openModal(`<h3>⏰ Medicine Reminder</h3>
  <div class="modal-sub">The notification uses a private message and does not show the medicine name.</div>
  <form id="reminderForm">
  <div class="field"><label>Private notification message</label><input id="reminderMessage" maxlength="80" value="${escapeHtml(r.message||"Monster needs med")}" required></div>
  <div class="field" style="margin-top:12px"><label>Reminder times</label><div id="reminderTimes" class="reminder-time-list">
  ${(r.times||[]).map((t,i)=>`<div class="reminder-time-row"><input class="reminder-time" type="time" value="${escapeHtml(t)}"><button type="button" class="btn btn-danger remove-reminder-time">Remove</button></div>`).join("")}
  </div><button type="button" class="btn btn-primary btn-block" style="margin-top:8px" id="addReminderTime">＋ Add Reminder Time</button></div>
  <label class="switch-row"><input id="remindersEnabled" type="checkbox" ${r.enabled?"checked":""}><span>Enable reminders</span></label>
  <div class="notice" style="margin-top:12px">On iPhone, add this site to the Home Screen and allow notifications when iOS asks.</div><div class="notice" style="margin-top:8px">${escapeHtml(pushStatusText())}</div>
  <div class="form-actions"><button type="button" class="btn" data-modal-action="close">Cancel</button><button class="btn btn-pink" type="submit">Save Reminders</button></div>
  </form>`);
  const box=$("#reminderTimes");
  $("#addReminderTime").addEventListener("click",()=>{
    const row=document.createElement("div"); row.className="reminder-time-row";
    row.innerHTML=`<input class="reminder-time" type="time" value="08:00"><button type="button" class="btn btn-danger remove-reminder-time">Remove</button>`;
    box.appendChild(row); row.querySelector("button").addEventListener("click",()=>row.remove());
  });
  box.querySelectorAll(".remove-reminder-time").forEach(b=>b.addEventListener("click",()=>b.parentElement.remove()));
  $("#reminderForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const times=[...document.querySelectorAll("#reminderTimes .reminder-time")].map(x=>x.value).filter(Boolean).sort();
    state.medicineReminders[id]={enabled:$("#remindersEnabled").checked,times,message:$("#reminderMessage").value.trim()||"Monster needs med"};
    saveState();
    try{
      if(state.medicineReminders[id].enabled){
        await ensureWebPushSubscription();
      }
      await syncWebPushReminders();
      closeModal(); render(); toast(state.medicineReminders[id].enabled ? "Web Push reminder saved" : "Reminder disabled");
    }catch(err){
      closeModal(); render();
      toast(err?.message || "Push setup needs attention");
    }
  });
}
function checkMedicineReminders(){
  // Local fallback only. When Web Push is configured, the server is responsible for delivery.
  if(pushConfigured()) return;
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  const now=new Date(), hhmm=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`, date=isoDate(now);
  let changed=false;
  state.medicines.forEach(m=>{
    const r=getReminderSettings(m.id); if(!r.enabled||!r.times.includes(hhmm))return;
    const guard=`${date}|${hhmm}|${m.id}`; if(state.reminderLastFired[guard])return;
    state.reminderLastFired[guard]=true; changed=true;
    try{new Notification(r.message||"Monster needs med",{body:"Open Daily Tracker to record it.",tag:`medicine-${m.id}-${hhmm}`,renotify:true});}catch{}
  });
  if(changed){const keys=Object.keys(state.reminderLastFired).sort().slice(-200);state.reminderLastFired=Object.fromEntries(keys.map(k=>[k,true]));saveState();}
}
setInterval(checkMedicineReminders,15000);
setTimeout(checkMedicineReminders,1200);

function openMedicineForm(id=null) {
  const med=id ? state.medicines.find(m=>m.id===id) : null;
  openModal(`<h3>${med?"Edit":"Add"} Medicine</h3><div class="modal-sub">Keep the name clear so it is easy to pick on a phone.</div>
    <form id="medicineForm">
      <div class="field"><label>Medicine name</label><input id="medName" required maxlength="80" value="${escapeHtml(med?.name||"")}" placeholder="e.g. Medicine A"></div>
      <div class="field" style="margin-top:12px"><label>Dosage (optional)</label><input id="medDosage" maxlength="60" value="${escapeHtml(med?.dosage||"")}" placeholder="e.g. 500 mg / 1 tablet"></div>
      <div class="form-actions"><button type="button" class="btn" data-modal-action="close">Cancel</button><button class="btn btn-pink" type="submit">${med?"Save Changes":"Add Medicine"}</button></div>
    </form>`);
  $("#medicineForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name=$("#medName").value.trim(), dosage=$("#medDosage").value.trim();
    if(!name) return;
    if(med){ med.name=name; med.dosage=dosage; state.medicineTaken.forEach(r=>{if(r.medicineId===med.id){r.medicineName=name;r.dosage=dosage;}}); }
    else state.medicines.push({id:uid(),name,dosage});
    saveState(); closeModal(); renderMedicinePage(); toast(med?"Medicine updated":"Medicine added");
  });
}

function openDoseForm(date) {
  if(!state.medicines.length) { closeModal(); openMedicineForm(); toast("Add a medicine first"); return; }
  const now=new Date(), time=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  openModal(`<h3>Record Medicine</h3><div class="modal-sub">${prettyDate(date)}</div>
    <form id="doseForm">
      <div class="field"><label>Medicine</label><select id="doseMed">${state.medicines.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}${m.dosage?` — ${escapeHtml(m.dosage)}`:""}</option>`).join("")}</select></div>
      <div class="field" style="margin-top:12px"><label>Time taken</label><input id="doseTime" type="time" value="${time}" required></div>
      <div class="form-actions"><button type="button" class="btn" data-modal-action="close">Cancel</button><button class="btn btn-pink" type="submit">✓ Medicine Taken</button></div>
    </form>`);
  $("#doseForm").addEventListener("submit",e=>{
    e.preventDefault();
    const med=state.medicines.find(m=>m.id===$("#doseMed").value), t=$("#doseTime").value;
    if(!med||!t)return;
    state.medicineTaken.push({id:uid(),date,time:t,medicineId:med.id,medicineName:med.name,dosage:med.dosage||""});
    saveState(); openMedicineDate(date); render(); toast("Medicine recorded");
  });
}

function renderMedicinePage(){ currentPage="medicine"; $("#pageTitle").textContent="Medicine"; render(); }

function exportCSV(filename, headers, rows) {
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=[headers,...rows].map(r=>r.map(esc).join(",")).join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  downloadBlob(blob,filename);
}
function downloadBlob(blob,name) {
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function exportExercise() {
  const rows=Object.entries(state.exercise).sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>[date,labelExercise(v)]);
  const summaries=[["MONTHLY SUMMARY","","","",""],["Month","Workout Days","Upper Body","Lower Body","Jogging / Cardio"]];
  const months=[...new Set(rows.map(r=>r[0].slice(0,7)))];
  months.forEach(k=>{const [y,m]=k.split("-").map(Number),d=new Date(y,m-1,1),c=exerciseCounts(d);summaries.push([monthName(d),c.total,c.upper,c.lower,c.cardio]);});
  exportCSV("exercise-records.csv",["Date","Workout","Upper Body","Lower Body","Jogging / Cardio"],rows.map(r=>[r[0],r[1],"","",""]).concat(summaries.slice(1)));
  toast("Exercise CSV exported");
}
function exportMedicine() {
  const rows=state.medicineTaken.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(r=>[r.date,formatTime(r.time),r.medicineName,r.dosage]);
  exportCSV("medicine-records.csv",["Date","Time","Medicine","Dosage"],rows); toast("Medicine CSV exported");
}
function exportBackup() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  downloadBlob(blob,`daily-health-backup-${isoDate(new Date())}.json`); toast("Backup exported");
}
function importBackup(file) {
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const incoming=JSON.parse(reader.result);
      if(!incoming || typeof incoming!=="object" || !incoming.exercise || !Array.isArray(incoming.medicines) || !Array.isArray(incoming.medicineTaken)) throw new Error();
      if(!confirm("Import this backup? Your current tracker data will be replaced.")) return;
      state={...structuredClone(defaultState),...incoming}; saveState(); render(); toast("Backup imported");
    } catch { alert("That file is not a valid Daily Health Tracker backup."); }
  };
  reader.readAsText(file);
}

function clearAll() {
  if(!confirm("Clear ALL exercise, medicine, and medicine list data? This cannot be undone unless you have a backup.")) return;
  state=structuredClone(defaultState); saveState(); unregisterPushClient(); closeModal(); setPage("dashboard"); toast("All data cleared");
}

function bindDynamic() {
  document.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",()=>{
    const a=el.dataset.action;
    if(a==="exercise-date") openExercisePicker(el.dataset.date);
    else if(a==="medicine-date") openMedicineDate(el.dataset.date);
    else if(a==="exercise-prev"){exerciseMonth=new Date(exerciseMonth.getFullYear(),exerciseMonth.getMonth()-1,1);render();}
    else if(a==="exercise-next"){exerciseMonth=new Date(exerciseMonth.getFullYear(),exerciseMonth.getMonth()+1,1);render();}
    else if(a==="medicine-prev"){medicineMonth=new Date(medicineMonth.getFullYear(),medicineMonth.getMonth()-1,1);render();}
    else if(a==="medicine-next"){medicineMonth=new Date(medicineMonth.getFullYear(),medicineMonth.getMonth()+1,1);render();}
    else if(a==="exercise-today") openExercisePicker(isoDate(new Date()));
    else if(a==="medicine-today") openMedicineDate(isoDate(new Date()));
    else if(a==="add-medicine") openMedicineForm();
    else if(a==="toggle-medicines"){ hideMedicines=!hideMedicines; render(); toast(hideMedicines?"Medicine list hidden":"Medicine list shown"); }
    else if(a==="reminder-settings") openReminderSettings(el.dataset.id);
    else if(a==="edit-medicine") openMedicineForm(el.dataset.id);
    else if(a==="delete-medicine") deleteMedicine(el.dataset.id);
    else if(a==="delete-dose") deleteDose(el.dataset.id);
    else if(a==="export-exercise") exportExercise();
    else if(a==="export-medicine") exportMedicine();
    else if(a==="export-backup") exportBackup();
    else if(a==="import-backup") $("#backupInput").click();
    else if(a==="clear-confirm") openClearModal();
  }));
}
function deleteMedicine(id) {
  const med=state.medicines.find(m=>m.id===id); if(!med)return;
  if(!confirm(`Delete "${med.name}" from your medicine list? Existing records will remain.`))return;
  state.medicines=state.medicines.filter(m=>m.id!==id);
  delete state.medicineReminders[id];
  saveState(); render(); syncWebPushReminders().catch(()=>{}); toast("Medicine removed");
}
function deleteDose(id) {
  state.medicineTaken=state.medicineTaken.filter(r=>r.id!==id); saveState(); render();
  if(!$("#modalBackdrop").classList.contains("hidden")) {
    const date = [...state.medicineTaken].find(r=>r.id===id)?.date;
    closeModal();
  }
  toast("Medicine record removed");
}
function openClearModal() {
  openModal(`<h3>⚠ Clear all data?</h3><div class="modal-sub">This removes exercise records, medicine records, and the medicine list from this browser.</div><div class="btn-group"><button class="btn" style="flex:1" data-modal-action="close">Cancel</button><button class="btn btn-danger" style="flex:1" data-modal-action="clear">CLEAR EVERYTHING</button></div>`);
}

document.addEventListener("click", e=>{
  const nav=e.target.closest(".nav-item[data-page]");
  if(nav) setPage(nav.dataset.page);
  const ma=e.target.closest("[data-modal-action]");
  if(!ma)return;
  const a=ma.dataset.modalAction;
  if(a==="close") closeModal();
  else if(a==="set-exercise"){
    const {date,value}=ma.dataset;
    if(value==="off") delete state.exercise[date]; else state.exercise[date]=value;
    saveState(); closeModal(); render(); toast(value==="off"?"Marked as day off":"Exercise saved");
  } else if(a==="record-dose") openDoseForm(ma.dataset.date);
  else if(a==="delete-dose") { const id=ma.dataset.id; state.medicineTaken=state.medicineTaken.filter(r=>r.id!==id); saveState(); openMedicineDate(ma.dataset.date); render(); }
  else if(a==="clear") clearAll();
});

$("#menuBtn").addEventListener("click",()=>{$("#sidebar").classList.add("open");$("#overlay").classList.add("show");});
$("#overlay").addEventListener("click",closeSidebar);
$("#todayBtn").addEventListener("click",(e)=>{
  e.preventDefault();
  e.stopPropagation();
  if(currentPage==="exercise"){
    exerciseMonth=new Date();
    render();
    return;
  }
  if(currentPage==="medicine"){
    medicineMonth=new Date();
    render();
    return;
  }
  render();
  toast("Showing today");
});
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
$("#backupInput").addEventListener("change",e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value="";});

render();

(async function handlePushOpen(){
  const params=new URLSearchParams(location.search);
  const reminderId=params.get("reminder");
  if(!reminderId) return;
  history.replaceState({},"",location.pathname+location.hash);
  const med=state.medicines.find(m=>m.id===reminderId || reminderId.startsWith(m.id+"_"));
  if(med){
    currentPage="medicine";
    render();
    openMedicineDate(isoDate(new Date()));
  }
})();
