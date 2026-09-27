// public/js/library.js
// IndexedDB-based library for persistent storage of projects

const DB_NAME = 'WernerAudioFactory';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let db = null;

export async function initLibrary() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB no soportado');
      resolve();
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      renderLibrary();
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('contentType', 'contentType', { unique: false });
      }
    };
  });
}

export async function saveProject(project) {
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project);
    request.onsuccess = () => {
      renderLibrary();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProject(id) {
  if (!db) return null;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProjects() {
  if (!db) return [];
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id) {
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => {
      renderLibrary();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadProjectToEditor(id) {
  const project = await getProject(id);
  if (!project) return;
  
  // Cargar en el wizard
  const els = {
    ideaInput: document.getElementById('ideaInput'),
    contentType: document.getElementById('contentType'),
    duration: document.getElementById('duration'),
    tone: document.getElementById('tone'),
    customInstructions: document.getElementById('customInstructions'),
    scriptEditor: document.getElementById('scriptEditor'),
    voiceSelect: document.getElementById('voiceSelect'),
    rateInput: document.getElementById('rateInput'),
    pitchInput: document.getElementById('pitchInput'),
    volumeInput: document.getElementById('volumeInput'),
  };
  
  if (els.ideaInput) els.ideaInput.value = project.idea || '';
  if (els.contentType) els.contentType.value = project.contentType || 'top_listas';
  if (els.duration) els.duration.value = project.duration || '90s';
  if (els.tone) els.tone.value = project.tone || 'neutral';
  if (els.customInstructions) els.customInstructions.value = project.customInstructions || '';
  if (els.scriptEditor) els.scriptEditor.value = project.script || '';
  if (els.voiceSelect) els.voiceSelect.value = project.voiceConfig?.voiceId || 'es-ES-AlvaroNeural';
  if (els.rateInput) { els.rateInput.value = parseInt(project.voiceConfig?.rate || '+0%'); updateRateValue?.(); }
  if (els.pitchInput) { els.pitchInput.value = parseInt(project.voiceConfig?.pitch || '+0Hz'); updatePitchValue?.(); }
  if (els.volumeInput) { els.volumeInput.value = parseInt(project.voiceConfig?.volume || '+0%'); updateVolumeValue?.(); }
  
  // Trigger input events
  [els.ideaInput, els.scriptEditor].forEach(el => {
    if (el) el.dispatchEvent(new Event('input'));
  });
  
  // Restaurar estado global
  window.structures = project.structures || [];
  window.selectedStructureId = project.selectedStructureId || null;
  window.scriptData = project.scriptData || null;
  window.audioData = project.audioData || null;
  window.descriptionsData = project.descriptionsData || null;
  window.voiceConfig = project.voiceConfig || window.voiceConfig;
  
  // Si tiene audio generado, ir al paso 5
  if (project.audioData) {
    window.currentStep = 5;
    window.updateStepUI?.();
    window.setupDownloads?.(project.audioData);
    window.loadFinalResults?.();
  } else if (project.scriptData) {
    window.currentStep = 4;
    window.updateStepUI?.();
    window.buildPreviews?.();
  } else if (project.structures?.length) {
    window.currentStep = 3;
    window.updateStepUI?.();
    window.generateScript?.(project.structures.find(s => s.id === project.selectedStructureId));
  } else {
    window.currentStep = 2;
    window.updateStepUI?.();
    window.renderStructures?.();
  }
  
  if (window.showToast) window.showToast('Proyecto cargado', 'success');
}

let searchQuery = '';

export function filterLibrary() {
  const input = document.getElementById('librarySearch');
  if (input) {
    searchQuery = input.value.toLowerCase();
    renderLibrary();
  }
}

async function renderLibrary() {
  const container = document.getElementById('libraryList');
  if (!container) return;
  
  if (!db) {
    container.innerHTML = '<div class="empty-state">IndexedDB no disponible</div>';
    return;
  }
  
  try {
    const projects = await getAllProjects();
    
    let filtered = projects;
    if (searchQuery) {
      filtered = projects.filter(p => 
        p.title.toLowerCase().includes(searchQuery) ||
        p.idea.toLowerCase().includes(searchQuery) ||
        p.contentType.toLowerCase().includes(searchQuery)
      );
    }
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay proyectos' + (searchQuery ? ' que coincidan' : '') + '.</div>';
      return;
    }
    
    container.innerHTML = filtered.map(project => `
      <div class="library-item" onclick="loadProjectToEditor('${project.id}')">
        <div class="item-icon">${getTypeIcon(project.contentType)}</div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(project.title)}</div>
          <div class="item-meta">
            <span>${formatDate(project.createdAt)}</span>
            <span>${project.contentType}</span>
            <span>${project.metadata?.wordCount || 0} palabras</span>
            <span>${Math.round(project.metadata?.actualDuration || project.metadata?.estimatedDuration || 0)}s</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="item-btn" onclick="event.stopPropagation(); downloadProject('${project.id}')" title="Descargar audio">⬇️</button>
          <button class="item-btn" onclick="event.stopPropagation(); duplicateProject('${project.id}')" title="Duplicar">📋</button>
          <button class="item-btn" onclick="event.stopPropagation(); deleteProjectConfirm('${project.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error rendering library:', error);
    container.innerHTML = '<div class="empty-state">Error cargando biblioteca</div>';
  }
}

function getTypeIcon(type) {
  const icons = {
    historias: '📖',
    educativo: '🎓',
    motivacion: '💪',
    finanzas_personales: '💰',
    top_listas: '📊',
    misterio: '🔍',
    resumenes_libros: '📚',
    noticias_nicho: '📰',
    otro: '✨',
  };
  return icons[type] || '✨';
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global functions for onclick
window.loadProjectToEditor = loadProjectToEditor;
window.filterLibrary = filterLibrary;

window.downloadProject = async function(id) {
  const project = await getProject(id);
  if (!project || !project.audioData) {
    if (window.showToast) window.showToast('No hay audio para descargar', 'error');
    return;
  }
  const a = document.createElement('a');
  a.href = `/api/audio/${project.audioData.id}`;
  a.download = `${(project.title || 'audio').replace(/[^a-z0-9]/gi, '_')}.mp3`;
  a.click();
  if (window.showToast) window.showToast('Descarga iniciada', 'success');
};

window.duplicateProject = async function(id) {
  const project = await getProject(id);
  if (!project) return;
  
  const newProject = {
    ...project,
    id: crypto.randomUUID(),
    title: project.title + ' (copia)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  
  await saveProject(newProject);
  if (window.showToast) window.showToast('Proyecto duplicado', 'success');
};

window.deleteProjectConfirm = async function(id) {
  if (!confirm('¿Eliminar este proyecto? No se puede deshacer.')) return;
  await deleteProject(id);
  if (window.showToast) window.showToast('Proyecto eliminado', 'success');
};