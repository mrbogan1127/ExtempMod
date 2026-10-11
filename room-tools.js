let roundListSignature = '';
let upcomingSignature = '';
let upcomingNodes = [];
let scheduleSignature = '';
const scheduleRows = new Map();
function renderRounds() {
  const tournaments = [...new Set(library.rounds.map(r => r.tournament))];
  const signature = JSON.stringify(tournaments);
  if (signature !== roundListSignature) {
    roundListSignature = signature; $('tournamentSelect').replaceChildren();
    for (const name of tournaments) { const option = element('option', '', name || 'Untitled tournament'); option.value = name; $('tournamentSelect').appendChild(option); }
  }
  const current = library.rounds.find(r => r.id === library.activeId);
  library.tournament = current.tournament;
  $('tournamentSelect').value = current.tournament;
  $('welcomeRoundTitle').textContent = current.title;
  $('activeRound').textContent = current.title;
  $('activeTournament').textContent = library.tournament;
  $('tournamentName').value = library.tournament;
  $('storageNotice').textContent = storageNotice;
  $('storageNotice').hidden = !storageNotice;
  renderSchedule();
}
function resetViewCaches() {
  boardSignature = ''; alertSignature = ''; cueSignature = ''; tripSignature = ''; upcomingSignature = '';
}
function switchRound(id) {
  if (!library.rounds.some(r => r.id === id)) return false;
  save(); library.activeId = id;
  session = library.rounds.find(r => r.id === id).session;
  resetViewCaches(); render(); return true;
}
function addRound(title) {
  if (library.rounds.length >= 500) throw new Error('Export a backup before starting another tournament. Maximum 500 rounds.');
  save();
  const data = freshSession(); data.count = session.count; data.mode = session.mode; data.defaultMinutes = session.defaultMinutes;
  const round = roundRecord(title, data, library.tournament);
  library.rounds.push(round); switchRound(round.id); return round.id;
}
function showWelcome(show) {
  $('welcomeScreen').hidden = !show;
  $('prepWorkspace').hidden = show;
  if (show) { document.body.classList.remove('focus-view'); $('focusView').setAttribute('aria-pressed', 'false'); $('focusView').textContent = 'Focus view'; }
}
function exportData() { save(); return JSON.stringify(library, null, 2); }
function importData(text) {
  const incoming = parseLibrary(text);
  if (library.rounds.length + incoming.rounds.length > 500) throw new Error('Too many rounds in this backup.');
  save();
  const imported = incoming.rounds.map(r => ({...r, id: newRoundId(), title: r.title}));
  library.rounds.push(...imported);
  // A valid imported file is a recovery path for unreadable device storage.
  storageBlocked = false; storageNotice = '';
  const activeIndex = Math.max(0, incoming.rounds.findIndex(r => r.id === incoming.activeId));
  switchRound(imported[activeIndex].id);
  return imported.length;
}
function initializeRoundControls() {
  $('tournamentSelect').addEventListener('change', e => { const round = library.rounds.find(r => r.tournament === e.target.value); if (round) switchRound(round.id); });
  $('addScheduledRound').addEventListener('click', () => {
    try { const id = addRound(`Round ${library.rounds.filter(r => r.tournament === library.tournament).length + 1}`); scheduleRows.get(id).editor.open = true; } catch (error) { $('scheduleMessage').textContent = error.message; }
  });
  $('newTournament').addEventListener('click', () => {
    const name = window.prompt('Tournament name');
    if (!name?.trim()) return;
    if (library.rounds.length >= 500) { window.alert('Export a backup before adding more rounds. Maximum 500 rounds.'); return; }
    save();
    const round = roundRecord('Round 1', freshSession(), name.trim().slice(0, 100));
    library.rounds.push(round); switchRound(round.id);
  });
  $('tournamentName').addEventListener('input', e => {
    const previous = library.tournament;
    library.tournament = e.target.value.slice(0, 100);
    for (const round of library.rounds) if (round.tournament === previous) round.tournament = library.tournament;
    save(); $('activeTournament').textContent = library.tournament;
  });
  $('tournamentName').addEventListener('change', renderRounds);
  $('continueRound').addEventListener('click', () => { save(); showWelcome(false); });
  $('openWelcome').addEventListener('click', () => { renderRounds(); showWelcome(true); });
  $('exportBackup').addEventListener('click', async () => {
    const text = exportData();
    const blob = new Blob([text], {type: 'application/json'});
    const fileName = `extemp-rounds-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('backupStatus').textContent = 'Backup download requested. Keep the JSON file in Files or Downloads; you can import it on either device.';
  });
  $('importBackup').addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an Extemp backup smaller than 10 MB.');
      const count = importData(await file.text());
      $('backupStatus').textContent = `Added ${count} saved round${count === 1 ? '' : 's'}. Your existing rounds are still available.`;
    } catch (error) { $('backupStatus').textContent = `Backup not imported: ${error.message}`; }
    e.target.value = '';
  });
}
function releaseSpeaker(key) {
  const s = session.speakers[key];
  if (!s || !hasStarted(s) || remaining(s) !== 0 || Number.isFinite(s.releasedAt)) return false;
  const group = key.split('-')[0];
  if (session.roundMode === 'final' && key.endsWith('-1') && session.count > 1 && !session.trips[group]) { markFirstReleased(group); return true; }
  s.releasedAt = Date.now(); s.warningGiven = 2; save(); tick(); return true;
}
function upcomingEvents(now) {
  const events = [];
  const groups = session.mode === 'equal' ? ['equal'] : ['us', 'intl'];
  for (const group of groups) {
    const key = [...cards.keys()].find(k => k.startsWith(group + '-') && !hasStarted(session.speakers[k]));
    if (key) events.push({id: `start-${key}`, key, at: session.lastStarts[group] === undefined ? currentScheduledStart() : session.lastStarts[group] + startGap() * 60000, text: `Start ${speakerLabel(key)} · ${eventLabel(key)}`, action: 'Start prep', run: () => toggleTimer(session.speakers[key])});
  }
  for (const [key, s] of Object.entries(session.speakers)) {
    if (!hasStarted(s) || Number.isFinite(s.releasedAt)) continue;
    const seconds = remaining(s, now);
    const label = `${speakerLabel(key)} · ${eventLabel(key)}`;
    if ((s.warningGiven || 0) < 1 && seconds > 0 && (s.deadline !== null || seconds <= 900)) events.push({id: `warn-${key}`, key, at: s.deadline === null ? now : s.deadline - 900000, text: `15-minute warning · ${label}`, action: 'Warning given', run: () => { s.warningGiven = 1; save(); tick(); }});
    if (s.deadline !== null || seconds === 0) events.push({id: `release-${key}`, key, at: s.deadline ?? s.releaseAt ?? now, text: `End prep & release · ${label}`, action: session.roundMode === 'final' && key.endsWith('-1') && session.count > 1 && !session.trips[key.split('-')[0]] ? 'Release with last' : 'Released ✓', run: () => releaseSpeaker(key)});
  }
  for (const [group, trip] of Object.entries(session.trips)) {
    if (session.roundMode === 'final' && trip.returnedAt === null) events.push({id: `return-${group}`, key: trip.last, at: trip.releasedAt + 600000, text: `Check return · ${speakerLabel(trip.last)} · ${eventLabel(trip.last)}`, action: 'Back in room ✓', run: () => { trip.returnedAt = Date.now(); save(); tick(); }});
  }
  return events.sort((a, b) => (a.at ?? now) - (b.at ?? now) || a.id.localeCompare(b.id));
}
function updateUpcoming(now) {
  const events = upcomingEvents(now);
  // Show every overdue action plus the next four upcoming actions.
  const due = events.filter(e => e.at === null || e.at <= now);
  const next = due.concat(events.filter(e => e.at !== null && e.at > now).slice(0, 4));
  const signature = JSON.stringify(next.map(e => [e.id, e.text, e.action]));
  if (signature !== upcomingSignature) {
    upcomingSignature = signature; upcomingNodes = []; $('upcomingList').replaceChildren();
    if (!next.length) $('upcomingList').appendChild(element('p', 'upcoming-empty', 'All caught up. No pending actions in this round.'));
    for (const event of next) {
      const row = element('div', 'upcoming-row');
      const label = element('strong', '', event.text);
      const time = element('span', 'upcoming-time');
      const action = element('button', 'quiet-button', event.action);
      action.addEventListener('click', event.run);
      row.appendChild(label); row.appendChild(time); row.appendChild(action);
      $('upcomingList').appendChild(row); upcomingNodes.push({id: event.id, row, time, action});
    }
  }
  for (const node of upcomingNodes) {
    const event = next.find(e => e.id === node.id);
    const seconds = event.at === null ? null : Math.ceil((event.at - now) / 1000);
    node.row.dataset.due = String(seconds === null || seconds <= 0);
    node.time.textContent = seconds === null ? 'Ready to start' : seconds > 0 ? `${clockTime(event.at)} · in ${formatTime(seconds)}` : seconds === 0 ? 'Due now' : `${formatTime(-seconds)} overdue`;
    node.action.disabled = event.id.startsWith('start-') ? false : seconds > 0;
  }
}
function updateOtherRounds(now) {
  updateScheduleStatuses(now);
  const notices = [];
  for (const round of library.rounds) {
    if (round.id === library.activeId) continue;
    const active = Object.values(round.session.speakers).filter(s => s.deadline !== null && s.deadline > now).length;
    const due = Object.values(round.session.speakers).filter(s => hasStarted(s) && remaining(s, now) === 0 && !Number.isFinite(s.releasedAt)).length;
    const away = round.session.roundMode === 'final' ? Object.values(round.session.trips).filter(t => t.returnedAt === null).length : 0;
    if (active || due || away) notices.push(`${round.tournament} / ${round.title}: ${active} prepping, ${due} awaiting release, ${away} away`);
  }
  $('otherRounds').hidden = notices.length === 0;
  $('otherRounds').textContent = notices.length ? `Other saved rounds still have activity. ${notices.join(' · ')}. Open Tournament & rounds to switch.` : '';
  const started = Object.values(session.speakers).filter(hasStarted).length;
  const active = Object.values(session.speakers).filter(s => s.deadline !== null && s.deadline > now).length;
  $('welcomeRoundStatus').textContent = started ? `${started} speakers started · ${active} currently prepping. Timers keep counting while this screen is open.` : 'Ready to begin. Choose the settings above, then continue.';
}

function currentScheduledStart() {
  return library.rounds.find(r => r.id === library.activeId).scheduledStart ?? null;
}
function localDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '';
  const d = new Date(timestamp);
  const two = value => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}
function parseScheduledStart(value) {
  if (value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid start date and time.');
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || localDateTime(timestamp) !== value) throw new Error('Choose a valid local date and time.');
  return timestamp;
}
function applyRoundSettings(id, values) {
  const round = library.rounds.find(r => r.id === id);
  if (!round) throw new Error('Round not found.');
  const title = values.title.trim();
  const count = Number(values.count), minutes = Number(values.minutes);
  const scheduledStart = parseScheduledStart(values.start);
  if (!title) throw new Error('Enter a round name.');
  if (!Number.isInteger(count) || count < 1 || count > 7) throw new Error('Choose 1 to 7 speakers per event.');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error('Prep duration must be 1 to 180 minutes.');
  if (!['equal', 'split'].includes(values.mode) || !['normal', 'final'].includes(values.roundMode)) throw new Error('Choose a valid event and round format.');
  round.title = title.slice(0, 80); round.scheduledStart = scheduledStart;
  Object.assign(round.session, {count, defaultMinutes: minutes, mode: values.mode, roundMode: values.roundMode});
  for (const speaker of Object.values(round.session.speakers)) {
    if (!hasStarted(speaker)) { speaker.minutes = minutes; speaker.remaining = minutes * 60; }
  }
  round.updatedAt = Date.now();
  const saved = save();
  // Rebuild the active view only; changing another round must not change this round's timers.
  render();
  $('scheduleMessage').textContent = saved ? `${round.title} settings saved.` : `${round.title} updated in memory. Export a backup before closing; device saving failed.`;
  return round;
}
function scheduleField(label, control) {
  const wrapper = element('label', 'schedule-field');
  wrapper.appendChild(element('span', 'field-label', label)); wrapper.appendChild(control); return wrapper;
}
function scheduleInput(type, value) {
  const input = element('input', ''); input.type = type; input.value = value; return input;
}
function scheduleSelect(options, value) {
  const select = element('select', '');
  for (const [id, label] of options) { const option = element('option', '', label); option.value = id; select.appendChild(option); }
  select.value = value; return select;
}
function renderSchedule() {
  const rounds = library.rounds.filter(r => r.tournament === library.tournament).slice().sort((a,b) => (a.scheduledStart ?? Infinity) - (b.scheduledStart ?? Infinity) || a.createdAt - b.createdAt);
  const signature = JSON.stringify(rounds.map(r => [r.id, r.title, r.scheduledStart, r.session.count, r.session.defaultMinutes, r.session.mode, r.session.roundMode]));
  if (signature === scheduleSignature) return;
  scheduleSignature = signature; scheduleRows.clear(); $('roundSchedule').replaceChildren();
  for (const round of rounds) {
    const card = element('article', 'round-card');
    const overview = element('div', 'round-overview');
    const info = element('div', 'round-info');
    info.appendChild(element('h3', '', round.title));
    const when = round.scheduledStart === null || round.scheduledStart === undefined ? 'Time not set' : new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}).format(round.scheduledStart);
    info.appendChild(element('p', 'round-meta', `${when} · ${round.session.mode === 'split' ? 'US & International' : 'Equal prep'} · ${round.session.count} speakers${round.session.mode === 'split' ? ' per event' : ''}`));
    info.appendChild(element('p', 'round-meta', `${round.session.defaultMinutes} min prep · ${round.session.roundMode === 'final' ? 'Final / 12 min spacing' : 'Standard / 8 min spacing'}`));
    const editor = element('details', 'round-editor');
    editor.appendChild(element('summary', '', 'Edit settings'));
    const form = element('form', 'schedule-round');
    const title = scheduleInput('text', round.title); title.maxLength = 80; title.required = true;
    const start = scheduleInput('datetime-local', localDateTime(round.scheduledStart));
    const count = scheduleSelect(Array.from({length:7}, (_,i) => [String(i+1),String(i+1)]), String(round.session.count));
    const mode = scheduleSelect([['equal', 'Equal prep'], ['split', 'US & International']], round.session.mode);
    const minutes = scheduleInput('number', round.session.defaultMinutes); minutes.min = 1; minutes.max = 180; minutes.step = 1; minutes.required = true;
    const format = scheduleSelect([['normal', 'Standard · 8 min'], ['final', 'Final · 12 min']], round.session.roundMode);
    form.appendChild(scheduleField('Round name', title)); form.appendChild(scheduleField('First prep start · local time', start));
    form.appendChild(scheduleField('Event format', mode)); form.appendChild(scheduleField('Speakers per event', count));
    form.appendChild(scheduleField('Prep minutes', minutes)); form.appendChild(scheduleField('Round format', format));
    const footer = element('div', 'schedule-actions');
    const status = element('span', 'schedule-status'); info.appendChild(status);
    const submit = element('button', 'primary', 'Save settings'); submit.type = 'submit';
    const open = element('button', 'quiet-button', 'Open round'); open.type = 'button';
    const error = element('p', 'schedule-error'); error.setAttribute('role', 'status');
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; error.textContent = 'Unsaved changes — tap Save settings.'; });
    const values = () => ({title: title.value, start: start.value, count: count.value, mode: mode.value, minutes: minutes.value, roundMode: format.value});
    form.addEventListener('submit', e => { e.preventDefault(); try { applyRoundSettings(round.id, values()); } catch (problem) { error.textContent = problem.message; } });
    open.addEventListener('click', () => {
      try { if (dirty) applyRoundSettings(round.id, values()); switchRound(round.id); showWelcome(false); }
      catch (problem) { error.textContent = problem.message; }
    });
    footer.appendChild(submit); form.appendChild(footer); form.appendChild(error);
    overview.appendChild(info); overview.appendChild(open);
    editor.appendChild(form); card.appendChild(overview); card.appendChild(editor);
    $('roundSchedule').appendChild(card); scheduleRows.set(round.id, {status, editor});
  }
}
function updateScheduleStatuses(now) {
  for (const [id, {status}] of scheduleRows) {
    const round = library.rounds.find(r => r.id === id);
    const started = Object.values(round.session.speakers).some(hasStarted);
    const seconds = round.scheduledStart === null || round.scheduledStart === undefined ? null : Math.ceil((round.scheduledStart - now) / 1000);
    status.textContent = started ? 'Round started' : seconds === null ? 'Start time not set' : seconds > 0 ? `Starts in ${formatTime(seconds)}` : seconds === 0 ? 'Scheduled start is now' : `Start overdue by ${formatTime(-seconds)}`;
    status.dataset.due = String(!started && seconds !== null && seconds <= 0);
  }
}
