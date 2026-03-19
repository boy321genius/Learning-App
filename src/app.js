// ============================================================
// CONFIG — change BASE to match your GitHub repo name exactly
// ============================================================
const BASE = '/Learning-App';

const CAT_COLORS = {
  'History and Culture': {
    g1:'#e74c3c', g2:'#9e1a0e', chip:'#fdecea', text:'#c0392b'
  },
  'Psychology': {
    g1:'#1abc9c', g2:'#0d8a72', chip:'#e8f8f5', text:'#0e7d64'
  },
  'Economics and Finance': {
    g1:'#3498db', g2:'#1c6fa0', chip:'#eaf4fb', text:'#1a6fa0'
  },
  'Science and Math': {
    g1:'#9b59b6', g2:'#6c3483', chip:'#f5eef8', text:'#7d3c98'
  },
  'Languages': {
    g1:'#f39c12', g2:'#b7770d', chip:'#fef9e7', text:'#b7770d'
  },
};

// ============================================================
// STATE
// ============================================================
let state = {
  topics: [],
  currentTopic: null,
  progress: {},
  activeCategory: 'All'
};

// ============================================================
// PROGRESS
// ============================================================
function loadProgress() {
  try {
    state.progress = JSON.parse(localStorage.getItem('userProgress') || '{}');
  } catch {
    state.progress = {};
  }
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
function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const hash = window.location.hash || '#home';
  const parts = hash.replace('#','').split('/');
  if (!parts[0] || parts[0]==='home') renderHome();
  else if (parts[0]==='topic') renderTopic(parts[1], parseInt(parts[2]||'0'));
  else if (parts[0]==='deepdive') renderDeepDive(parts[1], parts[2]);
  else renderHome();
}

// ============================================================
// HELPERS
// ============================================================
function catColor(category) {
  return CAT_COLORS[category] || {
    g1:'#6C47FF', g2:'#4a2fd4', chip:'#ede9ff', text:'#6C47FF'
  };
}

function $(sel) {
  return document.querySelector(sel);
}

function createEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

// ============================================================
// HOME SCREEN — NEW UNIFIED GRID (NO FEATURED)
// ============================================================
function renderHome() {
  const app = $('#app');
  app.innerHTML = '';

  const screen = createEl('div', 'screen');

  // Header
  const header = createEl('header', 'app-header');
  const left = createEl('div', 'header-left');
  const logo = createEl('div', 'app-logo', '🧠');
  const title = createEl('div', 'app-title', 'LearnApp');
  left.append(logo, title);
  const settingsBtn = createEl('button', 'icon-btn', '⚙️');
  settingsBtn.addEventListener('click', () => openSettings());
  header.append(left, settingsBtn);
  screen.append(header);

  // Optional streak banner if any concepts read
  const totalRead = getTotalReadCount();
  if (totalRead > 0) {
    const streak = createEl('div', 'streak-banner');
    streak.innerHTML = `
      🔥 <span><strong>${totalRead}</strong> concepts explored so far. Keep going!</span>
    `;
    screen.append(streak);
  }

  // Section label
  const sectionLabel = createEl('div', 'section-label', 'Topics');
  screen.append(sectionLabel);

  // Category filters
  const filterRow = createEl('div', 'cat-filter-row');
  const categories = ['All','History and Culture','Psychology','Economics and Finance','Science and Math','Languages'];
  categories.forEach(cat => {
    const chip = createEl('button', 'cat-chip' + (state.activeCategory === cat ? ' cat-chip-active' : ''), cat === 'All' ? 'All' : cat);
    chip.addEventListener('click', () => {
      state.activeCategory = cat;
      renderHome();
    });
    filterRow.appendChild(chip);
  });
  screen.append(filterRow);

  // Topic grid
  const grid = createEl('div', 'grid-cards');

  const visibleTopics = state.activeCategory === 'All'
    ? state.topics
    : state.topics.filter(t => t.category === state.activeCategory);

  if (!visibleTopics.length) {
    const empty = createEl('div', 'empty-state');
    empty.innerHTML = `
      <div class="empty-icon">📚</div>
      <h3>No topics yet</h3>
      <p>Once you add topics to <code>data/topics.json</code>, they’ll appear here automatically.</p>
    `;
    screen.append(empty);
  } else {
    visibleTopics.forEach(topic => {
      const cc = catColor(topic.category);
      const card = createEl('div', 'grid-card');
      const inner = createEl('div', 'grid-card-inner');
      inner.style.background = `linear-gradient(135deg, ${cc.g1}, ${cc.g2})`;

      const titleEl = createEl('div', 'grid-title', topic.title);
      const summaryEl = createEl('div', 'grid-summary', topic.summary || '');
      const exploreEl = createEl('div', 'grid-explore', 'Explore →');

      inner.append(titleEl, summaryEl, exploreEl);
      card.appendChild(inner);

      card.addEventListener('click', () => {
        navigate(`#topic/${topic.id}/0`);
      });

      grid.appendChild(card);
    });

    screen.append(grid);
  }

  // Bottom nav (unchanged)
  const nav = createEl('nav', 'bottom-nav');
  const tabs = [
    { id:'home', icon:'🏠', label:'Home', active:true },
    { id:'progress', icon:'📊', label:'Progress', active:false },
    { id:'settings', icon:'⚙️', label:'Settings', active:false },
  ];
  tabs.forEach(t => {
    const item = createEl('button', 'bottom-nav-item' + (t.active ? ' bottom-nav-item-active' : ''), '');
    const icon = createEl('span', '', t.icon);
    const label = createEl('div', '', t.label);
    item.append(icon, label);
    if (t.id === 'settings') {
      item.addEventListener('click', () => openSettings());
    } else if (t.id === 'home') {
      item.addEventListener('click', () => navigate('#home'));
    }
    if (t.active) {
      const dot = createEl('div', 'bottom-nav-dot');
      item.appendChild(dot);
    }
    nav.appendChild(item);
  });
  screen.append(nav);

  app.append(screen);
}

// ============================================================
// TOPIC SCREEN (UNCHANGED)
// ============================================================
async function renderTopic(topicId, conceptIndex) {
  const app = $('#app');
  app.innerHTML = '';

  const topicData = await loadTopic(topicId);
  const concepts = topicData.concepts || [];
  const idx = Math.max(0, Math.min(conceptIndex || 0, concepts.length - 1));
  const concept = concepts[idx];

  const screen = createEl('div', 'screen');

  const header = createEl('header', 'app-header');
  const left = createEl('div', 'header-left');
  const back = createEl('button', 'back-btn', '‹ Back');
  back.addEventListener('click', () => navigate('#home'));
  const hTitle = createEl('div', 'header-title', topicData.title || topicId);
  left.append(back, hTitle);
  header.append(left);
  screen.append(header);

  if (concepts.length > 0) {
    const progressBar = createEl('div', 'topic-progress');
    const pct = ((idx + 1) / concepts.length) * 100;
    progressBar.innerHTML = `
      <div class="topic-progress-track">
        <div class="topic-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="topic-progress-label">${idx + 1} / ${concepts.length} concepts</div>
    `;
    screen.append(progressBar);
  }

  if (!concept) {
    const empty = createEl('div', 'empty-state');
    empty.innerHTML = `
      <div class="empty-icon">📝</div>
      <h3>No concepts yet</h3>
      <p>This topic doesn’t have any concept cards yet. Add them to the JSON file to get started.</p>
    `;
    screen.append(empty);
  } else {
    const cc = catColor(topicData.category);
    const card = createEl('div', 'concept-card');
    card.innerHTML = `
      <div class="concept-card-inner" style="border-top: 4px solid ${cc.g1}">
        <div class="concept-title">${concept.title}</div>
        <div class="concept-body">${concept.summary}</div>
        <div class="concept-actions">
          <button class="btn-mark-read">${isConceptRead(topicId, concept.id) ? '✓ Marked as read' : 'Mark as read'}</button>
          <button class="btn-deep-dive">Deep‑dive →</button>
        </div>
      </div>
      <div class="concept-nav-dots">
        ${concepts.map((c, i) => `
          <span class="dot ${i === idx ? 'dot-active' : isConceptRead(topicId, c.id) ? 'dot-read' : ''}"></span>
        `).join('')}
      </div>
    `;
    const markBtn = card.querySelector('.btn-mark-read');
    markBtn.addEventListener('click', () => {
      markConceptRead(topicId, concept.id);
      renderTopic(topicId, idx);
    });
    const deepBtn = card.querySelector('.btn-deep-dive');
    deepBtn.addEventListener('click', () => {
      navigate(`#deepdive/${topicId}/${concept.id}`);
    });
    screen.append(card);

    const navStrip = createEl('div', 'concept-nav-strip');
    const prevBtn = createEl('button', 'concept-nav-btn', '← Previous');
    const nextBtn = createEl('button', 'concept-nav-btn', 'Next →');
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === concepts.length - 1;
    prevBtn.addEventListener('click', () => {
      if (idx > 0) navigate(`#topic/${topicId}/${idx-1}`);
    });
    nextBtn.addEventListener('click', () => {
      if (idx < concepts.length - 1) navigate(`#topic/${topicId}/${idx+1}`);
    });
    navStrip.append(prevBtn, nextBtn);
    screen.append(navStrip);
  }

  const nav = createEl('nav', 'bottom-nav');
  const tabs = [
    { id:'home', icon:'🏠', label:'Home', active:false },
    { id:'progress', icon:'📊', label:'Progress', active:false },
    { id:'settings', icon:'⚙️', label:'Settings', active:false },
  ];
  tabs.forEach(t => {
    const item = createEl('button', 'bottom-nav-item' + (t.id==='home' ? '' : ''), '');
    const icon = createEl('span', '', t.icon);
    const label = createEl('div', '', t.label);
    item.append(icon, label);
    if (t.id === 'settings') {
      item.addEventListener('click', () => openSettings());
    } else if (t.id === 'home') {
      item.addEventListener('click', () => navigate('#home'));
    }
    nav.appendChild(item);
  });
  screen.append(nav);

  app.append(screen);
}

// ============================================================
// DEEP-DIVE SCREEN (UNCHANGED)
// ============================================================
async function renderDeepDive(topicId, conceptId) {
  const app = $('#app');
  app.innerHTML = '';

  const topicData = await loadTopic(topicId);
  const concept = (topicData.concepts || []).find(c => c.id === conceptId);

  const screen = createEl('div', 'screen');

  const header = createEl('header', 'app-header');
  const left = createEl('div', 'header-left');
  const back = createEl('button', 'back-btn', '‹ Back');
  back.addEventListener('click', () => navigate(`#topic/${topicId}/0`));
  const hTitle = createEl('div', 'header-title', concept ? concept.title : 'Deep‑dive');
  left.append(back, hTitle);
  header.append(left);
  screen.append(header);

  if (!concept) {
    const empty = createEl('div', 'empty-state');
    empty.innerHTML = `
      <div class="empty-icon">🔍</div>
      <h3>Deep‑dive not found</h3>
      <p>We couldn’t find that concept in the topic JSON. Check the ID and try again.</p>
    `;
    screen.append(empty);
  } else {
    const dd = createEl('div', 'deepdive');
    const sections = concept.deep_dive || {};
    dd.innerHTML = `
      ${Object.entries(sections).map(([key, value]) => `
        <details class="dd-section" open>
          <summary class="dd-summary">${key}</summary>
          <div class="dd-body">${value}</div>
        </details>
      `).join('')}
      <button class="dd-mark-read">
        ${isConceptRead(topicId, conceptId) ? '✓ Marked as read' : 'Mark this concept as read'}
      </button>
    `;
    const markBtn = dd.querySelector('.dd-mark-read');
    markBtn.addEventListener('click', () => {
      markConceptRead(topicId, conceptId);
      renderDeepDive(topicId, conceptId);
    });
    screen.append(dd);
  }

  const nav = createEl('nav', 'bottom-nav');
  const tabs = [
    { id:'home', icon:'🏠', label:'Home', active:false },
    { id:'progress', icon:'📊', label:'Progress', active:false },
    { id:'settings', icon:'⚙️', label:'Settings', active:false },
  ];
  tabs.forEach(t => {
    const item = createEl('button', 'bottom-nav-item', '');
    const icon = createEl('span', '', t.icon);
    const label = createEl('div', '', t.label);
    item.append(icon, label);
    if (t.id === 'settings') {
      item.addEventListener('click', () => openSettings());
    } else if (t.id === 'home') {
      item.addEventListener('click', () => navigate('#home'));
    }
    nav.appendChild(item);
  });
  screen.append(nav);

  app.append(screen);
}

// ============================================================
// SETTINGS, IMPORT/EXPORT (UNCHANGED)
// ============================================================
function openSettings() {
  alert('Settings sheet coming soon (export/import, theme, etc.).');
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadProgress();
  try {
    await loadTopicsIndex();
  } catch (e) {
    console.error(e);
  }
  handleRoute();
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', init);

// Service worker registration (unchanged)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}/sw.js`).catch(err => {
      console.error('SW registration failed', err);
    });
  });
}
