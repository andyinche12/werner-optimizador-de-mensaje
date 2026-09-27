// public/js/app.js
// werner Audio Factory - Main Application Logic

import { initState, getState, setState, subscribe } from './state.js';
import { api } from './api.js';
import { initVoice } from './voice.js';
import { initLibrary } from './library.js';
import { initLearn } from './learn.js';
import { showToast } from './toast.js';

// ============================================
// GLOBAL STATE & INIT
// ============================================
let currentStep = 1;
const totalSteps = 5;
let structures = [];
let selectedStructureId = null;
let scriptData = null;
let audioData = null;
let descriptionsData = null;
let voiceConfig = {
  voiceId: 'es-ES-AlvaroNeural',
  rate: '+0%',
  pitch: '+0Hz',
  volume: '+0%',
  toneOverrides: {},
};
let learnVideos = [];

// DOM Elements Cache
const els = {};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  initTheme();
  initEventListeners();
  await loadVoices();
  initVoice();
  initLibrary();
  initLearn();
  checkApiHealth();
  updateStepUI();
});

function cacheElements() {
  // Steps
  for (let i = 1; i <= totalSteps; i++) {
    els[`step${i}`] = document.getElementById(`step-${i}`);
  }
  // Progress
  els.progressSteps = document.querySelectorAll('.progress-step');
  els.progressLines = document.querySelectorAll('.progress-line');
  // Form inputs
  els.ideaInput = document.getElementById('ideaInput');
  els.contentType = document.getElementById('contentType');
  els.duration = document.getElementById('duration');
  els.tone = document.getElementById('tone');
  els.customInstructions = document.getElementById('customInstructions');
  els.ideaCharCount = document.getElementById('ideaCharCount');
  // Structures
  els.structuresContainer = document.getElementById('structuresContainer');
  els.btnChooseStructure = document.getElementById('btnChooseStructure');
  // Script
  els.scriptEditor = document.getElementById('scriptEditor');
  els.wordCount = document.getElementById('wordCount');
  els.estDuration = document.getElementById('estDuration');
  // Voice
  els.voiceSelect = document.getElementById('voiceSelect');
  els.rateInput = document.getElementById('rateInput');
  els.rateValue = document.getElementById('rateValue');
  els.pitchInput = document.getElementById('pitchInput');
  els.pitchValue = document.getElementById('pitchValue');
  els.volumeInput = document.getElementById('volumeInput');
  els.volumeValue = document.getElementById('volumeValue');
  els.previewContainer = document.getElementById('previewContainer');
  els.btnGenerateAudio = document.getElementById('btnGenerateAudio');
  // Player
  els.audioPlayer = document.getElementById('audioPlayer');
  els.playerTitle = document.getElementById('playerTitle');
  els.playerMeta = document.getElementById('playerMeta');
  // Downloads
  els.downloadMp3 = document.getElementById('downloadMp3');
  els.downloadSrt = document.getElementById('downloadSrt');
  els.downloadVtt = document.getElementById('downloadVtt');
  els.downloadJson = document.getElementById('downloadJson');
  els.downloadTxt = document.getElementById('downloadTxt');
  // Descriptions
  els.titlesContainer = document.getElementById('titlesContainer');
  els.descYoutube = document.getElementById('descYoutube');
  els.descTiktok = document.getElementById('descTiktok');
  els.descShorts = document.getElementById('descShorts');
  els.hashtagsYoutube = document.getElementById('hashtagsYoutube');
  els.hashtagsTiktok = document.getElementById('hashtagsTiktok');
  els.hashtagsShorts = document.getElementById('hashtagsShorts');
  els.thumbnailsContainer = document.getElementById('thumbnailsContainer');
  els.checklistContainer = document.getElementById('checklistContainer');
  // Status
  els.statusIndicator = document.getElementById('statusIndicator');
}

function initEventListeners() {
  // Idea input char count
  els.ideaInput.addEventListener('input', () => {
    const len = els.ideaInput.value.length;
    els.ideaCharCount.textContent = len;
    els.ideaCharCount.className = len > 4500 ? 'danger' : len > 4000 ? 'warning' : '';
  });

  // Script editor stats
  els.scriptEditor.addEventListener('input', updateScriptStats);

  // Voice controls
  els.rateInput.addEventListener('input', updateRateValue);
  els.pitchInput.addEventListener('input', updatePitchValue);
  els.volumeInput.addEventListener('input', updateVolumeValue);
  els.voiceSelect.addEventListener('change', () => {
    voiceConfig.voiceId = els.voiceSelect.value;
    buildPreviews();
  });

  // Description tabs
  document.querySelectorAll('.desc-tab').forEach(btn => {
    btn.addEventListener('click', () => switchDescTab(btn.dataset.platform));
  });

  // Sidebar tabs
  document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSidebarTab(btn.dataset.tab));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (currentStep < totalSteps) nextStep();
    }
    if (e.key === 'Escape') {
      if (currentStep > 1) prevStep();
    }
  });
}

// ============================================
// THEME
// ============================================
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  document.body.classList.toggle('light-mode', !isDark);
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon(!isLight);
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById('themeToggle');
  btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

// ============================================
// API HEALTH
// ============================================
async function checkApiHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    els.statusIndicator.textContent = data.status === 'ok' ? '● Conectado' : '● Error';
    els.statusIndicator.style.color = data.status === 'ok' ? 'var(--success)' : 'var(--danger)';
  } catch {
    els.statusIndicator.textContent = '● Sin conexión';
    els.statusIndicator.style.color = 'var(--danger)';
  }
}

// ============================================
// STEP NAVIGATION
// ============================================
function updateStepUI() {
  // Steps
  for (let i = 1; i <= totalSteps; i++) {
    els[`step${i}`].classList.toggle('active', i === currentStep);
  }
  // Progress bar
  els.progressSteps.forEach((step, idx) => {
    const stepNum = idx + 1;
    step.classList.toggle('active', stepNum === currentStep);
    step.classList.toggle('completed', stepNum < currentStep);
  });
  els.progressLines.forEach((line, idx) => {
    line.classList.toggle('completed', idx + 1 < currentStep);
  });
  // Scroll to top
  document.querySelector('.main-content').scrollTop = 0;
}

function nextStep() {
  if (currentStep < totalSteps) {
    // Validaciones por paso
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !selectedStructureId) return;
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4 && !validateStep4()) return;
    
    currentStep++;
    updateStepUI();
    
    // Acciones al entrar a pasos
    if (currentStep === 4) buildPreviews();
    if (currentStep === 5) loadFinalResults();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
}

function validateStep1() {
  const idea = els.ideaInput.value.trim();
  if (idea.length < 10) {
    showToast('La idea debe tener al menos 10 caracteres', 'error');
    return false;
  }
  return true;
}

function validateStep3() {
  const script = els.scriptEditor.value.trim();
  if (script.length < 20) {
    showToast('El guion está muy corto', 'error');
    return false;
  }
  return true;
}

function validateStep4() {
  return true; // Siempre válido
}

// ============================================
// STEP 1: GENERATE STRUCTURES
// ============================================
async function generateStructures() {
  const btn = document.querySelector('#step-1 .btn-next');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Generando...';

  try {
    const idea = {
      idea: els.ideaInput.value.trim(),
      contentType: els.contentType.value,
      duration: els.duration.value,
      tone: els.tone.value,
      customInstructions: els.customInstructions.value.trim(),
    };

    const res = await api.post('/api/script/architect', { idea });
    structures = res.structures;
    renderStructures();
    
    currentStep = 2;
    updateStepUI();
    showToast('3 estructuras generadas', 'success');
  } catch (error) {
    showToast(error.message || 'Error generando estructuras', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Hacer global para onclick
window.generateStructures = generateStructures;

function renderStructures() {
  els.structuresContainer.innerHTML = structures.map((s, idx) => `
    <div class="structure-card" data-id="${s.id}" onclick="selectStructure('${s.id}')">
      <div class="struct-id">${s.id}</div>
      <div class="struct-name">${s.name}</div>
      <div class="struct-outline">
        ${s.outline.map(step => `<div class="struct-step">${step}</div>`).join('')}
      </div>
      <div class="struct-why">${s.why}</div>
    </div>
  `).join('');
}

window.selectStructure = function(id) {
  selectedStructureId = id;
  document.querySelectorAll('.structure-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === id);
  });
  els.btnChooseStructure.disabled = false;
};

function chooseStructure() {
  const structure = structures.find(s => s.id === selectedStructureId);
  if (!structure) return;
  
  // Generar guion
  generateScript(structure);
}

window.chooseStructure = chooseStructure;

// ============================================
// STEP 2/3: GENERATE SCRIPT
// ============================================
async function generateScript(structure) {
  const btn = els.btnChooseStructure;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Escribiendo guion...';

  try {
    const idea = {
      idea: els.ideaInput.value.trim(),
      contentType: els.contentType.value,
      duration: els.duration.value,
      tone: els.tone.value,
      customInstructions: els.customInstructions.value.trim(),
    };

    const res = await api.post('/api/script/write', {
      idea,
      structureChoice: { structureId: structure.id, structure },
      customInstructions: idea.customInstructions,
    });

    scriptData = res;
    renderScript(scriptData);
    
    currentStep = 3;
    updateStepUI();
    showToast('Guion generado', 'success');
  } catch (error) {
    showToast(error.message || 'Error generando guion', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function renderScript(data) {
  els.scriptEditor.value = data.script;
  updateScriptStats();
}

function updateScriptStats() {
  const text = els.scriptEditor.value;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const duration = Math.round(words / 2.5); // ~150 ppm
  els.wordCount.textContent = words.toLocaleString();
  els.estDuration.textContent = duration;
}

// Script toolbar functions
window.insertTag = function(tag) {
  const textarea = els.scriptEditor;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + tag + text.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  updateScriptStats();
};

window.wrapSelection = function(openTag, closeTag) {
  const textarea = els.scriptEditor;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  if (selected) {
    textarea.value = textarea.value.substring(0, start) + openTag + selected + closeTag + textarea.value.substring(end);
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = start + openTag.length + selected.length + closeTag.length;
  }
  updateScriptStats();
};

// ============================================
// STEP 4: VOICE CONFIG & PREVIEWS
// ============================================
async function loadVoices() {
  try {
    const res = await api.get('/api/tts/voices');
    els.voiceSelect.innerHTML = res.voices.map(v => `
      <option value="${v.id}" ${v.id === voiceConfig.voiceId ? 'selected' : ''}>
        ${v.label}
      </option>
    `).join('');
  } catch (error) {
    console.error('Error cargando voces:', error);
  }
}

function updateRateValue() {
  const val = parseInt(els.rateInput.value);
  voiceConfig.rate = `${val >= 0 ? '+' : ''}${val}%`;
  els.rateValue.textContent = voiceConfig.rate;
  buildPreviews();
}

function updatePitchValue() {
  const val = parseInt(els.pitchInput.value);
  voiceConfig.pitch = `${val >= 0 ? '+' : ''}${val}Hz`;
  els.pitchValue.textContent = voiceConfig.pitch;
  buildPreviews();
}

function updateVolumeValue() {
  const val = parseInt(els.volumeInput.value);
  voiceConfig.volume = `${val >= 0 ? '+' : ''}${val}%`;
  els.volumeValue.textContent = voiceConfig.volume;
  buildPreviews();
}

function buildPreviews() {
  if (!scriptData || !scriptData.scenes) return;
  
  els.previewContainer.innerHTML = scriptData.scenes.map((scene, idx) => `
    <div class="preview-item" data-idx="${idx}">
      <button class="preview-play" onclick="playPreview(${idx})" aria-label="Reproducir preview">▶</button>
      <div class="preview-text">${scene.text.substring(0, 100)}${scene.text.length > 100 ? '...' : ''}</div>
      <div class="preview-duration">~${Math.round(scene.text.split(' ').length / 2.5)}s</div>
    </div>
  `).join('');
}

async function playPreview(idx) {
  const scene = scriptData.scenes[idx];
  const btn = document.querySelector(`.preview-item[data-idx="${idx}"] .preview-play`);
  
  if (btn.dataset.playing === 'true') {
    // Stop
    window.speechSynthesis.cancel();
    btn.textContent = '▶';
    btn.dataset.playing = 'false';
    btn.classList.remove('playing');
    return;
  }

  btn.textContent = '⏳';
  btn.disabled = true;
  
  try {
    const res = await api.post('/api/tts/preview', {
      text: scene.text,
      voiceConfig,
    }, { responseType: 'arraybuffer' });
    
    const audio = new Audio(URL.createObjectURL(new Blob([res], { type: 'audio/mpeg' })));
    audio.onplay = () => {
      btn.textContent = '⏹';
      btn.dataset.playing = 'true';
      btn.classList.add('playing');
    };
    audio.onended = () => {
      btn.textContent = '▶';
      btn.dataset.playing = 'false';
      btn.classList.remove('playing');
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => {
      btn.textContent = '▶';
      btn.dataset.playing = 'false';
      btn.disabled = false;
      showToast('Error reproduciendo preview', 'error');
    };
    await audio.play();
  } catch (error) {
    btn.textContent = '▶';
    btn.dataset.playing = 'false';
    btn.disabled = false;
    showToast(error.message, 'error');
  }
}

window.playPreview = playPreview;

// ============================================
// STEP 4: GENERATE FINAL AUDIO
// ============================================
async function generateFinalAudio() {
  const btn = els.btnGenerateAudio;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Generando audio final...';

  try {
    // Preparar script con escenas para el backend
    const fullScript = {
      script: els.scriptEditor.value,
      scenes: scriptData.scenes,
    };

    const res = await api.post('/api/tts', {
      script: JSON.stringify(fullScript),
      voiceConfig,
      splitChunks: true,
    });

    audioData = res;
    setupDownloads(res);
    
    currentStep = 5;
    updateStepUI();
    showToast('Audio generado exitosamente', 'success');
  } catch (error) {
    showToast(error.message || 'Error generando audio', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

window.generateFinalAudio = generateFinalAudio;

function setupDownloads(data) {
  const baseUrl = `/api`;
  els.downloadMp3.href = `${baseUrl}/audio/${data.id}`;
  els.downloadSrt.href = `${baseUrl}/srt/${data.id}`;
  els.downloadVtt.href = `${baseUrl}/vtt/${data.id}`;
  els.downloadJson.href = `${baseUrl}/json/${data.id}`;
  els.downloadTxt.href = `${baseUrl}/script/${data.id}`;
  
  // Set download filenames
  const title = (scriptData?.scenes?.[0]?.text?.substring(0, 30) || 'audio').replace(/[^a-z0-9]/gi, '_');
  els.downloadMp3.download = `${title}.mp3`;
  els.downloadSrt.download = `${title}.srt`;
  els.downloadVtt.download = `${title}.vtt`;
  els.downloadJson.download = `${title}.json`;
  els.downloadTxt.download = `${title}.txt`;
}

// ============================================
// STEP 5: LOAD FINAL RESULTS
// ============================================
async function loadFinalResults() {
  if (!audioData) return;
  
  // Player
  els.audioPlayer.src = `/api/audio/${audioData.id}`;
  els.playerTitle.textContent = scriptData?.scenes?.[0]?.text?.substring(0, 50) || 'Tu audio';
  els.playerMeta.textContent = `Duración: ${Math.round(audioData.duration)}s | Tamaño: ${formatBytes(audioData.size)}`;
  
  // Generar descripciones
  await generateDescriptions();
}

async function generateDescriptions() {
  try {
    const res = await api.post('/api/descriptions', {
      script: els.scriptEditor.value,
      metadata: {
        title: structures.find(s => s.id === selectedStructureId)?.name || 'Mi video',
        contentType: els.contentType.value,
        tone: els.tone.value,
        niche: els.contentType.value,
      },
      audioId: audioData.id,
    });
    
    descriptionsData = res;
    renderDescriptions(res);
  } catch (error) {
    console.error('Error generando descripciones:', error);
    showToast('Error generando descripciones', 'error');
  }
}

function renderDescriptions(data) {
  // Títulos
  els.titlesContainer.innerHTML = data.titles.map((t, i) => `
    <div class="title-option" onclick="selectTitle(this, ${i})">${t}</div>
  `).join('');
  
  // YouTube
  els.descYoutube.value = data.youtube.description;
  els.hashtagsYoutube.innerHTML = data.youtube.hashtags.map(h => `<span class="hashtag">${h}</span>`).join('');
  
  // TikTok
  els.descTiktok.value = data.tiktok.description;
  els.hashtagsTiktok.innerHTML = data.tiktok.hashtags.map(h => `<span class="hashtag">${h}</span>`).join('');
  
  // Shorts
  els.descShorts.value = data.shorts.description;
  els.hashtagsShorts.innerHTML = data.shorts.hashtags.map(h => `<span class="hashtag">${h}</span>`).join('');
  
  // Thumbnails
  els.thumbnailsContainer.innerHTML = data.thumbnailPrompts.map((p, i) => `
    <div class="thumbnail-prompt">
      ${p}
      <button class="copy-btn" onclick="copyToClipboardFromText('${p.replace(/'/g, "\\'")}', this)">📋</button>
    </div>
  `).join('');
  
  // Checklist
  els.checklistContainer.innerHTML = data.checklist.map(item => `
    <div class="checklist-item ${item.passed ? 'passed' : ''}">
      <div class="check-icon">${item.passed ? '✓' : ''}</div>
      <span class="check-label">${item.label}</span>
    </div>
  `).join('');
}

window.selectTitle = function(el, idx) {
  document.querySelectorAll('.title-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
};

// ============================================
// COPY FUNCTIONS
// ============================================
window.copyToClipboard = function(textareaId, btn) {
  const textarea = document.getElementById(textareaId);
  navigator.clipboard.writeText(textarea.value).then(() => {
    btn.classList.add('copied');
    btn.textContent = '✓ Copiado';
    showToast('Copiado al portapapeles', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = btn.textContent.replace('✓ Copiado', '📋 Copiar');
    }, 2000);
  });
};

window.copyHashtags = function(containerId, btn) {
  const container = document.getElementById(containerId);
  const tags = Array.from(container.querySelectorAll('.hashtag')).map(h => h.textContent).join(' ');
  navigator.clipboard.writeText(tags).then(() => {
    btn.classList.add('copied');
    btn.textContent = '✓ Copiado';
    showToast('Hashtags copiados', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = '📋 Copiar Hashtags';
    }, 2000);
  });
};

window.copyToClipboardFromText = function(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    showToast('Copiado', 'success');
    setTimeout(() => btn.textContent = '📋', 2000);
  });
};

// ============================================
// LIBRARY
// ============================================
function saveToLibrary() {
  if (!audioData || !scriptData) return;
  
  const item = {
    id: audioData.id,
    title: structures.find(s => s.id === selectedStructureId)?.name || 'Sin título',
    idea: els.ideaInput.value.trim(),
    contentType: els.contentType.value,
    tone: els.tone.value,
    duration: els.duration.value,
    script: els.scriptEditor.value,
    audioUrl: `/api/audio/${audioData.id}`,
    srtUrl: `/api/srt/${audioData.id}`,
    jsonUrl: `/api/json/${audioData.id}`,
    descriptions: descriptionsData,
    voiceConfig,
    metadata: {
      wordCount: scriptData.wordCount,
      estimatedDuration: scriptData.estimatedDuration,
      actualDuration: audioData.duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      tags: [],
    },
  };
  
  // Guardar en IndexedDB via library module
  window.libraryAPI.save(item);
  showToast('Guardado en biblioteca', 'success');
}

window.saveToLibrary = saveToLibrary;

// ============================================
// NEW PROJECT
// ============================================
function newProject() {
  // Reset all state
  currentStep = 1;
  structures = [];
  selectedStructureId = null;
  scriptData = null;
  audioData = null;
  descriptionsData = null;
  voiceConfig = { voiceId: 'es-ES-AlvaroNeural', rate: '+0%', pitch: '+0Hz', volume: '+0%', toneOverrides: {} };
  
  // Clear forms
  els.ideaInput.value = '';
  els.customInstructions.value = '';
  els.scriptEditor.value = '';
  els.rateInput.value = 0; updateRateValue();
  els.pitchInput.value = 0; updatePitchValue();
  els.volumeInput.value = 0; updateVolumeValue();
  els.ideaCharCount.textContent = '0';
  
  // Clear previews/downloads
  els.previewContainer.innerHTML = '';
  els.structuresContainer.innerHTML = '';
  els.btnChooseStructure.disabled = true;
  
  updateStepUI();
  updateScriptStats();
  showToast('Nuevo proyecto iniciado', 'info');
}

window.newProject = newProject;

// ============================================
// UTILITIES
// ============================================
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function switchDescTab(platform) {
  document.querySelectorAll('.desc-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.platform === platform));
  document.querySelectorAll('.desc-panel').forEach(panel => panel.classList.toggle('active', panel.id === `desc-${platform}`));
}

function switchSidebarTab(tab) {
  document.querySelectorAll('.sidebar-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.sidebar-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
}

window.switchDescTab = switchDescTab;
window.switchSidebarTab = switchSidebarTab;

// ============================================
// VOICE INPUT (Speech Recognition)
// ============================================
let recognition = null;
let isListening = false;

window.toggleVoice = function() {
  const btn = document.getElementById('micBtn');
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Tu navegador no soporta dictado por voz', 'error');
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    btn.classList.add('listening');
    btn.textContent = '⏹️';
    showToast('Escuchando... habla ahora', 'info');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      }
    }
    if (finalTranscript) {
      const textarea = els.ideaInput;
      textarea.value += (textarea.value ? ' ' : '') + finalTranscript;
      textarea.dispatchEvent(new Event('input'));
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      showToast('Permiso de micrófono denegado', 'error');
    }
    stopListening();
  };

  recognition.onend = stopListening;
  recognition.start();
};

function stopListening() {
  const btn = document.getElementById('micBtn');
  isListening = false;
  btn.classList.remove('listening');
  btn.textContent = '🎤';
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}