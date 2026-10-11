// All saved rounds live on this device. Backup files can move them to another device.
const STORAGE_KEY = 'extemp-prep-room-v1';
const LIBRARY_KEY = 'extemp-prep-rounds-v2';
const BACKUP_KEY = LIBRARY_KEY + '-backup';
const freshSession = () => ({ mode: 'equal', count: 1, speakers: {}, lastStarts: {}, lastSpeakers: {}, roundMode: 'normal', defaultMinutes: 30, trips: {} });
function normalizeSession(saved) {
  const session = freshSession();
  if (saved && ['equal', 'split'].includes(saved.mode) && Number.isInteger(saved.count) && saved.count >= 1 && saved.count <= 7 && saved.speakers && typeof saved.speakers === 'object') {
    session.mode = saved.mode;
    session.count = saved.count;
    session.roundMode = saved.roundMode === 'final' ? 'final' : 'normal';
    session.defaultMinutes = Number.isInteger(saved.defaultMinutes) && saved.defaultMinutes >= 1 && saved.defaultMinutes <= 180 ? saved.defaultMinutes : 30;
    for (const group of ['equal', 'us', 'intl']) {
      const t = saved.trips?.[group];
      if (t && t.first === `${group}-1` && new RegExp(`^${group}-[2-7]$`).test(t.last) && Number.isFinite(t.releasedAt) && (t.returnedAt === null || Number.isFinite(t.returnedAt))) session.trips[group] = t;
    }
    for (const group of ['equal', 'us', 'intl']) {
      if (Number.isFinite(saved.lastStarts?.[group])) session.lastStarts[group] = saved.lastStarts[group];
    }
    for (const [key, s] of Object.entries(saved.speakers)) {
      if (/^(equal|us|intl)-[1-7]$/.test(key) && s && Number.isFinite(s.minutes) && s.minutes >= 1 && s.minutes <= 180 && Number.isFinite(s.remaining) && s.remaining >= 0 && s.remaining <= s.minutes * 60 && (s.deadline === null || (Number.isFinite(s.deadline) && s.deadline > 0 && s.deadline <= 8640000000000000)) && typeof s.name === 'string' && typeof s.question === 'string') session.speakers[key] = s;
    }
    for (const group of ['equal', 'us', 'intl']) {
      const savedKey = saved.lastSpeakers?.[group];
      if (typeof savedKey === 'string' && savedKey.startsWith(group + '-') && session.speakers[savedKey]) session.lastSpeakers[group] = savedKey;
      else {
        // Older sessions stored a start time but not the speaker that set it.
        const candidates = Object.entries(session.speakers).filter(([key, s]) => key.startsWith(group + '-') && (s.started === true || s.deadline !== null || s.remaining < s.minutes * 60));
        candidates.sort((a, b) => {
          const estimate = s => s.deadline === null ? Date.now() - (s.minutes * 60 - s.remaining) * 1000 : s.deadline - s.minutes * 60000;
          return Math.abs(estimate(a[1]) - session.lastStarts[group]) - Math.abs(estimate(b[1]) - session.lastStarts[group]);
        });
        if (candidates.length) session.lastSpeakers[group] = candidates[0][0];
      }
    }
  }
  else throw new Error('Invalid round data');
  return session;
}
function newRoundId() { return 'round-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
function roundRecord(title, data = freshSession(), tournament = 'My tournament') {
  return { scheduledStart: null, tournament, id: newRoundId(), title: title.trim().slice(0, 80) || 'Untitled round', createdAt: Date.now(), updatedAt: Date.now(), session: data };
}
function parseLibrary(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 2 || !Array.isArray(data.rounds) || !data.rounds.length || data.rounds.length > 500) throw new Error('Invalid backup');
  const ids = new Set();
  const rounds = data.rounds.map(round => {
    if (!round || typeof round.id !== 'string' || ids.has(round.id) || typeof round.title !== 'string') throw new Error('Invalid round');
    ids.add(round.id);
    const normalized = normalizeSession(round.session);
    if (Object.keys(normalized.speakers).length !== Object.keys(round.session.speakers).length) throw new Error('Invalid speaker timer in backup');
    return {scheduledStart: Number.isFinite(round.scheduledStart) && Math.abs(round.scheduledStart) <= 8640000000000000 ? round.scheduledStart : null, tournament: typeof round.tournament === 'string' ? round.tournament.slice(0, 100) : typeof data.tournament === 'string' ? data.tournament.slice(0, 100) : 'My tournament', id: round.id, title: round.title.slice(0, 80), createdAt: Number.isFinite(round.createdAt) ? round.createdAt : Date.now(), updatedAt: Number.isFinite(round.updatedAt) ? round.updatedAt : Date.now(), session: normalized};
  });
  return {version: 2, tournament: typeof data.tournament === 'string' ? data.tournament.slice(0, 100) : 'My tournament', activeId: ids.has(data.activeId) ? data.activeId : rounds[0].id, rounds};
}
let storageNotice = '';
let storageBlocked = false;
function loadLibrary() {
  let existing = false;
  try {
    for (const key of [LIBRARY_KEY, BACKUP_KEY]) {
      const text = localStorage.getItem(key);
      if (!text) continue;
      existing = true;
      try { const library = parseLibrary(text); if (key === BACKUP_KEY) storageNotice = 'Recovered the previous save. Export a backup when convenient.'; return library; }
      catch { /* Try the previous complete save before falling back to migration. */ }
    }
    if (existing) { storageBlocked = true; storageNotice = 'Saved rounds could not be read. Existing data is preserved. Import a backup to recover.'; }
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      try { const round = roundRecord('Round 1', normalizeSession(JSON.parse(legacy))); return {version: 2, tournament: 'My tournament', activeId: round.id, rounds: [round]}; }
      catch { storageNotice ||= 'The old session could not be restored. Start a new round or import a backup.'; }
    }
  } catch { storageNotice = 'Device storage is unavailable. Export a backup before closing.'; }
  const round = roundRecord('Round 1');
  return {version: 2, tournament: 'My tournament', activeId: round.id, rounds: [round]};
}
let library = loadLibrary();
let session = library.rounds.find(round => round.id === library.activeId).session;
