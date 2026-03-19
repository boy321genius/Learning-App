// ============================================================
// CONFIG  –  BASE must exactly match your GitHub repo name (case-sensitive)
// ============================================================
const BASE = '/Learning-App';

const CATEGORY_COLORS = {
  'History and Culture':     '#FF6B6B',
  'Psychology':              '#4ECDC4',
  'Economics and Finance':   '#45B7D1',
  'Science and Math':        '#96CEB4',
  'Languages':               '#FFEAA7'
};

// ============================================================
// STATE
// ============================================================
let state = {
  topics:              [],
  currentTopic:        null,
  currentConceptIndex: 0,
  progress:            {}
};

// ============================================================
// PROGRESS  (localStorage)
// ============================================================
function loadProgress() {
  try { state.progress = JSON.parse(localStorage.getItem('userProgress') || '{}'); }
  catch { state.progress = {}; }
}

function saveProgress() {
  localStorage.setItem('userProgress', JSON.stringify(state.progress));
}

function markConceptRead(topicId, conceptId) {
  if (!state.progress[topicId]) state.progress[topicId] = {};
  state.progress[topicId][conceptId] = true;
  saveProgress();
}

function isConceptRead(topicId, conceptId) {
  return !!(state.progress[topicId] && state.progress[topicId][conceptId]);
}

function getTopicReadCount(topicId) {
  return state.progress[topicId] ? Object.keys(state.progress[topicId]).length : 0;
}

function getTotalReadCount() {
  return Object.values(state.progress)
    .reduce((sum, t) => sum + Object.keys(t).length, 0);
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadTopicsIndex() {
  const res = await fetch(`${BASE}/data/topics.json`);
  state.topics = await res.json();
}

async function loadTopic(id) {
  const res = await fetch(`${BASE}/data/topics/${id}.json`);
  return await res.json();
}

// ============================================================
// ROUTER
// ============================================================
function navigate(hash) { window.location.hash = hash; }

function handleRoute() {
  const hash  = window.location.hash || '#home';
  const parts = hash.replace('#', '').split('/');
  const screen = parts[0];

  if (!screen || screen === 'home') renderHome();
  else if (screen === 'topic')      renderTopic(parts[1], parseInt(parts[2] || '0'));
  else if (screen === 'deepdive')   renderDeepDive(parts[1], parts[2]);
  else                              renderHome();
}

// ============================================================
// RENDER: HOME
// ============================================================
function renderHome(filterCategory) {
  const app       = document.getElementById('app');
  const totalRead = getTotalReadCount();

  const categories = [
    'All','History and Culture','Psychology',
    'Economics and Finance','Science and Math','Languages'
  ];
  const catShort = {
    'All':'All','History and Culture':'History','Psychology':'Psych',
    'Economics and Finance':'Finance','Science and Math':'Science','Languages':'Languages'
  };

  const filtered = (filterCategory && filterCategory !== 'All')
    ? state.topics.filter(t => t.category === filterCategory)
    : state.topics;

  app.innerHTML = `
    <div class="screen home-screen">
      <header class="app-header">
        <div class="header-left">
          <div class="app-logo">🧠</div>
          <h1 class="app-title">LearnApp</h1>
        </div>
        <button class="icon-btn" id="settings-btn" aria-label="Settings">⚙️</button>
      </header>

      ${totalRead > 0 ? `
        <div class="progress-banner">
          🔥 You've read <strong>${totalRead}</strong> concept${totalRead !== 1 ? 's' : ''}
        </div>
      ` : ''}

      <div class="category-tabs" id="category-tabs">
        ${categories.map(cat => `
          <button class="cat-tab ${(!filterCategory && cat==='All')||filterCategory===cat?'active':''}"
            data-cat="${cat}">${catShort[cat]}</button>
        `).join('')}
      </div>

      <div class="topics-grid" id="topics-grid">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <p>No topics yet.<br>Content coming soon.</p>
          </div>
        ` : filtered.map(topic => {
            const read  = getTopicReadCount(topic.id);
            const color = CATEGORY_COLORS[topic.category] || '#5B3FD9';
            return `
              <div class="topic-card" data-topic-id="${topic.id}">
                <div class="topic-card-accent" style="background:${color}"></div>
                <div class="topic-card-body">
                  <span class="topic-category-label" style="color:${color}">${topic.category}</span>
                  <h2 class="topic-title">${topic.title}</h2>
                  <p class="topic-summary">${topic.summary}</p>
                  ${read > 0 ? `<div class="topic-progress-badge">${read} read</div>` : ''}
                </div>
              </div>`;
          }).join('')}
      </div>
    </div>

    <div class="modal-overlay hidden" id="settings-modal">
      <div class="modal">
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="icon-btn" id="close-settings">✕</button>
        </div>
        <div class="modal-body">
          <button class="action-btn" id="export-btn">
            <span class="btn-icon">📤</span><span>Export Progress</span>
          </button>
          <label class="action-btn">
            <span class="btn-icon">📥</span><span>Import Progress</span>
            <input type="file" accept=".json" id="import-input" class="hidden" />
          </label>
          <p class="settings-note">
            Your progress is stored only on this device.
            Export/Import to back it up or move it to another device.
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('settings-btn').addEventListener('click', () =>
    document.getElementById('settings-modal').classList.remove('hidden'));
  document.getElementById('close-settings').addEventListener('click', () =>
    document.getElementById('settings-modal').classList.add('hidden'));
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
  });
  document.getElementById('category-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    renderHome(btn.dataset.cat === 'All' ? null : btn.dataset.cat);
  });
  document.getElementById('topics-grid').addEventListener('click', e => {
    const card = e.target.closest('.topic-card');
    if (card) navigate(`#topic/${card.dataset.topicId}/0`);
  });
}

// ============================================================
// RENDER: TOPIC
// ============================================================
async function renderTopic(topicId, conceptIndex = 0) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="screen loading-screen"><div class="spinner"></div></div>`;

  let topic;
  try {
    topic = (state.currentTopic && state.currentTopic.id === topicId)
      ? state.currentTopic
      : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = `<div class="screen"><div class="error-state">Could not load topic.</div></div>`;
    return;
  }

  state.currentConceptIndex = conceptIndex;
  const concept = topic.concepts[conceptIndex];
  const total   = topic.concepts.length;
  const isRead  = isConceptRead(topicId, concept.id);
  const color   = CATEGORY_COLORS[topic.category] || '#5B3FD9';

  app.innerHTML = `
    <div class="screen topic-screen">
      <header class="app-header">
        <button class="back-btn" id="back-btn">‹ Back</button>
        <h1 class="header-title">${topic.title}</h1>
        <div style="width:60px"></div>
      </header>

      <div class="concept-progress-bar">
        <div class="concept-progress-fill" style="width:${((conceptIndex+1)/total)*100}%"></div>
      </div>
      <div class="concept-counter">${conceptIndex+1} / ${total}</div>

      <div class="concept-card-wrapper" id="card-wrapper">
        <div class="concept-card ${isRead?'is-read':''}" id="concept-card">
          <div class="concept-card-top">
            <span class="concept-category-chip"
              style="background:${color}22;color:${color}">${topic.category}</span>
            ${isRead ? '<span class="read-badge">✓ Read</span>' : ''}
          </div>
          <h2 class="concept-title">${concept.title}</h2>
          <div class="concept-summary">${concept.summary}</div>
          <div class="concept-card-actions">
            <button class="mark-read-btn ${isRead?'marked':''}" id="mark-read-btn">
              ${isRead ? '✓ Read' : 'Mark as Read'}
            </button>
            <button class="deep-dive-btn" id="deep-dive-btn">Deep‑Dive →</button>
          </div>
        </div>
      </div>

      <div class="concept-nav">
        <button class="nav-btn ${conceptIndex===0?'disabled':''}"
          id="prev-btn" ${conceptIndex===0?'disabled':''}>‹</button>
        <div class="dots-container" id="dots-container">
          ${topic.concepts.map((c,i) => `
            <div class="dot ${i===conceptIndex?'active':''} ${isConceptRead(topicId,c.id)?'read':''}"
              data-index="${i}"></div>
          `).join('')}
        </div>
        <button class="nav-btn ${conceptIndex===total-1?'disabled':''}"
          id="next-btn" ${conceptIndex===total-1?'disabled':''}>›</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#home'));
  document.getElementById('mark-read-btn').addEventListener('click', () => {
    markConceptRead(topicId, concept.id);
    renderTopic(topicId, conceptIndex);
  });
  document.getElementById('deep-dive-btn').addEventListener('click', () =>
    navigate(`#deepdive/${topicId}/${concept.id}`));
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (conceptIndex > 0) navigate(`#topic/${topicId}/${conceptIndex-1}`);
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (conceptIndex < total-1) navigate(`#topic/${topicId}/${conceptIndex+1}`);
  });
  document.getElementById('dots-container').addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (dot) navigate(`#topic/${topicId}/${dot.dataset.index}`);
  });
  setupSwipe(
    document.getElementById('card-wrapper'),
    () => { if (conceptIndex < total-1) navigate(`#topic/${topicId}/${conceptIndex+1}`); },
    () => { if (conceptIndex > 0)       navigate(`#topic/${topicId}/${conceptIndex-1}`); }
  );
}

// ============================================================
// RENDER: DEEP DIVE
// ============================================================
async function renderDeepDive(topicId, conceptId) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="screen loading-screen"><div class="spinner"></div></div>`;

  let topic;
  try {
    topic = (state.currentTopic && state.currentTopic.id === topicId)
      ? state.currentTopic
      : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = `<div class="screen"><div class="error-state">Could not load content.</div></div>`;
    return;
  }

  const conceptIndex = topic.concepts.findIndex(c => c.id === conceptId);
  const concept      = topic.concepts[conceptIndex];
  const color        = CATEGORY_COLORS[topic.category] || '#5B3FD9';
  const alreadyRead  = isConceptRead(topicId, conceptId);

  app.innerHTML = `
    <div class="screen deepdive-screen">
      <header class="app-header">
        <button class="back-btn" id="back-btn">‹</button>
        <h1 class="header-title">${concept.title}</h1>
        <div style="width:40px"></div>
      </header>
      <div class="deepdive-content">
        <div class="deepdive-intro">
          <span class="concept-category-chip"
            style="background:${color}22;color:${color}">${topic.category} · ${topic.title}</span>
        </div>
        ${concept.sections.map((section,i) => `
          <div class="deepdive-section">
            <div class="section-header" data-section="${i}">
              <span class="section-number">${String(i+1).padStart(2,'0')}</span>
              <h3 class="section-title">${section.title}</h3>
              <span class="section-toggle">▾</span>
            </div>
            <div class="section-body open" id="section-body-${i}">
              ${section.body.map(p => `<p>${p}</p>`).join('')}
            </div>
          </div>
        `).join('')}
        <div class="deepdive-actions">
          ${!alreadyRead ? `
            <button class="mark-read-btn" id="mark-read-btn">Mark as Read ✓</button>
          ` : '<div class="already-read-badge">✓ Already Read</div>'}
          <button class="back-to-topic-btn" id="back-topic-btn">← Back to ${topic.title}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () =>
    navigate(`#topic/${topicId}/${conceptIndex}`));
  const markBtn = document.getElementById('mark-read-btn');
  if (markBtn) markBtn.addEventListener('click', () => {
    markConceptRead(topicId, conceptId);
    navigate(`#topic/${topicId}/${conceptIndex}`);
  });
  document.getElementById('back-topic-btn').addEventListener('click', () =>
    navigate(`#topic/${topicId}/${conceptIndex}`));
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const i    = header.dataset.section;
      const body = document.getElementById(`section-body-${i}`);
      const tog  = header.querySelector('.section-toggle');
      body.classList.toggle('open');
      tog.textContent = body.classList.contains('open') ? '▾' : '▸';
    });
  });
}

// ============================================================
// SWIPE
// ============================================================
function setupSwipe(el, onLeft, onRight) {
  let startX = 0, startY = 0;
  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) onLeft(); else onRight();
    }
  }, { passive: true });
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportProgress() {
  const data = { exportedAt: new Date().toISOString(), progress: state.progress };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'learnapp-progress.json'; a.click();
  URL.revokeObjectURL(url);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      state.progress = data.progress || {};
      saveProgress();
      document.getElementById('settings-modal').classList.add('hidden');
      renderHome();
    } catch {
      alert('Invalid file — please select a valid LearnApp export.');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadProgress();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register(`${BASE}/sw.js`));
  }
  try { await loadTopicsIndex(); }
  catch (e) { console.error('Could not load topics index:', e); }
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
