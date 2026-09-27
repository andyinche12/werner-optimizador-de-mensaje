// public/js/learn.js
// Learning module: analyze top videos to extract winning patterns

let learnVideos = [];

export function initLearn() {
  loadLearnVideos();
  renderLearnVideos();
}

function loadLearnVideos() {
  try {
    const saved = localStorage.getItem('werner-learn-videos');
    if (saved) {
      learnVideos = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading learn videos:', e);
    learnVideos = [];
  }
}

function saveLearnVideos() {
  try {
    localStorage.setItem('werner-learn-videos', JSON.stringify(learnVideos));
  } catch (e) {
    console.warn('Error saving learn videos:', e);
  }
}

function renderLearnVideos() {
  const container = document.getElementById('learnVideosList');
  if (!container) return;
  
  if (learnVideos.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;">No hay videos añadidos aún.</div>';
    return;
  }
  
  container.innerHTML = learnVideos.map((video, idx) => `
    <div class="learn-video-item">
      <div class="video-platform ${video.platform}">${getPlatformIcon(video.platform)}</div>
      <div class="video-info">
        <div class="video-url">${escapeHtml(video.url)}</div>
        <div class="video-stats">
          <span>${formatNumber(video.views)} vistas</span>
          <span>${video.watchTime}s watch time</span>
          ${video.ctr ? `<span>${video.ctr}% CTR</span>` : ''}
          ${video.likes ? `<span>${formatNumber(video.likes)} 👍</span>` : ''}
        </div>
      </div>
      <button class="remove-btn" onclick="removeLearnVideo(${idx})" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function getPlatformIcon(platform) {
  const icons = { youtube: '▶', tiktok: '♪', shorts: '📱' };
  return icons[platform] || '📹';
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.addLearnVideo = function() {
  const url = document.getElementById('learnUrl').value.trim();
  const views = parseInt(document.getElementById('learnViews').value) || 0;
  const watchTime = parseInt(document.getElementById('learnWatchTime').value) || 0;
  const platform = document.getElementById('learnPlatform').value;
  const ctr = parseFloat(document.getElementById('learnCtr').value) || null;
  
  if (!url) {
    if (window.showToast) window.showToast('Ingresa la URL del video', 'error');
    return;
  }
  
  if (views < 100) {
    if (window.showToast) window.showToast('Mínimo 100 vistas para ser relevante', 'error');
    return;
  }
  
  if (watchTime < 10) {
    if (window.showToast) window.showToast('Mínimo 10s de watch time', 'error');
    return;
  }
  
  learnVideos.push({ url, views, watchTime, platform, ctr, likes: 0, comments: 0, shares: 0, publishedAt: new Date().toISOString() });
  saveLearnVideos();
  renderLearnVideos();
  
  // Clear form
  document.getElementById('learnUrl').value = '';
  document.getElementById('learnViews').value = '';
  document.getElementById('learnWatchTime').value = '';
  document.getElementById('learnCtr').value = '';
  
  if (window.showToast) window.showToast('Video añadido', 'success');
};

window.removeLearnVideo = function(idx) {
  learnVideos.splice(idx, 1);
  saveLearnVideos();
  renderLearnVideos();
  if (window.showToast) window.showToast('Video eliminado', 'info');
};

window.runLearning = async function() {
  if (learnVideos.length === 0) {
    if (window.showToast) window.showToast('Añade al menos 1 video', 'error');
    return;
  }
  
  const btn = document.querySelector('.btn-full[onclick="runLearning()"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '🧠 Analizando...';
  
  try {
    // Import api dynamically to avoid circular deps
    const { api } = await import('./api.js');
    
    const res = await api.post('/api/learn', { videos: learnVideos });
    
    if (res.patterns) {
      renderLearnResults(res.patterns);
      document.getElementById('learnResults').style.display = 'block';
      if (window.showToast) window.showToast(`Analizados ${res.analyzedCount} videos`, 'success');
    }
  } catch (error) {
    if (window.showToast) window.showToast(error.message || 'Error analizando', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

function renderLearnResults(patterns) {
  const container = document.getElementById('learnResults');
  if (!container) return;
  
  const groups = [
    { key: 'titleFormulas', label: 'Fórmulas de Título', icon: '📝' },
    { key: 'hookPatterns', label: 'Patrones de Gancho', icon: '🎣' },
    { key: 'structurePatterns', label: 'Estructuras Ganadoras', icon: '🏗️' },
    { key: 'ctaPatterns', label: 'CTAs Efectivos', icon: '📢' },
    { key: 'recommendedTones', label: 'Tonos Recomendados', icon: '🎭' },
    { key: 'keywords', label: 'Palabras Clave', icon: '🔑' },
  ];
  
  container.innerHTML = `
    <h4>📊 Patrones detectados (basado en ${learnVideos.length} videos)</h4>
    ${groups.map(g => `
      <div class="pattern-group">
        <div class="pattern-label">${g.icon} ${g.label}</div>
        <div class="pattern-list">
          ${(patterns[g.key] || []).map(p => `<span class="pattern-tag">${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>
    `).join('')}
    ${patterns.optimalDuration ? `
      <div class="pattern-group">
        <div class="pattern-label">⏱️ Duración Óptima</div>
        <div class="pattern-tag">${patterns.optimalDuration}s</div>
      </div>
    ` : ''}
    <button class="btn btn-primary btn-full" onclick="applyPatterns()" style="margin-top:16px;">✨ Aplicar a próximo proyecto</button>
  `;
}

window.applyPatterns = function() {
  // Guardar patrones para usar en próximo proyecto
  const patterns = document.getElementById('learnResults').dataset.patterns;
  localStorage.setItem('werner-learn-patterns', JSON.stringify(patterns));
  if (window.showToast) window.showToast('Patrones guardados para próximo proyecto', 'success');
};