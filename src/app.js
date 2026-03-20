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
  progress: {},
  needsReview: {},
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
function isConceptRead(topicId, conceptId) {
  return !!(state.progress[topicId]?.[conceptId]);
}
function isNeedsReview(topicId, conceptId) {
  return !!(state.needsReview[topicId]?.[conceptId]);
}
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
// Two navigation modes:
//   navigatePush    — major moves (home <-> topic <-> deepdive); adds a history entry
//   navigateReplace — minor moves (card-to-card within a topic); replaces current entry
//                     so back-button exits the topic rather than stepping through cards
// ============================================================
function navigatePush(hash) {
  window.location.hash = hash;
}
function navigateReplace(hash) {
  history.replaceState(null, '', '#' + hash);
  handleRoute();
}
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
// HELPERS
// ============================================================
function catColor(category) {
  return CAT_COLORS[category] || { g1:'#6C47FF', g2:'#4a2fd4', chip:'#ede9ff', text:'#6C47FF' };
}

function settingsModalHTML() {
  return `
    <div class="modal-overlay hidden" id="settings-modal">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="icon-btn" id="close-settings">X</button>
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
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target===e.currentTarget) close();
  });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
  });
}

// ============================================================
// RENDER: HOME
// ============================================================
function renderHome(filterCat, searchQuery) {
  const app = document.getElementById('app');
  const totalRead   = getTotalReadCount();
  const reviewCount = getTotalNeedsReviewCount();

  const cats = ['All','History and Culture','Psychology','Economics and Finance','Science and Math','Languages'];
  const topicsList = Array.isArray(state.topics) ? state.topics : [];

  let filtered = (filterCat && filterCat!=='All')
    ? topicsList.filter(t => t.category===filterCat)
    : topicsList;

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }

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
            <span>You've read <strong>${totalRead}</strong> concept${totalRead!==1?'s':''} so far${reviewCount > 0 ? ` &nbsp;·&nbsp; <strong>${reviewCount}</strong> to review` : ''}</span>
          </div>` : ''}

        <div class="search-bar-wrap">
          <input class="search-input" id="search-input" type="search"
            placeholder="Search topics..." value="${searchQuery||''}" autocomplete="off" />
        </div>

        <div class="cat-tabs" id="cat-tabs">
          ${cats.map(c => `
            <button class="cat-tab ${(!filterCat&&c==='All')||filterCat===c?'active':''}"
              data-cat="${c}">${c}</button>`).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <h3>${searchQuery ? 'No results' : 'No topics yet'}</h3>
            <p>${searchQuery ? 'Nothing matched "'+searchQuery+'".' : 'Content is coming soon.'}</p>
          </div>
        ` : `
          <div class="section-label">TOPICS</div>
          <div class="grid-cards">
            ${filtered.map(topic => {
              const cc         = catColor(topic.category);
              const readCount  = getTopicReadCount(topic.id);
              const total      = topic.concept_count || '?';
              const revCount   = getTopicReviewCount(topic.id);
              return `
                <div class="grid-card" onclick="navigatePush('#topic/${topic.id}/0')"
                     style="background:linear-gradient(135deg,${cc.g1},${cc.g2});">
                  <div class="grid-card-inner">
                    <div class="grid-title">${topic.title}</div>
                    <div class="grid-summary">${topic.summary||''}</div>
                    <div class="grid-explore">
                      Explore &rarr;&nbsp;
                      ${readCount ? readCount+'/'+total+' read' : total+' concepts'}
                      ${revCount ? '<span class="grid-review-badge">&#8634; '+revCount+'</span>' : ''}
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
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

  document.getElementById('cat-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (btn) renderHome(btn.dataset.cat==='All' ? null : btn.dataset.cat,
                        document.getElementById('search-input')?.value);
  });

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderHome(filterCat, e.target.value), 200);
  });
}

// ============================================================
// RENDER: TOPIC
// ============================================================
async function renderTopic(topicId, conceptIndex) {
  conceptIndex = conceptIndex || 0;
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
        <h1 class="header-title">${topic.title}</h1>
        <div style="width:60px"></div>
      </header>

      <div class="concept-progress-bar">
        <div class="concept-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="concept-counter">${conceptIndex+1} of ${total} concepts &middot; ${pct}%</div>

      <div class="concept-card-wrapper" id="card-wrapper">
        <div class="concept-card ${isRead?'is-read':''} ${needsRev?'card-needs-review':''}" id="concept-card">
          <div class="concept-card-accent-bar"
               style="background:linear-gradient(90deg,${cc.g1},${cc.g2})"></div>
          <div class="concept-card-body">
            <div class="concept-card-top">
              <span class="cat-chip" style="background:${cc.chip};color:${cc.text}">${topic.category}</span>
              ${needsRev
                ? '<span class="review-badge">&#8634; Review</span>'
                : isRead
                  ? '<span class="read-badge">&#10003; Read</span>'
                  : '<span class="concept-ghost-num">'+String(conceptIndex+1).padStart(2,'0')+'</span>'}
            </div>
            <h2 class="concept-title">${concept.title}</h2>
            <div class="concept-divider"></div>
            <div class="concept-summary">${concept.summary}</div>
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
            return '<div class="dot '+
              (i===conceptIndex?'active ':'')+
              (r?(nr?'dot-review':'read'):'')+
              '" data-index="'+i+'"></div>';
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
    if (needsRev) {
      clearNeedsReview(topicId, concept.id);
      renderTopic(topicId, conceptIndex);
      return;
    }
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
      <div class="recall-concept-name">${concept.title}</div>
      <div class="recall-prompt">Without looking, could you explain the core idea to someone else?</div>
      <div class="recall-actions">
        <button class="recall-btn recall-got-it" id="recall-got-it">&#10003; Got it</button>
        <button class="recall-btn recall-fuzzy"  id="recall-fuzzy">&#8634; Still fuzzy</button>
      </div>
      <div class="recall-note">"Still fuzzy" marks it read but flags it for review on the Progress screen.</div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  document.getElementById('recall-got-it').addEventListener('click', () => {
    markConceptRead(topicId, concept.id);
    clearNeedsReview(topicId, concept.id);
    overlay.remove();
    if (conceptIndex < total-1) navigateReplace('topic/'+topicId+'/'+(conceptIndex+1));
    else renderTopic(topicId, conceptIndex);
  });

  document.getElementById('recall-fuzzy').addEventListener('click', () => {
    markConceptRead(topicId, concept.id);
    markNeedsReview(topicId, concept.id);
    overlay.remove();
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

  const conceptIndex = topic.concepts.findIndex(c => c.id===conceptId);
  const concept      = topic.concepts[conceptIndex];
  const cc           = catColor(topic.category);
  const alreadyRead  = isConceptRead(topicId, conceptId);
  const needsRev     = isNeedsReview(topicId, conceptId);
  const hasNext      = conceptIndex < topic.concepts.length - 1;
  const nextConcept  = hasNext ? topic.concepts[conceptIndex+1] : null;

  app.innerHTML = `
    <div class="screen deepdive-screen">
      <header class="app-header" style="background:linear-gradient(180deg,var(--primary-tint),var(--bg))">
        <button class="back-btn" id="back-btn">&#8249;</button>
        <h1 class="header-title">${concept.title}</h1>
        <div style="width:40px"></div>
      </header>

      <div class="deepdive-content">
        <div class="breadcrumb-chip">${topic.category} &middot; ${topic.title}</div>

        <div class="deepdive-label">
          <span class="deepdive-label-text">DEEP&#8209;DIVE</span>
          <span class="deepdive-label-count">${concept.sections.length} sections</span>
        </div>

        ${concept.sections.map((sec, i) => `
          <div class="dd-section ${i===0?'open':''}" id="dds-${i}">
            <div class="dd-section-header" data-section="${i}">
              <div class="dd-section-left-bar"></div>
              <span class="dd-section-num">${String(i+1).padStart(2,'0')}</span>
              <span class="dd-section-title">${sec.title}</span>
              <span class="dd-section-toggle">${i===0?'&#9662;':'&#9656;'}</span>
            </div>
            <div class="dd-section-body ${i===0?'open':''}" id="ddb-${i}">
              ${sec.body.map(p=>'<p>'+p+'</p>').join('')}
            </div>
          </div>
        `).join('')}

        <div class="deepdive-actions">
          ${needsRev
            ? '<button class="cta-primary-btn" id="mark-read-btn">&#10003; Mark as reviewed</button>'
            : !alreadyRead
              ? '<button class="cta-primary-btn" id="mark-read-btn">&#10003; Mark as Read</button>'
              : '<div class="already-read-badge">&#10003; Already Read</div>'}
          ${hasNext
            ? '<button class="cta-next-btn" id="next-concept-btn">Next: '+nextConcept.title+' &#8594;</button>'
            : ''}
          <button class="cta-secondary-btn" id="back-topic-btn">&#8592; Back to ${topic.title}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () =>
    navigatePush('#topic/'+topicId+'/'+conceptIndex));
  document.getElementById('back-topic-btn').addEventListener('click', () =>
    navigatePush('#topic/'+topicId+'/'+conceptIndex));

  const mrb = document.getElementById('mark-read-btn');
  if (mrb) mrb.addEventListener('click', () => {
    if (needsRev) clearNeedsReview(topicId, conceptId);
    markConceptRead(topicId, conceptId);
    if (hasNext) navigatePush('#topic/'+topicId+'/'+(conceptIndex+1));
    else         navigatePush('#topic/'+topicId+'/'+conceptIndex);
  });

  const ncb = document.getElementById('next-concept-btn');
  if (ncb) ncb.addEventListener('click', () =>
    navigatePush('#topic/'+topicId+'/'+(conceptIndex+1)));

  document.querySelectorAll('.dd-section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const i    = hdr.dataset.section;
      const sec  = document.getElementById('dds-'+i);
      const body = document.getElementById('ddb-'+i);
      const tog  = hdr.querySelector('.dd-section-toggle');
      const open = body.classList.toggle('open');
      sec.classList.toggle('open', open);
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
  const totalConcepts = topicsList.reduce((s,t) => s + (t.concept_count||0), 0);
  const totalRead     = getTotalReadCount();
  const totalReview   = getTotalNeedsReviewCount();
  const pct = totalConcepts > 0 ? Math.round(totalRead/totalConcepts*100) : 0;

  const CIRC = 214;  // 2 * pi * r=34
  const dash = Math.round(CIRC * pct / 100);

  const cats = ['History and Culture','Psychology','Economics and Finance','Science and Math','Languages'];
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
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--primary)" stroke-width="6"
                stroke-dasharray="${dash} ${CIRC}" stroke-linecap="round"
                transform="rotate(-90 40 40)"/>
            </svg>
            <div class="progress-ring-pct">${pct}%</div>
          </div>
          <div class="progress-hero-text">
            <div class="progress-hero-main">${totalRead} of ${totalConcepts} concepts</div>
            ${totalReview > 0
              ? '<div class="progress-hero-sub" style="color:var(--review-color)">&#8634; '+totalReview+' flagged for review</div>'
              : totalRead > 0
                ? '<div class="progress-hero-sub" style="color:var(--success)">&#10003; All caught up</div>'
                : '<div class="progress-hero-sub">Start any topic to begin</div>'}
          </div>
        </div>

        ${reviewTopics.length > 0 ? `
          <div class="section-label">NEEDS REVIEW</div>
          ${reviewTopics.map(topic => {
            const cc  = catColor(topic.category);
            const cnt = getTopicReviewCount(topic.id);
            return `
              <div class="progress-review-row" onclick="navigatePush('#topic/${topic.id}/0')"
                   style="border-left:4px solid ${cc.g1}">
                <div class="progress-review-title">${topic.title}</div>
                <div class="progress-review-count">${cnt} concept${cnt!==1?'s':''} &middot; tap to revisit &#8594;</div>
              </div>`;
          }).join('')}
        ` : ''}

        ${cats.map(cat => {
          const topics = byCat[cat];
          if (!topics || topics.length===0) return '';
          const cc = catColor(cat);
          return `
            <div class="section-label" style="color:${cc.text}">${cat.toUpperCase()}</div>
            ${topics.map(topic => {
              const readCount  = getTopicReadCount(topic.id);
              const total      = topic.concept_count || 0;
              const topicPct   = total > 0 ? Math.round(readCount/total*100) : 0;
              const revCount   = getTopicReviewCount(topic.id);
              return `
                <div class="progress-topic-item" onclick="navigatePush('#topic/${topic.id}/0')">
                  <div class="progress-topic-header">
                    <div class="progress-topic-name">${topic.title}</div>
                    <div class="progress-topic-stat">${readCount}/${total}</div>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill"
                         style="width:${topicPct}%;background:linear-gradient(90deg,${cc.g1},${cc.g2})">
                    </div>
                  </div>
                  ${revCount > 0
                    ? '<div class="progress-topic-review-note">&#8634; '+revCount+' to review</div>'
                    : ''}
                </div>`;
            }).join('')}`;
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
// SWIPE  (attached to full screen element, not just the card)
// ============================================================
function setupSwipe(el, onLeft, onRight) {
  let sx=0, sy=0;
  el.addEventListener('touchstart', e => {
    sx=e.touches[0].clientX; sy=e.touches[0].clientY;
  }, {passive:true});
  el.addEventListener('touchend', e => {
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if (Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>50) { if(dx<0) onLeft(); else onRight(); }
  }, {passive:true});
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportProgress() {
  const data = {
    exportedAt: new Date().toISOString(),
    progress: state.progress,
    needsReview: state.needsReview,
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'learnapp-progress.json'
  });
  a.click(); URL.revokeObjectURL(a.href);
}
function importProgress(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      state.progress    = d.progress    || {};
      state.needsReview = d.needsReview || {};
      saveProgress();
      saveNeedsReview();
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
