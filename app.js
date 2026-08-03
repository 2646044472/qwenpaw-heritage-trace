const tabs = [
  ['overview', '項目概覽', 'layout-dashboard'],
  ['archive', '資料歸檔', 'folder-kanban'],
  ['verify', '核驗審核', 'shield-check'],
  ['publish', '發布與活化', 'send'],
  ['district', '街區看板', 'map'],
];

const state = {
  checking: true,
  user: null,
  csrf: '',
  tab: location.hash.slice(1) || 'overview',
  projects: [],
  claims: [],
  projectId: 'laikei',
  toast: '',
  loginError: '',
  modal: null,
  aiStatus: { configured: false, model: null },
  aiDraft: null,
};

const validTabs = new Set(tabs.map(([id]) => id));
if (!validTabs.has(state.tab)) state.tab = 'overview';
const icon = name => {
  const fallback = { plus: '+', x: 'x', 'chevron-right': '>', 'arrow-right': '>', 'arrow-up-right': '>', 'log-out': '>', 'log-in': '>', save: '+', archive: '+', 'file-plus-2': '+' };
  return `<i class="fallback-icon" data-lucide="${name}">${fallback[name] || ''}</i>`;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currentProject = () => state.projects.find(project => project.id === state.projectId) || state.projects[0];

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    state.user = null;
    state.csrf = '';
    render();
  }
  if (!response.ok) throw new Error(data.error || 'request_failed');
  return data;
}

async function bootstrap() {
  render();
  try {
    const session = await api('/api/session');
    if (session.authenticated) {
      state.user = { username: session.username, role: session.role };
      state.csrf = session.csrf;
      await loadWorkspace();
      state.aiStatus = await api('/api/ai/status');
    }
  } catch (_) {
    state.loginError = '登入服務暫時無法連線，請稍後重試。';
  } finally {
    state.checking = false;
    render();
  }
}

async function loadWorkspace() {
  const result = await api('/api/projects');
  state.projects = result.projects;
  if (!currentProject() && state.projects.length) state.projectId = state.projects[0].id;
  await loadClaims();
  state.aiStatus = await api('/api/ai/status');
}

async function loadClaims() {
  const project = currentProject();
  if (!project) return;
  const result = await api(`/api/claims?project_id=${encodeURIComponent(project.id)}`);
  state.claims = result.claims;
}

function render() {
  document.querySelector('#app').innerHTML = state.checking ? renderLoading() : state.user ? renderWorkspace() : renderLogin();
  if (window.lucide) window.lucide.createIcons();
}

function renderLoading() {
  return `<main class="login-page"><section class="login-card" aria-live="polite"><span class="login-mark">${icon('landmark')}</span><h1>澳憶・千尋</h1><p>正在連接文化資產工作台</p><div class="loading-line"><span></span></div></section></main>`;
}

function renderLogin() {
  return `<main class="login-page"><section class="login-card"><span class="login-mark">${icon('landmark')}</span><div class="record-kicker">QWENPAW HERITAGE TRACE</div><h1>文化資產工作台</h1><p>登入後可管理項目資料、核驗狀態與發布版本。</p><form id="login-form" class="login-form"><label>帳戶<input name="username" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label>${state.loginError ? `<div class="form-error" role="alert">${state.loginError}</div>` : ''}<button class="btn btn-primary" type="submit">${icon('log-in')} 登入工作台</button></form><div class="login-note">Demo 環境 · 登入操作會記錄在伺服器本地資料庫</div></section></main>`;
}

function renderWorkspace() {
  const project = currentProject();
  if (!project) return `<main class="login-page"><section class="login-card"><h1>沒有可用項目</h1><p>請檢查伺服器資料庫初始化狀態。</p></section></main>`;
  return `<a class="skip-link" href="#main-content">跳至主要內容</a><div class="shell">${renderSidebar()}<div class="workspace">${renderTopbar()}<main id="main-content" tabindex="-1">${renderRecordHead(project)}${renderTabs()}<div class="content">${renderTabContent(project)}</div></main></div></div><div aria-live="polite" aria-atomic="true">${state.toast ? `<div class="toast">${icon('circle-check')}<span>${state.toast}</span></div>` : ''}</div>${renderModal()}`;
}

function renderModal() {
  if (!state.modal) return '';
  if (state.modal === 'ai-draft') return renderAiDraftModal();
  if (state.modal === 'project') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"><header><div><div class="record-kicker">文化資產項目</div><h2 id="project-modal-title">新增項目</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><form id="project-form" class="modal-form"><label>項目名稱<input name="name" maxlength="100" required placeholder="例如：新中央酒店"></label><label>所在街區<input name="area" maxlength="120" required placeholder="例如：新馬路 / 葡京"></label><label>創立年份<input name="year" maxlength="20" required placeholder="例如：1928 或 待查"></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">建立項目</button></div></form></section></div>`;
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title"><header><div><div class="record-kicker">核驗資料</div><h2 id="claim-modal-title">新增核驗項目</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><form id="claim-form" class="modal-form"><label>資產敘述<textarea name="claim" maxlength="500" required placeholder="例如：店舖於 1928 年開始營業"></textarea></label><label>證據來源<input name="source" maxlength="300" required placeholder="例如：訪談記錄 01 / 報紙檔案"></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">寫入核驗資料</button></div></form></section></div>`;
}

function renderSidebar() {
  return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('landmark')}</span><div><div class="brand-name">澳憶・千尋</div><div class="brand-sub">城市文化資產工作台</div></div></div><section class="sidebar-section"><div class="sidebar-label"><span>試點項目</span><button title="新增項目" aria-label="新增項目" data-action="new-project">${icon('plus')}</button></div><div class="project-list">${state.projects.map(project => `<button class="project-item ${project.id === state.projectId ? 'is-active' : ''}" data-project="${project.id}"><span class="project-sigil ${project.tone}">${icon(project.icon)}</span><span class="project-copy"><strong>${project.name}</strong><span>${project.area}</span></span>${project.pending ? `<span class="count">${project.pending}</span>` : ''}</button>`).join('')}</div></section><section class="sidebar-section"><div class="sidebar-label"><span>工作區</span></div><nav class="nav-list" aria-label="工作區導覽"><button class="nav-item ${state.tab === 'overview' ? 'is-active' : ''}" data-tab="overview">${icon('files')} <span>文化資產項目</span></button><button class="nav-item ${state.tab === 'verify' ? 'is-active' : ''}" data-tab="verify">${icon('list-checks')} <span>待辦核驗</span><span class="count">${state.claims.filter(claim => claim.status === 'pending').length}</span></button><button class="nav-item ${state.tab === 'district' ? 'is-active' : ''}" data-tab="district">${icon('map-pinned')} <span>街區資產庫</span></button></nav></section><div class="sidebar-bottom"><strong>${state.user.username} · ${state.user.role}</strong>所有核驗和發布動作會記錄在專案日誌。</div></aside>`;
}

function renderTopbar() {
  return `<header class="topbar"><div class="crumbs"><span>文化資產項目</span>${icon('chevron-right')}<strong>${currentProject().name}</strong></div><div class="top-actions"><label class="search">${icon('search')}<input type="search" aria-label="搜尋項目或來源" placeholder="搜尋項目、來源或標籤"></label><span class="user-chip">${icon('user-round')} ${state.user.username}</span><button class="btn" data-action="logout">${icon('log-out')} 登出</button></div></header>`;
}

function renderRecordHead(project) {
  const archived = project.archive_status === 'archived';
  return `<section class="record-head"><div class="record-image"><img src="assets/heritage-cover.jpeg" alt="澳門老街文化記憶插畫"></div><div><div class="record-kicker">文化資產項目 · MCA-HP-026</div><h1>${project.name}</h1><div class="record-meta">${project.area} · 創立年份 ${project.year} · 資料完整度 ${project.completeness}%</div></div><div class="head-actions"><button class="btn" data-tab="archive">${icon('folder-plus')} 歸檔資料</button><button class="btn btn-primary" data-tab="verify">${icon('shield-check')} ${archived ? '查看核驗' : '進入核驗'}</button></div></section>`;
}

function renderTabs() { return `<nav class="tabs" aria-label="項目分頁">${tabs.map(([id, label, glyph]) => `<button class="tab ${state.tab === id ? 'is-active' : ''}" data-tab="${id}">${icon(glyph)} ${label}</button>`).join('')}</nav>`; }
function renderTabContent(project) { return { overview: renderOverview, archive: renderArchiveWithAi, verify: renderVerify, publish: renderPublish, district: renderDistrict }[state.tab](project); }
function badge(status) { return status === 'public' ? `<span class="badge green">${icon('circle-check')} 可公開</span>` : status === 'internal' ? `<span class="badge red">${icon('lock-keyhole')} 僅內部</span>` : `<span class="badge amber">${icon('clock-3')} 待確認</span>`; }

function renderOverview(project) {
  const pending = state.claims.filter(claim => claim.status === 'pending').length;
  const publicCount = state.claims.filter(claim => claim.status === 'public').length;
  return `<div class="notice"><div class="notice-copy">${icon('circle-alert')}<div><strong>還有 ${pending} 個欄位需要商戶確認</strong><span>核驗結果已儲存於伺服器本地資料庫，確認後可進入發布流程。</span></div></div><button class="btn" data-tab="verify">查看核驗項目 ${icon('arrow-right')}</button></div><section class="metrics"><div class="metric"><div class="metric-label">已入庫來源</div><div class="metric-value">08</div><div class="metric-note">公開資料與訪談素材</div></div><div class="metric"><div class="metric-label">可公開欄位</div><div class="metric-value">${publicCount}</div><div class="metric-note">已完成核驗</div></div><div class="metric"><div class="metric-label">待確認項目</div><div class="metric-value">${pending}</div><div class="metric-note">需商戶或校對人處理</div></div><div class="metric"><div class="metric-label">資料完整度</div><div class="metric-value">${project.completeness}%</div><div class="metric-note">${project.archive_status === 'archived' ? '已生成內部檔案' : '目標：可發布版本'}</div></div></section><div class="split"><div><section class="section"><div class="section-heading"><h2>資產摘要</h2><button class="text-action" data-tab="archive">編輯檔案 ${icon('arrow-up-right')}</button></div><div class="fields"><div class="field-label">資產類型</div><div class="field-value">懷舊雪糕店 / 飲食文化</div><div class="field-label">所在街區</div><div class="field-value">${project.area}</div><div class="field-label">文化標籤</div><div class="field-value"><div class="chips"><span class="chip">懷舊甜品</span><span class="chip">街坊記憶</span><span class="chip">代際消費</span><span class="chip">老澳門味道</span></div></div><div class="field-label">內部版本</div><div class="field-value">${project.archive_status === 'archived' ? '已歸檔 · 等待發布審核' : '草稿 · 尚未生成資產檔案'}</div></div></section><section class="section"><div class="section-heading"><h2>已整理的故事片段</h2><span class="badge teal">可回溯</span></div><blockquote class="excerpt">「以前很多街坊都不是只來買雪糕，還會帶小朋友來。後來小朋友長大了，又帶自己的孩子回來。」<footer>來源：店主訪談摘錄 02 · 需確認公開範圍</footer></blockquote></section></div><div><section class="section"><div class="section-heading"><h2>核驗狀態</h2><span class="badge amber">${pending} 項待辦</span></div><div class="queue">${state.claims.map(claim => `<div class="queue-row"><span class="queue-mark ${claim.status === 'public' ? 'green' : claim.status === 'internal' ? 'red' : ''}">${icon(claim.status === 'public' ? 'circle-check' : claim.status === 'internal' ? 'lock-keyhole' : 'clock-3')}</span><div><div class="queue-title">${claim.claim}</div><div class="queue-note">${claim.source}</div></div>${badge(claim.status)}</div>`).join('')}</div></section></div></div>`;
}

function renderArchive(project) {
  return `<div class="toolbar"><div class="toolbar-copy"><h2>資料歸檔</h2><p>來源、訪談與實地素材會整理成可核驗的內部文化資產檔案。</p></div><button class="btn btn-primary" data-action="archive" ${project.archive_status === 'archived' ? 'disabled' : ''}>${icon('archive')} ${project.archive_status === 'archived' ? '資產檔案已生成' : '生成資產檔案'}</button></div><div class="archive-layout"><div><div class="dropzone">${icon('upload')}<div><strong>加入新的文化記錄</strong><span>上傳功能會在下一階段連接檔案隔離與掃描服務。</span></div><button class="text-action" data-action="upload">查看歸檔資料 ${icon('arrow-up-right')}</button></div><div class="table-scroll"><table class="source-table"><thead><tr><th>資料</th><th>來源類型</th><th>處理狀態</th><th></th></tr></thead><tbody><tr><td><span class="source-title"><span class="file">${icon('file-text')}</span>禮記雪糕_訪談摘錄.txt</span></td><td class="muted">店主訪談</td><td><span class="badge green">已分段</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr><tr><td><span class="source-title"><span class="file">${icon('image')}</span>店面與舊包裝_06.jpg</span></td><td class="muted">實地圖片</td><td><span class="badge amber">待標記權利</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr><tr><td><span class="source-title"><span class="file">${icon('newspaper')}</span>1933_創立年份_報道.pdf</span></td><td class="muted">公開報道</td><td><span class="badge green">已引用</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr></tbody></table></div></div><aside class="side-sheet"><h3>歸檔進度</h3><p>${project.archive_status === 'archived' ? '內部資產檔案已生成，後續內容仍需核驗才能對外發布。' : '目前資料足夠生成一份內部文化資產卡，對外欄位仍會經過核驗。'}</p><div class="progress"><span style="width:${project.completeness}%"></span></div><div class="progress-meta"><span>資料完整度</span><strong>${project.completeness}%</strong></div><div class="mini-list"><div>${icon('circle-check')}<span>08 筆來源已建立回鏈</span></div><div>${icon('circle-check')}<span>04 個文化標籤已整理</span></div><div>${icon('clock-3')}<span>${state.claims.filter(claim => claim.status === 'pending').length} 個公開權限待確認</span></div></div></aside></div>`;
}

function renderArchiveWithAi(project) {
  const aiReady = state.aiStatus.configured;
  const aiLabel = aiReady ? `用 ${escapeHtml(state.aiStatus.model)} 生成建檔草稿` : 'AI 尚未配置';
  return `<div class="toolbar"><div class="toolbar-copy"><h2>資料歸檔</h2><p>來源、訪談與實地素材會整理成可核驗的內部文化資產檔案。</p></div><div class="head-actions"><button class="btn" data-action="ai-draft" ${aiReady ? '' : 'disabled'}>${icon('sparkles')} ${aiLabel}</button><button class="btn btn-primary" data-action="archive" ${project.archive_status === 'archived' ? 'disabled' : ''}>${icon('archive')} ${project.archive_status === 'archived' ? '資產檔案已生成' : '生成資產檔案'}</button></div></div><div class="notice"><div class="notice-copy">${icon('shield-check')}<div><strong>AI 只產生待核驗草稿</strong><span>草稿必須回鏈現有來源，採納後仍是「待確認」，不會自動發布。</span></div></div><span class="badge ${aiReady ? 'teal' : 'amber'}">${aiReady ? '模型已配置' : '等待安全配置'}</span></div>${renderArchive(project).replace(/^<div class="toolbar">[\s\S]*?<\/div><div class="archive-layout">/, '<div class="archive-layout">')}`;
}

function renderAiDraftModal() {
  const record = state.aiDraft;
  if (!record) return '';
  const claims = record.draft.claims.map((item, index) => `<article class="section"><div class="section-heading"><h3>${index + 1}. ${escapeHtml(item.claim)}</h3><span class="badge amber">待確認</span></div><p class="muted">${escapeHtml(item.evidence_excerpt)}</p><div class="queue-note">來源編號：${item.source_indexes.join('、')} · ${escapeHtml(item.verification_note)}</div></article>`).join('');
  return `<div class="modal-backdrop"><section class="modal ai-draft-modal" role="dialog" aria-modal="true" aria-labelledby="ai-draft-title"><header><div><div class="record-kicker">Paw-Archivist · ${escapeHtml(record.model)}</div><h2 id="ai-draft-title">AI 建檔草稿</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><p>${escapeHtml(record.draft.summary)}</p><div class="ai-draft-list">${claims}</div><div class="notice"><div class="notice-copy">${icon('circle-alert')}<div><strong>尚未寫入公開資料</strong><span>採納後，每條內容會以「待確認」加入核驗清單。</span></div></div></div><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">保留草稿</button><button class="btn btn-primary" type="button" data-action="accept-ai-draft">採納為待核驗資料</button></div></section></div>`;
}

function renderVerify() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  return `<div class="toolbar"><div class="toolbar-copy"><h2>核驗審核</h2><p>每次狀態變更會立即寫入資料庫和審計日誌。</p></div><button class="btn btn-primary" data-tab="publish">${icon('send')} 進入發布版本</button></div><div class="verify-summary"><div><strong>${publicCount}</strong><span>可公開欄位</span></div><div><strong>${pendingCount}</strong><span>待商戶確認</span></div><div><strong>${state.claims.filter(item => item.status === 'internal').length}</strong><span>僅內部使用</span></div></div><div class="table-scroll"><table class="verify-table"><thead><tr><th>資產敘述</th><th>證據來源</th><th>目前狀態</th><th></th></tr></thead><tbody>${state.claims.map(claim => `<tr><td class="claim">${claim.claim}</td><td class="muted">${claim.source}</td><td>${badge(claim.status)}</td><td><button class="table-action" data-claim="${claim.id}">更改狀態 ${icon('chevron-right')}</button></td></tr>`).join('')}</tbody></table></div><div class="verify-footer"><p>${icon('info')} 更改狀態會循環切換「可公開 → 待確認 → 僅內部」，並在伺服器記錄操作者與時間。</p><button class="btn" data-action="report">${icon('file-down')} 匯出核驗清單</button></div>`;
}

function renderPublish() { return `<div class="toolbar"><div class="toolbar-copy"><h2>發布與活化</h2><p>同一份已核驗資料，可在不同使用場景下保持一致。</p></div><button class="btn btn-primary" data-action="publish">${icon('send')} 建立對外版本</button></div><div class="publish-grid"><article class="publish-channel"><div class="channel-top"><span class="channel-letter">G</span><h3>文化資產看板</h3></div><p>供政府或文旅單位查看街區採集進度、待辦優先級與可公開資產。</p><span class="badge green">已具備資料</span><button class="btn" data-action="preview">預覽看板 ${icon('arrow-up-right')}</button></article><article class="publish-channel channel-b"><div class="channel-top"><span class="channel-letter">B</span><h3>商戶介紹內容</h3></div><p>由商戶確認後使用的 POI 描述、三語介紹與故事素材。</p><span class="badge amber">${state.claims.filter(claim => claim.status === 'pending').length} 項待確認</span><button class="btn" data-action="copy">複製介紹文案 ${icon('copy')}</button></article><article class="publish-channel channel-c"><div class="channel-top"><span class="channel-letter">C</span><h3>城市故事路線</h3></div><p>把已核驗的資料串成可步行體驗的街區故事線。</p><span class="badge teal">可預覽</span><button class="btn" data-action="preview">預覽路線 ${icon('arrow-up-right')}</button></article></div>`; }
function renderDistrict() { return `<div class="toolbar"><div class="toolbar-copy"><h2>荷蘭園 / 水坑尾街區看板</h2><p>以已歸檔商戶、街區和品類關聯安排補訪與活化優先級。</p></div><div class="filter-group"><button class="filter is-active">全部資產</button><button class="filter">待核驗</button><button class="filter">可公開</button></div></div><div class="district-layout"><div class="map-board" aria-label="街區關聯示意"><span class="map-title">街區關聯示意</span><span class="map-node primary one">${currentProject().name}</span><span class="map-node two">荷蘭園</span><span class="map-node three">懷舊甜品</span><span class="map-node four">街坊記憶</span><span class="map-node five">水坑尾</span></div><aside><section class="section"><div class="section-heading"><h2>採集概況</h2></div><div class="queue"><div class="queue-row"><span class="queue-mark green">${icon('archive')}</span><div><div class="queue-title">${state.projects.length} 間老店已建檔</div><div class="queue-note">資料可持續更新</div></div></div><div class="queue-row"><span class="queue-mark">${icon('clock-3')}</span><div><div class="queue-title">${state.projects.reduce((total, project) => total + project.pending, 0)} 項待辦核驗</div><div class="queue-note">優先處理權利與年份</div></div></div></div></section></aside></div>`; }

function setTab(tab) { state.tab = tab; history.replaceState(null, '', `#${tab}`); render(); }
function showToast(message) { state.toast = message; render(); window.setTimeout(() => { state.toast = ''; render(); }, 2600); }

async function changeClaim(claimId) {
  const claim = state.claims.find(item => item.id === claimId);
  if (!claim) return;
  const order = ['public', 'pending', 'internal'];
  const next = order[(order.indexOf(claim.status) + 1) % order.length];
  try {
    const result = await api(`/api/claims/${claimId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    state.claims = state.claims.map(item => item.id === claimId ? result.claim : item);
    showToast(`已更新為「${next === 'public' ? '可公開' : next === 'pending' ? '待確認' : '僅內部'}」。`);
  } catch (_) { showToast('狀態更新失敗，請重新登入後再試。'); }
}

document.addEventListener('submit', async event => {
  event.preventDefault();
  if (event.target.id === 'project-form') {
    const form = new FormData(event.target);
    try {
      const result = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: form.get('name'), area: form.get('area'), year: form.get('year') }) });
      state.projects.push(result.project);
      state.projectId = result.project.id;
      state.claims = [];
      state.modal = null;
      state.tab = 'overview';
      showToast('新項目已寫入資料庫。');
    } catch (_) { showToast('建立失敗，請檢查欄位後重試。'); }
    return;
  }
  if (event.target.id === 'claim-form') {
    const form = new FormData(event.target);
    try {
      const result = await api('/api/claims', { method: 'POST', body: JSON.stringify({ project_id: currentProject().id, claim: form.get('claim'), source: form.get('source') }) });
      state.claims.push(result.claim);
      state.projects = state.projects.map(project => project.id === result.project.id ? result.project : project);
      state.modal = null;
      state.tab = 'verify';
      showToast('核驗資料已寫入資料庫。');
    } catch (_) { showToast('寫入失敗，請檢查欄位後重試。'); }
    return;
  }
  if (event.target.id !== 'login-form') return;
  const form = new FormData(event.target);
  state.loginError = '';
  render();
  try {
    const session = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    state.user = { username: session.username, role: session.role };
    state.csrf = session.csrf;
    await loadWorkspace();
    render();
  } catch (error) {
    state.loginError = error.message === 'too_many_attempts' ? '登入嘗試次數過多，請稍後再試。' : '帳戶或密碼不正確。';
    render();
  }
});

document.addEventListener('click', async event => {
  const tab = event.target.closest('[data-tab]')?.dataset.tab;
  if (tab) { setTab(tab); return; }
  const projectId = event.target.closest('[data-project]')?.dataset.project;
  if (projectId) { state.projectId = projectId; await loadClaims(); setTab('overview'); return; }
  const claimId = event.target.closest('[data-claim]')?.dataset.claim;
  if (claimId) { await changeClaim(Number(claimId)); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'close-modal') { state.modal = null; render(); return; }
  if (action === 'new-project') { state.modal = 'project'; render(); return; }
  if (action === 'add-claim') { state.modal = 'claim'; render(); return; }
  if (action === 'logout') { try { await api('/api/logout', { method: 'POST' }); } finally { state.user = null; state.csrf = ''; state.claims = []; render(); } return; }
  if (action === 'ai-draft') {
    try {
      const result = await api(`/api/projects/${currentProject().id}/ai-drafts`, { method: 'POST', body: JSON.stringify({}) });
      state.aiDraft = result;
      state.modal = 'ai-draft';
      render();
    } catch (error) {
      const messages = { ai_unconfigured: '模型尚未配置，請只在伺服器環境檔設定金鑰。', no_sources: '請先加入至少一條來源資料。', ai_unavailable: '模型服務暫時無法連線，請稍後重試。', invalid_model_output: '模型未返回可核驗格式，草稿沒有寫入資料庫。' };
      showToast(messages[error.message] || 'AI 建檔草稿生成失敗。');
    }
    return;
  }
  if (action === 'accept-ai-draft') {
    if (!state.aiDraft) return;
    try {
      const claimIndexes = state.aiDraft.draft.claims.map((_, index) => index);
      const result = await api(`/api/projects/${currentProject().id}/ai-drafts/${state.aiDraft.draft_id}/accept`, { method: 'POST', body: JSON.stringify({ claim_indexes: claimIndexes }) });
      state.projects = state.projects.map(project => project.id === result.project.id ? result.project : project);
      state.claims = [...state.claims, ...result.claims];
      state.aiDraft = null;
      state.modal = null;
      state.tab = 'verify';
      showToast(`已採納 ${result.claims.length} 條 AI 草稿，等待人工核驗。`);
    } catch (_) { showToast('草稿未能採納，可能已過期或權限不足。'); }
    return;
  }
  if (action === 'archive') { try { const result = await api(`/api/projects/${currentProject().id}/archive`, { method: 'POST' }); state.projects = state.projects.map(project => project.id === result.project.id ? result.project : project); showToast('內部文化資產檔案已生成。'); } catch (_) { showToast('歸檔失敗，請稍後再試。'); } return; }
  if (action === 'copy') { navigator.clipboard?.writeText('禮記雪糕創立於 1933 年，是荷蘭園一帶承載街坊記憶的懷舊甜品店。'); showToast('商戶介紹文案已複製。'); return; }
  if (action === 'upload') { state.modal = 'claim'; render(); }
  else if (action === 'view-source') showToast('來源預覽已準備（Demo）。');
  else if (action === 'report') showToast('核驗清單匯出功能待接入。');
  else if (action === 'publish') showToast('已建立待確認的對外發布版本。');
  else if (action === 'preview') showToast('活化場景預覽已準備。');
});

window.addEventListener('hashchange', () => { const tab = location.hash.slice(1); if (validTabs.has(tab)) { state.tab = tab; render(); } });
bootstrap();
