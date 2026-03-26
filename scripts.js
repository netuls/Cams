// ─────────────────────────────────────────
//  VARIÁVEIS GLOBAIS E CONSTANTES
// ─────────────────────────────────────────
const DAYS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let activeIdx = todayWeekIdx(); 
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
  const container = document.getElementById('creatine-bar-container');
  if(!container) return;

  container.innerHTML = `
    <div class="creatine-bar ${taken ? 'taken' : ''}">
      <div style="font-size: 1.5rem;">${taken ? '🥤' : '🥛'}</div>
      <div class="creatine-info">
        <div class="creatine-title">Suplementação: Creatina</div>
        <div class="creatine-status">${taken ? 'Já tomou hoje! ✨' : 'Ainda não tomou'}</div>
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
    if (agora.getHours() === 21 && agora.getMinutes() === 0 && !load().creatine[dateKey(agora)]) {
      if (!sessionStorage.getItem('creatine_notified')) {
        alert("🔔 Cams, hora da Creatina! Não esquece de tomar.");
        sessionStorage.setItem('creatine_notified', 'true');
      }
    } else if (agora.getHours() !== 21) {
      sessionStorage.removeItem('creatine_notified');
    }
  }, 60000);
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
//  RELATÓRIO (LOGICA COMPLETA)
// ─────────────────────────────────────────

function openReport() {
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderReport();
}

function closeReportBtn() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function setPeriod(period, btn) {
  activePeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReport();
}

function getPeriodRange(period) {
  const now = new Date();
  let start = new Date(); start.setHours(0,0,0,0);
  let end = new Date(); end.setHours(23,59,59,999);

  if (period === 'week') {
    const day = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    start.setDate(now.getDate() + diff);
    end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  } else if (period === 'all') {
    start = new Date(2023, 0, 1);
  }
  return { start, end };
}

function renderReport() {
  const { start, end } = getPeriodRange(activePeriod);
  const data = load();
  const filtered = Object.entries(data.entries).filter(([key]) => {
    const d = new Date(key + 'T12:00:00');
    return d >= start && d <= end;
  });

  const totalEx = filtered.reduce((acc, [_, ex]) => acc + ex.length, 0);
  const totalDone = filtered.reduce((acc, [_, ex]) => acc + ex.filter(e => e.done).length, 0);
  const daysCount = filtered.length;

  document.getElementById('summary-strip').innerHTML = `
    <div class="sum-card"><div class="sum-num">${totalEx}</div><div class="sum-label">Total</div></div>
    <div class="sum-card"><div class="sum-num mid">${totalDone}</div><div class="sum-label">Feitos</div></div>
    <div class="sum-card"><div class="sum-num purple">${daysCount}</div><div class="sum-label">Dias</div></div>
  `;

  renderHeatmap(start, end, data);
  renderDayLog(filtered);
}

function renderHeatmap(start, end, data) {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';
  // Simplificado para os últimos 35 dias no relatório
  for (let i = 0; i < 35; i++) {
    const d = new Date(); d.setDate(d.getDate() - (34 - i));
    const key = dateKey(d);
    const count = (data.entries[key] || []).length;
    const cell = document.createElement('div');
    cell.className = `hm-cell ${count > 0 ? 'level' + Math.min(count, 4) : ''}`;
    grid.appendChild(cell);
  }
}

function renderDayLog(filtered) {
  const log = document.getElementById('day-log-list');
  if (filtered.length === 0) {
    log.innerHTML = '<div class="no-data">Sem treinos no período.</div>';
    return;
  }
  log.innerHTML = filtered.sort().reverse().map(([key, ex]) => `
    <div class="day-log-item">
      <div class="log-date">${key.split('-')[2]}<small>${MONTHS_PT[new Date(key+'T12:00:00').getMonth()]}</small></div>
      <div class="log-exercises">${ex.map(e => `<span class="log-ex-tag ${e.done?'done-tag':''}">${e.name}</span>`).join('')}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
//  SISTEMA DE ABAS E LISTA PRINCIPAL
// ─────────────────────────────────────────

function todayWeekIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }

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

function changeWeek(dir) { weekOffset += dir; renderMain(); }

function renderTabs() {
  const dates = getWeekDates();
  const container = document.querySelector('.tabs-row');
  const weekRange = document.querySelector('.week-range');
  if(!container) return;

  weekRange.textContent = `${dates[0].getDate()} ${MONTHS_PT[dates[0].getMonth()]} - ${dates[6].getDate()} ${MONTHS_PT[dates[6].getMonth()]}`;
  
  container.innerHTML = dates.map((d, i) => {
    const key = dateKey(d);
    const n = getForDate(key).length;
    const active = i === activeIdx ? 'active' : '';
    const today = key === dateKey(new Date()) ? 'today' : '';
    return `<button class="day-tab ${active} ${today}" onclick="selectDay(${i})">
      ${DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1] || 'Dom'}
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
  
  document.getElementById('active-day-name').textContent = DAYS_FULL[getWeekDates()[activeIdx].getDay()];

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Clique nos botões abaixo ou adicione manualmente.</div>';
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
  if (!input.value.trim()) return;
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
//  INICIALIZAÇÃO
// ─────────────────────────────────────────

function renderMain() {
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
  const items = getForDate(dateKey(getWeekDates()[activeIdx]));
  const done = items.filter(e => e.done).length;
  const pct = items.length ? Math.round((done/items.length)*100) : 0;
  document.getElementById('progress-wrap').innerHTML = `
    <div class="progress-label"><span>Progresso</span><span>${pct}%</span></div>
    <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
}

function renderOverview() {
  const grid = document.getElementById('overview-grid');
  const dates = getWeekDates();
  grid.innerHTML = dates.map(d => {
    const n = getForDate(dateKey(d)).length;
    return `<div class="ov-day"><div class="ov-bar-wrap"><div class="ov-bar" style="height:${n*15}%"></div></div></div>`;
  }).join('');
}

function haptic(type) { if(navigator.vibrate) navigator.vibrate(20); }

function init() {
  updateDateBadge();
  renderMain();
  checkCreatineReminder();
  
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 900);
    }, 2500);
  }
}

// Inicia o app
init();
