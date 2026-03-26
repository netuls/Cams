// ─────────────────────────────────────────
//  VARIÁVEIS GLOBAIS E CONSTANTES
// ─────────────────────────────────────────
const DAYS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let activeIdx = new Date().getDay(); 
let weekOffset = 0;             
let activePeriod = 'week';      
let customFrom = null;
let customTo   = null;

// ─────────────────────────────────────────
//  DATA HELPERS
// ─────────────────────────────────────────

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
  localStorage.setItem('treino_v3', JSON.stringify(data));
  if (window._firebaseReady) {
     const ref = window._firebaseDocRef("dados/treino_v3");
     window._firebaseSetDoc(ref, { payload: JSON.stringify(data) }, { merge: true });
  }
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

// ─────────────────────────────────────────
//  LÓGICA DA CREATINA
// ─────────────────────────────────────────

function toggleCreatine(key) {
  const d = load();
  if (d.creatine[key]) delete d.creatine[key];
  else { d.creatine[key] = true; }
  save(d);
  renderMain();
}

function renderCreatineBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const taken = !!load().creatine[key];
  const container = document.getElementById('creatine-bar'); 
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
    bar.innerHTML = `<div class="checkin-bar"><div class="checkin-icon">🏃‍♀️</div><div class="checkin-info"><div class="checkin-title">Academia</div><div class="checkin-times" style="font-size:0.8rem">Pendente</div></div><button class="btn-checkin" onclick="doCheckin('${key}')">📍 Check-in</button></div>`;
  } else if (!sess.checkout) {
    bar.innerHTML = `<div class="checkin-bar active-session"><div class="checkin-icon">💪</div><div class="checkin-info"><div class="checkin-title">Treinando</div><div class="checkin-times" style="font-size:0.8rem">Entrou: ${fmt(sess.checkin)}</div></div><button class="btn-checkin btn-checkout" onclick="doCheckout('${key}')">🏁 Sair</button></div>`;
  } else {
    bar.innerHTML = `<div class="checkin-bar done-session"><div class="checkin-icon">✅</div><div class="checkin-info"><div class="checkin-title">Concluído</div><div class="checkin-times" style="font-size:0.8rem">${fmt(sess.checkin)} às ${fmt(sess.checkout)}</div></div><button class="btn-session-reset" onclick="resetSession('${key}')" style="background:none; border:none; color:gray; cursor:pointer; margin-left:10px">✕</button></div>`;
  }
}

function doCheckin(key) { const d=load(); d.sessions[key]={checkin:new Date().toISOString(), checkout:null}; save(d); renderMain(); }
function doCheckout(key) { const d=load(); d.sessions[key].checkout=new Date().toISOString(); save(d); renderMain(); }
function resetSession(key) { const d=load(); delete d.sessions[key]; save(d); renderMain(); }

// ─────────────────────────────────────────
//  CALENDÁRIO E LISTA
// ─────────────────────────────────────────

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = 0 - day; // Domingo como início
  const sun = new Date(now);
  sun.setDate(now.getDate() + diff + weekOffset * 7);
  sun.setHours(0,0,0,0);
  return sun;
}

function getWeekDates() {
  const sun = getWeekStart();
  return Array.from({length:7},(_,i) => { const d=new Date(sun); d.setDate(sun.getDate()+i); return d; });
}

function renderTabs() {
  const dates = getWeekDates();
  const container = document.getElementById('tabs-row');
  if(!container) return;

  container.innerHTML = dates.map((d, i) => {
    const key = dateKey(d);
    const n = getForDate(key).length;
    const active = i === activeIdx ? 'active' : '';
    const isToday = key === dateKey(new Date());
    return `<button class="day-tab ${active} ${isToday ? 'today' : ''}" onclick="selectDay(${i})">
      ${DAYS_SHORT[i]}
      <span style="font-size:0.7rem">${d.getDate()}</span>
      ${n > 0 ? `<span class="ex-count">${n}</span>` : ''}
    </button>`;
  }).join('');
}

function selectDay(i) { activeIdx = i; renderMain(); }

function renderList() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const items = getForDate(key);
  const list = document.getElementById('ex-list');
  if(!list) return;
  
  document.getElementById('active-day-name').textContent = DAYS_FULL[activeIdx];
  document.getElementById('active-day-date').textContent = dates[activeIdx].toLocaleDateString('pt-BR', {day:'numeric', month:'long'});

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhum exercício hoje.</div>';
    return;
  }

  list.innerHTML = items.map((ex, idx) => `
    <div class="ex-item ${ex.done ? 'done' : ''}">
      <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}', ${idx})"></div>
      <div class="ex-info"><div class="ex-name">${ex.name}</div></div>
      <button class="btn-del" onclick="deleteEx('${key}', ${idx})" style="background:none; border:none; color:#f5aac8; cursor:pointer;">✕</button>
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
//  ESTATÍSTICAS
// ─────────────────────────────────────────

function renderStats() {
  const key = dateKey(getWeekDates()[activeIdx]);
  const items = getForDate(key);
  const done = items.filter(e => e.done).length;
  const pct = items.length ? Math.round((done/items.length)*100) : 0;
  const wrap = document.getElementById('progress-wrap');
  if(wrap) {
    wrap.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-label" style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px">
            <span>Progresso</span><span>${pct}%</span>
        </div>
        <div class="progress-bg" style="background:#eee; height:8px; border-radius:10px; overflow:hidden">
            <div class="progress-fill" style="width:${pct}%; height:100%; background:#d63f7e; transition:width 0.5s"></div>
        </div>
      </div>
    `;
  }
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
}

function init() {
  try {
    renderMain();
  } catch (e) {
    console.error("Erro ao renderizar:", e);
  }

  // REMOVE O SPLASH (A parte que faz o site abrir)
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 800);
    }, 2000);
  }
}

window.addEventListener('DOMContentLoaded', init);
