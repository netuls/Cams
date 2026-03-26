// ─────────────────────────────────────────
//  VARIÁVEIS GLOBAIS E CONSTANTES
// ─────────────────────────────────────────
const DAYS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Inicializamos sem valor para evitar erro de carregamento precoce
let activeIdx; 
let weekOffset = 0;             
let activePeriod = 'week';      
let customFrom = null;
let customTo   = null;

// ─────────────────────────────────────────
//  DATA HELPERS (LocalStorage & Firebase)
// ─────────────────────────────────────────

async function syncToFirebase() {
  if (!window._firebaseReady) return;
  try {
    setFbStatus('syncing', 'Salvando...');
    window._firebaseSkipSnapshot = true;
    const localData = JSON.parse(localStorage.getItem('treino_v3') || '{}');
    const ref = window._firebaseDocRef("dados/treino_v3");
    await window._firebaseSetDoc(ref, { payload: JSON.stringify(localData) }, { merge: true });
    setFbStatus('connected', 'Salvo ✓');
    setTimeout(() => setFbStatus('connected', 'Firebase ☁️'), 2000);
  } catch(e) {
    setFbStatus('error', 'Erro sync');
  } finally {
    setTimeout(() => { window._firebaseSkipSnapshot = false; }, 1500);
  }
}

function setFbStatus(state, label) {
  const dot = document.getElementById('fb-dot');
  const lbl = document.getElementById('fb-label');
  if (!dot || !lbl) return;
  dot.className = 'fb-dot ' + state;
  lbl.textContent = label;
}

function load() {
  try {
    const r = localStorage.getItem('treino_v3');
    const parsed = r ? JSON.parse(r) : {};
    return {
      entries: parsed.entries || {},
      confirmed: parsed.confirmed || {},
      sessions: parsed.sessions || {},
      creatine: parsed.creatine || {}
    };
  } catch(e) { return {entries:{}, confirmed:{}, sessions:{}, creatine:{}}; }
}

function save(data) {
  try {
    localStorage.setItem('treino_v3', JSON.stringify(data));
    syncToFirebase();
  } catch(e) {}
}

function dateKey(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getForDate(key) { return load().entries[key] || []; }

function saveForDate(key, arr) {
  const d = load();
  if (arr.length === 0) delete d.entries[key];
  else d.entries[key] = arr;
  save(d);
}

function isConfirmed(key) { return !!load().confirmed[key]; }

function setConfirmed(key, val) {
  const d = load();
  if (val) d.confirmed[key] = true;
  else delete d.confirmed[key];
  save(d);
}

// ─────────────────────────────────────────
//  LÓGICA DA CREATINA
// ─────────────────────────────────────────

function toggleCreatine(key) {
  const d = load();
  if (d.creatine[key]) delete d.creatine[key];
  else { d.creatine[key] = true; haptic('success'); }
  save(d);
  renderMain();
}

function renderCreatineBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const taken = !!load().creatine[key];
  const container = document.getElementById('creatine-bar'); // Ajustado para bater com o ID do seu HTML
  if(!container) return;

  container.innerHTML = `
    <div class="creatine-bar ${taken ? 'taken' : ''}">
      <div style="font-size: 1.5rem;">${taken ? '🥤' : '🥛'}</div>
      <div class="creatine-info">
        <div class="creatine-title">Creatina</div>
        <div class="creatine-status">${taken ? 'Já tomou hoje! ✨' : 'Ainda não tomou'}</div>
      </div>
      <button class="btn-creatine ${taken ? 'done' : ''}" onclick="toggleCreatine('${key}')">
        ${taken ? '✓ Tomado' : 'Check-in'}
      </button>
    </div>
  `;
}

function checkCreatineReminder() {
    const agora = new Date();
    if (agora.getHours() === 21 && agora.getMinutes() === 0 && !load().creatine[dateKey(agora)]) {
      if (!sessionStorage.getItem('creatine_notified')) {
        alert("🔔 Cams, hora da Creatina! Não esquece de tomar.");
        sessionStorage.setItem('creatine_notified', 'true');
      }
    } else if (agora.getHours() !== 21) {
      sessionStorage.removeItem('creatine_notified');
    }
}

// ─────────────────────────────────────────
//  CHECK-IN ACADEMIA
// ─────────────────────────────────────────

function getSession(key) { return load().sessions[key] || {checkin:null, checkout:null}; }

function renderCheckinBar() {
  const key = dateKey(getWeekDates()[activeIdx]);
  const sess = getSession(key);
  const bar = document.getElementById('checkin-bar');
  if(!bar) return;
  const fmt = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '--:--';

  if (!sess.checkin) {
    bar.innerHTML = `<div class="checkin-bar"><div class="checkin-icon">🏃‍♀️</div><div class="checkin-info"><div class="checkin-title">Academia</div><div class="checkin-times">Pendente</div></div><button class="btn-checkin" onclick="doCheckin('${key}')">📍 Check-in</button></div>`;
  } else if (!sess.checkout) {
    bar.innerHTML = `<div class="checkin-bar active-session"><div class="checkin-icon">💪</div><div class="checkin-info"><div class="checkin-title">Treinando</div><div class="checkin-times">Entrou: ${fmt(sess.checkin)}</div></div><button class="btn-checkin btn-checkout" onclick="doCheckout('${key}')">🏁 Sair</button></div>`;
  } else {
    bar.innerHTML = `<div class="checkin-bar done-session"><div class="checkin-icon">✅</div><div class="checkin-info"><div class="checkin-title">Concluído</div><div class="checkin-times">${fmt(sess.checkin)} às ${fmt(sess.checkout)}</div></div><button class="btn-session-reset" onclick="resetSession('${key}')">✕</button></div>`;
  }
}

function doCheckin(key) { const d=load(); d.sessions[key]={checkin:new Date().toISOString(), checkout:null}; save(d); renderMain(); }
function doCheckout(key) { const d=load(); d.sessions[key].checkout=new Date().toISOString(); save(d); renderMain(); }
function resetSession(key) { const d=load(); delete d.sessions[key]; save(d); renderMain(); }

// ─────────────────────────────────────────
//  SISTEMA DE ABAS E LISTA PRINCIPAL
// ─────────────────────────────────────────

function todayWeekIdx() { 
    const d = new Date().getDay(); 
    return d === 0 ? 6 : d - 1; 
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + weekOffset * 7);
  mon.setHours(0,0,0,0);
  return mon;
}

function getWeekDates() {
  const mon = getWeekStart();
  return Array.from({length:7},(_,i) => { const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}

function renderTabs() {
  const dates = getWeekDates();
  const container = document.querySelector('.tabs-row');
  const weekRange = document.getElementById('week-nav'); // Simplificado
  if(!container) return;

  container.innerHTML = dates.map((d, i) => {
    const key = dateKey(d);
    const n = getForDate(key).length;
    const active = i === activeIdx ? 'active' : '';
    const today = key === dateKey(new Date()) ? 'today' : '';
    return `<button class="day-tab ${active} ${today}" onclick="selectDay(${i})">
      ${DAYS_SHORT[d.getDay()]}
      <span style="font-size:0.7rem">${d.getDate()}</span>
      <span class="ex-count">${n}</span>
    </button>`;
  }).join('');
}

function selectDay(i) { activeIdx = i; renderMain(); }

function renderList() {
  const key = dateKey(getWeekDates()[activeIdx]);
  const items = getForDate(key);
  const list = document.getElementById('ex-list');
  
  const dayNameElement = document.getElementById('active-day-name');
  if(dayNameElement) dayNameElement.textContent = DAYS_FULL[getWeekDates()[activeIdx].getDay()];

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhum exercício para hoje.</div>';
    return;
  }

  list.innerHTML = items.map((ex, idx) => `
    <div class="ex-item ${ex.done ? 'done' : ''}">
      <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}', ${idx})"></div>
      <div class="ex-info"><div class="ex-name">${ex.name}</div></div>
      <button class="btn-del" onclick="deleteEx('${key}', ${idx})">✕</button>
    </div>
  `).join('');
}

function addExercise() {
  const input = document.getElementById('ex-input');
  if (!input || !input.value.trim()) return;
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  arr.push({ id: Date.now(), name: input.value.trim(), done: false });
  saveForDate(key, arr);
  input.value = '';
  renderMain();
}

function toggleEx(key, idx) {
  const arr = getForDate(key);
  arr[idx].done = !arr[idx].done;
  saveForDate(key, arr);
  renderMain();
}

function deleteEx(key, idx) {
  const arr = getForDate(key);
  arr.splice(idx, 1);
  saveForDate(key, arr);
  renderMain();
}

// ─────────────────────────────────────────
//  ESTATÍSTICAS E COMPLEMENTOS
// ─────────────────────────────────────────

function updateDateBadge() {
    const el = document.getElementById('current-date');
    if(el) el.textContent = new Date().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'});
}

function renderMain() {
  if (activeIdx === undefined) activeIdx = todayWeekIdx();
  renderTabs();
  renderList();
  renderCheckinBar();
  renderCreatineBar();
  renderStats();
  renderOverview();
  renderPresetChips();
}

function renderPresetChips() {
  const container = document.getElementById('presets-chips');
  if(!container) return;
  const presets = [
    {n:"Quadríceps", i:"🦵"}, {n:"Glúteo", i:"🍑"}, 
    {n:"Costas", i:"🔙"}, {n:"Bíceps", i:"💪"}, {n:"Escada", i:"🏃‍♀️"}
  ];
  container.innerHTML = presets.map(p => `
    <button class="preset-chip" onclick="addPreset('${p.n}')">
      <span>${p.i}</span> ${p.n}
    </button>
  `).join('');
}

function addPreset(name) {
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  if (arr.some(e => e.name === name)) return;
  arr.push({ id: Date.now(), name, done: false });
  saveForDate(key, arr);
  renderMain();
}

function renderStats() {
  const key = dateKey(getWeekDates()[activeIdx]);
  const items = getForDate(key);
  const done = items.filter(e => e.done).length;
  const pct = items.length ? Math.round((done/items.length)*100) : 0;
  const wrap = document.getElementById('progress-wrap');
  if(wrap) {
    wrap.innerHTML = `
      <div class="progress-label"><span>Progresso</span><span>${pct}%</span></div>
      <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
    `;
  }
}

function renderOverview() {
  const grid = document.getElementById('overview-grid');
  if(!grid) return;
  const dates = getWeekDates();
  grid.innerHTML = dates.map(d => {
    const n = getForDate(dateKey(d)).length;
    return `<div class="ov-day"><div class="ov-bar-wrap"><div class="ov-bar" style="height:${Math.min(n*20, 100)}%"></div></div></div>`;
  }).join('');
}

function haptic(type) { if(navigator.vibrate) navigator.vibrate(20); }

// ─────────────────────────────────────────
//  INICIALIZAÇÃO (Onde o Splash é removido)
// ─────────────────────────────────────────

function init() {
  try {
    activeIdx = todayWeekIdx();
    updateDateBadge();
    renderMain();
    setInterval(checkCreatineReminder, 60000);
  } catch (e) {
    console.error("Erro na inicialização:", e);
  }

  // Remove a Splash Screen mesmo que ocorra erro acima
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 900);
    }, 2000);
  }
}

// Inicia o app
document.addEventListener('DOMContentLoaded', init);
