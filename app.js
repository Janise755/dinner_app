/* ============================================================
 * DINNER BOARD — data model
 * data = {
 *   members: ["Dad", "Mom", ...],
 *   entries: { "2026-11-02": { "Dad": { "Mon": 1, "Tue": 2, ... } } },
 *   rules:   [ { member, type:"weekly", day:1, status:0 },
 *              { member, type:"monthly", nth:1, day:5, status:2 } ]
 * }
 *
 * State values: 0 = not coming, 1 = on time, 2 = early, 3 = late
 * Default (no rule, no override): 1 = on time
 * ============================================================ */

const STORAGE_KEY = 'dinnerBoard';
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];           // display labels
const DOW  = [1,2,3,4,5,6,0];                                       // JS Date.getDay() values
const STATES = [
  { label: '– Not coming',   short: 'Not coming', display: '—',           badge: null,   cls: 's0' },
  { label: '🍽️ On time',      short: 'On time',    display: '🍽️ Dinner',   badge: null,   cls: 's1' },
  { label: '🕕 Early dinner', short: 'Early',      display: '🍽️ Dinner',   badge: 'early',cls: 's2' },
  { label: '🌙 Late dinner',  short: 'Late',       display: '🍽️ Dinner',   badge: 'late', cls: 's3' },
];
const FIXED_MEMBERS = ['Dad', 'Mum', 'Abbie', 'Janise', 'Zoe'];

/* ---------- Storage ---------- */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      d.rules = (d.rules || []).map((r) => ({
        ...r,
        status: Number.isInteger(r.status) ? r.status : 0, // old rules were "no dinner"
      }));
      d.entries = d.entries || {};
      d.members = FIXED_MEMBERS;
      return d;
    } catch (e) {
      console.warn('Could not parse saved dinner board data, starting fresh.', e);
    }
  }
  return {
    members: FIXED_MEMBERS,
    entries: {},
    rules: [],
  };
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem('lastUpdated', new Date().toISOString());
}

/* ---------- Date helpers ---------- */
function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0,0,0,0);
  return d;
}
function weekKey(m) {
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const d = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
function dayDate(monday, i) { const d = new Date(monday); d.setDate(d.getDate()+i); return d; }
function fmtRange(monday) {
  const fri = new Date(monday); fri.setDate(fri.getDate()+4);
  const o = { month:'short', day:'numeric' };
  return `${monday.toLocaleDateString(undefined,o)} – ${fri.toLocaleDateString(undefined,o)}`;
}
function fmtDay(date) {
  return date.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}

const DEFAULT_STATE = 1; // on time / coming

function ruleMatches(r, date) {
  if (r.type === 'weekly') return date.getDay() === r.day;
  if (r.type === 'monthly') {
    return date.getDay() === r.day && Math.ceil(date.getDate() / 7) === r.nth;
  }
  return false;
}

/* ---------- Rule evaluation ---------- */
// Returns the rule status if a rule matches this date, else null.
function ruleStatusFor(member, date) {
  for (const r of data.rules) {
    if (r.member !== member) continue;
    if (ruleMatches(r, date)) return r.status;
  }
  return null;
}

/* ---------- Get/set a cell (rule-aware) ---------- */
function getCell(weekKeyStr, member, dayLabel, date) {
  const stored = data.entries[weekKeyStr]?.[member]?.[dayLabel];
  if (stored !== undefined) return stored;      // explicit override
  const rule = ruleStatusFor(member, date);
  if (rule !== null) return rule;
  return DEFAULT_STATE;
}
function setCell(weekKeyStr, member, dayLabel, value) {
  if (!data.entries[weekKeyStr]) data.entries[weekKeyStr] = {};
  if (!data.entries[weekKeyStr][member]) data.entries[weekKeyStr][member] = {};
  data.entries[weekKeyStr][member][dayLabel] = value;
  saveData(data);
}
function cycleState(current) { return (current + 1) % STATES.length; }

/* ---------- Shared: build the grid for a week ---------- */
function buildWeekGrid(container, monday, compact=false) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'week-grid';
  const wKey = weekKey(monday);

  DAYS.forEach((dayLabel, i) => {
    const date = dayDate(monday, i);
    const block = document.createElement('div');
    block.className = 'day-block';

    const h3 = document.createElement('h3');
    const isToday = date.toDateString() === new Date().toDateString();
    h3.textContent = fmtDay(date);
    if (isToday) h3.classList.add('today');
    block.appendChild(h3);

    data.members.forEach((member) => {
      const row = document.createElement('div');
      row.className = 'member-row';
      const name = document.createElement('span');
      name.textContent = member;
      row.appendChild(name);

      const btn = document.createElement('button');
      const state = getCell(wKey, member, dayLabel, date);
      btn.className = `mini-state-btn ${STATES[state].cls}`;
      btn.textContent = STATES[state].short;
      btn.onclick = () => {
        setCell(wKey, member, dayLabel, cycleState(state));
        buildWeekGrid(container, monday, compact);
        if (!compact) renderToday(); // keep today in sync if same week
      };
      row.appendChild(btn);
      block.appendChild(row);
    });
    grid.appendChild(block);
  });
  container.appendChild(grid);
}

/* ============================================================
 * INPUT PAGE
 * ============================================================ */
function renderToday() {
  const today = new Date();
  const monday = getMondayOf(today);
  const wKey = weekKey(monday);
  const dayLabel = DAYS[(today.getDay() === 0 ? 6 : today.getDay() - 1)];

  document.getElementById('todayLabel').textContent = fmtDay(today);

  const list = document.getElementById('todayList');
  list.innerHTML = '';

  data.members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'today-row';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = member;
    row.appendChild(name);

    const btn = document.createElement('button');
    const state = getCell(wKey, member, dayLabel, today);
    btn.className = `state-btn ${STATES[state].cls}`;
    btn.textContent = STATES[state].label;
    btn.onclick = () => {
      setCell(wKey, member, dayLabel, cycleState(state));
      renderToday();
      renderThisWeek();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function renderThisWeek() {
  const monday = getMondayOf(new Date());
  document.getElementById('thisWeekLabel').textContent = fmtRange(monday);
  buildWeekGrid(document.getElementById('thisWeekGrid'), monday);
}
function renderNextWeek() {
  const monday = getMondayOf(new Date());
  monday.setDate(monday.getDate() + 7);
  document.getElementById('nextWeekLabel').textContent = fmtRange(monday);
  buildWeekGrid(document.getElementById('nextWeekGrid'), monday);
}

function renderRules() {
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  if (data.rules.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No rules yet.';
    list.appendChild(p);
    return;
  }
  data.rules.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const when = r.type === 'weekly'
      ? `every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day]}`
      : `${['1st','2nd','3rd','4th'][r.nth-1]} ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day]} of the month`;
    const st = STATES[r.status] || STATES[DEFAULT_STATE];
    row.innerHTML =
      `<span>${r.member} — ${when} — <span class="rule-status ${st.cls}">${st.short}</span></span>`;
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕';
    del.onclick = () => {
      data.rules.splice(idx, 1);
      saveData(data);
      renderRules();
      renderThisWeek(); renderNextWeek(); renderToday();
    };
    row.appendChild(del);
    list.appendChild(row);
  });
}



function setupRuleForm() {
  const memberSel = document.getElementById('ruleMember');
  const typeSel = document.getElementById('ruleType');
  const daySel = document.getElementById('ruleDay');
  const nthSel = document.getElementById('ruleNth');
  const statusSel = document.getElementById('ruleStatus');
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  memberSel.innerHTML = data.members.map(m => `<option>${m}</option>`).join('');
  daySel.innerHTML = dayNames.map((d,i) => `<option value="${i}">${d}</option>`).join('');
  if (!statusSel.value) statusSel.value = '0';

  typeSel.onchange = () => {
    nthSel.style.display = typeSel.value === 'monthly' ? '' : 'none';
  };

  document.getElementById('addRuleBtn').onclick = () => {
    const r = {
      member: memberSel.value,
      type: typeSel.value,
      day: parseInt(daySel.value, 10),
      status: parseInt(statusSel.value, 10),
    };
    if (typeSel.value === 'monthly') r.nth = parseInt(nthSel.value, 10);
    data.rules.push(r);
    saveData(data);
    renderRules();
    renderThisWeek(); renderNextWeek(); renderToday();
  };
}

function renderAll() {
  renderToday();
  renderThisWeek();
  renderNextWeek();
  renderRules();
  setupRuleForm();
}

function initInput() {
  renderAll();
}

/* ============================================================
 * DISPLAY PAGE
 * ============================================================ */
function renderDisplayToday() {
  const today = new Date();
  const monday = getMondayOf(today);
  const wKey = weekKey(monday);
  const dayLabel = DAYS[(today.getDay() === 0 ? 6 : today.getDay() - 1)];

  document.getElementById('displayTodayLabel').textContent = fmtDay(today);

  const list = document.getElementById('displayToday');
  list.innerHTML = '';

  data.members.forEach((member) => {
    const state = getCell(wKey, member, dayLabel, today);
    const card = document.createElement('div');
    card.className = 'today-card';

    const nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = member;
    card.appendChild(nameEl);

    const status = document.createElement('div');
    status.className = 'status';
    if (state === 0) {
      status.classList.add('notcoming');
      status.textContent = '—';
    } else {
      status.classList.add('coming');
      const st = STATES[state];
      status.innerHTML = `${st.display}` +
        (st.badge ? ` <span class="badge ${st.badge}">${st.badge}</span>` : '');
    }
    card.appendChild(status);
    list.appendChild(card);
  });
}

function renderDisplayWeek() {
  const monday = getMondayOf(new Date());
  const wKey = weekKey(monday);
  const container = document.getElementById('displayWeek');
  container.innerHTML = '';

  DAYS.forEach((dayLabel, i) => {
    const date = dayDate(monday, i);
    if (date.toDateString() === new Date().toDateString()) return; // skip today (shown above)
    const card = document.createElement('div');
    card.className = 'display-day';
    card.innerHTML = `<h3>${fmtDay(date)}</h3>`;

    data.members.forEach((member) => {
      const state = getCell(wKey, member, dayLabel, date);
      const st = STATES[state];
      const item = document.createElement('div');
      item.className = 'item';
      if (state === 0) item.classList.add('no');
      item.innerHTML = `<span>${member}</span>` +
        (state === 0
          ? `<span>—</span>`
          : `<span>${st.display}` +
            (st.badge ? ` <span class="badge ${st.badge}">${st.badge}</span>` : '') +
            `</span>`);
      card.appendChild(item);
    });
    container.appendChild(card);
  });

  const lu = localStorage.getItem('lastUpdated');
  document.getElementById('lastUpdated').textContent =
    lu ? `Last updated: ${new Date(lu).toLocaleTimeString()}` : '';
}

function renderDisplay() {
  renderDisplayToday();
  renderDisplayWeek();
}

/* ---------- Boot ---------- */
const data = loadData();
const isDisplay = document.body.classList.contains('display-page');

if (isDisplay) {
  renderDisplay();
  setInterval(renderDisplay, 30000);
} else {
  initInput();
}