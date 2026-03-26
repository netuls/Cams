// ─────────────────────────────────────────
//  VARIÁVEIS GLOBAIS E CONSTANTES
// ─────────────────────────────────────────
const DAYS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let activeIdx = todayWeekIdx(); // Inicia no dia atual
let weekOffset = 0;             // 0 = semana atual
let activePeriod = 'week';      // Filtro padrão do relatório
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
    console.warn("Firebase sync error:", e);
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
    return r ? JSON.parse(r) : {entries:{}, confirmed:{}, sessions:{}, creatine:{}};
  } catch(e) { return {entries:{}, confirmed:{}, sessions:{}, creatine:{}}; }
}

function save(data) {
  try {
    localStorage.setItem('treino_v3', JSON.stringify(data));
    syncToFirebase();
  } catch(e) {}
}

function dateKey(date) {
  return date.toISOString().slice(0,10);
}

function getForDate(key) {
  return load().entries[key] || [];
}

function saveForDate(key, arr) {
  const d = load();
  if (!d.entries) d.entries = {};
  if (arr.length === 0) { delete d.entries[key]; }
  else { d.entries[key] = arr; }
  save(d);
}

function isConfirmed(key) {
  const d = load();
  return !!(d.confirmed && d.confirmed[key]);
}

function setConfirmed(key, val) {
  const d = load();
  if (!d.confirmed) d.confirmed = {};
  if (val) d.confirmed[key] = true;
  else delete d.confirmed[key];
  save(d);
}

// ─────────────────────────────────────────
//  LÓGICA DA CREATINA
// ─────────────────────────────────────────

function isCreatineTaken(key) {
  const d = load();
  return !!(d.creatine && d.creatine[key]);
}

function toggleCreatine(key) {
  const d = load();
  if (!d.creatine) d.creatine = {};
  if (d.creatine[key]) {
    delete d.creatine[key];
  } else {
    d.creatine[key] = true;
    haptic('success');
  }
  save(d);
  renderMain();
}

function renderCreatineBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const taken = isCreatineTaken(key);
  const container = document.getElementById('creatine-bar-container');
  if(!container) return;

  container.innerHTML = `
    <div class="creatine-bar ${taken ? 'taken' : ''}">
      <div style="font-size: 1.5rem;">${taken ? '🥤' : '🥛'}</div>
      <div class="creatine-info">
        <div class="creatine-title">Suplementação: Creatina</div>
        <div class="creatine-status">${taken ? 'Status: Tomado hoje! ✨' : 'Status: Pendente'}</div>
      </div>
      <button class="btn-creatine ${taken ? 'done' : ''}" onclick="toggleCreatine('${key}')">
        ${taken ? '✓ Tomado' : 'Check-in'}
      </button>
    </div>
  `;
}

function checkCreatineReminder() {
  setInterval(() => {
    const agora = new Date();
    const hoje = dateKey(agora);
    if (agora.getHours() === 21 && agora.getMinutes() === 0 && !isCreatineTaken(hoje)) {
      if (!sessionStorage.getItem('creatine_notified')) {
        alert("🔔 Cams, hora da Creatina! Já tomou seu suplemento hoje?");
        sessionStorage.setItem('creatine_notified', 'true');
      }
    } else if (agora.getHours() !== 21) {
      sessionStorage.removeItem('creatine_notified');
    }
  }, 60000);
}

// ─────────────────────────────────────────
//  SESSÃO DA ACADEMIA (Check-in)
// ─────────────────────────────────────────

function getSession(key) {
  const d = load();
  return (d.sessions && d.sessions[key]) || {checkin:null, checkout:null};
}

function saveSession(key, sess) {
  const d = load();
  if (!d.sessions) d.sessions = {};
  if (!sess.checkin && !sess.checkout) delete d.sessions[key];
  else d.sessions[key] = sess;
  save(d);
}

function renderCheckinBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const sess = getSession(key);
  const bar = document.getElementById('checkin-bar');
  if(!bar) return;

  const fmt = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '--:--';

  if (!sess.checkin) {
    bar.innerHTML = `
      <div class="checkin-bar">
        <div class="checkin-icon">🏃‍♀️</div>
        <div class="checkin-info"><div class="checkin-title">Academia</div><div class="checkin-times" style="font-size:0.8rem; font-family:Jost">Check-in pendente</div></div>
        <button class="btn-checkin" onclick="doCheckin('${key}')">📍 Check-in</button>
      </div>`;
  } else if (!sess.checkout) {
    bar.innerHTML = `
      <div class="checkin-bar active-session">
        <div class="checkin-icon">💪</div>
        <div class="checkin-info">
          <div class="checkin-title">Treinando</div>
          <div class="checkin-times">Entrou às <strong>${fmt(sess.checkin)}</strong></div>
        </div>
        <button class="btn-checkin btn-checkout" onclick="doCheckout('${key}')">🏁 Finalizar</button>
      </div>`;
  } else {
    bar.innerHTML = `
      <div class="checkin-bar done-session">
        <div class="checkin-icon">✅</div>
        <div class="checkin-info">
          <div class="checkin-title">Sessão Concluída</div>
          <div class="checkin-times">${fmt(sess.checkin)} → ${fmt(sess.checkout)}</div>
        </div>
        <button class="btn-session-reset" onclick="resetSession('${key}')">✕</button>
      </div>`;
  }
}

function doCheckin(key) { saveSession(key, {checkin: new Date().toISOString(), checkout:null}); renderMain(); }
function doCheckout(key) { const s = getSession(key); s.checkout = new Date().toISOString(); saveSession(key, s); renderMain(); }
function resetSession(key) { saveSession(key, {checkin:null, checkout:null}); renderMain(); }

// ─────────────────────────────────────────
//  NAVEGAÇÃO DE DATAS
// ─────────────────────────────────────────

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

function todayWeekIdx() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function changeWeek(dir) {
  weekOffset += dir;
  renderMain();
}

function goToToday() {
  weekOffset = 0;
  activeIdx = todayWeekIdx();
  renderMain();
}

// ─────────────────────────────────────────
//  RENDERIZAÇÃO DA INTERFACE
// ─────────────────────────────────────────

function updateDateBadge() {
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'short'});
}

function renderTabs() {
  const nav = document.getElementById('week-nav');
  const dates = getWeekDates();
  const todayKey = dateKey(new Date());

  nav.innerHTML = `
    <div class="week-label">
      <button class="week-arrow" onclick="changeWeek(-1)">‹</button>
      <span class="week-range">${dates[0].getDate()} ${MONTHS_PT[dates[0].getMonth()]} - ${dates[6].getDate()} ${MONTHS_PT[dates[6].getMonth()]}</span>
      <button class="week-arrow" onclick="changeWeek(1)">›</button>
    </div>
    <div class="tabs-row"></div>
  `;

  const row = nav.querySelector('.tabs-row');
  dates.forEach((d, i) => {
    const key = dateKey(d);
    const hasEx = getForDate(key).length;
    const tab = document.createElement('button');
    tab.className = `day-tab ${i === activeIdx ? 'active' : ''} ${key === todayKey ? 'today' : ''}`;
    tab.innerHTML = `<span>${DAYS_SHORT[i]}</span><small>${d.getDate()}</small>${hasEx ? '<span class="ex-count"></span>' : ''}`;
    tab.onclick = () => { activeIdx = i; renderMain(); };
    row.appendChild(tab);
  });
}

function renderList() {
  const key = dateKey(getWeekDates()[activeIdx]);
  const list = document.getElementById('ex-list');
  const items = getForDate(key);

  document.getElementById('active-day-name').textContent = DAYS_FULL[getWeekDates()[activeIdx].getDay()];
  document.getElementById('active-day-date').textContent = getWeekDates()[activeIdx].toLocaleDateString('pt-BR', {day:'numeric', month:'long'});

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhum exercício para hoje.</div>`;
    return;
  }

  list.innerHTML = '';
  items.forEach((ex, idx) => {
    const div = document.createElement('div');
    div.className = `ex-item ${ex.done ? 'done' : ''}`;
    div.innerHTML = `
      <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}',${idx})"></div>
      <div class="ex-info"><div class="ex-name">${ex.name}</div></div>
      <button class="btn-del" onclick="deleteEx('${key}',${idx})">✕</button>
    `;
    list.appendChild(div);
  });
}

function addExercise() {
  const input = document.getElementById('ex-input');
  if (!input.value.trim()) return;
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  arr.push({id: Date.now(), name: input.value.trim(), done: false});
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
//  OUTRAS FUNÇÕES (Presets, Stats, Haptic)
// ─────────────────────────────────────────

function renderPresetChips() {
  const container = document.getElementById('presets-chips');
  const presets = ["Quadríceps", "Glúteo", "Costas", "Bíceps", "Escada"];
  container.innerHTML = presets.map(p => `<button class="preset-chip" onclick="addPreset('${p}')">${p}</button>`).join('');
}

function addPreset(name) {
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  arr.push({id: Date.now(), name: name, done: false});
  saveForDate(key, arr);
  renderMain();
}

function renderStats() {
  const dates = getWeekDates();
  let total = 0, done = 0;
  dates.forEach(d => {
    const items = getForDate(dateKey(d));
    total += items.length;
    done += items.filter(e => e.done).length;
  });
  const pct = total === 0 ? 0 : Math.round((done/total)*100);
  document.getElementById('progress-wrap').innerHTML = `
    <div class="progress-label"><span>Progresso da semana</span><span>${pct}%</span></div>
    <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
}

function renderOverview() {
  const grid = document.getElementById('overview-grid');
  const dates = getWeekDates();
  grid.innerHTML = dates.map((d, i) => {
    const n = getForDate(dateKey(d)).length;
    return `<div class="ov-day"><small>${DAYS_SHORT[i]}</small><div class="ov-bar-wrap"><div class="ov-bar" style="height:${n*10}%"></div></div></div>`;
  }).join('');
}

function haptic(type = 'light') {
  if (navigator.vibrate) navigator.vibrate(type === 'success' ? [10, 30, 10] : [10]);
}

// ─────────────────────────────────────────
//  INICIALIZAÇÃO
// ─────────────────────────────────────────

function init() {
  updateDateBadge();
  renderMain();
  renderPresetChips();
  checkCreatineReminder();
  
  if (window.Notification) Notification.requestPermission();

  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 900);
    }, 2600);
  }
}

function renderMain() {
  renderTabs();
  renderList();
  renderCheckinBar();
  renderCreatineBar();
  renderStats();
  renderOverview();
  // renderDupBar(); // Ative se tiver a lógica de duplicação
}

init();
