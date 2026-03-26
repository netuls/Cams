// ─────────────────────────────────────────
//  DATA HELPERS
// ─────────────────────────────────────────
// Storage: { entries: { "YYYY-MM-DD": [ {id,name,time,done}, ... ] } }

// ── FIREBASE SYNC ──
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

window.addEventListener('firebase-ready', () => {
  setFbStatus('connected', 'Firebase ☁️');
});

// Verifica se Firebase está configurado
setTimeout(() => {
  if (!window._firebaseReady) {
    setFbStatus('error', 'Config Firebase');
    document.getElementById('firebase-status').title = 'Configure as credenciais do Firebase no código';
  }
}, 3000);

function load() {
  try { const r = localStorage.getItem('treino_v3'); return r ? JSON.parse(r) : {entries:{}, confirmed:{}}; }
  catch(e) { return {entries:{}, confirmed:{}}; }
}

function save(data) {
  try {
    localStorage.setItem('treino_v3', JSON.stringify(data));
    syncToFirebase();
  } catch(e) {}
}

function dateKey(date) {
  return date.toISOString().slice(0,10); // "YYYY-MM-DD"
}

function getForDate(key) { return load().entries[key] || []; }

function saveForDate(key, arr) {
  const d = load();
  if (!d.entries) d.entries = {};
  if (!d.confirmed) d.confirmed = {};
  if (arr.length === 0) { delete d.entries[key]; }
  else { d.entries[key] = arr; }
  save(d);
}

function isConfirmed(key) { const d = load(); return !!(d.confirmed && d.confirmed[key]); }

function setConfirmed(key, val) {
  const d = load();
  if (!d.confirmed) d.confirmed = {};
  if (val) d.confirmed[key] = true;
  else delete d.confirmed[key];
  save(d);
}

function allEntries() { return load().entries; }

// ── SESSION HELPERS ──
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

// ─────────────────────────────────────────
//  WEEK NAVIGATION (current week)
// ─────────────────────────────────────────
const DAYS_SHORT  = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const DAYS_FULL   = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Get Monday of selected week (offset in weeks from current)
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

let activeIdx = 0; // 0=Mon ... 6=Sun
let weekOffset = 0; // 0=current week, 1=next week, -1=last week
let activePeriod = 'week';
let customFrom = null;
let customTo   = null;

function todayWeekIdx() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

// ─────────────────────────────────────────
//  CHECK-IN / CHECK-OUT
// ─────────────────────────────────────────
function renderCheckinBar() {
  const dates = getWeekDates();
  const key   = dateKey(dates[activeIdx]);
  const sess  = getSession(key);
  const bar   = document.getElementById('checkin-bar');

  const fmt = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '--:--';

  const dur = () => {
    if (!sess.checkin || !sess.checkout) return null;
    const m = Math.round((new Date(sess.checkout)-new Date(sess.checkin))/60000);
    if (m <= 0) return null;
    const h = Math.floor(m/60);
    return h > 0 ? `${h}h ${m%60 > 0 ? m%60+'min' : ''}`.trim() : `${m}min`;
  };

  const d = dur();

  if (!sess.checkin) {
    bar.innerHTML = `
      <div class="checkin-bar">
        <div class="checkin-icon">🏃‍♀️</div>
        <div class="checkin-info">
          <div class="checkin-title">Academia</div>
          <div class="checkin-times" style="font-size:0.9rem;color:var(--muted);font-family:'Jost',sans-serif;font-weight:400">Você ainda não chegou</div>
        </div>
        <div class="checkin-actions">
          <button class="btn-checkin" onclick="doCheckin('${key}')">📍 Check-in</button>
        </div>
      </div>`;
  } else if (!sess.checkout) {
    bar.innerHTML = `
      <div class="checkin-bar active-session">
        <div class="checkin-icon">💪</div>
        <div class="checkin-info">
          <div class="checkin-title">Treino em andamento</div>
          <div class="checkin-times">Entrou às <strong style="color:var(--pink)">${fmt(sess.checkin)}</strong></div>
          <div class="checkin-duration">Arrasando! 💗</div>
        </div>
        <div class="checkin-actions">
          <button class="btn-checkin btn-checkout" onclick="doCheckout('${key}')">🏁 Check-out</button>
          <button class="btn-session-reset" onclick="resetSession('${key}')" title="Apagar">✕</button>
        </div>
      </div>`;
  } else {
    bar.innerHTML = `
      <div class="checkin-bar done-session">
        <div class="checkin-icon">✅</div>
        <div class="checkin-info">
          <div class="checkin-title">Sessão concluída</div>
          <div class="checkin-times">
            <span>${fmt(sess.checkin)}</span>
            <span class="checkin-sep">→</span>
            <span>${fmt(sess.checkout)}</span>
          </div>
          ${d ? `<div class="checkin-duration">Duração: <strong>${d}</strong></div>` : ''}
        </div>
        <div class="checkin-actions">
          <button class="btn-session-reset" onclick="resetSession('${key}')">✕ Apagar</button>
        </div>
      </div>`;
  }
}

function doCheckin(key) {
  const sess = getSession(key);
  sess.checkin  = new Date().toISOString();
  sess.checkout = null;
  saveSession(key, sess);
  renderCheckinBar();
}

function doCheckout(key) {
  const sess = getSession(key);
  sess.checkout = new Date().toISOString();
  saveSession(key, sess);
  renderCheckinBar();
}

function resetSession(key) {
  saveSession(key, {checkin:null, checkout:null});
  renderCheckinBar();
}

// ─────────────────────────────────────────
//  RENDER MAIN
// ─────────────────────────────────────────
function updateDateBadge() {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
}

function renderTabs() {
  const nav = document.getElementById('week-nav');
  nav.innerHTML = '';

  const todayKey = dateKey(new Date());
  const dates = getWeekDates();
  const mon = dates[0];
  const sun = dates[6];

  // Week label
  const weekLabel = document.createElement('div');
  weekLabel.className = 'week-label';
  const monStr = `${mon.getDate()} ${MONTHS_PT[mon.getMonth()]}`;
  const sunStr = `${sun.getDate()} ${MONTHS_PT[sun.getMonth()]}`;
  const isCurrentWeek = weekOffset === 0;
  const isFutureWeek  = weekOffset > 0;
  weekLabel.innerHTML = `
    <button class="week-arrow" onclick="changeWeek(-1)" title="Semana anterior">‹</button>
    <span class="week-range">
      ${isCurrentWeek ? '<span class="week-badge">Esta semana</span>' : isFutureWeek ? '<span class="week-badge future">Semana futura</span>' : '<span class="week-badge past">Semana passada</span>'}
      ${monStr} – ${sunStr}
    </span>
    <button class="week-arrow" onclick="changeWeek(1)" title="Próxima semana">›</button>
    ${weekOffset !== 0 ? `<button class="week-today-btn" onclick="goToToday()">Hoje</button>` : ''}
  `;
  nav.appendChild(weekLabel);

  // Day tabs
  const tabsRow = document.createElement('div');
  tabsRow.className = 'tabs-row';

  DAYS_SHORT.forEach((day, i) => {
    const key = dateKey(dates[i]);
    const n = getForDate(key).length;
    const isToday   = key === todayKey;
    const isPast    = dates[i] < new Date() && !isToday;
    const isFuture  = dates[i] > new Date() && !isToday;
    const confirmed = isConfirmed(key);

    const btn = document.createElement('button');
    btn.className = 'day-tab' + (i === activeIdx ? ' active' : '') + (isToday ? ' today' : '') + (isFuture ? ' future' : '');
    const dayNum = dates[i].getDate();
    const mon2 = MONTHS_PT[dates[i].getMonth()];
    btn.innerHTML = `
      ${day}
      <span style="font-size:0.68rem;opacity:0.75">${dayNum}/${mon2}</span>
      ${confirmed ? '<span class="tab-confirmed">✓</span>' : `<span class="ex-count">${n}</span>`}
    `;
    btn.onclick = () => { activeIdx = i; renderMain(); };
    tabsRow.appendChild(btn);
  });

  nav.appendChild(tabsRow);
}

function changeWeek(dir) {
  weekOffset += dir;
  activeIdx = (weekOffset === 0) ? todayWeekIdx() : 0;
  renderMain();
}

function goToToday() {
  weekOffset = 0;
  activeIdx = todayWeekIdx();
  renderMain();
}

function renderList() {
  const dates = getWeekDates();
  const date  = dates[activeIdx];
  const key   = dateKey(date);

  document.getElementById('active-day-name').textContent = DAYS_FULL[activeIdx];
  document.getElementById('active-day-date').textContent =
    date.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});

  const list = document.getElementById('ex-list');
  let items = getForDate(key);

  items = [...items].sort((a,b) => {
    if (!a.time&&!b.time) return 0;
    if (!a.time) return 1; if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🌸</span>
      Nenhum exercício para <strong>${DAYS_SHORT[activeIdx]}, ${date.getDate()} de ${MONTHS_FULL[date.getMonth()]}</strong>.<br>Adicione um exercício acima ↑
    </div>`;
    return;
  }

  const all = getForDate(key);
  list.innerHTML = '';
  items.forEach(ex => {
    const realIdx = all.findIndex(e => e.id===ex.id);
    const div = document.createElement('div');
    div.className = 'ex-item'+(ex.done?' done':'');
    div.innerHTML = `
      <div class="ex-check ${ex.done?'checked':''}" onclick="toggleEx('${key}',${realIdx})"></div>
      <div class="ex-info">
        <div class="ex-name">${esc(ex.name)}</div>
        ${ex.time?`<div class="ex-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
          ${ex.time}
        </div>`:''}
      </div>
      <button class="btn-del" onclick="deleteEx('${key}',${realIdx})">✕</button>
    `;
    list.appendChild(div);
  });
}

function renderOverview() {
  const grid = document.getElementById('overview-grid');
  grid.innerHTML = '';
  const dates = getWeekDates();
  const counts = dates.map(d => getForDate(dateKey(d)).length);
  const maxN = Math.max(...counts, 1);

  DAYS_SHORT.forEach((label,i) => {
    const pct = counts[i]===0 ? 0 : Math.max(8,(counts[i]/maxN)*100);
    const div = document.createElement('div');
    div.className = 'ov-day'+(i===activeIdx?' active':'');
    div.onclick = () => { activeIdx=i; renderMain(); };
    div.innerHTML = `
      <span class="ov-label">${label}</span>
      <div class="ov-bar-wrap"><div class="ov-bar" style="height:${pct}%"></div></div>
      <span class="ov-count">${counts[i]}</span>
    `;
    grid.appendChild(div);
  });
}

function renderStats() {
  const sg = document.getElementById('stats-grid');
  const pw = document.getElementById('progress-wrap');
  const dates = getWeekDates();

  let totalWeek=0, doneWeek=0;
  dates.forEach(d => {
    const t = getForDate(dateKey(d));
    totalWeek += t.length;
    doneWeek  += t.filter(e=>e.done).length;
  });

  const key = dateKey(dates[activeIdx]);
  const todayAll  = getForDate(key);
  const todayDone = todayAll.filter(e=>e.done).length;
  const pct = todayAll.length===0 ? 0 : Math.round((todayDone/todayAll.length)*100);
  const diasAtivos = dates.filter(d=>getForDate(dateKey(d)).length>0).length;

  sg.innerHTML = `
    <div class="stat-card s1"><div class="stat-num">${todayAll.length}</div><div class="stat-label">Hoje</div></div>
    <div class="stat-card s2"><div class="stat-num s2">${todayDone}</div><div class="stat-label">Concluídos</div></div>
    <div class="stat-card s3"><div class="stat-num s3">${totalWeek}</div><div class="stat-label">Na semana</div></div>
    <div class="stat-card s4"><div class="stat-num s4">${diasAtivos}</div><div class="stat-label">Dias ativos</div></div>
  `;

  pw.innerHTML = `
    <div class="progress-wrap">
      <div class="progress-label"><span>Progresso hoje</span><span>${pct}%</span></div>
      <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function addExercise() {
  const input = document.getElementById('ex-input');
  const time  = document.getElementById('ex-time');
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  arr.push({id:Date.now(), name, time:time.value, done:false});
  saveForDate(key, arr);
  input.value=''; time.value='';
  renderMain();
}

document.getElementById('ex-input').addEventListener('keydown', e => { if(e.key==='Enter') addExercise(); });

function toggleEx(key, idx) {
  const arr = getForDate(key);
  arr[idx].done = !arr[idx].done;
  saveForDate(key, arr);
  renderMain();
  if (document.getElementById('overlay').classList.contains('open')) renderReport();
}

function deleteEx(key, idx) {
  const arr = getForDate(key);
  arr.splice(idx,1);
  saveForDate(key, arr);
  renderMain();
  if (document.getElementById('overlay').classList.contains('open')) renderReport();
}

function renderMain() {
  renderTabs(); renderList(); renderOverview(); renderStats(); renderCheckinBar(); renderDupBar(); renderPresetChips();
}

// ─────────────────────────────────────────
//  DUPLICATE
// ─────────────────────────────────────────
let dupWeekOffset = 0;
let dupSelectedKeys = new Set();

function renderDupBar() {
  const bar = document.getElementById('dup-bar');
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const exercises = getForDate(key);
  if (exercises.length === 0) { bar.innerHTML = ''; return; }
  const date = dates[activeIdx];
  const dateStr = date.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
  bar.innerHTML = `
    <button class="btn-duplicate" onclick="openDuplicate()">
      ⧉ Duplicar este treino para outros dias
    </button>
  `;
}

function openDuplicate() {
  dupWeekOffset = weekOffset; // start showing same week
  dupSelectedKeys = new Set();
  document.getElementById('dup-feedback').textContent = '';
  document.getElementById('dup-feedback').className = 'dup-feedback';

  // source info
  const dates = getWeekDates();
  const srcDate = dates[activeIdx];
  const srcKey = dateKey(srcDate);
  const exercises = getForDate(srcKey);
  const srcDateStr = srcDate.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});

  document.getElementById('dup-source-info').innerHTML = `
    <div class="dup-source-box">
      Copiando <strong>${exercises.length} exercício${exercises.length>1?'s':''}</strong> de
      <strong>${srcDateStr}</strong>:<br>
      <span style="color:var(--muted);font-size:0.78rem">${exercises.map(e=>e.name).join(' · ')}</span>
    </div>
  `;

  renderDupGrid();
  document.getElementById('dup-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDupBtn() {
  document.getElementById('dup-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeDupOverlay(e) {
  if (e.target === document.getElementById('dup-overlay')) closeDupBtn();
}

function changeDupWeek(dir) {
  dupWeekOffset += dir;
  renderDupGrid();
}

function getDupWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + dupWeekOffset * 7);
  mon.setHours(0,0,0,0);
  return Array.from({length:7}, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
}

function renderDupGrid() {
  const dates = getWeekDates();
  const srcKey = dateKey(dates[activeIdx]);

  const dupDates = getDupWeekDates();
  const mon = dupDates[0]; const sun = dupDates[6];
  const monStr = `${mon.getDate()} ${MONTHS_PT[mon.getMonth()]}`;
  const sunStr = `${sun.getDate()} ${MONTHS_PT[sun.getMonth()]}`;
  document.getElementById('dup-week-label').textContent = `${monStr} – ${sunStr}`;

  const grid = document.getElementById('dup-days-grid');
  grid.innerHTML = '';

  dupDates.forEach(d => {
    const key = dateKey(d);
    const isSource = key === srcKey;
    const hasEx = getForDate(key).length > 0;
    const isSelected = dupSelectedKeys.has(key);

    const btn = document.createElement('div');
    btn.className = 'dup-day-btn' +
      (isSource   ? ' source'   : '') +
      (isSelected ? ' selected' : '');

    btn.innerHTML = `
      <span class="dup-day-name">${DAYS_SHORT[dupDates.indexOf(d)]}</span>
      <span class="dup-day-num">${d.getDate()}</span>
      ${hasEx && !isSource ? '<span class="dup-day-has"></span>' : ''}
      ${isSource ? '<span style="font-size:0.6rem;color:var(--pink)">origem</span>' : ''}
    `;

    if (!isSource) {
      btn.onclick = () => {
        if (dupSelectedKeys.has(key)) dupSelectedKeys.delete(key);
        else dupSelectedKeys.add(key);
        document.getElementById('dup-feedback').textContent = '';
        renderDupGrid();
      };
    }

    grid.appendChild(btn);
  });
}

function executeDuplicate() {
  if (dupSelectedKeys.size === 0) {
    const fb = document.getElementById('dup-feedback');
    fb.textContent = 'Selecione ao menos um dia de destino!';
    fb.className = 'dup-feedback error';
    return;
  }

  const dates = getWeekDates();
  const srcKey = dateKey(dates[activeIdx]);
  const srcExercises = getForDate(srcKey);
  const resetDone = document.getElementById('dup-reset-done').checked;
  const overwrite = document.getElementById('dup-overwrite').checked;

  let copied = 0;
  let skipped = 0;

  dupSelectedKeys.forEach(key => {
    const existing = getForDate(key);
    if (existing.length > 0 && !overwrite) { skipped++; return; }

    const newExercises = srcExercises.map(e => ({
      ...e,
      id: Date.now() + Math.random(),
      done: resetDone ? false : e.done
    }));

    if (overwrite || existing.length === 0) {
      saveForDate(key, newExercises);
    } else {
      saveForDate(key, [...existing, ...newExercises]);
    }
    copied++;
  });

  renderMain();
  renderDupGrid();

  const fb = document.getElementById('dup-feedback');
  if (copied === 0) {
    fb.textContent = `${skipped} dia${skipped>1?'s':''} ignorado${skipped>1?'s':''} — já tinham treino. Ative "Substituir" para sobrescrever.`;
    fb.className = 'dup-feedback error';
  } else {
    fb.textContent = `✓ Treino copiado para ${copied} dia${copied>1?'s':''}!${skipped>0?' ('+skipped+' ignorado'+(skipped>1?'s':'')+')':''}`;
    fb.className = 'dup-feedback';
  }
}

// ─────────────────────────────────────────
//  CONFIRM WORKOUT
// ─────────────────────────────────────────
function renderConfirmBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const exercises = getForDate(key);
  const bar = document.getElementById('confirm-bar');

  if (exercises.length === 0) { bar.innerHTML = ''; return; }

  const confirmed = isConfirmed(key);
  const done = exercises.filter(e => e.done).length;
  const date = dates[activeIdx];
  const dateStr = date.toLocaleDateString('pt-BR', {day:'numeric', month:'long'});

  if (confirmed) {
    bar.innerHTML = `
      <button class="btn-confirm confirmed" disabled>
        ✅ Treino de ${dateStr} confirmado!
      </button>
      <div class="confirm-note">
        Parabéns! Você registrou <strong>${done} de ${exercises.length}</strong> exercícios concluídos neste dia. 💗
      </div>
    `;
  } else {
    bar.innerHTML = `
      <button class="btn-confirm" onclick="confirmWorkout('${key}')">
        🏋️ Confirmar treino de hoje
      </button>
      <div class="confirm-note">
        Clique para confirmar que você fez o treino de <strong>${dateStr}</strong> e registrar no seu histórico.
      </div>
    `;
  }
}

function confirmWorkout(key) {
  setConfirmed(key, true);
  // also mark all exercises as done
  const arr = getForDate(key);
  arr.forEach(e => e.done = true);
  saveForDate(key, arr);
  renderMain();
  if (document.getElementById('overlay').classList.contains('open')) renderReport();
  showCelebration(key);
}

function showCelebration(key) {
  const date = new Date(key + 'T12:00:00');
  const dateStr = date.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
  const exercises = getForDate(key);
  const done = exercises.filter(e=>e.done).length;

  // count total confirmed days
  const d = load();
  const totalConfirmed = Object.keys(d.confirmed || {}).length;

  // session duration
  const sess = getSession(key);
  let durStr = '—';
  if (sess.checkin && sess.checkout) {
    const m = Math.round((new Date(sess.checkout)-new Date(sess.checkin))/60000);
    if (m > 0) { const h=Math.floor(m/60); durStr = h>0 ? `${h}h${m%60>0?' '+m%60+'m':''}` : `${m}min`; }
  }

  document.getElementById('cel-day-label').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  document.getElementById('cel-stats').innerHTML = `
    <div class="cel-stat"><div class="cel-stat-num">${exercises.length}</div><div class="cel-stat-label">Exercícios<br>no treino</div></div>
    <div class="cel-stat"><div class="cel-stat-num">${done}</div><div class="cel-stat-label">Exercícios<br>concluídos</div></div>
    <div class="cel-stat"><div class="cel-stat-num" style="font-size:${durStr.length>5?'1.1rem':'1.8rem'}">${durStr}</div><div class="cel-stat-label">Tempo na<br>academia</div></div>
    <div class="cel-stat"><div class="cel-stat-num">${totalConfirmed}</div><div class="cel-stat-label">Treinos<br>confirmados</div></div>
  `;

  const overlay = document.getElementById('celebration-overlay');
  overlay.classList.add('show');
  spawnConfetti();
}

function closeCelebration() {
  document.getElementById('celebration-overlay').classList.remove('show');
}

function spawnConfetti() {
  const box = document.getElementById('celebration-box');
  const colors = ['#ff4da6','#f5aac8','#c084fc','#ffc2e2','#d63f7e','#ffb3d9','#e8619a'];
  // remove old confetti
  box.querySelectorAll('.confetti-piece').forEach(el => el.remove());

  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random()*100}%;
      top: ${Math.random()*30}%;
      background: ${colors[Math.floor(Math.random()*colors.length)]};
      width: ${6+Math.random()*8}px;
      height: ${6+Math.random()*8}px;
      border-radius: ${Math.random()>0.5?'50%':'3px'};
      animation-duration: ${1.2+Math.random()*1.8}s;
      animation-delay: ${Math.random()*0.8}s;
    `;
    box.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ─────────────────────────────────────────
//  REPORT
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

function closeReport(e) {
  if (e.target === document.getElementById('overlay')) closeReportBtn();
}

function setPeriod(period, btn) {
  activePeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const customDiv = document.getElementById('custom-range');
  if (period === 'custom') {
    customDiv.classList.add('visible');
    // Set default range to current month if not set
    if (!customFrom) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth()+1).padStart(2,'0');
      const d = String(now.getDate()).padStart(2,'0');
      document.getElementById('date-from').value = `${y}-${m}-01`;
      document.getElementById('date-to').value   = `${y}-${m}-${d}`;
      customFrom = new Date(`${y}-${m}-01T00:00:00`);
      customTo   = new Date(`${y}-${m}-${d}T23:59:59`);
    }
    updateCustomLabel();
  } else {
    customDiv.classList.remove('visible');
  }
  renderReport();
}

function applyCustomRange() {
  const fromVal = document.getElementById('date-from').value;
  const toVal   = document.getElementById('date-to').value;
  if (!fromVal || !toVal) return;

  customFrom = new Date(fromVal + 'T00:00:00');
  customTo   = new Date(toVal   + 'T23:59:59');

  if (customFrom > customTo) {
    // swap
    [customFrom, customTo] = [customTo, customFrom];
    document.getElementById('date-from').value = toVal;
    document.getElementById('date-to').value   = fromVal;
  }

  updateCustomLabel();
  renderReport();
}

function updateCustomLabel() {
  const el = document.getElementById('custom-range-result');
  if (!customFrom || !customTo) { el.textContent = ''; return; }
  const diffMs   = customTo - customFrom;
  const diffDays = Math.round(diffMs / 86400000) + 1;
  el.textContent = `${diffDays} dia${diffDays !== 1 ? 's' : ''} selecionado${diffDays !== 1 ? 's' : ''}`;
}

// Returns {start, end} Date objects for current period
function getPeriodRange(period) {
  const now = new Date();
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const start = new Date(); start.setHours(0,0,0,0);

  if (period === 'week') {
    // always use current real week for report
    const realNow = new Date();
    const day = realNow.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon = new Date(realNow); mon.setDate(realNow.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
    return {start:mon, end:sun};
  }
  if (period === 'month') {
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth()+1, 0);
    end.setHours(23,59,59,999);
    return {start, end};
  }
  if (period === 'semester') {
    const m = now.getMonth();
    const semStart = m < 6 ? 0 : 6;
    start.setMonth(semStart,1);
    const semEnd = semStart + 5;
    const end = new Date(start.getFullYear(), semEnd+1, 0);
    end.setHours(23,59,59,999);
    return {start, end};
  }
  if (period === 'year') {
    start.setMonth(0,1);
    const end = new Date(start.getFullYear(),11,31);
    end.setHours(23,59,59,999);
    return {start, end};
  }
  // custom range
  if (period === 'custom') {
    if (customFrom && customTo) return {start: customFrom, end: customTo};
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth()+1, 0);
    end.setHours(23,59,59,999);
    return {start, end};
  }
  // all — include past and future entries
  const keys = Object.keys(allEntries()).sort();
  if (keys.length === 0) return {start:new Date(2024,0,1), end:todayEnd};
  const lastKey = keys[keys.length - 1];
  const lastDate = new Date(lastKey + 'T23:59:59');
  const endAll = lastDate > todayEnd ? lastDate : todayEnd;
  return {start: new Date(keys[0] + 'T00:00:00'), end: endAll};
}

// Filter entries by period, returns [{dateKey, date, exercises}]
function getFilteredDays(period) {
  const {start, end} = getPeriodRange(period);
  const entries = allEntries();
  const result = [];
  Object.entries(entries).forEach(([key, exs]) => {
    const d = new Date(key+'T12:00:00');
    if (d >= start && d <= end && exs.length > 0) {
      result.push({key, date:d, exercises:exs});
    }
  });
  return result.sort((a,b)=>b.date-a.date);
}

function renderReport() {
  const days = getFilteredDays(activePeriod);

  // ── SUMMARY STRIP ──
  const totalEx   = days.reduce((s,d)=>s+d.exercises.length,0);
  const totalDone = days.reduce((s,d)=>s+d.exercises.filter(e=>e.done).length,0);
  const diasTreinou = days.length;
  const taxa = totalEx===0?0:Math.round((totalDone/totalEx)*100);

  document.getElementById('summary-strip').innerHTML = `
    <div class="sum-card"><div class="sum-num">${totalEx}</div><div class="sum-label">Exercícios<br>registrados</div></div>
    <div class="sum-card"><div class="sum-num mid">${totalDone}</div><div class="sum-label">Exercícios<br>concluídos</div></div>
    <div class="sum-card"><div class="sum-num purple">${diasTreinou}</div><div class="sum-label">Dias que<br>treinou</div></div>
    <div class="sum-card"><div class="sum-num rose">${taxa}%</div><div class="sum-label">Taxa de<br>conclusão</div></div>
  `;

  // ── HEATMAP ──
  renderHeatmap();

  // ── TOP EXERCISES ──
  const freq = {};
  days.forEach(d => d.exercises.forEach(e => {
    const n = e.name.toLowerCase().trim();
    freq[n] = (freq[n]||0)+1;
  }));

  const topEx = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxFreq = topEx.length > 0 ? topEx[0][1] : 1;
  const rankClasses = ['gold','silver','bronze'];

  const topList = document.getElementById('top-ex-list');
  if (topEx.length === 0) {
    topList.innerHTML = `<div class="no-data"><span class="no-data-icon">🌸</span>Nenhum dado para este período.</div>`;
  } else {
    topList.innerHTML = topEx.map(([name,count],i) => `
      <div class="top-ex-item">
        <div class="top-ex-rank ${i<3?rankClasses[i]:''}">${i+1}</div>
        <div class="top-ex-name">${cap(name)}</div>
        <div class="top-ex-bar-wrap"><div class="top-ex-bar" style="width:${(count/maxFreq)*100}%"></div></div>
        <div>
          <div class="top-ex-count">${count}</div>
          <div class="top-ex-label">vez${count>1?'es':''}</div>
        </div>
      </div>
    `).join('');
  }

  // ── DAY LOG ──
  const logList = document.getElementById('day-log-list');
  if (days.length === 0) {
    logList.innerHTML = `<div class="no-data"><span class="no-data-icon">💗</span>Nenhum treino registrado neste período.<br>Comece adicionando exercícios!</div>`;
  } else {
    logList.innerHTML = days.map(d => {
      const day = d.date.getDate();
      const mon = MONTHS_PT[d.date.getMonth()];
      const weekDay = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.date.getDay()];
      const done = d.exercises.filter(e=>e.done).length;
      const confirmed = isConfirmed(d.key);
      const sess = getSession(d.key);
      let sessStr = '';
      if (sess.checkin) {
        const ci = new Date(sess.checkin).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        const co = sess.checkout ? new Date(sess.checkout).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : null;
        let dur = '';
        if (sess.checkout) {
          const m = Math.round((new Date(sess.checkout)-new Date(sess.checkin))/60000);
          if (m > 0) { const h=Math.floor(m/60); dur = ` · ${h>0?h+'h ':''}${m%60>0?m%60+'min':''}`; }
        }
        sessStr = `<div style="font-size:0.72rem;color:var(--pink-mid);font-weight:500;margin-bottom:5px">⏱️ ${ci}${co?' → '+co:''}${dur}</div>`;
      }
      const tags = d.exercises.map(e=>
        `<span class="log-ex-tag ${e.done?'done-tag':''}">${esc(e.name)}</span>`
      ).join('');
      return `
        <div class="day-log-item" style="${confirmed?'border-color:rgba(46,204,113,0.3);background:rgba(46,204,113,0.04)':''}">
          <div class="log-date">${day}<br><span style="font-size:1rem;color:var(--pink-mid)">${mon}</span><small>${weekDay}</small></div>
          <div style="flex:1">
            ${confirmed ? `<div style="font-size:0.7rem;color:#27ae60;font-weight:600;letter-spacing:1px;margin-bottom:6px;">✅ TREINO CONFIRMADO</div>` : ''}
            ${sessStr}
            <div class="log-exercises">${tags}</div>
          </div>
          <div class="log-count">${done}/${d.exercises.length}<small>feitos</small></div>
        </div>
      `;
    }).join('');
  }
}

function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';
  const {start, end} = getPeriodRange(activePeriod);
  const entries = allEntries();
  const todayStr = dateKey(new Date());

  // Build day array padded to full weeks
  const startSun = new Date(start);
  startSun.setDate(start.getDate() - start.getDay()); // go back to Sunday
  startSun.setHours(0,0,0,0);

  const endSat = new Date(end);
  const endDay = end.getDay();
  if (endDay !== 6) endSat.setDate(end.getDate() + (6 - endDay));
  endSat.setHours(23,59,59,999);

  const cells = [];
  const cur = new Date(startSun);
  while (cur <= endSat) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate()+1);
  }

  // max exercises in a day (for level calc)
  const counts = cells.map(d => (entries[dateKey(d)]||[]).length);
  const maxC = Math.max(...counts, 1);

  cells.forEach(d => {
    const key = dateKey(d);
    const count = (entries[key]||[]).length;
    const inRange = d >= start && d <= end;
    const div = document.createElement('div');

    if (!inRange) { div.className='hm-cell empty'; }
    else {
      let level = 0;
      if (count > 0) level = Math.ceil((count/maxC)*4);
      div.className = `hm-cell ${count>0?'has-data':''} ${count>0?'level'+level:''} ${key===todayStr?'today':''}`;
      if (count > 0) {
        div.title = `${d.toLocaleDateString('pt-BR')}: ${count} exercício${count>1?'s':''}`;
        div.textContent = count <= 3 ? count : '';
      }
    }
    grid.appendChild(div);
  });
}

// ─────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cap(s) { return s.charAt(0).toUpperCase()+s.slice(1); }

// ─────────────────────────────────────────
//  TREINOS PRÉ-SALVOS
// ─────────────────────────────────────────
const PRESETS = [
  { name: "Quadríceps", icon: "🦵" },
  { name: "Panturrilha", icon: "🦶" },
  { name: "Glúteo",     icon: "🍑" },
  { name: "Costas",     icon: "🔙" },
  { name: "Bíceps",     icon: "💪" },
  { name: "Escada",     icon: "🏃‍♀️" },
];

function renderPresetChips() {
  const container = document.getElementById('presets-chips');
  if (!container) return;

  const dates   = getWeekDates();
  const key     = dateKey(dates[activeIdx]);
  const current = getForDate(key).map(e => e.name.toLowerCase());

  container.innerHTML = '';
  PRESETS.forEach(preset => {
    const isAdded = current.includes(preset.name.toLowerCase());
    const chip = document.createElement('button');
    chip.className = 'preset-chip' + (isAdded ? ' added' : '');
    chip.innerHTML = `<span class="preset-chip-icon">${preset.icon}</span>${preset.name}${isAdded ? ' ✓' : ''}`;
    chip.title = isAdded ? 'Já adicionado' : `Adicionar ${preset.name}`;
    chip.onclick = () => {
      if (!isAdded) {
        addPresetExercise(preset.name);
      }
    };
    container.appendChild(chip);
  });
}

function addPresetExercise(name) {
  const key = dateKey(getWeekDates()[activeIdx]);
  const arr = getForDate(key);
  // Evita duplicata
  if (arr.some(e => e.name.toLowerCase() === name.toLowerCase())) return;
  arr.push({ id: Date.now(), name, time: '', done: false });
  saveForDate(key, arr);
  renderMain();
}

// ─────────────────────────────────────────
//  GEOLOCALIZAÇÃO — NOTIFICAÇÃO NA ACADEMIA
// ─────────────────────────────────────────
const ACADEMIA = {
  lat: -3.756198272665352, 
  lng: -38.56503948107475,
  raioMetros: 200  // raio de detecção em metros
};

let geoWatchId = null;
let geoBannerDismissed = false;
let geoNotifiedToday   = null;

function calcDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371000; // raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function iniciarGeoWatch() {
  if (!("geolocation" in navigator)) return;

  navigator.permissions?.query({ name: 'geolocation' }).then(perm => {
    if (perm.state === 'denied') return;
    startWatch();
  }).catch(() => startWatch());

  function startWatch() {
    geoWatchId = navigator.geolocation.watchPosition(pos => {
      const dist = calcDistancia(
        pos.coords.latitude, pos.coords.longitude,
        ACADEMIA.lat, ACADEMIA.lng
      );

      const hoje = dateKey(new Date());

      if (dist <= ACADEMIA.raioMetros) {
        // Está na academia
        if (!geoBannerDismissed && geoNotifiedToday !== hoje) {
          geoNotifiedToday = hoje;
          mostrarGeoBanner();
        }
      } else {
        // Saiu da academia
        if (geoNotifiedToday === hoje) {
          geoBannerDismissed = false; // permite notificar novamente se voltar
        }
        ocultarGeoBanner();
      }
    }, err => {
      console.warn("Geo error:", err.message);
    }, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 15000
    });
  }
}

function mostrarGeoBanner() {
  const banner = document.getElementById('geo-banner');
  if (banner) banner.classList.add('visible');
}

function ocultarGeoBanner() {
  const banner = document.getElementById('geo-banner');
  if (banner) banner.classList.remove('visible');
}

function dismissGeoBanner(e) {
  e.stopPropagation();
  geoBannerDismissed = true;
  ocultarGeoBanner();
}

function geoCheckinNow() {
  ocultarGeoBanner();
  geoBannerDismissed = true;
  // Muda para o dia de hoje e faz check-in
  weekOffset = 0;
  activeIdx  = todayWeekIdx();
  renderMain();
  const key = dateKey(getWeekDates()[activeIdx]);
  const sess = getSession(key);
  if (!sess.checkin) {
    doCheckin(key);
  }
  // Scroll para o topo suavemente
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────

// ─────────────────────────────────────────
//  PWA — SERVICE WORKER & INSTALL PROMPT
// ─────────────────────────────────────────
let deferredInstallPrompt = null;

// Captura o evento de instalação (Android Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});




// Detecta se já está instalado como PWA
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  console.log('✅ Rodando como PWA instalado');
}

// Registra Service Worker para funcionamento offline
if ('serviceWorker' in navigator) {
  const swCode = `
    const CACHE = 'ce-treino-v1';
    const URLS  = ['./', './index.html'];
    self.addEventListener('install', e => {
      e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
    });
    self.addEventListener('fetch', e => {
      e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./')))
      );
    });
  `;
  const swBlob = new Blob([swCode], {type: 'application/javascript'});
  const swUrl  = URL.createObjectURL(swBlob);
  navigator.serviceWorker.register(swUrl).then(() => {
    console.log('✅ Service Worker registrado — app funciona offline!');
  }).catch(e => console.warn('SW error:', e));
}


// ─────────────────────────────────────────
//  HAPTIC FEEDBACK (vibração leve no mobile)
// ─────────────────────────────────────────
function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [10], medium: [20], success: [10, 50, 10], error: [30, 20, 30] };
  navigator.vibrate(patterns[type] || patterns.light);
}

// Adiciona haptic nos eventos de toque importantes
document.addEventListener('DOMContentLoaded', () => {
  // Chips de treino
  document.addEventListener('click', e => {
    if (e.target.closest('.preset-chip:not(.added)')) haptic('light');
    if (e.target.closest('.ex-check'))   haptic('light');
    if (e.target.closest('.btn-checkin')) haptic('medium');
    if (e.target.closest('.btn-checkout')) haptic('success');
    if (e.target.closest('.day-tab'))    haptic('light');
  });
});
// ── LÓGICA DA CREATINA ──

// Verifica se tomou creatina no dia
function isCreatineTaken(key) {
  const d = load();
  return !!(d.creatine && d.creatine[key]);
}

// Salva o check-in da creatina
function toggleCreatine(key) {
  const d = load();
  if (!d.creatine) d.creatine = {};
  
  if (d.creatine[key]) delete d.creatine[key];
  else d.creatine[key] = true;
  
  save(d);
  renderMain();
  haptic('success');
}

// Renderiza a barra de creatina
function renderCreatineBar() {
  const dates = getWeekDates();
  const key = dateKey(dates[activeIdx]);
  const taken = isCreatineTaken(key);
  const container = document.getElementById('creatine-bar');
  
  container.innerHTML = `
    <div class="creatine-bar ${taken ? 'taken' : ''}">
      <div class="creatine-icon">${taken ? '🥤' : '🥛'}</div>
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

// Alarme das 21h
function checkCreatineReminder() {
  const agora = new Date();
  // Se for 21h (9 da noite) e não tiver sido notificado na última hora
  if (agora.getHours() === 21 && agora.getMinutes() === 0) {
    if (!sessionStorage.getItem('creatine_notified')) {
      if (confirm("🔔 Cams, hora da Creatina! Já tomou?")) {
        const hoje = dateKey(new Date());
        toggleCreatine(hoje);
      }
      sessionStorage.setItem('creatine_notified', 'true');
    }
  } else {
    // Reseta para poder notificar no dia seguinte
    if (agora.getHours() !== 21) {
      sessionStorage.removeItem('creatine_notified');
    }
  }
}
function init() {
  weekOffset = 0;
  activeIdx = todayWeekIdx();
  updateDateBadge();
  renderMain();
  setTimeout(renderOverview, 120);
  // Inicia monitoramento de localização
  iniciarGeoWatch();
  // Esconde splash — timing calculado para cobrir o splash nativo
  const splash = document.getElementById('splash');
  if (splash) {
    // Splash aparece IMEDIATAMENTE (cobre a tela nativa do sistema)
    // Fica por 2.6s para as animações terminarem, depois dissolve suavemente
    const hideSplash = () => {
      splash.classList.add('hide');
      setTimeout(() => {
        splash.style.display = 'none';
        splash.remove();
      }, 900);
    };
    setTimeout(hideSplash, 2600);

    // Toque na splash pula para o app
    splash.addEventListener('click', () => {
      if (!splash.classList.contains('hide')) hideSplash();
    });
  }
}

init();
