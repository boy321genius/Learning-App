// ============================================================
// CONFIG  — change BASE to match your GitHub repo name exactly
// ============================================================
const BASE = '/Learning-App';

const CAT_COLORS = {
  'History and Culture':     { g1:'#e74c3c', g2:'#9e1a0e', chip:'#fdecea', text:'#c0392b' },
  'Psychology':              { g1:'#1abc9c', g2:'#0d8a72', chip:'#e8f8f5', text:'#0e7d64' },
  'Economics and Finance':   { g1:'#3498db', g2:'#1c6fa0', chip:'#eaf4fb', text:'#1a6fa0' },
  'Science and Math':        { g1:'#9b59b6', g2:'#6c3483', chip:'#f5eef8', text:'#7d3c98' },
  'Languages':               { g1:'#f39c12', g2:'#b7770d', chip:'#fef9e7', text:'#b7770d' },
};

// ============================================================
// STATE
// ============================================================
let state = {
  topics: [],
  currentTopic: null,
  progress: {}
};

// ============================================================
// PROGRESS
// ============================================================
function loadProgress() {
  try { state.progress = JSON.parse(localStorage.getItem('userProgress') || '{}'); }
  catch { state.progress = {}; }
}
function saveProgress() { localStorage.setItem('userProgress', JSON.stringify(state.progress)); }
function markConceptRead(topicId, conceptId) {
  if (!state.progress[topicId]) state.progress[topicId] = {};
  state.progress[topicId][conceptId] = true;
  saveProgress();
}
function isConceptRead(topicId, conceptId) {
  return !!(state.progress[topicId]?.[conceptId]);
}
function getTopicReadCount(topicId) {
  return state.progress[topicId] ? Object.keys(state.progress[topicId]).length : 0;
}
function getTotalReadCount() {
  return Object.values(state.progress).reduce((s,t) => s + Object.keys(t).length, 0);
}

// ============================================================
// DATA
// ============================================================
async function loadTopicsIndex() {
  const res = await fetch(`${BASE}/data/topics.json`);
  if (!res.ok) throw new Error(`topics.json fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  state.topics = Array.isArray(data) ? data : [];
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
  const parts = hash.replace('#','').split('/');
  if (!parts[0] || parts[0]==='home') renderHome();
  else if (parts[0]==='topic')         renderTopic(parts[1], parseInt(parts[2]||'0'));
  else if (parts[0]==='deepdive')      renderDeepDive(parts[1], parts[2]);
  else                                 renderHome();
}

// ============================================================
// HELPERS
// ============================================================
function catColor(category) {
  return CAT_COLORS[category] || { g1:'#6C47FF', g2:'#4a2fd4', chip:'#ede9ff', text:'#6C47FF' };
}

function heroCardHTML(topic) {
  const cc = catColor(topic.category);
  const read = getTopicReadCount(topic.id);
  return `
    <div class="hero-card" data-topic-id="${topic.id}"
         style="background:linear-gradient(135deg,${cc.g1},${cc.g2})">
      <div class="hero-card-inner">
        <div>
          <div class="hero-cat-label">${topic.category}</div>
          <h2 class="hero-title">${topic.title}</h2>
          <p class="hero-subtitle">${topic.summary}</p>
        </div>
        <div class="hero-meta">
          ${read > 0 ? `<span class="hero-pill">✓ ${read} read</span>` : ''}
        </div>
      </div>
    </div>`;
}

function gridCardHTML(topic) {
  const cc = catColor(topic.category);
  const read = getTopicReadCount(topic.id);
  return `
    <div class="grid-card" data-topic-id="${topic.id}"
         style="background:linear-gradient(145deg,${cc.g1},${cc.g2})">
      <div class="grid-card-inner">
        <div class="grid-cat-label">${topic.category}</div>
        <div class="grid-title">${topic.title}</div>
        <div class="grid-explore">${read > 0 ? `✓ ${read} read  ·  ` : ''}Explore →</div>
      </div>
    </div>`;
}

function listCardHTML(topic) {
  const cc = catColor(topic.category);
  const read = getTopicReadCount(topic.id);
  return `
    <div class="list-card" data-topic-id="${topic.id}">
      <div class="list-card-accent" style="background:linear-gradient(${cc.g1},${cc.g2})"></div>
      <div class="list-card-body">
        <div class="list-cat-label" style="color:${cc.text}">${topic.category}</div>
        <div class="list-title">${topic.title}</div>
        <div class="list-meta">${topic.summary.slice(0,60)}…</div>
        ${read > 0 ? `<div class="topic-read-badge">✓ ${read} read</div>` : ''}
      </div>
      <div class="list-card-arrow">›</div>
    </div>`;
}

// ============================================================
// RENDER: HOME
// ============================================================
function renderHome(filterCat) {
  const app = document.getElementById('app');
  const totalRead = getTotalReadCount();

  const cats = ['All','History and Culture','Psychology','Economics and Finance','Science and Math','Languages'];
  const short = { 'All':'All','History and Culture':'History','Psychology':'Psych',
                   'Economics and Finance':'Finance','Science and Math':'Science','Languages':'Languages' };

  const topicsList = Array.isArray(state.topics) ? state.topics : [];
  const filtered = (filterCat && filterCat!=='All')
    ? topicsList.filter(t => t.category===filterCat)
    : topicsList;

  app.innerHTML = `
    <div class="screen home-screen">
      <header class="app-header">
        <div class="header-left">
          <div class="app-logo">🧠</div>
          <h1 class="app-title">LearnApp</h1>
        </div>
        <button class="icon-btn" id="settings-btn" aria-label="Settings">⚙️</button>
      </header>

      <div class="home-scroll-area" id="scroll-area">
        ${totalRead > 0 ? `
          <div class="streak-banner">
            <span>🔥</span>
            <span>You've read <strong>${totalRead}</strong> concept${totalRead!==1?'s':''} so far</span>
          </div>` : ''}

        <div class="cat-tabs" id="cat-tabs">
          ${cats.map(c => `
            <button class="cat-tab ${(!filterCat&&c==='All')||filterCat===c?'active':''}"
              data-cat="${c}">${short[c]}</button>`).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <h3>No topics yet</h3>
            <p>Content is coming soon.<br>Check back after the first topics are added.</p>
          </div>
        ` : `
          <div class="section-label">TOPICS</div>
          <div class="grid-cards">
            ${filtered.map(topic => {
              const cc = catColor(topic.category);
              const readCount = getTopicReadCount(topic.id);
              return `
                <div class="grid-card" onclick="navigate('#topic/${topic.id}/0')"
                     style="background: linear-gradient(135deg, ${cc.g1}, ${cc.g2});">
                  <div class="grid-card-inner">
                    <div class="grid-title">${topic.title}</div>
                    <div class="grid-summary">${topic.summary || ''}</div>
                    <div class="grid-explore">Explore &rarr;${readCount ? ` · ${readCount} read` : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

        `}
      </div>

      <nav class="bottom-nav">
        <button class="nav-item active" id="nav-home">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
          <div class="nav-active-dot"></div>
        </button>
        <button class="nav-item" id="nav-progress">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Progress</span>
        </button>
        <button class="nav-item" id="nav-settings-nav">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Settings</span>
        </button>
      </nav>
    </div>

    <!-- Settings modal -->
    <div class="modal-overlay hidden" id="settings-modal">
      <div class="modal">
        <div class="modal-handle"></div>
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
          <p class="settings-note">Progress is stored on this device only. Export to back it up or move it to another device.</p>
        </div>
      </div>
    </div>
  `;

  const openSettings = () => document.getElementById('settings-modal').classList.remove('hidden');
  const closeSettings = () => document.getElementById('settings-modal').classList.add('hidden');

  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('nav-settings-nav').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target===e.currentTarget) closeSettings();
  });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
  });

  document.getElementById('cat-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (btn) renderHome(btn.dataset.cat==='All' ? null : btn.dataset.cat);
  });

  document.getElementById('scroll-area').addEventListener('click', e => {
    const card = e.target.closest('[data-topic-id]');
    if (card) navigate(`#topic/${card.dataset.topicId}/0`);
  });
}

// ============================================================
// RENDER: TOPIC
// ============================================================
async function renderTopic(topicId, conceptIndex=0) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="screen loading-screen"><div class="spinner"></div></div>`;

  let topic;
  try {
    topic = (state.currentTopic?.id===topicId) ? state.currentTopic : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = `<div class="screen"><div class="error-state">Could not load topic. Check your connection.</div></div>`;
    return;
  }

  const concept  = topic.concepts[conceptIndex];
  const total    = topic.concepts.length;
  const isRead   = isConceptRead(topicId, concept.id);
  const cc       = catColor(topic.category);
  const pct      = ((conceptIndex+1)/total*100).toFixed(0);

  app.innerHTML = `
    <div class="screen topic-screen">
      <header class="app-header" style="background:linear-gradient(180deg,${cc.g1}18,${cc.g1}00)">
        <button class="back-btn" id="back-btn">‹ Back</button>
        <h1 class="header-title">${topic.title}</h1>
        <div style="width:60px"></div>
      </header>

      <div class="concept-progress-bar">
        <div class="concept-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="concept-counter">${conceptIndex+1} of ${total} concepts · ${pct}%</div>

      <div class="concept-card-wrapper" id="card-wrapper">
        <div class="concept-card ${isRead?'is-read':''}" id="concept-card">
          <div class="concept-card-accent-bar"
               style="background:linear-gradient(90deg,${cc.g1},${cc.g2})"></div>
          <div class="concept-card-body">
            <div class="concept-card-top">
              <span class="cat-chip"
                style="background:${cc.chip};color:${cc.text}">${topic.category}</span>
              ${isRead
                ? '<span class="read-badge">✓ Read</span>'
                : `<span class="concept-ghost-num">${String(conceptIndex+1).padStart(2,'0')}</span>`}
            </div>
            <h2 class="concept-title">${concept.title}</h2>
            <div class="concept-divider"></div>
            <div class="concept-summary">${concept.summary}</div>
          </div>
          <div class="concept-card-actions">
            <button class="mark-read-btn ${isRead?'marked':''}" id="mark-read-btn">
              ${isRead ? '✓ Read' : '○ Mark as Read'}
            </button>
            <button class="deep-dive-btn" id="deep-dive-btn">Deep‑Dive →</button>
          </div>
        </div>
      </div>

      <div class="concept-nav">
        <button class="nav-btn ${conceptIndex===0?'disabled':''}"
          id="prev-btn" ${conceptIndex===0?'disabled':''}>‹</button>
        <div class="dots-container" id="dots">
          ${topic.concepts.map((c,i) => `
            <div class="dot
              ${i===conceptIndex?'active':''}
              ${isConceptRead(topicId,c.id)?'read':''}"
              data-index="${i}"></div>`).join('')}
        </div>
        <button class="nav-btn ${conceptIndex<total-1?'next-active':'disabled'}"
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
    if (conceptIndex>0) navigate(`#topic/${topicId}/${conceptIndex-1}`);
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (conceptIndex<total-1) navigate(`#topic/${topicId}/${conceptIndex+1}`);
  });
  document.getElementById('dots').addEventListener('click', e => {
    const d = e.target.closest('.dot');
    if (d) navigate(`#topic/${topicId}/${d.dataset.index}`);
  });
  setupSwipe(document.getElementById('card-wrapper'),
    () => { if (conceptIndex<total-1) navigate(`#topic/${topicId}/${conceptIndex+1}`); },
    () => { if (conceptIndex>0)       navigate(`#topic/${topicId}/${conceptIndex-1}`); }
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
    topic = (state.currentTopic?.id===topicId) ? state.currentTopic : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = `<div class="screen"><div class="error-state">Could not load content.</div></div>`;
    return;
  }

  const conceptIndex = topic.concepts.findIndex(c => c.id===conceptId);
  const concept      = topic.concepts[conceptIndex];
  const cc           = catColor(topic.category);
  const alreadyRead  = isConceptRead(topicId, conceptId);

  app.innerHTML = `
    <div class="screen deepdive-screen">
      <header class="app-header" style="background:linear-gradient(180deg,var(--primary-tint),var(--bg))">
        <button class="back-btn" id="back-btn">‹</button>
        <h1 class="header-title">${concept.title}</h1>
        <div style="width:40px"></div>
      </header>

      <div class="deepdive-content">
        <div class="breadcrumb-chip">${topic.category} · ${topic.title}</div>

        <div class="deepdive-label">
          <span class="deepdive-label-text">DEEP‑DIVE</span>
          <span class="deepdive-label-count">${concept.sections.length} sections</span>
        </div>

        ${concept.sections.map((sec, i) => `
          <div class="dd-section ${i===0?'open':''}" id="dds-${i}">
            <div class="dd-section-header" data-section="${i}">
              <div class="dd-section-left-bar"></div>
              <span class="dd-section-num">${String(i+1).padStart(2,'0')}</span>
              <span class="dd-section-title">${sec.title}</span>
              <span class="dd-section-toggle">${i===0?'▾':'▸'}</span>
            </div>
            <div class="dd-section-body ${i===0?'open':''}" id="ddb-${i}">
              ${sec.body.map(p=>`<p>${p}</p>`).join('')}
            </div>
          </div>
        `).join('')}

        <div class="deepdive-actions">
          ${!alreadyRead
            ? `<button class="cta-primary-btn" id="mark-read-btn">✓ Mark as Read</button>`
            : `<div class="already-read-badge">✓ Already Read</div>`}
          <button class="cta-secondary-btn" id="back-topic-btn">← Back to ${topic.title}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () =>
    navigate(`#topic/${topicId}/${conceptIndex}`));
  document.getElementById('back-topic-btn').addEventListener('click', () =>
    navigate(`#topic/${topicId}/${conceptIndex}`));
  const mrb = document.getElementById('mark-read-btn');
  if (mrb) mrb.addEventListener('click', () => {
    markConceptRead(topicId, conceptId);
    navigate(`#topic/${topicId}/${conceptIndex}`);
  });

  document.querySelectorAll('.dd-section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const i    = hdr.dataset.section;
      const sec  = document.getElementById(`dds-${i}`);
      const body = document.getElementById(`ddb-${i}`);
      const tog  = hdr.querySelector('.dd-section-toggle');
      const open = body.classList.toggle('open');
      sec.classList.toggle('open', open);
      tog.textContent = open ? '▾' : '▸';
    });
  });
}

// ============================================================
// SWIPE
// ============================================================
function setupSwipe(el, onLeft, onRight) {
  let sx=0, sy=0;
  el.addEventListener('touchstart', e => { sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, {passive:true});
  el.addEventListener('touchend',   e => {
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if (Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>50) { if(dx<0) onLeft(); else onRight(); }
  }, {passive:true});
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportProgress() {
  const blob = new Blob([JSON.stringify({exportedAt:new Date().toISOString(),progress:state.progress},null,2)],{type:'application/json'});
  const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob),download:'learnapp-progress.json'});
  a.click(); URL.revokeObjectURL(a.href);
}
function importProgress(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      state.progress = d.progress || {};
      saveProgress();
      document.getElementById('settings-modal').classList.add('hidden');
      renderHome();
    } catch { alert('Invalid file — please select a valid LearnApp export.'); }
  };
  r.readAsText(file);
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadProgress();
  if ('serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register(`${BASE}/sw.js`));
  try { await loadTopicsIndex(); } catch(e) { console.error('Topics index failed:', e); }
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
