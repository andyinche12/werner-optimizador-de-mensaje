// public/js/state.js
// Simple reactive state management with localStorage persistence

const STORAGE_KEY = 'werner-audio-factory-state';
const listeners = new Map();

const defaultState = {
  theme: 'dark',
  library: [],
  learnVideos: [],
  learnPatterns: null,
  voiceConfig: {
    voiceId: 'es-ES-AlvaroNeural',
    rate: '+0%',
    pitch: '+0Hz',
    volume: '+0%',
    toneOverrides: {},
  },
  recentProjects: [],
};

let state = { ...defaultState };

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state = { ...defaultState, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error loading state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Error saving state:', e);
  }
}

function initState() {
  loadState();
  // Apply theme
  document.body.classList.toggle('light-mode', state.theme === 'light');
}

function getState(key) {
  if (!key) return state;
  return key.split('.').reduce((obj, k) => obj?.[k], state);
}

function setState(key, value) {
  const keys = key.split('.');
  const lastKey = keys.pop();
  let obj = state;
  for (const k of keys) {
    if (!obj[k]) obj[k] = {};
    obj = obj[k];
  }
  obj[lastKey] = value;
  saveState();
  notify(key, value);
}

function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key).delete(callback);
}

function notify(key, value) {
  if (listeners.has(key)) {
    listeners.get(key).forEach(cb => cb(value));
  }
  // Also notify parent keys
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const parentKey = parts.slice(0, i).join('.');
    if (listeners.has(parentKey)) {
      listeners.get(parentKey).forEach(cb => cb(getState(parentKey)));
    }
  }
}

// Library helpers
function getLibrary() {
  return getState('library') || [];
}

function saveLibrary(library) {
  setState('library', library);
}

function addToLibrary(item) {
  const library = getLibrary();
  library.unshift(item); // Add to beginning
  // Keep only last 100
  if (library.length > 100) library.pop();
  saveLibrary(library);
}

function removeFromLibrary(id) {
  const library = getLibrary().filter(item => item.id !== id);
  saveLibrary(library);
}

function updateLibraryItem(id, updates) {
  const library = getLibrary();
  const idx = library.findIndex(item => item.id === id);
  if (idx >= 0) {
    library[idx] = { ...library[idx], ...updates, updatedAt: new Date().toISOString() };
    saveLibrary(library);
  }
}

// Learn helpers
function getLearnVideos() {
  return getState('learnVideos') || [];
}

function addLearnVideo(video) {
  const videos = getLearnVideos();
  videos.push({ ...video, addedAt: new Date().toISOString() });
  setState('learnVideos', videos);
}

function removeLearnVideo(index) {
  const videos = getLearnVideos();
  videos.splice(index, 1);
  setState('learnVideos', videos);
}

function setLearnPatterns(patterns) {
  setState('learnPatterns', patterns);
}

function getLearnPatterns() {
  return getState('learnPatterns');
}

// Voice config helpers
function getVoiceConfig() {
  return getState('voiceConfig') || defaultState.voiceConfig;
}

function setVoiceConfig(config) {
  setState('voiceConfig', config);
}

// Recent projects
function addRecentProject(project) {
  const recent = getState('recentProjects') || [];
  recent.unshift({ ...project, openedAt: new Date().toISOString() });
  if (recent.length > 20) recent.pop();
  setState('recentProjects', recent);
}

export { initState, getState, setState, subscribe, loadState, saveState };
export const libraryAPI = { get: getLibrary, save: saveLibrary, add: addToLibrary, remove: removeFromLibrary, update: updateLibraryItem };
export const learnAPI = { getVideos: getLearnVideos, add: addLearnVideo, remove: removeLearnVideo, setPatterns: setLearnPatterns, getPatterns: getLearnPatterns };
export const voiceConfigAPI = { get: getVoiceConfig, set: setVoiceConfig };
export const recentAPI = { add: addRecentProject, get: () => getState('recentProjects') || [] };