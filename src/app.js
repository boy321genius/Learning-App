// Base path for GitHub Pages (must match your repo name, e.g. /learning-app)
const BASE = '/learning-app';

// Simple router-ish state
const state = {
  view: 'home', // 'home' | 'topic' | 'deep-dive'
  topics: [],
  filteredTopics: [],
  activeCategory: 'all',
  activeTopicId: null,
  activeConceptIndex: 0,
  userProgress: {
    readConcepts: {}, // topicId -> { conceptId: true }
  },
  showSettings: false,
};

// Categories → gradient card classes
const CATEGORY_GRADIENT_CLASS = {
  'History and Culture': 'card-gradient-history',
  Psychology: 'card-gradient-psych',
  Finance: 'card-gradient-finance',
  Science: 'card-gradient-science',
  Languages: 'card-gradient-languages',
};

// Concept sections for deep-dive view
const CONCEPT_SECTION_KEYS = [
  'context',
  'figuresForces',
  'coreIdea',
  'mechanics',
  'consequences',
  'connections',
];

const CONCEPT_SECTION_LABELS = {
  context: 'Context',
  figuresForces: 'Key figures & forces',
  coreIdea: 'Core idea',
  mechanics: 'Actions / how it works',
  consequences: 'Consequences / impact',
  connections: 'Connections',
};

// DOM helpers
function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text) node.textContent = options.text;
  if (options.html) node.innerHTML = options.html;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (options.on) {
    for (const [event, handler] of Object.entries(options.on)) {
      node.addEventListener(event, handler);
    }
  }
  if (options.children) {
    for (const child of options.children) {
      if (child) node.appendChild(child);
    }
  }
  return node;
}

// Storage helpers
const STORAGE_KEY = 'learnapp-progress';

function loadUserProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.userProgress = {
        readConcepts: parsed.readConcepts || {},
      };
    }
  } catch (e) {
    console.warn('Failed to load user progress', e);
  }
}

function saveUserProgress() {
  try {
    const payload = {
      readConcepts: state.userProgress.readConcepts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save user progress', e);
  }
}

// Export / Import progress
function exportProgress() {
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      progress: state.userProgress,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learnapp-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('Progress exported successfully.');
  } catch (e) {
    alert('Unable to export progress right now.');
  }
}

function importProgressFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.progress) {
        alert('Invalid file. Please select a valid export.');
        return;
      }
      state.userProgress = data.progress;
      saveUserProgress();
      alert('Progress imported successfully.');
      render();
    } catch (err) {
      alert('Invalid file. Please select a valid export.');
    }
  };
  reader.readAsText(file);
}

// Data loading
async function loadTopics() {
  try {
    const res = await fetch(`${BASE}/data/topics.json`);
    if (!res.ok) {
      throw new Error('Failed to load topics.json');
    }
    const data = await res.json();
    state.topics = Array.isArray(data) ? data : [];
    applyFilter(state.activeCategory);
  } catch (e) {
    console.error(e);
    state.topics = [];
    state.filteredTopics = [];
  }
}

// Apply category filter
function applyFilter(category) {
  state.activeCategory = category;
  if (category === 'all') {
    state.filteredTopics = [...state.topics];
  } else {
    state.filteredTopics = state.topics.filter(
      (t) => t.category === category
    );
  }
}

// Topic & concept helpers
function getTopicById(id) {
  return state.topics.find((t) => t.id === id) || null;
}

function getConceptStatus(topicId, conceptId) {
  const readMap = state.userProgress.readConcepts[topicId] || {};
  return !!readMap[conceptId];
}

function markConceptRead(topicId, conceptId) {
  if (!state.userProgress.readConcepts[topicId]) {
    state.userProgress.readConcepts[topicId] = {};
  }
  state.userProgress.readConcepts[topicId][conceptId] = true;
  saveUserProgress();
}

function computeTopicReadCount(topic) {
  const readMap = state.userProgress.readConcepts[topic.id] || {};
  return (topic.concepts || []).reduce(
    (acc, c) => (readMap[c.id] ? acc + 1 : acc),
    0
  );
}

// Renderers
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const shell = el('div', { class: 'app-shell' });

  shell.appendChild(renderHeader());

  if (state.view === 'home') {
    shell.appendChild(renderHome());
  } else if (state.view === 'topic') {
    shell.appendChild(renderTopicView());
  } else if (state.view === 'deep-dive') {
    shell.appendChild(renderDeepDive());
  }

  shell.appendChild(renderBottomNav());
  app.appendChild(shell);

  if (state.showSettings) {
    app.appendChild(renderSettingsSheet());
  }
}

// Header
function renderHeader() {
  const left = el('div', {
    class: 'app-header-left',
    children: [
      el('div', { class: 'app-logo-pill', text: '🧠' }),
      el('div', {
        class: 'app-title-group',
        children: [
          el('div', { class: 'app-title', text: 'LearnApp' }),
          el('div', {
            class: 'app-subtitle',
            text: 'Tiny deep dives, one card at a time.',
          }),
        ],
      }),
    ],
  });

  const streak = el('div', {
    class: 'header-pill',
    children: [
      el('div', { class: 'header-pill-dot' }),
      el('div', { text: 'Offline-ready. Your progress stays with you.' }),
    ],
  });

  const settingsButton = el('button', {
    class: 'icon-button',
    text: '⚙️',
    on: {
      click: () => {
        state.showSettings = true;
        render();
      },
    },
  });

  const right = el('div', {
    class: 'app-header-right',
    children: [streak, settingsButton],
  });

  return el('header', {
    class: 'app-header',
    children: [left, right],
  });
}

// Home view
function renderHome() {
  const container = el('div');

  const bannerNeeded = state.topics.some(
    (topic) => computeTopicReadCount(topic) > 0
  );
  if (bannerNeeded) {
    container.appendChild(renderStreakBanner());
  }

  container.appendChild(renderFilterRow());
  container.appendChild(
    el('div', { class: 'section-label', text: 'Topics' })
  );
  container.appendChild(renderTopicsGrid());

  return container;
}

function renderStreakBanner() {
  const text = el('div', {
    children: [
      el('div', {
        class: 'streak-text-main',
        text: 'Keep going—your future self is watching.',
      }),
      el('div', {
        class: 'streak-text-sub',
        text: 'Pick one concept, read it fully, and mark it as read.',
      }),
    ],
  });

  return el('div', {
    class: 'streak-banner',
    children: [
      el('div', { class: 'streak-icon', text: '🔥' }),
      text,
    ],
  });
}

function renderFilterRow() {
  const categories = [
    { id: 'all', label: 'All', icon: '' },
    { id: 'History and Culture', label: 'History', icon: '🏛️' },
    { id: 'Psychology', label: 'Psych', icon: '🧩' },
    { id: 'Finance', label: 'Finance', icon: '📈' },
    { id: 'Science', label: 'Science', icon: '🧬' },
    { id: 'Languages', label: 'Languages', icon: '🗣️' },
  ];

  const pills = categories.map((cat) =>
    el('button', {
      class:
        'filter-pill' +
        (state.activeCategory === cat.id ? ' active' : ''),
      children: [
        cat.icon ? el('span', { text: cat.icon }) : null,
        el('span', { text: cat.label }),
      ],
      on: {
        click: () => {
          applyFilter(cat.id);
          render();
        },
      },
    })
  );

  const row = el('div', {
    class: 'filter-row',
    children: [el('div', { class: 'filter-pills', children: pills })],
  });

  return row;
}

function renderTopicsGrid() {
  const scroll = el('div', { class: 'topics-scroll' });

  if (!state.filteredTopics.length) {
    scroll.appendChild(
      el('div', {
        class: 'empty-state',
        children: [
          el('div', { class: 'empty-state-emoji', text: '✨' }),
          el('div', {
            text: 'No topics yet. Add your first one to get started.',
          }),
        ],
      })
    );
    return scroll;
  }

  const grid = el('div', { class: 'topics-grid' });

  state.filteredTopics.forEach((topic) => {
    const card = createTopicCard(topic);
    grid.appendChild(card);
  });

  scroll.appendChild(grid);
  return scroll;
}

function createTopicCard(topic) {
  const category = topic.category || 'History and Culture';
  const gradientClass =
    CATEGORY_GRADIENT_CLASS[category] || 'card-gradient-history';

  const wrapper = el('div', {
    class: `topic-card ${gradientClass}`,
  });

  // Title
  const title = el('div', {
    class: 'topic-card-title',
    text: topic.title || 'Untitled topic',
  });

  // Summary (shortened externally so it usually fits)
  const summary = el('div', {
    class: 'topic-card-summary clamped',
    text: topic.summary || '',
  });

  // Bottom row: Explore + optional dot
  const readCount = computeTopicReadCount(topic);
  const totalConcepts = (topic.concepts || []).length;

  const explore = el('div', {
    class: 'topic-card-explore',
    text: 'Explore →',
  });

  const dot =
    totalConcepts > 0
      ? el('div', {
          class:
            'topic-card-dot' +
            (readCount >= totalConcepts && totalConcepts > 0
              ? ' read'
              : ''),
        })
      : null;

  const bottom = el('div', {
    class: 'topic-card-bottom',
    children: [explore, dot],
  });

  const inner = el('div', {
    class: 'topic-card-inner',
    children: [title, summary, bottom],
  });

  wrapper.appendChild(inner);

  wrapper.addEventListener('click', () => {
    // When entering topic, load per-topic JSON
    openTopic(topic.id);
  });

  return wrapper;
}

// Topic detail view
async function openTopic(topicId) {
  state.activeTopicId = topicId;
  state.activeConceptIndex = 0;
  state.view = 'topic';

  // Load full topic (with concepts) from per-topic JSON
  try {
    const res = await fetch(`${BASE}/data/topics/${topicId}.json`);
    if (!res.ok) {
      console.warn('Topic JSON not found for', topicId);
    } else {
      const fullTopic = await res.json();
      // Merge concepts into existing topic object in state.topics
      const idx = state.topics.findIndex((t) => t.id === topicId);
      if (idx >= 0) {
        state.topics[idx] = {
          ...state.topics[idx],
          concepts: fullTopic.concepts || [],
        };
      }
    }
  } catch (e) {
    console.error('Failed to load topic JSON', e);
  }

  render();
}

function renderTopicView() {
  const topic = getTopicById(state.activeTopicId);
  const container = el('div', { class: 'topic-view' });

  if (!topic) {
    container.appendChild(
      el('div', {
        class: 'empty-state',
        children: [
          el('div', { class: 'empty-state-emoji', text: '🤔' }),
          el('div', {
            text: 'Topic not found. Go back and try again.',
          }),
        ],
      })
    );
    return container;
  }

  const backBtn = el('button', {
    class: 'topic-view-back',
    text: '←',
    on: {
      click: () => {
        state.view = 'home';
        render();
      },
    },
  });

  const titleRow = el('div', {
    class: 'topic-view-title-row',
    children: [
      backBtn,
      el('div', {
        class: 'topic-view-title',
        text: topic.title || 'Untitled topic',
      }),
    ],
  });

  const meta = el('div', {
    class: 'topic-view-meta',
    text: topic.category || '',
  });

  const progressBar = renderTopicProgressBar(topic);

  const conceptCard = renderConceptCard(topic);

  container.appendChild(titleRow);
  container.appendChild(meta);
  container.appendChild(progressBar);
  container.appendChild(conceptCard);

  return container;
}

function renderTopicProgressBar(topic) {
  const total = (topic.concepts || []).length;
  const readCount = computeTopicReadCount(topic);
  const currentIndex = state.activeConceptIndex;
  const progressRatio =
    total > 0 ? (currentIndex + 1) / total : 0;

  const fill = el('div', {
    class: 'topic-progress-fill',
  });
  fill.style.width = `${Math.max(4, progressRatio * 100)}%`;

  return el('div', {
    class: 'topic-progress-bar',
    children: [fill],
  });
}

function renderConceptCard(topic) {
  const concepts = topic.concepts || [];
  const total = concepts.length;

  const safeIndex = Math.min(
    Math.max(0, state.activeConceptIndex),
    Math.max(0, total - 1)
  );
  const concept =
    concepts[safeIndex] || {
      id: 'placeholder',
      title: 'Add your first concept',
      summary:
        'When you create concepts for this topic, they will appear here.',
    };

  const card = el('div', { class: 'concept-card' });

  const title = el('div', {
    class: 'concept-card-title',
    text: concept.title || 'Untitled concept',
  });

  const body = el('div', {
    class: 'concept-card-body',
    text:
      concept.summary ||
      'Use the deep-dive view to explore this concept in more detail.',
  });

  const progressText = el('div', {
    class: 'concept-progress-text',
    text: total > 0 ? `${safeIndex + 1} / ${total}` : '',
  });

  const prevBtn = el('button', {
    class: 'concept-nav-button',
    text: '←',
    on: {
      click: () => {
        if (state.activeConceptIndex > 0) {
          state.activeConceptIndex -= 1;
          render();
        }
      },
    },
  });

  const nextBtn = el('button', {
    class: 'concept-nav-button',
    text: '→',
    on: {
      click: () => {
        if (state.activeConceptIndex < total - 1) {
          state.activeConceptIndex += 1;
          render();
        }
      },
    },
  });

  const navButtons = el('div', {
    class: 'concept-nav-buttons',
    children: [prevBtn, nextBtn],
  });

  const controls = el('div', {
    class: 'concept-controls',
    children: [progressText, navButtons],
  });

  const dotsRow = renderConceptDots(topic, concepts, safeIndex);

  const markReadButton = el('button', {
    class: 'concept-button primary',
    children: [
      el('span', { text: '✓' }),
      el('span', { text: 'Mark as read' }),
    ],
    on: {
      click: () => {
        if (!concept.id) return;
        markConceptRead(topic.id, concept.id);
        render();
      },
    },
  });

  const deepDiveButton = el('button', {
    class: 'concept-button secondary',
    children: [
      el('span', { text: 'Deep-dive' }),
      el('span', { text: '→' }),
    ],
    on: {
      click: () => {
        state.view = 'deep-dive';
        render();
      },
    },
  });

  const actions = el('div', {
    class: 'concept-actions',
    children: [markReadButton, deepDiveButton],
  });

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(controls);
  card.appendChild(dotsRow);
  card.appendChild(actions);

  return card;
}

function renderConceptDots(topic, concepts, activeIndex) {
  const row = el('div', { class: 'concept-dots' });
  const readMap = state.userProgress.readConcepts[topic.id] || {};

  concepts.forEach((concept, idx) => {
    const isActive = idx === activeIndex;
    const isRead = concept.id && readMap[concept.id];
    const dot = el('div', {
      class:
        'concept-dot' +
        (isActive ? ' active' : '') +
        (isRead ? ' read' : ''),
    });
    row.appendChild(dot);
  });

  return row;
}

// Deep-dive view
function renderDeepDive() {
  const topic = getTopicById(state.activeTopicId);
  const container = el('div', { class: 'deep-dive-view' });

  if (!topic) {
    container.appendChild(
      el('div', {
        class: 'empty-state',
        children: [
          el('div', { class: 'empty-state-emoji', text: '🤔' }),
          el('div', {
            text: 'Topic not found. Go back and try again.',
          }),
        ],
      })
    );
    return container;
  }

  const concepts = topic.concepts || [];
  const total = concepts.length;
  const safeIndex = Math.min(
    Math.max(0, state.activeConceptIndex),
    Math.max(0, total - 1)
  );
  const concept = concepts[safeIndex];

  const backBtn = el('button', {
    class: 'topic-view-back',
    text: '←',
    on: {
      click: () => {
        state.view = 'topic';
        render();
      },
    },
  });

  const header = el('div', {
    class: 'deep-dive-header',
    children: [
      backBtn,
      el('div', {
        class: 'deep-dive-title',
        text: concept ? concept.title || 'Deep-dive' : 'Deep-dive',
      }),
    ],
  });

  const subtitle = el('div', {
    class: 'deep-dive-subtitle',
    text: 'Tap any section header to collapse it.',
  });

  const accordion = el('div', { class: 'accordion' });

  CONCEPT_SECTION_KEYS.forEach((key) => {
    const label = CONCEPT_SECTION_LABELS[key];
    const content = concept && concept[key];
    if (!content) return;

    const item = el('div', { class: 'accordion-item' });
    const body = el('div', {
      class: 'accordion-body',
      text: content,
    });

    let expanded = true;

    const icon = el('span', {
      class: 'accordion-icon',
      text: '⌄',
    });

    const headerInner = el('div', {
      class: 'accordion-header',
      children: [
        el('div', {
          class: 'accordion-title',
          children: [
            el('span', { class: 'accordion-pill', text: label }),
          ],
        }),
        icon,
      ],
    });

    headerInner.addEventListener('click', () => {
      expanded = !expanded;
      body.style.display = expanded ? 'block' : 'none';
      icon.textContent = expanded ? '⌄' : '›';
    });

    item.appendChild(headerInner);
    item.appendChild(body);
    accordion.appendChild(item);
  });

  const markReadButton = el('button', {
    class: 'concept-button primary',
    children: [
      el('span', { text: '✓' }),
      el('span', { text: 'Mark as read' }),
    ],
    on: {
      click: () => {
        if (!concept || !concept.id) return;
        markConceptRead(topic.id, concept.id);
        render();
      },
    },
  });

  const backToConceptButton = el('button', {
    class: 'deep-dive-back',
    children: [
      el('span', { text: '←' }),
      el('span', { text: 'Back to concept card' }),
    ],
    on: {
      click: () => {
        state.view = 'topic';
        render();
      },
    },
  });

  const footer = el('div', {
    class: 'deep-dive-footer',
    children: [markReadButton, backToConceptButton],
  });

  container.appendChild(header);
  container.appendChild(subtitle);
  container.appendChild(accordion);
  container.appendChild(footer);

  return container;
}

// Settings sheet
function renderSettingsSheet() {
  const backdrop = el('div', { class: 'sheet-backdrop' });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      state.showSettings = false;
      render();
    }
  });

  const sheet = el('div', { class: 'sheet' });

  const handle = el('div', { class: 'sheet-handle' });

  const titleRow = el('div', {
    class: 'sheet-title-row',
    children: [
      el('div', { class: 'sheet-title', text: 'Settings & data' }),
      el('button', {
        class: 'icon-button',
        text: '✕',
        on: {
          click: () => {
            state.showSettings = false;
            render();
          },
        },
      }),
    ],
  });

  const subtitle = el('div', {
    class: 'sheet-subtitle',
    text: 'Export your reading progress or import it on another device.',
  });

  const exportButton = el('button', {
    class: 'sheet-button export',
    children: [
      el('div', {
        class: 'sheet-button-left',
        children: [
          el('div', {
            class: 'sheet-button-icon',
            text: '⬇️',
          }),
          el('div', {
            children: [
              el('div', {
                class: 'sheet-button-label',
                text: 'Export progress',
              }),
              el('div', {
                class: 'sheet-button-description',
                text: 'Save a JSON file with your reading history.',
              }),
            ],
          }),
        ],
      }),
      el('div', { text: 'JSON' }),
    ],
    on: { click: exportProgress },
  });

  const importButton = el('button', {
    class: 'sheet-button import',
    children: [
      el('div', {
        class: 'sheet-button-left',
        children: [
          el('div', { class: 'sheet-button-icon', text: '⬆️' }),
          el('div', {
            children: [
              el('div', {
                class: 'sheet-button-label',
                text: 'Import progress',
              }),
              el('div', {
                class: 'sheet-button-description',
                text: 'Restore from a previously exported file.',
              }),
            ],
          }),
        ],
      }),
      el('div', { text: 'JSON' }),
    ],
  });

  const fileInput = el('input', {
    class: 'hidden-file-input',
    attrs: { type: 'file', accept: '.json,application/json' },
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      importProgressFromFile(file);
    }
    fileInput.value = '';
  });

  importButton.addEventListener('click', () => {
    fileInput.click();
  });

  const actions = el('div', {
    class: 'sheet-actions',
    children: [exportButton, importButton],
  });

  sheet.appendChild(handle);
  sheet.appendChild(titleRow);
  sheet.appendChild(subtitle);
  sheet.appendChild(actions);
  sheet.appendChild(fileInput);

  backdrop.appendChild(sheet);
  return backdrop;
}

// Bottom navigation
function renderBottomNav() {
  const nav = el('div', { class: 'bottom-nav' });

  const items = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'progress', icon: '📊', label: 'Progress' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  const inner = el(
    'div',
    { class: 'bottom-nav-inner' },
    null
  );

  items.forEach((item) => {
    const isActive =
      (item.id === 'home' && state.view === 'home') ||
      (item.id === 'progress' && state.view !== 'home') ||
      (item.id === 'settings' && state.showSettings);

    const navItem = el('div', {
      class: 'nav-item' + (isActive ? ' active' : ''),
      children: [
        el('div', { class: 'nav-item-icon', text: item.icon }),
        el('span', { class: 'nav-item-label', text: item.label }),
      ],
      on: {
        click: () => {
          if (item.id === 'home') {
            state.view = 'home';
            render();
          } else if (item.id === 'settings') {
            state.showSettings = true;
            render();
          } else if (item.id === 'progress') {
            // For now, progress just takes you to home; later you can add a dedicated view.
            state.view = 'home';
            render();
          }
        },
      },
    });

    inner.appendChild(navItem);
  });

  nav.appendChild(inner);
  return nav;
}

// Service worker registration (for offline)
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${BASE}/sw.js`)
        .catch((err) => {
          console.warn('SW registration failed', err);
        });
    });
  }
}

// Initialize
async function init() {
  loadUserProgress();
  await loadTopics();
  registerServiceWorker();
  render();
}

document.addEventListener('DOMContentLoaded', init);
