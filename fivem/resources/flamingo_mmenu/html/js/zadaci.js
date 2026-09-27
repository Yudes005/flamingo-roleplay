/* ============================================================
   ZADACI (leva traka -> Zadaci -> Dnevni / Nedeljni)
   Podaci stižu sa servera (server/zadaci.lua) preko 'updateTasks'.
   Nagrada je samo novac. Zadaci se menjaju u ponoć / ponedeljkom.
   ============================================================ */

const TASK_TABS = [
  { id: 'daily',  label: 'Dnevni zadaci',   icon: 'fa-calendar-day',  resetText: 'Novi dnevni zadaci za' },
  { id: 'weekly', label: 'Nedeljni zadaci', icon: 'fa-calendar-week', resetText: 'Novi nedeljni zadaci za' }
];

let activeTaskTab = 'daily';
let taskData = null;          // { daily: {key, resetIn, tasks}, weekly: {...}, account }
let taskDataReceivedAt = 0;   // Date.now() kad je stiglo (za odbrojavanje)
let taskTimer = null;
let taskRefreshTimer = null;

function requestTaskRefresh() {
  fetch(`https://${GetParentResourceName()}/requestTaskData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => {});
}

function taskNum(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('sr-RS');
}

function taskMoney(v) {
  return `$${taskNum(v)}`;
}

function formatTaskValue(value, unit) {
  const v = Math.max(0, Number(value) || 0);
  if (unit === 'min') {
    const h = Math.floor(v / 60);
    const m = Math.floor(v % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  if (unit === 'km') {
    return `${(v / 1000).toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }
  if (unit === 'm') return `${taskNum(Math.floor(v))} m`;
  return unit ? `${taskNum(v)} ${unit}` : taskNum(v);
}

function formatCountdown(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function periodSecondsLeft(period) {
  const p = taskData && taskData[period];
  if (!p) return 0;
  return (Number(p.resetIn) || 0) - (Date.now() - taskDataReceivedAt) / 1000;
}

function taskReadyCount(period) {
  const p = taskData && taskData[period];
  if (!p || !Array.isArray(p.tasks)) return 0;
  return p.tasks.filter(t => !t.claimed && t.progress >= t.target).length;
}

// tačkica na "Zadaci" u traci kad ima nagrada za pokupiti
function updateTaskDots() {
  const btn = document.querySelector('.mmenu-rail-btn[data-category="zadaci"]');
  const any = taskReadyCount('daily') + taskReadyCount('weekly') > 0;
  if (btn) btn.classList.toggle('has-dot', any);

  document.querySelectorAll('.mmenu-rail-sub-item[data-task-tab]').forEach(el => {
    el.classList.toggle('has-dot', taskReadyCount(el.dataset.taskTab) > 0);
  });
}

function renderTaskSubmenu() {
  const wrap = document.getElementById('mmenuRailTaskSubmenu');
  if (!wrap) return;

  wrap.innerHTML = TASK_TABS.map(t => `
    <button class="mmenu-rail-sub-item ${activeTaskTab === t.id ? 'active' : ''}" data-task-tab="${t.id}">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  wrap.querySelectorAll('.mmenu-rail-sub-item[data-task-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeTaskTab = btn.dataset.taskTab;
      openCategory('zadaci');
    });
  });

  updateTaskDots();
}

function taskCardHtml(t, period) {
  const target = Math.max(1, Number(t.target) || 1);
  const progress = Math.min(Number(t.progress) || 0, target);
  const done = progress >= target;
  const claimed = !!t.claimed;
  const ready = done && !claimed;
  const pct = claimed ? 100 : Math.round((progress / target) * 100);

  const state = claimed ? 'claimed' : ready ? 'ready' : 'locked';
  const pill = claimed
    ? '<span class="fl-day-card-pill fl-day-card-pill--claimed"><i class="fa-solid fa-check"></i> Pokupljeno</span>'
    : ready
      ? '<span class="fl-day-card-pill fl-day-card-pill--ready">Završeno</span>'
      : `<span class="fl-day-card-pill">${pct}%</span>`;

  return `
    <div class="fl-task-card fl-task-card--${state}">
      <div class="fl-task-card-icon"><i class="fa-solid ${escapeHtml(t.icon || 'fa-list-check')}"></i></div>
      <div class="fl-task-card-body">
        <div class="fl-task-card-top">
          <span class="fl-task-card-label">${escapeHtml(t.label)}</span>
          ${pill}
        </div>
        <p class="fl-task-card-desc">${escapeHtml(t.description || '')}</p>
        <div class="fl-playtime-card-progress">
          <div class="fl-playtime-card-progress-bar"><div class="fl-playtime-card-progress-fill" style="width:${pct}%;"></div></div>
          <span class="fl-playtime-card-progress-text">${escapeHtml(formatTaskValue(progress, t.unit))} / ${escapeHtml(formatTaskValue(target, t.unit))}</span>
        </div>
      </div>
      <div class="fl-task-card-side">
        <span class="fl-task-card-xp"><i class="fa-solid fa-money-bill-wave fl-task-money-icon"></i>${escapeHtml(taskMoney(t.money))}</span>
        ${ready ? `<button class="fl-day-claim-btn fl-task-claim-btn" data-sfx="none" data-period="${period}" data-task-id="${escapeHtml(t.id)}"><i class="fa-solid fa-sack-dollar"></i> Pokupi</button>` : ''}
      </div>
    </div>
  `;
}

function renderZadaci() {
  renderTaskSubmenu();

  const tab = TASK_TABS.find(t => t.id === activeTaskTab) || TASK_TABS[0];
  const period = taskData && taskData[tab.id];

  if (!period) {
    categoryBody.innerHTML = `
      <div class="fl-empty">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Učitavam zadatke...</span>
      </div>
    `;
    stopTaskTimers();
    return;
  }

  const tasks = Array.isArray(period.tasks) ? period.tasks : [];
  const doneCount = tasks.filter(t => t.claimed || t.progress >= t.target).length;
  const earned = tasks.filter(t => t.claimed).reduce((a, t) => a + (Number(t.money) || 0), 0);
  const total = tasks.reduce((a, t) => a + (Number(t.money) || 0), 0);
  const readyCount = taskReadyCount(tab.id);
  const accountLabel = taskData.account === 'bank' ? 'na račun u banci' : 'u kešu';

  categoryBody.innerHTML = `
    <div class="fl-tasks-page">
      <div class="fl-tasks-summary">
        <div class="fl-tasks-summary-main">
          <div class="fl-tasks-summary-icon"><i class="fa-solid ${tab.icon}"></i></div>
          <div class="fl-tasks-summary-text">
            <span class="fl-tasks-summary-title">${escapeHtml(tab.label)}</span>
            <span class="fl-tasks-summary-sub">${escapeHtml(tab.resetText)} <b id="taskResetTimer">${formatCountdown(periodSecondsLeft(tab.id))}</b></span>
          </div>
        </div>
        <div class="fl-tasks-stats">
          <div class="fl-tasks-stat">
            <span class="fl-tasks-stat-label">Završeno</span>
            <span class="fl-tasks-stat-value">${doneCount}<small>/${tasks.length}</small></span>
          </div>
          <div class="fl-tasks-stat">
            <span class="fl-tasks-stat-label">Zarađeno</span>
            <span class="fl-tasks-stat-value">${escapeHtml(taskMoney(earned))}</span>
          </div>
          <div class="fl-tasks-stat">
            <span class="fl-tasks-stat-label">Ukupno moguće</span>
            <span class="fl-tasks-stat-value fl-tasks-stat-value--accent">${escapeHtml(taskMoney(total))}</span>
          </div>
        </div>
      </div>

      ${readyCount > 1 ? `
        <div class="fl-tasks-claimall-row">
          <span>Imaš <b>${readyCount}</b> završena zadatka za pokupiti.</span>
          <button class="fl-btn-primary fl-tasks-claimall" data-sfx="none"><i class="fa-solid fa-sack-dollar"></i> Pokupi sve</button>
        </div>
      ` : ''}

      ${tasks.length ? `<div class="fl-task-list">${tasks.map(t => taskCardHtml(t, tab.id)).join('')}</div>` : `
        <div class="fl-empty">
          <i class="fa-solid fa-list-check"></i>
          <span>Trenutno nema aktivnih zadataka.</span>
        </div>
      `}

      <p class="fl-tasks-note">
        <i class="fa-solid fa-circle-info"></i>
        Nagrada za zadatke je samo novac (isplata ${escapeHtml(accountLabel)}). Zadaci ne daju XP - nivo se dobija igranjem (svaki sat).
        ${tab.id === 'daily' ? 'Dnevni zadaci se menjaju svaki dan u ponoć.' : 'Nedeljni zadaci se menjaju svakog ponedeljka u ponoć.'}
      </p>
    </div>
  `;

  categoryBody.querySelectorAll('.fl-task-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimTaskBtn(btn));
  });

  const allBtn = categoryBody.querySelector('.fl-tasks-claimall');
  if (allBtn) {
    allBtn.addEventListener('click', () => {
      allBtn.disabled = true;
      allBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pokupljam...';
      categoryBody.querySelectorAll('.fl-task-claim-btn').forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      });
      fetch(`https://${GetParentResourceName()}/claimTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: tab.id, taskId: '*' })
      }).catch(() => {});
    });
  }

  startTaskTimers();
}

function claimTaskBtn(btn) {
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  fetch(`https://${GetParentResourceName()}/claimTask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: btn.dataset.period, taskId: btn.dataset.taskId })
  }).catch(() => {});
}

function startTaskTimers() {
  if (!taskTimer) {
    taskTimer = setInterval(() => {
      if (currentCategory !== 'zadaci') { stopTaskTimers(); return; }
      const el = document.getElementById('taskResetTimer');
      const left = periodSecondsLeft(activeTaskTab);
      if (el) el.textContent = formatCountdown(left);
      if (left <= 0 && Date.now() - taskDataReceivedAt > 5000) {
        taskDataReceivedAt = Date.now(); // spreči spam dok ne stigne novo
        requestTaskRefresh();
      }
    }, 1000);
  }

  // napredak vožnje/pešačenja se menja dok je meni otvoren - osveži na 20s
  if (!taskRefreshTimer) {
    taskRefreshTimer = setInterval(() => {
      if (currentCategory !== 'zadaci' || app.classList.contains('hidden')) { stopTaskTimers(); return; }
      requestTaskRefresh();
    }, 20000);
  }
}

function stopTaskTimers() {
  if (taskTimer) { clearInterval(taskTimer); taskTimer = null; }
  if (taskRefreshTimer) { clearInterval(taskRefreshTimer); taskRefreshTimer = null; }
}

function applyTaskData(data) {
  if (!data) return;
  taskData = data;
  taskDataReceivedAt = Date.now();
  if (currentPlayer) currentPlayer.tasks = data;
  updateTaskDots();
  if (currentCategory === 'zadaci') renderZadaci();
}

window.addEventListener('message', (event) => {
  const d = event.data || {};

  if (d.action === 'openMenu') {
    renderTaskSubmenu();
    if (d.player && d.player.tasks) applyTaskData(d.player.tasks);
  }

  if (d.action === 'updateTasks') {
    applyTaskData(d.tasks);
  }

  if (d.action === 'taskClaimed') {
    const r = d.result || {};
    if (r.success && window.flSound) window.flSound.play('reward');
    if (!r.success && window.flSound) window.flSound.play('error');
    // server odmah šalje i svež 'updateTasks', pa se ekran sam osveži
  }

  if (d.action === 'closeMenu') stopTaskTimers();
});

renderTaskSubmenu();
