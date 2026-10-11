const cards = new Map();
const $ = id => document.getElementById(id);
function save() {
  const round = library.rounds.find(round => round.id === library.activeId);
  round.session = session; round.updatedAt = Date.now();
  try {
    if (storageBlocked) throw new Error('Storage protected');
    const previous = localStorage.getItem(LIBRARY_KEY);
    if (previous) { try { parseLibrary(previous); localStorage.setItem(BACKUP_KEY, previous); } catch { /* Do not replace a good recovery copy with bad data. */ } }
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    $('saveState').textContent = 'All rounds saved on this device';
    $('saveState').dataset.failed = 'false';
    $('saveProblem').hidden = true;
    return true;
  } catch {
    $('saveState').textContent = 'Not saved · export a backup before closing';
    $('saveState').dataset.failed = 'true';
    $('saveProblem').hidden = false;
    return false;
  }
}
function remaining(s, now = Date.now()) { return s.deadline === null ? s.remaining : Math.max(0, Math.ceil((s.deadline - now) / 1000)); }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function resetTimer(s) { s.deadline = null; s.remaining = s.minutes * 60; s.started = false; s.warningGiven = 0; delete s.startedAt; delete s.releaseAt; delete s.startEstimated; delete s.releasedAt; }
function toggleTimer(s) {
  if (s.deadline !== null) { s.remaining = remaining(s); s.deadline = null; }
  else if (s.remaining > 0) {
    if (!hasStarted(s)) {
      const key = Object.keys(session.speakers).find(key => session.speakers[key] === s);
      if (key) { const group = key.split('-')[0]; session.lastStarts[group] = Date.now(); session.lastSpeakers[group] = key; }
      s.startedAt = Date.now();
      s.startEstimated = false;
      s.started = true;
      s.warningGiven = 0;
    }
    s.deadline = Date.now() + s.remaining * 1000;
    s.releaseAt = s.deadline;
  }
  save(); tick();
}
function setRemainingTime(key, seconds) {
  const s = session.speakers[key];
  if (!s || !Number.isInteger(seconds) || seconds < 0 || seconds > s.minutes * 60) return false;
  const group = key.split('-')[0];
  const wasStarted = hasStarted(s);
  const running = s.deadline !== null;
  s.remaining = seconds;
  s.deadline = running && seconds > 0 ? Date.now() + seconds * 1000 : null;
  s.started = wasStarted || seconds < s.minutes * 60;
  if (seconds > 0) delete s.releasedAt;
  if (s.started && !Number.isFinite(s.startedAt)) {
    s.startedAt = Date.now() - (s.minutes * 60 - seconds) * 1000;
    s.startEstimated = true;
  }
  s.releaseAt = s.deadline ?? (seconds === 0 ? Date.now() : null);
  // Re-arm a warning only when the correction moves back above its threshold.
  if (seconds > 900) s.warningGiven = 0;
  else if (seconds > 0 && s.warningGiven === 2) s.warningGiven = 1;
  if ((!wasStarted && s.started) || session.lastSpeakers[group] === key) {
    session.lastSpeakers[group] = key;
    session.lastStarts[group] = Date.now() - (s.minutes * 60 - seconds) * 1000;
  }
  save(); tick(); return true;
}
function editRemainingTime(key) {
  const s = session.speakers[key];
  const value = window.prompt(`Set time remaining for ${speakerLabel(key, s)} (${eventLabel(key)}). Enter minutes or mm:ss, up to ${s.minutes} minutes. The next-start reminder will adapt.`, formatTime(remaining(s)));
  if (value === null) return;
  const match = /^(\d{1,3})(?::([0-5]\d))?$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * 60 + Number(match[2] || 0) : NaN;
  if (!setRemainingTime(key, seconds)) window.alert(`Enter a time between 0:00 and ${formatTime(s.minutes * 60)} (minutes or mm:ss).`);
}
function createCard(group, number) {
  const key = `${group}-${number}`;
  const s = session.speakers[key] ||= {name: '', question: '', minutes: session.defaultMinutes, remaining: session.defaultMinutes * 60, deadline: null};
  const card = document.createElement('article');
  card.className = 'speaker';
  card.innerHTML = `<div class="card-top"><span class="speaker-number">${String(number).padStart(2, '0')}</span><strong class="name"></strong><span class="status" role="status"></span></div><div class="timer" role="timer"></div><div class="timer-caption">PREP TIME REMAINING</div><div class="progress" aria-hidden="true"><span class="progress-fill"></span></div><label class="card-settings">Prep duration <span><input class="duration" type="number" min="1" max="180" step="1"> min</span></label><div class="card-actions"><button class="primary toggle-timer">Start prep</button><button class="reset-timer" title="Reset this timer">↺</button></div>`;
  const find = selector => card.querySelector(selector);
  const defaultName = `${group === 'us' ? 'US ' : group === 'intl' ? 'Intl ' : ''}Speaker ${number}`;
  find('.name').textContent = defaultName;
  find('.timer').setAttribute('aria-label', `${defaultName} prep time remaining`);
  find('.reset-timer').setAttribute('aria-label', `Reset ${defaultName} timer`);
  find('.duration').value = s.minutes;
  find('.duration').addEventListener('change', e => {
    const value = Number(e.target.value);
    if (s.deadline !== null || !Number.isInteger(value) || value < 1 || value > 180) { e.target.value = s.minutes; return; }
    s.minutes = value; resetTimer(s); save(); tick();
  });
  find('.toggle-timer').addEventListener('click', () => toggleTimer(s));
  find('.reset-timer').addEventListener('click', () => {
    if (remaining(s) !== s.minutes * 60 && !window.confirm(`Reset ${s.name || defaultName} to ${s.minutes} minutes?`)) return;
    resetTimer(s); save(); tick();
  });
  cards.set(key, { s, card, timer: find('.timer'), status: find('.status'), progress: find('.progress-fill'), toggle: find('.toggle-timer'), duration: find('.duration') });
  return card;
}
function render() {
  renderRounds();
  cards.clear(); $('speakerGroups').replaceChildren();
  $('roomDescription').textContent = `Start timers manually. The next-start reminder follows your actual start by ${startGap()} minutes.`;
  const groups = session.mode === 'equal' ? ['equal'] : ['us', 'intl'];
  for (const group of groups) {
    const section = document.createElement('section');
    if (group !== 'equal') { const heading = document.createElement('h3'); heading.className = 'group-title'; heading.textContent = group === 'us' ? 'United States' : 'International'; section.appendChild(heading); }
    const grid = document.createElement('div'); grid.className = 'speaker-grid';
    for (let i = 1; i <= session.count; i++) grid.appendChild(createCard(group, i));
    section.appendChild(grid); $('speakerGroups').appendChild(section);
  }
  $('totalCount').textContent = cards.size;
  tick(); save();
}
function tick() {
  const now = Date.now(); let completed = false;
  for (const s of Object.values(session.speakers)) {
    if (s.deadline !== null && remaining(s, now) === 0) { s.releaseAt = s.deadline; s.deadline = null; s.remaining = 0; completed = true; }
  }
  let active = 0; let done = 0;
  for (const { s, card, timer, status, progress, toggle, duration } of cards.values()) {
    const seconds = remaining(s, now);
    const running = s.deadline !== null;
    const state = seconds === 0 ? 'done' : running ? 'running' : seconds < s.minutes * 60 ? 'paused' : 'ready';
    card.dataset.state = state;
    card.dataset.urgency = urgency(seconds);
    timer.textContent = formatTime(seconds);
    const label = {done: 'Time’s up', running: 'Prepping', paused: 'Paused', ready: 'Ready'}[state];
    if (status.textContent !== label) status.textContent = label;
    progress.style.width = `${seconds / (s.minutes * 60) * 100}%`;
    toggle.textContent = running ? 'Ⅱ Pause prep' : state === 'paused' ? 'Resume prep' : state === 'done' ? 'Prep complete' : '▷ Start prep';
    toggle.disabled = state === 'done'; duration.disabled = running;
    if (running) active++;
    if (state === 'done') done++;
  }
  const allSpeakers = Object.values(session.speakers);
  active = allSpeakers.filter(s => s.deadline !== null).length;
  done = allSpeakers.filter(s => s.remaining === 0 && s.deadline === null).length;
  const summary = `${active ? `${active} prepping` : 'No active timers'}${done ? ` · ${done} complete` : ''}`;
  if ($('sessionSummary').textContent !== summary) $('sessionSummary').textContent = summary;
  monitorTick(now);
  if (completed) save();
}
$('resetAllBtn').addEventListener('click', () => $('resetModal').showModal());
$('focusView').addEventListener('click', () => {
  const focused = document.body.classList.toggle('focus-view');
  $('focusView').setAttribute('aria-pressed', String(focused));
  $('focusView').textContent = focused ? 'Exit focus view' : 'Focus view';
});
$('resetModal').addEventListener('close', () => {
  if ($('resetModal').returnValue === 'reset') { Object.values(session.speakers).forEach(resetTimer); session.lastStarts = {}; session.lastSpeakers = {}; session.trips = {}; save(); tick(); }
  $('resetModal').returnValue = '';
});
function hasStarted(s) { return s.started === true || s.deadline !== null || s.remaining < s.minutes * 60; }
function urgency(seconds) {
  return seconds === 0 ? 'done' : seconds <= 60 ? 'urgent' : seconds <= 120 ? 'two-minute' : seconds <= 300 ? 'warning' : seconds <= 600 ? 'gold' : seconds <= 900 ? 'yellow' : 'normal';
}
function speakerLabel(key, s) { return `Speaker ${key.split('-')[1]}`; }
function eventLabel(key) { return {equal: 'Equal prep', us: 'United States', intl: 'International'}[key.split('-')[0]]; }
function element(tag, className, text) {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function warningLevel(s, now) {
  if (!hasStarted(s) || Number.isFinite(s.releasedAt)) return 0;
  const seconds = remaining(s, now);
  if (seconds === 0) return 2;
  return seconds <= 900 ? 1 : 0;
}
function clockTime(timestamp) {
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit', second: '2-digit'}).format(timestamp) : '—';
}
function timingLabel(s) {
  if (!hasStarted(s)) return 'Started — · Release —';
  const start = Number.isFinite(s.startedAt) ? `${s.startEstimated ? 'Estimated start' : 'Started'} ${clockTime(s.startedAt)}` : 'Start not recorded';
  const release = s.deadline !== null ? clockTime(s.deadline) : s.remaining === 0 ? clockTime(s.releaseAt) : 'paused';
  return `${start} · Release ${release}${Number.isFinite(s.releasedAt) ? ` · Left ${clockTime(s.releasedAt)}` : ''}`;
}
function monitorTick(now) {
  // Include every started speaker, even outside the selected format or count.
  const entries = Object.entries(session.speakers).filter(([key, s]) => cards.has(key) || hasStarted(s));
  const signature = entries.map(([key]) => key).join(',');
  if (signature !== boardSignature) {
    boardSignature = signature; boardRows.clear(); $('prepBoard').replaceChildren();
    for (const [key, s] of entries) {
      const row = element('article', 'board-row');
      const identity = element('div', 'board-identity');
      const name = element('strong', 'board-name');
      identity.appendChild(name); identity.appendChild(element('small', '', eventLabel(key)));
      const time = element('div', 'board-time'); time.setAttribute('role', 'timer');
      const state = element('span', 'board-state');
      const timing = element('small', 'board-timing');
      identity.appendChild(timing);
      const controls = element('div', 'board-controls');
      const toggle = element('button', 'primary');
      toggle.addEventListener('click', () => toggleTimer(s));
      const reset = element('button', 'quiet-button', 'Reset');
      reset.addEventListener('click', () => {
        if (!hasStarted(s) || window.confirm(`Reset ${speakerLabel(key, s)} to ${s.minutes} minutes?`)) { resetTimer(s); save(); tick(); }
      });
      const adjust = element('button', 'quiet-button', 'Set time');
      adjust.addEventListener('click', () => editRemainingTime(key));
      const release = element('button', 'release-button', 'Released ✓');
      release.addEventListener('click', () => releaseSpeaker(key));
      controls.appendChild(release);
      controls.appendChild(toggle); controls.appendChild(adjust); controls.appendChild(reset);
      row.appendChild(identity); row.appendChild(time); row.appendChild(state); row.appendChild(controls);
      $('prepBoard').appendChild(row); boardRows.set(key, { row, name, time, state, toggle, reset, adjust, timing, release });
    }
  }
  let active = 0;
  for (const [key, s] of entries) {
    const {row, name, time, state, toggle, reset, adjust, timing, release} = boardRows.get(key);
    const seconds = remaining(s, now); const running = s.deadline !== null;
    name.textContent = speakerLabel(key, s); time.textContent = formatTime(seconds);
    timing.textContent = timingLabel(s);
    time.setAttribute('aria-label', `${speakerLabel(key, s)}, ${eventLabel(key)}, time remaining`);
    row.dataset.urgency = hasStarted(s) ? urgency(seconds) : 'ready';
    state.textContent = Number.isFinite(s.releasedAt) ? 'Released ✓' : seconds === 0 ? 'Release due — still in room' : running ? (seconds <= 900 && s.warningGiven !== 1 && s.warningGiven !== 2 ? '15-minute warning due' : 'Prepping') : hasStarted(s) ? 'Paused' : 'Waiting to start';
    toggle.textContent = running ? 'Pause' : seconds === 0 ? 'Finished' : hasStarted(s) ? 'Resume' : 'Start prep';
    toggle.disabled = seconds === 0;
    release.hidden = seconds !== 0 || Number.isFinite(s.releasedAt);
    toggle.hidden = seconds === 0;
    release.textContent = session.roundMode === 'final' && key.endsWith('-1') && session.count > 1 && !session.trips[key.split('-')[0]] ? 'Release with last' : 'Released ✓';
    release.setAttribute('aria-label', `Confirm release of ${speakerLabel(key, s)}, ${eventLabel(key)}`);
    toggle.setAttribute('aria-label', `${toggle.textContent}: ${speakerLabel(key, s)}, ${eventLabel(key)}`);
    adjust.setAttribute('aria-label', `Set time remaining for ${speakerLabel(key, s)}, ${eventLabel(key)}`);
    reset.setAttribute('aria-label', `Reset ${speakerLabel(key, s)}, ${eventLabel(key)}`);
    if (running) active++;
  }
  $('boardSummary').textContent = `${active} prepping · ${entries.length} speakers shown`;
  const alerts = entries.filter(([, s]) => warningLevel(s, now) > (s.warningGiven === 1 || s.warningGiven === 2 ? s.warningGiven : 0));
  const newAlertSignature = JSON.stringify(alerts.map(([key, s]) => [key, s.name, warningLevel(s, now)]));
  if (alertSignature !== newAlertSignature) {
    alertSignature = newAlertSignature;
    $('warningAnnouncement').textContent = alerts.length ? `${alerts.length} warning${alerts.length === 1 ? '' : 's'} to give. ${alerts.map(([key, s]) => `${speakerLabel(key, s)}, ${eventLabel(key)}: ${warningLevel(s, now) === 2 ? 'end of prep' : '15 minutes remaining'}`).join('. ')}` : 'No warnings due.';
  }
  updateStartCues(now);
  updateFinalTrips(now);
  updateUpcoming(now);
  updateOtherRounds(now);
}
function updateStartCues(now) {
  const groups = session.mode === 'equal' ? ['equal'] : ['us', 'intl'];
  const next = groups.map(group => {
    const key = [...cards.keys()].find(key => key.startsWith(group + '-') && !hasStarted(session.speakers[key]));
    return {group, key, last: session.lastStarts[group]};
  });
  const signature = JSON.stringify(next.map(c => [c.group, c.key, c.last, c.key && session.speakers[c.key].name]));
  if (signature !== cueSignature) {
    cueSignature = signature; cueRows = []; $('startCues').replaceChildren();
    for (const cue of next) {
      const box = element('article', 'start-cue');
      const copy = element('div', '');
      copy.appendChild(element('small', '', `${eventLabel(cue.group + '-1')} · next start`));
      const text = element('strong', ''); copy.appendChild(text);
      const caption = element('span', ''); copy.appendChild(caption);
      box.appendChild(copy);
      if (cue.key) {
        const button = element('button', 'primary', `Start ${speakerLabel(cue.key, session.speakers[cue.key])}`);
        button.addEventListener('click', () => toggleTimer(session.speakers[cue.key])); box.appendChild(button);
      }
      $('startCues').appendChild(box); cueRows.push({...cue, box, text, caption});
    }
  }
  for (const cue of cueRows) {
    const target = cue.last === undefined ? currentScheduledStart() : cue.last + startGap() * 60 * 1000;
    const seconds = target === null ? null : Math.ceil((target - now) / 1000);
    cue.box.dataset.due = String(Boolean(cue.key) && seconds !== null && seconds <= 0);
    cue.text.textContent = !cue.key ? 'All speakers have started' : seconds === null ? 'Ready for the first speaker' : seconds > 0 ? `Next start in ${formatTime(seconds)}` : seconds === 0 ? 'Start next speaker now' : `Start due · ${formatTime(-seconds)} overdue`;
    cue.caption.textContent = !cue.key ? 'Track every active timer below.' : `Manual start · ${startGap()}-minute reminders follow actual starts and time corrections.`;
  }
}
function startGap() { return session.roundMode === 'final' ? 12 : 8; }
function markFirstReleased(group) {
  const first = `${group}-1`, last = `${group}-${session.count}`;
  if (session.roundMode !== 'final' || session.count < 2 || !session.speakers[first] || !hasStarted(session.speakers[first]) || remaining(session.speakers[first]) !== 0 || session.trips[group]) return;
  session.trips[group] = { first, last, releasedAt: Date.now(), returnedAt: null };
  session.speakers[first].releasedAt = Date.now();
  session.speakers[first].warningGiven = 2;
  save(); tick();
}
function updateFinalTrips(now) {
  const currentGroups = session.mode === 'equal' ? ['equal'] : ['us', 'intl'];
  const groups = session.roundMode === 'final' ? [...new Set([...currentGroups, ...Object.keys(session.trips)])] : [];
  $('finalTrips').hidden = groups.length === 0;
  const records = groups.map(group => {
    const trip = session.trips[group];
    const first = trip?.first || `${group}-1`, last = trip?.last || `${group}-${session.count}`;
    const speaker = session.speakers[first];
    const stage = trip ? trip.returnedAt === null ? 'away' : 'returned' : session.count < 2 ? 'single' : speaker && hasStarted(speaker) && remaining(speaker, now) === 0 ? 'release' : 'waiting';
    return {group, trip, first, last, stage};
  });
  const signature = JSON.stringify(records.map(r => [r.group, r.stage, r.first, r.last, r.trip, session.speakers[r.first]?.name, session.speakers[r.last]?.name]));
  if (signature !== tripSignature) {
    tripSignature = signature; tripRows = []; $('finalTrips').replaceChildren();
    for (const record of records) {
      const {group, first, last, stage} = record;
      const box = element('article', 'trip-card');
      const copy = element('div', '');
      copy.appendChild(element('small', '', `${eventLabel(first)} · final round`));
      const title = element('strong', ''); copy.appendChild(title);
      const detail = element('span', ''); copy.appendChild(detail); box.appendChild(copy);
      const label = key => speakerLabel(key, session.speakers[key] || {name: ''});
      if (stage === 'release') {
        const release = element('button', 'primary', `Both released →`);
        release.setAttribute('aria-label', `Confirm ${label(first)} and ${label(last)} released together, ${eventLabel(first)}`);
        release.addEventListener('click', () => markFirstReleased(group)); box.appendChild(release);
      } else if (stage === 'away') {
        const returned = element('button', 'primary', `${label(last)} is back ✓`);
        returned.addEventListener('click', () => { session.trips[group].returnedAt = Date.now(); save(); tick(); }); box.appendChild(returned);
      }
      $('finalTrips').appendChild(box); tripRows.push({...record, box, title, detail});
    }
  }
  for (const r of tripRows) {
    const label = key => speakerLabel(key, session.speakers[key] || {name: ''});
    const seconds = r.trip ? Math.ceil((r.trip.releasedAt + 600000 - now) / 1000) : null;
    r.box.dataset.due = String(r.stage === 'release' || (r.stage === 'away' && seconds <= 0));
    if (r.stage === 'single') {
      r.title.textContent = 'Add at least two speakers for release and return tracking.'; r.detail.textContent = 'Final-round start spacing is 12 minutes.';
    } else if (r.stage === 'waiting') {
      r.title.textContent = `${label(r.last)} goes with ${label(r.first)}`;
      const first = session.speakers[r.first];
      r.detail.textContent = `${first?.deadline ? `Expected release ${clockTime(first.deadline)}. ` : ''}Confirm when both leave; the return reminder starts then. Prep timers are unchanged.`;
    } else if (r.stage === 'release') {
      r.title.textContent = `Release ${label(r.first)} with ${label(r.last)}`;
      r.detail.textContent = 'First speaker’s prep is finished. Mark both released when they leave; the last speaker is due back 10 minutes later.';
    } else if (r.stage === 'away') {
      r.title.textContent = seconds > 0 ? `${label(r.last)} returns in ${formatTime(seconds)}` : `${label(r.last)} ${seconds === 0 ? 'is due back now' : `is ${formatTime(-seconds)} overdue`}`;
      r.detail.textContent = `Left with ${label(r.first)} at ${clockTime(r.trip.releasedAt)} · Due back ${clockTime(r.trip.releasedAt + 600000)}. Confirm when back in the prep room.`;
    } else {
      r.title.textContent = `${label(r.last)} returned ✓`;
      r.detail.textContent = `Released ${clockTime(r.trip.releasedAt)} · Returned ${clockTime(r.trip.returnedAt)}. Prep timers are unchanged.`;
    }
  }
}
document.addEventListener('visibilitychange', tick);
const boardRows = new Map();
let boardSignature = '';
let alertSignature = '';
let cueSignature = '';
let cueRows = [];
let tripSignature = '';
let tripRows = [];
initializeRoundControls();
render();
setInterval(tick, 250);
