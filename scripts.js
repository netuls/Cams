/**
 * scripts.js - Cams Exercícios
 * Ajustado para GitHub Pages /Cams/
 */

// --- VARIÁVEIS DE ESTADO ---
let activeIdx = 0; 
let weekOffset = 0;
const DAYS_FULL = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// --- CARREGAMENTO DE DADOS ---
function load() {
    const r = localStorage.getItem('treino_v3');
    return r ? JSON.parse(r) : {entries:{}, confirmed:{}, sessions:{}, creatine:{}};
}

function save(data) {
    localStorage.setItem('treino_v3', JSON.stringify(data));
    // Sincroniza com o Firebase se estiver carregado no window
    if (window._firebaseReady) {
        const ref = window._firebaseDocRef("dados/treino_v3");
        window._firebaseSetDoc(ref, { payload: JSON.stringify(data) }, { merge: true });
    }
}

function dateKey(date) {
    return date.toISOString().slice(0,10);
}

// --- LOGICA DE DATA ---
function getWeekDates() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);
    mon.setHours(0,0,0,0);
    return Array.from({length:7}, (_,i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
}

// --- RENDERIZAÇÃO ---
function renderMain() {
    const dates = getWeekDates();
    const currentKey = dateKey(dates[activeIdx]);
    const data = load();

    // Atualiza nomes do dia
    document.getElementById('active-day-name').textContent = DAYS_FULL[activeIdx];
    document.getElementById('active-day-date').textContent = dates[activeIdx].toLocaleDateString('pt-BR', {day:'numeric', month:'long'});

    renderList(currentKey, data);
    renderStats(currentKey, data);
    renderCreatineBar(currentKey, data);
    renderCheckinBar(currentKey, data);
    updateDateBadge();
}

function renderList(key, data) {
    const list = document.getElementById('ex-list');
    const items = data.entries[key] || [];
    list.innerHTML = items.length ? '' : '<div class="empty-state">Nenhum exercício hoje 🌸</div>';
    
    items.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = `ex-item ${ex.done ? 'done' : ''}`;
        div.innerHTML = `
            <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}', ${idx})"></div>
            <div class="ex-info"><div class="ex-name">${ex.name}</div></div>
            <button class="btn-del" onclick="deleteEx('${key}', ${idx})">✕</button>
        `;
        list.appendChild(div);
    });
}

// --- FUNÇÕES DE INTERAÇÃO ---
window.addExercise = function() {
    const input = document.getElementById('ex-input');
    const name = input.value.trim();
    if (!name) return;
    
    const data = load();
    const key = dateKey(getWeekDates()[activeIdx]);
    if (!data.entries[key]) data.entries[key] = [];
    
    data.entries[key].push({ id: Date.now(), name, done: false });
    save(data);
    input.value = '';
    renderMain();
};

window.toggleEx = function(key, idx) {
    const data = load();
    data.entries[key][idx].done = !data.entries[key][idx].done;
    save(data);
    renderMain();
};

window.deleteEx = function(key, idx) {
    const data = load();
    data.entries[key].splice(idx, 1);
    save(data);
    renderMain();
};

function renderCreatineBar(key, data) {
    const taken = !!(data.creatine && data.creatine[key]);
    document.getElementById('creatine-bar').innerHTML = `
        <div class="creatine-bar ${taken ? 'taken' : ''}">
            <div class="creatine-info">Creatina: <strong>${taken ? 'Tomada ✓' : 'Pendente'}</strong></div>
            <button class="btn-creatine ${taken ? 'done' : ''}" onclick="toggleCreatine('${key}')">
                ${taken ? 'Desmarcar' : 'Check-in'}
            </button>
        </div>
    `;
}

window.toggleCreatine = function(key) {
    const data = load();
    if (!data.creatine) data.creatine = {};
    data.creatine[key] = !data.creatine[key];
    save(data);
    renderMain();
};

// --- INICIALIZAÇÃO ---
function init() {
    const day = new Date().getDay();
    activeIdx = (day === 0) ? 6 : day - 1;
    
    // Esconde Splash
    setTimeout(() => {
        document.getElementById('splash').classList.add('hide');
    }, 2600);

    renderMain();

    // Registro do Service Worker para GitHub Pages
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('SW registrado com sucesso!');
        });
    }
}

window.onload = init;
