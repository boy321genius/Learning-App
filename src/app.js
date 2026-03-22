// ============================================================
// CONFIG
// ============================================================
const BASE = '/Learning-App';

const CAT_COLORS = {
  'History and Culture':   { g1:'#e74c3c', g2:'#9e1a0e', chip:'#fdecea', text:'#c0392b' },
  'Mind and Human Nature': { g1:'#1abc9c', g2:'#0d8a72', chip:'#e8f8f5', text:'#0e7d64' },
  'Economics and Finance': { g1:'#3498db', g2:'#1c6fa0', chip:'#eaf4fb', text:'#1a6fa0' },
  'Science and Math':      { g1:'#9b59b6', g2:'#6c3483', chip:'#f5eef8', text:'#7d3c98' },
  'Languages':             { g1:'#f39c12', g2:'#b7770d', chip:'#fef9e7', text:'#b7770d' },
};

// ============================================================
// HELPERS
// ============================================================
// FIX: Added escapeHTML to sanitize all dynamic content injected into innerHTML,
// preventing XSS and broken layouts when titles/summaries contain <, >, ", or '.
function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function catColor(category) {
  return CAT_COLORS[category] || { g1:'#6C47FF', g2:'#4a2fd4', chip:'#ede9ff', text:'#6C47FF' };
}

// ============================================================
// AI ART CACHE
// ============================================================
function getCachedArt(topicId) {
  try { return localStorage.getItem('topic-art-' + topicId); }
  catch { return null; }
}
function setCachedArt(topicId, svg) {
  try { localStorage.setItem('topic-art-' + topicId, svg); } catch {}
}

// FIX: Removed direct browser call to api.anthropic.com. Calling the Anthropic API
// directly from the browser exposes your API key to anyone who inspects network
// requests. Route through your own backend/serverless endpoint instead, which holds
// the key securely server-side. The direct call also lacked the required
// 'x-api-key', 'anthropic-version', and 'anthropic-dangerous-direct-browser-access'
// headers, so it silently failed every time and art never rendered.
async function generateTopicArt(topic, cc) {
  if (getCachedArt(topic.id)) return getCachedArt(topic.id);
  try {
    const res = await fetch(`${BASE}/api/topic-art`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:       topic.id,
        title:    topic.title,
        category: topic.category,
        colors:   cc
      })
    });
    if (!res.ok) throw new Error(`Art API failed: HTTP ${res.status}`);
    const data = await res.json();
    const svg  = typeof data.svg === 'string' ? data.svg.trim() : '';
    if (svg.startsWith('<svg')) {
      setCachedArt(topic.id, svg);
      return svg;
    }
  } catch (e) {
    console.warn('Art gen failed for', topic.id, e);
  }
  return null;
}

// FIX: Added a running-lock so that rapid renderHome() calls (e.g. typing in the
// search box) cannot spawn multiple concurrent generation loops. Without this,
// overlapping loops would fire duplicate API requests before cache entries existed,
// and each loop would independently try to write the same cache key.
let artGenerationRunning = false;

async function generateMissingArt() {
  if (artGenerationRunning) return;
  artGenerationRunning = true;
  try {
    const topics = Array.isArray(state.topics) ? state.topics : [];
    for (const topic of topics) {
      if (getCachedArt(topic.id)) continue;
      const cc  = catColor(topic.category);
      const svg = await generateTopicArt(topic, cc);
      if (svg) {
        const card = document.getElementById('lane-card-' + topic.id);
        if (card && !card.querySelector('.lane-card-art')) {
          const artDiv = document.createElement('div');
          artDiv.className = 'lane-card-art';
          artDiv.innerHTML = svg;
          card.insertBefore(artDiv, card.firstChild);
          card.classList.add('has-art');
        }
      }
    }
  } finally {
    artGenerationRunning = false;
  }
}

// ============================================================
// STATE
// ============================================================
let state = {
  topics:       [],
  currentTopic: null,
  progress:     {},
  needsReview:  {},
};

// ============================================================
// PROGRESS & REVIEW FLAGS
// ============================================================
function loadProgress() {
  try { state.progress    = JSON.parse(localStorage.getItem('userProgress') || '{}'); }
  catch { state.progress  = {}; }
  try { state.needsReview = JSON.parse(localStorage.getItem('needsReview')  || '{}'); }
  catch { state.needsReview = {}; }
}
function saveProgress()    { localStorage.setItem('userProgress', JSON.stringify(state.progress)); }
function saveNeedsReview() { localStorage.setItem('needsReview',  JSON.stringify(state.needsReview)); }

function markConceptRead(topicId, conceptId) {
  if (!state.progress[topicId]) state.progress[topicId] = {};
  state.progress[topicId][conceptId] = true;
  saveProgress();
}
function markNeedsReview(topicId, conceptId) {
  if (!state.needsReview[topicId]) state.needsReview[topicId] = {};
  state.needsReview[topicId][conceptId] = true;
  saveNeedsReview();
}
function clearNeedsReview(topicId, conceptId) {
  if (state.needsReview[topicId]) {
    delete state.needsReview[topicId][conceptId];
    if (Object.keys(state.needsReview[topicId]).length === 0)
      delete state.needsReview[topicId];
    saveNeedsReview();
  }
}
function isConceptRead(topicId, conceptId)   { return !!(state.progress[topicId]?.[conceptId]); }
function isNeedsReview(topicId, conceptId)   { return !!(state.needsReview[topicId]?.[conceptId]); }
function getTopicReadCount(topicId) {
  return state.progress[topicId] ? Object.keys(state.progress[topicId]).length : 0;
}
function getTotalReadCount() {
  return Object.values(state.progress).reduce((s,t) => s + Object.keys(t).length, 0);
}
function getTotalNeedsReviewCount() {
  return Object.values(state.needsReview).reduce((s,t) => s + Object.keys(t).length, 0);
}
function getTopicReviewCount(topicId) {
  return state.needsReview[topicId] ? Object.keys(state.needsReview[topicId]).length : 0;
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
  if (!res.ok) throw new Error(`Topic "${id}" fetch failed: HTTP ${res.status}`);
  return await res.json();
}

// ============================================================
// ROUTER
// navigatePush    — major moves (home <-> topic <-> deepdive); adds history entry
// navigateReplace — card-to-card within a topic; replaces entry so back exits topic
// ============================================================
function navigatePush(hash) { window.location.hash = hash; }
function navigateReplace(hash) { history.replaceState(null, '', '#' + hash); handleRoute(); }
function handleRoute() {
  const hash  = window.location.hash || '#home';
  const parts = hash.replace('#','').split('/');
  if (!parts[0] || parts[0]==='home')  renderHome();
  else if (parts[0]==='topic')         renderTopic(parts[1], parseInt(parts[2]||'0'));
  else if (parts[0]==='deepdive')      renderDeepDive(parts[1], parts[2]);
  else if (parts[0]==='progress')      renderProgress();
  else                                 renderHome();
}

// ============================================================
// SETTINGS MODAL
// ============================================================
function settingsModalHTML() {
  return `
    <div class="modal-overlay hidden" id="settings-modal">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="icon-btn" id="close-settings">&#10005;</button>
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
    </div>`;
}

function wireSettingsModal(openTriggerIds) {
  const open  = () => document.getElementById('settings-modal').classList.remove('hidden');
  const close = () => document.getElementById('settings-modal').classList.add('hidden');
  (openTriggerIds || []).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', open);
  });
  document.getElementById('close-settings').addEventListener('click', close);
  document.getElementById('settings-modal').addEventListener('click', e => { if (e.target===e.currentTarget) close(); });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-input').addEventListener('change', e => { if (e.target.files[0]) importProgress(e.target.files[0]); });
}

// ============================================================
// LANE CARD  (used in category lanes and Continue strip)
// ============================================================
function laneCardHTML(topic) {
  const cc        = catColor(topic.category);
  const readCount = getTopicReadCount(topic.id);
  const total     = topic.concept_count || 0;
  const pct       = total > 0 ? Math.round(readCount / total * 100) : 0;
  const revCount  = getTopicReviewCount(topic.id);
  const metaLine  = readCount > 0
    ? readCount + '/' + total + ' read' + (revCount > 0 ? ' · &#8634; ' + revCount : '')
    : total + ' concept' + (total !== 1 ? 's' : '');
  const cachedArt = getCachedArt(topic.id);
  // FIX: escape topic.id (used in id/onclick attrs) and topic.title
  const safeId    = escapeHTML(topic.id);
  const safeTitle = escapeHTML(topic.title);

  return `
    <div class="lane-card ${cachedArt ? 'has-art' : ''}"
         id="lane-card-${safeId}"
         onclick="showTopicPreview('${safeId}')"
         style="background:linear-gradient(160deg,${cc.g1},${cc.g2})">
      ${cachedArt ? `<div class="lane-card-art">${cachedArt}</div>` : ''}
      <div class="lane-card-inner">
        <div class="lane-card-title">${safeTitle}</div>
        <div class="lane-card-meta">${metaLine}</div>
      </div>
      ${pct > 0 ? `
        <div class="lane-card-progress-track">
          <div class="lane-card-progress-fill" style="width:${pct}%"></div>
        </div>` : ''}
    </div>`;
}

// ============================================================
// RENDER: HOME  (category lanes + surprise me + search)
// ============================================================
function renderHome(searchQuery) {
  const app        = document.getElementById('app');
  const topicsList = Array.isArray(state.topics) ? state.topics : [];

  const inProgress = topicsList.filter(t => {
    const r = getTopicReadCount(t.id);
    return r > 0 && r < (t.concept_count || 0);
  });

  const cats = ['History and Culture','Mind and Human Nature','Economics and Finance','Science and Math','Languages'];
  const byCat = {};
  cats.forEach(c => { byCat[c] = []; });
  topicsList.forEach(t => { if (byCat[t.category]) byCat[t.category].push(t); });

  let searchResults = null;
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    searchResults = topicsList.filter(t =>
      t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }

  // FIX: escape searchQuery before inserting into the input's value attribute
  // and into the "No results" message — raw strings could break the attribute
  // or inject markup.
  const safeSearchQuery = escapeHTML(searchQuery || '');

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

        <div class="search-bar-wrap">
          <input class="search-input" id="search-input" type="search"
            placeholder="Search topics..." value="${safeSearchQuery}" autocomplete="off" />
        </div>

        ${searchResults !== null ? `

          ${searchResults.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No results</h3>
              <p>Nothing matched &ldquo;${safeSearchQuery}&rdquo;.</p>
            </div>
          ` : `
            <div class="section-label">RESULTS — ${searchResults.length} topic${searchResults.length!==1?'s':''}</div>
            <div class="search-results-list">
              ${searchResults.map(topic => {
                const cc        = catColor(topic.category);
                const readCount = getTopicReadCount(topic.id);
                const total     = topic.concept_count || '?';
                const safeId    = escapeHTML(topic.id);
                const safeCat   = escapeHTML(topic.category);
                const safeTitle = escapeHTML(topic.title);
                return `
                  <div class="search-result-item" onclick="showTopicPreview('${safeId}')">
                    <div class="search-result-accent" style="background:linear-gradient(${cc.g1},${cc.g2})"></div>
                    <div class="search-result-body">
                      <div class="search-result-cat" style="color:${cc.text}">${safeCat}</div>
                      <div class="search-result-title">${safeTitle}</div>
                      <div class="search-result-meta">${readCount ? readCount+'/'+total+' read · ' : ''}${total} concepts</div>
                    </div>
                    <div class="search-result-arrow">&#8250;</div>
                  </div>`;
              }).join('')}
            </div>
          `}

        ` : `

          <button class="surprise-btn" id="surprise-btn">
            <span class="surprise-icon">✨</span>
            <div class="surprise-text-wrap">
              <span class="surprise-title">Surprise me</span>
              <span class="surprise-sub">Pick something random</span>
            </div>
            <span class="surprise-arrow">&#8594;</span>
          </button>

          ${inProgress.length > 0 ? `
            <div class="section-label lane-section-label">CONTINUE</div>
            <div class="lane-scroll">
              ${inProgress.map(t => laneCardHTML(t)).join('')}
            </div>
          ` : ''}

          ${cats.map(cat => {
            const topics = byCat[cat];
            if (!topics || topics.length === 0) return '';
            const cc = catColor(cat);
            return `
              <div class="lane-header">
                <span class="lane-title" style="color:${cc.text}">${escapeHTML(cat)}</span>
                <span class="lane-count">${topics.length} topic${topics.length!==1?'s':''}</span>
              </div>
              <div class="lane-scroll">
                ${topics.map(t => laneCardHTML(t)).join('')}
              </div>`;
          }).join('')}

        `}

        <div style="height:88px"></div>
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
    ${settingsModalHTML()}
  `;

  wireSettingsModal(['settings-btn','nav-settings-nav']);
  document.getElementById('nav-progress').addEventListener('click', () => navigatePush('#progress'));

  const surpriseBtn = document.getElementById('surprise-btn');
  if (surpriseBtn) surpriseBtn.addEventListener('click', () => {
    const unstarted = topicsList.filter(t => getTopicReadCount(t.id) === 0);
    const pool = unstarted.length > 0 ? unstarted : topicsList;
    showTopicPreview(pool[Math.floor(Math.random() * pool.length)].id);
  });

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderHome(e.target.value), 200);
  });
  document.getElementById('search-input').addEventListener('search', e => {
    if (!e.target.value) renderHome();
  });

  setTimeout(() => generateMissingArt(), 400);
}

// ============================================================
// TOPIC PREVIEW SHEET
// ============================================================
async function showTopicPreview(topicId) {
  const topicMeta = state.topics.find(t => t.id === topicId);
  if (!topicMeta) return;
  const cc = catColor(topicMeta.category);

  const app     = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'preview-overlay';

  overlay.innerHTML = `
    <div class="preview-sheet" id="preview-sheet">
      <div class="preview-handle-bar"></div>
      <div class="preview-header-loading" style="background:linear-gradient(135deg,${cc.g1},${cc.g2})">
        <div class="spinner spinner-white"></div>
      </div>
    </div>`;
  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  overlay.addEventListener('click', e => { if (e.target === overlay) dismissPreview(overlay); });

  let topic;
  try {
    topic = (state.currentTopic?.id===topicId) ? state.currentTopic : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    overlay.remove();
    return;
  }

  // FIX: overlay may have been dismissed by the user while loadTopic() was awaiting.
  // Without this guard, writing to a detached #preview-sheet node throws silently
  // and the close/CTA listeners never attach, leaving ghost state.
  if (!overlay.isConnected) return;
  const sheet = document.getElementById('preview-sheet');
  if (!sheet) return;

  const readCount   = getTopicReadCount(topicId);
  const total       = topic.concepts.length;
  const revCount    = getTopicReviewCount(topicId);
  const firstUnread = topic.concepts.findIndex(c => !isConceptRead(topicId, c.id));
  const resumeIndex = firstUnread >= 0 ? firstUnread : 0;
  const btnLabel    = readCount === 0    ? 'Start Learning'
                    : readCount === total ? 'Review Again'
                    : 'Continue (' + readCount + '/' + total + ')';

  sheet.innerHTML = `
    <div class="preview-handle-bar"></div>
    <div class="preview-header" style="background:linear-gradient(135deg,${cc.g1},${cc.g2})">
      ${getCachedArt(topicId) ? `<div class="preview-header-art">${getCachedArt(topicId)}</div>` : ''}
      <button class="preview-close-btn" id="preview-close">&#10005;</button>
      <div class="preview-cat-label">${escapeHTML(topic.category)}</div>
      <h2 class="preview-title">${escapeHTML(topic.title)}</h2>
      <div class="preview-pills">
        <span class="preview-pill">${total} concept${total!==1?'s':''}</span>
        ${readCount > 0 ? '<span class="preview-pill">' + readCount + ' read</span>' : ''}
        ${revCount  > 0 ? '<span class="preview-pill preview-pill-review">&#8634; ' + revCount + ' to review</span>' : ''}
      </div>
    </div>
    <div class="preview-body" id="preview-body">
      <p class="preview-summary">${escapeHTML(topic.summary)}</p>
      <div class="preview-concepts-label">Concepts</div>
      ${topic.concepts.map((c, i) => {
        const read = isConceptRead(topicId, c.id);
        const rev  = isNeedsReview(topicId, c.id);
        return `
          <div class="preview-concept-row ${read ? 'pcr-read' : ''}" data-index="${i}">
            <div class="preview-concept-num" style="color:${cc.g1}">${String(i+1).padStart(2,'0')}</div>
            <div class="preview-concept-name">${escapeHTML(c.title)}</div>
            <div class="preview-concept-status">
              ${rev  ? '<span class="pcr-review-icon">&#8634;</span>'
                     : read ? '<span class="pcr-check">&#10003;</span>' : '<span class="pcr-arrow">&#8250;</span>'}
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="preview-footer">
      <button class="preview-cta-btn" id="preview-cta"
              style="background:linear-gradient(135deg,${cc.g1},${cc.g2})">${btnLabel} &#8594;</button>
    </div>
  `;

  document.getElementById('preview-close').addEventListener('click', () => dismissPreview(overlay));
  document.getElementById('preview-cta').addEventListener('click', () => {
    dismissPreview(overlay);
    navigatePush('#topic/' + topicId + '/' + resumeIndex);
  });
  document.getElementById('preview-body').addEventListener('click', e => {
    const row = e.target.closest('.preview-concept-row');
    if (row) {
      dismissPreview(overlay);
      navigatePush('#topic/' + topicId + '/' + row.dataset.index);
    }
  });
}

function dismissPreview(overlay) {
  overlay.classList.remove('visible');
  overlay.classList.add('dismissing');
  setTimeout(() => overlay.remove(), 300);
}

// ============================================================
// RENDER: TOPIC
// ============================================================
async function renderTopic(topicId, conceptIndex) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="screen loading-screen"><div class="spinner"></div></div>';

  let topic;
  try {
    topic = (state.currentTopic?.id===topicId) ? state.currentTopic : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = '<div class="screen"><div class="error-state">Could not load topic. Check your connection.</div></div>';
    return;
  }

  // FIX: guard against an empty or malformed concepts array — without this,
  // topic.concepts[conceptIndex] is undefined and concept.id throws immediately.
  if (!topic?.concepts?.length) {
    app.innerHTML = '<div class="screen"><div class="error-state">This topic has no concepts yet.</div></div>';
    return;
  }

  // FIX: clamp conceptIndex to a valid range. A stale/malformed hash like
  // #topic/some-id/999 would otherwise produce an undefined concept and crash.
  conceptIndex = typeof conceptIndex === 'number' && !isNaN(conceptIndex)
    ? conceptIndex
    : parseInt(conceptIndex, 10) || 0;
  conceptIndex = Math.max(0, Math.min(conceptIndex, topic.concepts.length - 1));

  const concept  = topic.concepts[conceptIndex];
  const total    = topic.concepts.length;
  const isRead   = isConceptRead(topicId, concept.id);
  const needsRev = isNeedsReview(topicId, concept.id);
  const cc       = catColor(topic.category);
  const pct      = ((conceptIndex+1)/total*100).toFixed(0);

  const markBtnLabel = needsRev ? '&#8634; Mark as reviewed'
                     : isRead   ? '&#10003; Read'
                                : '&#9675; Mark as Read';
  const markBtnClass = (isRead && !needsRev) ? 'marked' : needsRev ? 'btn-needs-review' : '';

  app.innerHTML = `
    <div class="screen topic-screen" id="topic-screen">
      <header class="app-header" style="background:linear-gradient(180deg,${cc.g1}18,${cc.g1}00)">
        <button class="back-btn" id="back-btn">&#8249; Back</button>
        <h1 class="header-title">${escapeHTML(topic.title)}</h1>
        <div style="width:60px"></div>
      </header>

      <div class="concept-progress-bar">
        <div class="concept-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="concept-counter">${conceptIndex+1} of ${total} concepts &middot; ${pct}%</div>

      <div class="concept-card-wrapper" id="card-wrapper">
        <div class="concept-card ${isRead?'is-read':''} ${needsRev?'card-needs-review':''}" id="concept-card">
          <div class="concept-card-accent-bar" style="background:linear-gradient(90deg,${cc.g1},${cc.g2})"></div>
          <div class="concept-card-body">
            <div class="concept-card-top">
              <span class="cat-chip" style="background:${cc.chip};color:${cc.text}">${escapeHTML(topic.category)}</span>
              ${needsRev
                ? '<span class="review-badge">&#8634; Review</span>'
                : isRead
                  ? '<span class="read-badge">&#10003; Read</span>'
                  : '<span class="concept-ghost-num">'+String(conceptIndex+1).padStart(2,'0')+'</span>'}
            </div>
            <h2 class="concept-title">${escapeHTML(concept.title)}</h2>
            <div class="concept-divider"></div>
            <div class="concept-summary">${escapeHTML(concept.summary)}</div>
          </div>
          <div class="concept-card-actions">
            <button class="mark-read-btn ${markBtnClass}" id="mark-read-btn">${markBtnLabel}</button>
            <button class="deep-dive-btn" id="deep-dive-btn">Deep&#8209;Dive &#8594;</button>
          </div>
        </div>
      </div>

      <div class="concept-nav">
        <button class="nav-btn ${conceptIndex===0?'disabled':''}"
          id="prev-btn" ${conceptIndex===0?'disabled':''}>&#8249;</button>
        <div class="dots-container" id="dots">
          ${topic.concepts.map((c,i) => {
            const r  = isConceptRead(topicId,c.id);
            const nr = isNeedsReview(topicId,c.id);
            return '<div class="dot '+(i===conceptIndex?'active ':'')+
              (r?(nr?'dot-review':'read'):'')+'" data-index="'+i+'"></div>';
          }).join('')}
        </div>
        <button class="nav-btn ${conceptIndex<total-1?'next-active':'disabled'}"
          id="next-btn" ${conceptIndex===total-1?'disabled':''}>&#8250;</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigatePush('#home'));
  document.getElementById('deep-dive-btn').addEventListener('click', () =>
    navigatePush('#deepdive/'+topicId+'/'+concept.id));
  document.getElementById('mark-read-btn').addEventListener('click', () => {
    if (isRead && !needsRev) return;
    if (needsRev) { clearNeedsReview(topicId, concept.id); renderTopic(topicId, conceptIndex); return; }
    showRecallModal(topicId, concept, conceptIndex, total);
  });
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (conceptIndex>0) navigateReplace('topic/'+topicId+'/'+(conceptIndex-1));
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (conceptIndex<total-1) navigateReplace('topic/'+topicId+'/'+(conceptIndex+1));
  });
  document.getElementById('dots').addEventListener('click', e => {
    const d = e.target.closest('.dot');
    if (d) navigateReplace('topic/'+topicId+'/'+d.dataset.index);
  });
  setupSwipe(document.getElementById('topic-screen'),
    () => { if (conceptIndex<total-1) navigateReplace('topic/'+topicId+'/'+(conceptIndex+1)); },
    () => { if (conceptIndex>0)       navigateReplace('topic/'+topicId+'/'+(conceptIndex-1)); }
  );
}

// ============================================================
// RECALL MODAL
// ============================================================
function showRecallModal(topicId, concept, conceptIndex, total) {
  const overlay = document.createElement('div');
  overlay.className = 'recall-overlay';
  overlay.innerHTML = `
    <div class="recall-modal">
      <div class="recall-eyebrow">Quick recall</div>
      <div class="recall-concept-name">${escapeHTML(concept.title)}</div>
      <div class="recall-prompt">Without looking, could you explain the core idea to someone else?</div>
      <div class="recall-actions">
        <button class="recall-btn recall-got-it" id="recall-got-it">&#10003; Got it</button>
        <button class="recall-btn recall-fuzzy" id="recall-fuzzy">&#8634; Still fuzzy</button>
      </div>
      <div class="recall-note">"Still fuzzy" marks it read but flags it for review on the Progress screen.</div>
    </div>`;
  document.getElementById('app').appendChild(overlay);
  document.getElementById('recall-got-it').addEventListener('click', () => {
    markConceptRead(topicId, concept.id); clearNeedsReview(topicId, concept.id); overlay.remove();
    if (conceptIndex < total-1) navigateReplace('topic/'+topicId+'/'+(conceptIndex+1));
    else renderTopic(topicId, conceptIndex);
  });
  document.getElementById('recall-fuzzy').addEventListener('click', () => {
    markConceptRead(topicId, concept.id); markNeedsReview(topicId, concept.id); overlay.remove();
    if (conceptIndex < total-1) navigateReplace('topic/'+topicId+'/'+(conceptIndex+1));
    else renderTopic(topicId, conceptIndex);
  });
}

// ============================================================
// RENDER: DEEP DIVE
// ============================================================
async function renderDeepDive(topicId, conceptId) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="screen loading-screen"><div class="spinner"></div></div>';
  let topic;
  try {
    topic = (state.currentTopic?.id===topicId) ? state.currentTopic : await loadTopic(topicId);
    state.currentTopic = topic;
  } catch {
    app.innerHTML = '<div class="screen"><div class="error-state">Could not load content.</div></div>';
    return;
  }

  // FIX: findIndex returns -1 when conceptId doesn't match (stale URL, renamed
  // concept, etc.). The original code passed -1 straight to topic.concepts[-1],
  // giving undefined, and then concept.title / concept.sections immediately threw.
  const conceptIndex = topic.concepts.findIndex(c => c.id === conceptId);
  if (conceptIndex === -1) {
    navigatePush('#topic/' + topicId + '/0');
    return;
  }

  const concept     = topic.concepts[conceptIndex];
  const cc          = catColor(topic.category);
  const alreadyRead = isConceptRead(topicId, conceptId);
  const needsRev    = isNeedsReview(topicId, conceptId);
  const hasNext     = conceptIndex < topic.concepts.length - 1;
  const nextConcept = hasNext ? topic.concepts[conceptIndex+1] : null;

  app.innerHTML = `
    <div class="screen deepdive-screen">
      <header class="app-header" style="background:linear-gradient(180deg,var(--primary-tint),var(--bg))">
        <button class="back-btn" id="back-btn">&#8249;</button>
        <h1 class="header-title">${escapeHTML(concept.title)}</h1>
        <div style="width:40px"></div>
      </header>
      <div class="deepdive-content">
        <div class="breadcrumb-chip">${escapeHTML(topic.category)} &middot; ${escapeHTML(topic.title)}</div>
        <div class="deepdive-label">
          <span class="deepdive-label-text">DEEP&#8209;DIVE</span>
          <span class="deepdive-label-count">${concept.sections.length} sections</span>
        </div>
        ${concept.sections.map((sec, i) => `
          <div class="dd-section ${i===0?'open':''}" id="dds-${i}">
            <div class="dd-section-header" data-section="${i}">
              <div class="dd-section-left-bar"></div>
              <span class="dd-section-num">${String(i+1).padStart(2,'0')}</span>
              <span class="dd-section-title">${escapeHTML(sec.title)}</span>
              <span class="dd-section-toggle">${i===0?'&#9662;':'&#9656;'}</span>
            </div>
            <div class="dd-section-body ${i===0?'open':''}" id="ddb-${i}">
              ${sec.body.map(p => '<p>' + escapeHTML(p) + '</p>').join('')}
            </div>
          </div>`).join('')}
        <div class="deepdive-actions">
          ${needsRev
            ? '<button class="cta-primary-btn" id="mark-read-btn">&#10003; Mark as reviewed</button>'
            : !alreadyRead
              ? '<button class="cta-primary-btn" id="mark-read-btn">&#10003; Mark as Read</button>'
              : '<div class="already-read-badge">&#10003; Already Read</div>'}
          ${hasNext ? '<button class="cta-next-btn" id="next-concept-btn">Next: ' + escapeHTML(nextConcept.title) + ' &#8594;</button>' : ''}
          <button class="cta-secondary-btn" id="back-topic-btn">&#8592; Back to ${escapeHTML(topic.title)}</button>
        </div>
      </div>
    </div>`;

  document.getElementById('back-btn').addEventListener('click', () => navigatePush('#topic/'+topicId+'/'+conceptIndex));
  document.getElementById('back-topic-btn').addEventListener('click', () => navigatePush('#topic/'+topicId+'/'+conceptIndex));
  const mrb = document.getElementById('mark-read-btn');
  if (mrb) mrb.addEventListener('click', () => {
    if (needsRev) clearNeedsReview(topicId, conceptId);
    markConceptRead(topicId, conceptId);
    if (hasNext) navigatePush('#topic/'+topicId+'/'+(conceptIndex+1));
    else         navigatePush('#topic/'+topicId+'/'+conceptIndex);
  });
  const ncb = document.getElementById('next-concept-btn');
  if (ncb) ncb.addEventListener('click', () => navigatePush('#topic/'+topicId+'/'+(conceptIndex+1)));
  document.querySelectorAll('.dd-section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const i    = hdr.dataset.section;
      const body = document.getElementById('ddb-'+i);
      const tog  = hdr.querySelector('.dd-section-toggle');
      const open = body.classList.toggle('open');
      document.getElementById('dds-'+i).classList.toggle('open', open);
      tog.innerHTML = open ? '&#9662;' : '&#9656;';
    });
  });
}

// ============================================================
// RENDER: PROGRESS
// ============================================================
function renderProgress() {
  const app        = document.getElementById('app');
  const topicsList = Array.isArray(state.topics) ? state.topics : [];
  const totalConcepts = topicsList.reduce((s,t) => s + (t.concept_count || 0), 0);
  const totalRead     = getTotalReadCount();
  const totalReview   = getTotalNeedsReviewCount();
  const pct           = totalConcepts > 0 ? Math.round(totalRead / totalConcepts * 100) : 0;
  const CIRC          = 214;
  const dash          = Math.round(CIRC * pct / 100);

  const cats = [
    'History and Culture',
    'Mind and Human Nature',
    'Economics and Finance',
    'Science and Math',
    'Languages'
  ];

  const byCat = {};
  cats.forEach(c => { byCat[c] = []; });
  topicsList.forEach(t => { if (byCat[t.category]) byCat[t.category].push(t); });

  const reviewTopics = topicsList.filter(t => getTopicReviewCount(t.id) > 0);

  app.innerHTML = `
    <div class="screen progress-screen">
      <header class="app-header">
        <div class="header-left">
          <div class="app-logo">📊</div>
          <h1 class="app-title">Progress</h1>
        </div>
      </header>

      <div class="progress-scroll-area">
        <div class="progress-hero">
          <div class="progress-ring-wrap">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="6"/>
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="var(--primary)"
                stroke-width="6"
                stroke-dasharray="${dash} ${CIRC}"
                stroke-linecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div class="progress-ring-pct">${pct}%</div>
          </div>

          <div class="progress-hero-text">
            <div class="progress-hero-main">${totalRead} of ${totalConcepts} concepts</div>
            ${
              totalReview > 0
                ? '<div class="progress-hero-sub" style="color:var(--review-color)">&#8634; ' + totalReview + ' flagged for review</div>'
                : totalRead > 0
                  ? '<div class="progress-hero-sub" style="color:var(--success)">&#10003; All caught up</div>'
                  : '<div class="progress-hero-sub">Start any topic to begin</div>'
            }
          </div>
        </div>

        ${
          reviewTopics.length > 0
            ? `
              <div class="section-label">NEEDS REVIEW</div>
              ${reviewTopics.map(topic => {
                const cc  = catColor(topic.category);
                const cnt = getTopicReviewCount(topic.id);
                return `
                  <div class="progress-review-row" onclick="navigatePush('#topic/${escapeHTML(topic.id)}/0')"
                       style="border-left:4px solid ${cc.g1}">
                    <div class="progress-review-title">${escapeHTML(topic.title)}</div>
                    <div class="progress-review-count">${cnt} concept${cnt !== 1 ? 's' : ''} &middot; tap to revisit &#8594;</div>
                  </div>`;
              }).join('')}
            `
            : ''
        }

        ${cats.map(cat => {
          const topics = byCat[cat];
          if (!topics || topics.length === 0) return '';
          const cc = catColor(cat);

          return `
            <div class="section-label" style="color:${cc.text}">${escapeHTML(cat.toUpperCase())}</div>
            ${topics.map(topic => {
              const readCount = getTopicReadCount(topic.id);
              const total     = topic.concept_count || 0;
              const topicPct  = total > 0 ? Math.round(readCount / total * 100) : 0;
              const revCount  = getTopicReviewCount(topic.id);

              return `
                <div class="progress-topic-item" onclick="navigatePush('#topic/${escapeHTML(topic.id)}/0')">
                  <div class="progress-topic-header">
                    <div class="progress-topic-name">${escapeHTML(topic.title)}</div>
                    <div class="progress-topic-stat">${readCount}/${total}</div>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill"
                         style="width:${topicPct}%;background:linear-gradient(90deg,${cc.g1},${cc.g2})"></div>
                  </div>
                  ${revCount > 0 ? '<div class="progress-topic-review-note">&#8634; ' + revCount + ' to review</div>' : ''}
                </div>`;
            }).join('')}
          `;
        }).join('')}

        <div style="height:88px"></div>
      </div>

      <nav class="bottom-nav">
        <button class="nav-item" id="nav-home">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </button>
        <button class="nav-item active">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Progress</span>
          <div class="nav-active-dot"></div>
        </button>
        <button class="nav-item" id="nav-settings-nav">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Settings</span>
        </button>
      </nav>
    </div>
    ${settingsModalHTML()}
  `;

  document.getElementById('nav-home').addEventListener('click', () => navigatePush('#home'));
  wireSettingsModal(['nav-settings-nav']);
}

// ============================================================
// SWIPE
// ============================================================
function setupSwipe(el, onLeft, onRight) {
  let sx = 0, sy = 0;
  el.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) onLeft();
      else onRight();
    }
  }, { passive: true });
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportProgress() {
  const data = {
    exportedAt: new Date().toISOString(),
    progress: state.progress,
    needsReview: state.needsReview
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'learnapp-progress.json'
  });

  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      state.progress    = d.progress || {};
      state.needsReview = d.needsReview || {};
      saveProgress();
      saveNeedsReview();

      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.add('hidden');

      renderHome();
    } catch {
      alert('Invalid file — please select a valid LearnApp export.');
    }
  };
  r.readAsText(file);
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadProgress();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${BASE}/sw.js`);
    });
  }

  try {
    await loadTopicsIndex();
  } catch (e) {
    console.error('Topics index failed:', e);
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
