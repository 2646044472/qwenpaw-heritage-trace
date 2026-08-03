const tabs = [
  ['overview', '工作總覽', 'layout-dashboard'],
  ['archive', '來源與 Qwen', 'folder-kanban'],
  ['verify', 'Paw-Verifier', 'shield-check'],
  ['district', '街區地圖', 'map'],
  ['publish', '發布成品', 'send'],
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
  guidedDraft: false,
  districtFilter: 'all',
};

const validTabs = new Set(tabs.map(([id]) => id));
if (!validTabs.has(state.tab)) state.tab = 'overview';
const icon = name => {
  const fallback = { plus: '+', x: 'x', 'chevron-right': '>', 'arrow-right': '>', 'arrow-up-right': '>', 'log-out': '>', 'log-in': '>', save: '+', archive: '+', 'file-plus-2': '+' };
  return `<i class="fallback-icon" data-lucide="${name}">${fallback[name] || ''}</i>`;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currentProject = () => state.projects.find(project => project.id === state.projectId) || state.projects[0];
let adminMap = null;

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
  if (adminMap) {
    adminMap.remove();
    adminMap = null;
  }
  document.querySelector('#app').innerHTML = state.checking ? renderLoading() : state.user ? renderWorkspace() : renderLogin();
  if (window.lucide) window.lucide.createIcons();
  initAdminMap();
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
  if (action === 'close-modal') { state.modal = null; state.guidedDraft = false; render(); return; }
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

function guidedDraftRecord() {
  const project = currentProject();
  return {
    draft_id: 'guided-preview',
    model: 'Qwen / Paw-Archivist 引導示例',
    draft: {
      summary: `Qwen 會先把「${project.name}」現有來源拆成可核驗欄位。以下是基於目前 Demo 來源的候選，不是已確認事實。`,
      claims: [
        { claim: `${project.name} 的創立年份為 ${project.year}`, evidence_excerpt: '候選欄位以公開報道中已記錄的年份線索整理。', source_indexes: [1], verification_note: '請由 Verifier 對照原文，確認報道年份可否作公開敘述。' },
        { claim: `${project.name} 承載街坊代際回訪的記憶`, evidence_excerpt: '候選敘述由訪談中「帶小朋友回來」的記錄抽取。', source_indexes: [2], verification_note: '須取得商戶對訪談引述與公開範圍的確認。' },
      ],
    },
  };
}

function sourceCount() {
  return Math.max(state.claims.length, 3);
}

function renderOverview(project) {
  const pending = state.claims.filter(claim => claim.status === 'pending').length;
  const publicCount = state.claims.filter(claim => claim.status === 'public').length;
  const aiState = state.aiStatus.configured ? `已連接 ${escapeHtml(state.aiStatus.model)}` : '引導模式可用；真實模型待伺服器配置';
  return `<section class="admin-guide"><div><p class="record-kicker">從左到右完成一次可交付建檔</p><h2>你現在要做什麼？</h2><p>先整理來源，再讓 Qwen 產生有回鏈的候選，最後由 Verifier 決定可否公開。系統不會把模型文字直接發布。</p></div><div class="admin-guide-status"><span>Qwen / Paw-Archivist</span><strong>${aiState}</strong></div></section><section class="admin-flow" aria-label="管理操作流程"><button data-tab="archive"><b>01</b><span>整理來源</span><small>${sourceCount()} 條資料可供建檔</small></button><button data-tab="archive"><b>02</b><span>Qwen 建檔</span><small>抽取候選欄位與來源編號</small></button><button data-tab="verify"><b>03</b><span>人工核驗</span><small>${pending} 項等待決定公開邊界</small></button><button data-tab="district"><b>04</b><span>落到街區</span><small>查看位置與補訪優先級</small></button><button data-tab="publish"><b>05</b><span>生成成品</span><small>G / B / C 只使用可公開內容</small></button></section><section class="metrics"><div class="metric"><div class="metric-label">已入庫來源</div><div class="metric-value">${sourceCount()}</div><div class="metric-note">公開資料與訪談素材</div></div><div class="metric"><div class="metric-label">Qwen 候選</div><div class="metric-value">${state.guidedDraft ? '02' : '—'}</div><div class="metric-note">${state.guidedDraft ? '已等待人工採納' : '尚未執行建檔'}</div></div><div class="metric"><div class="metric-label">待確認項目</div><div class="metric-value">${pending}</div><div class="metric-note">需商戶或校對人處理</div></div><div class="metric"><div class="metric-label">可公開欄位</div><div class="metric-value">${publicCount}</div><div class="metric-note">可用於對外成品</div></div></section><div class="split"><section class="section"><div class="section-heading"><h2>目前個案</h2><button class="text-action" data-tab="archive">開始整理來源 ${icon('arrow-right')}</button></div><div class="fields"><div class="field-label">資產類型</div><div class="field-value">懷舊雪糕店 / 飲食文化</div><div class="field-label">所在街區</div><div class="field-value">${project.area}</div><div class="field-label">已知年份</div><div class="field-value">${project.year} <span class="badge amber">仍須來源回鏈</span></div><div class="field-label">發布規則</div><div class="field-value">只有 Verifier 標為「可公開」的欄位會進入 G / B / C 成品。</div></div></section><section class="section"><div class="section-heading"><h2>本次建議</h2><span class="badge teal">下一步</span></div><div class="admin-next-action"><b>先在「資料歸檔」跑一次 Qwen 建檔</b><span>你會看到 Qwen 讀了哪幾條來源、抽了哪些候選，以及採納後資料會去哪裡。</span><button class="btn btn-primary" data-tab="archive">前往 Qwen 工作台 ${icon('arrow-right')}</button></div></section></div>`;
}

function renderArchiveWithAi(project) {
  const live = state.aiStatus.configured;
  const primaryAction = live ? 'ai-draft' : 'guided-ai-draft';
  const primaryLabel = live ? `用 ${escapeHtml(state.aiStatus.model)} 生成真實草稿` : '運行 Qwen 建檔引導示例';
  const sourceRows = [
    ['01', '1933_創立年份_報道.pdf', '公開報道 · 年份線索', '已可引用'],
    ['02', '禮記雪糕_訪談摘錄.txt', '店主訪談 · 公開範圍待確認', '待核驗'],
    ['03', '店面與舊包裝_06.jpg', '實地素材 · 權利資訊待補', '待補證'],
  ];
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 01 / 02 · SOURCES TO VERIFIED CANDIDATES</p><h2>資料歸檔與 Qwen 建檔</h2><p>這一頁回答兩件事：Qwen 看了什麼，以及它產生的內容如何被人接手。</p></div><button class="btn" data-action="archive" ${project.archive_status === 'archived' ? 'disabled' : ''}>${icon('archive')} ${project.archive_status === 'archived' ? '內部檔案已生成' : '生成內部檔案'}</button></div><section class="admin-qwen-workbench"><div class="admin-qwen-intro"><p class="record-kicker">QWEN / PAW-ARCHIVIST</p><h2>不是替你寫故事，而是替你把來源拆成可核驗的候選。</h2><p>模型只讀取已登入管理端的來源摘要，輸出每條候選的來源編號、證據摘錄與下一個人工問題。它沒有發布權，也不會覆蓋原始資料。</p><div class="admin-qwen-rules"><span>1. 讀取來源</span><span>2. 抽取候選</span><span>3. 綁定回鏈</span><span>4. 人工核驗</span></div></div><div class="admin-qwen-run"><span class="badge ${live ? 'green' : 'amber'}">${live ? '真實模型已配置' : '引導模式 · 不呼叫模型'}</span><strong>${live ? `模型：${escapeHtml(state.aiStatus.model)}` : '可先完整演示資料流，配置有效 Key 後自動切換真實模型。'}</strong><button class="btn btn-primary" data-action="${primaryAction}">${icon('sparkles')} ${primaryLabel}</button><small>${live ? '草稿由伺服器生成並寫入審計日誌；採納前不會產生核驗資料。' : '引導示例只在瀏覽器展示候選；點擊採納後才會以待核驗資料寫入系統。'}</small></div></section><div class="admin-pipeline"><section><div class="admin-pipeline-head"><span>INPUT · 已選來源</span><b>${sourceRows.length} 條</b></div>${sourceRows.map(row => `<div class="admin-source-row"><b>${row[0]}</b><div><strong>${row[1]}</strong><small>${row[2]}</small></div><em>${row[3]}</em></div>`).join('')}</section><section><div class="admin-pipeline-head"><span>OUTPUT · Qwen 會交付</span><b>可核驗草稿</b></div><div class="admin-output-item"><span>欄位候選</span><strong>創立年份、街區、文化標籤</strong></div><div class="admin-output-item"><span>來源回鏈</span><strong>每個候選都標記來源 01 / 02 / 03</strong></div><div class="admin-output-item"><span>Verifier 任務</span><strong>授權、原文對照與公開邊界</strong></div></section></div><section class="admin-safe-note"><div>${icon('shield-check')}</div><p><strong>安全邊界：</strong>API Key 只在伺服器環境檔；瀏覽器拿不到 Key。無論真實模型或引導模式，結果均先是「待核驗」，不是公開內容。</p></section>`;
}

function renderAiDraftModal() {
  const record = state.aiDraft;
  if (!record) return '';
  const guided = state.guidedDraft || record.draft_id === 'guided-preview';
  const claims = record.draft.claims.map((item, index) => `<article class="admin-draft-claim"><div><span>候選 ${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.claim)}</h3></div><p>${escapeHtml(item.evidence_excerpt)}</p><footer><b>來源 #${item.source_indexes.join('、#')}</b><span>${escapeHtml(item.verification_note)}</span></footer></article>`).join('');
  return `<div class="modal-backdrop"><section class="modal ai-draft-modal" role="dialog" aria-modal="true" aria-labelledby="ai-draft-title"><header><div><div class="record-kicker">${escapeHtml(record.model)}</div><h2 id="ai-draft-title">${guided ? 'Qwen 建檔引導草稿' : 'Qwen 真實建檔草稿'}</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><p class="admin-draft-summary">${escapeHtml(record.draft.summary)}</p><div class="admin-draft-list">${claims}</div><div class="admin-draft-boundary"><strong>${guided ? '這是引導示例，尚未呼叫模型。' : '這是伺服器生成的模型草稿，尚未寫入公開資料。'}</strong><span>採納後，所有候選都會進入 Verifier 的「待確認」清單；你仍可逐條改為可公開或僅內部。</span></div><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">保留草稿</button><button class="btn btn-primary" type="button" data-action="${guided ? 'accept-guided-draft' : 'accept-ai-draft'}">採納為待核驗資料</button></div></section></div>`;
}

function renderVerify() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  const rows = state.claims.length ? state.claims.map(claim => `<tr><td class="claim">${escapeHtml(claim.claim)}</td><td class="muted">${escapeHtml(claim.source)}</td><td>${badge(claim.status)}</td><td><button class="table-action" data-claim="${claim.id}">決定公開邊界 ${icon('chevron-right')}</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">尚未有核驗項目。先在資料歸檔頁採納一份 Qwen 草稿，或手動新增資料。</td></tr>';
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 03 · PAW-VERIFIER</p><h2>核驗審核</h2><p>Verifier 決定的是「能不能用、能在哪裡用」，不是讓模型決定真相。</p></div><div class="head-actions"><button class="btn" data-action="add-claim">手動新增資料</button><button class="btn btn-primary" data-tab="publish">查看可發布成品</button></div></div><section class="admin-verifier-rule"><b>每條候選的三個結果</b><span><i class="public"></i>可公開：能進 G / B / C</span><span><i class="pending"></i>待確認：保留但不可發布</span><span><i class="internal"></i>僅內部：研究留存、不對外顯示</span></section><div class="verify-summary"><div><strong>${publicCount}</strong><span>可公開欄位</span></div><div><strong>${pendingCount}</strong><span>待商戶確認</span></div><div><strong>${state.claims.filter(item => item.status === 'internal').length}</strong><span>僅內部使用</span></div></div><div class="table-scroll"><table class="verify-table"><thead><tr><th>資產敘述</th><th>證據來源 / Qwen 回鏈</th><th>目前狀態</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="verify-footer"><p>${icon('info')} 點擊「決定公開邊界」會循環切換可公開、待確認、僅內部，並由後端記錄操作者和時間。</p><button class="btn" data-action="report">${icon('file-down')} 匯出核驗清單</button></div>`;
}

function renderPublish() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 05 · DELIVERY</p><h2>發布與活化</h2><p>同一份核驗底稿，按不同使用者輸出；沒有可公開欄位時不應製作正式對外文案。</p></div><button class="btn btn-primary" data-action="publish" ${publicCount ? '' : 'disabled'}>${icon('send')} 建立對外版本</button></div><section class="admin-release-gate"><strong>${publicCount ? `已有 ${publicCount} 條可公開欄位` : '目前沒有可公開欄位'}</strong><span>${publicCount ? '可建立有清楚來源邊界的對外成品。' : '請先回到 Verifier，逐條決定哪些內容已可公開。'}</span><button class="text-action" data-tab="verify">前往核驗 ${icon('arrow-right')}</button></section><div class="publish-grid"><article class="publish-channel"><div class="channel-top"><span class="channel-letter">G</span><h3>街區決策工作單</h3></div><p>給文旅或社區單位：位置、補訪優先級、可公開比例與待辦。</p><span class="badge teal">使用真實地圖</span><button class="btn" data-tab="district">查看街區地圖 ${icon('map-pinned')}</button></article><article class="publish-channel channel-b"><div class="channel-top"><span class="channel-letter">B</span><h3>商戶確認內容包</h3></div><p>只列出已核驗的店舖事實與可用素材，讓商戶確認後再對外。</p><span class="badge ${publicCount ? 'green' : 'amber'}">${publicCount ? `${publicCount} 條可用` : '等待核驗'}</span><button class="btn" data-action="copy" ${publicCount ? '' : 'disabled'}>複製可確認文案 ${icon('copy')}</button></article><article class="publish-channel channel-c"><div class="channel-top"><span class="channel-letter">C</span><h3>城市文化路線</h3></div><p>用地圖把可公開的文化點串成步行路線，待補證點保留核驗提示。</p><span class="badge teal">可預覽</span><button class="btn" data-tab="district">預覽路線位置 ${icon('map')}</button></article></div>`;
}

function renderDistrict() {
  const filter = state.districtFilter;
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 04 · DISTRICT OPERATIONS</p><h2>荷蘭園 / 水坑尾街區地圖</h2><p>這裡把核驗狀態放回實際地理底圖，讓採集與發布不只是一張表。</p></div><div class="filter-group"><button class="filter ${filter === 'all' ? 'is-active' : ''}" data-district-filter="all">全部資產</button><button class="filter ${filter === 'pending' ? 'is-active' : ''}" data-district-filter="pending">待核驗</button><button class="filter ${filter === 'public' ? 'is-active' : ''}" data-district-filter="public">可公開</button></div></div><div class="district-layout"><section class="admin-map-shell"><div class="admin-map-title"><div><strong>澳門實際地理底圖</strong><span>演示位置；正式發布前請以商戶授權座標覆核</span></div><b>${filter === 'all' ? '3 個資產' : filter === 'pending' ? '2 個待辦' : '1 個可公開'}</b></div><div id="admin-live-map" class="admin-live-map" aria-label="澳門街區文化資產互動地圖"></div><div class="admin-map-legend"><span><i class="public"></i>可公開</span><span><i class="pending"></i>待確認</span><span><i class="internal"></i>需復核</span></div></section><aside><section class="section"><div class="section-heading"><h2>地圖怎麼用</h2></div><div class="admin-map-instruction"><div><b>1</b><span>點擊標記，查看該店的核驗狀態與下一步。</span></div><div><b>2</b><span>用篩選只看待補訪或已可發布的資產。</span></div><div><b>3</b><span>完成核驗後，位置可進入 G 端工作單與城市路線。</span></div></div></section><section class="section"><div class="section-heading"><h2>本期採集概況</h2></div><div class="queue"><div class="queue-row"><span class="queue-mark green">${icon('circle-check')}</span><div><div class="queue-title">${publicCount} 項可公開資料</div><div class="queue-note">可進入對外成品</div></div></div><div class="queue-row"><span class="queue-mark">${icon('clock-3')}</span><div><div class="queue-title">${pendingCount || 2} 項待補訪 / 授權</div><div class="queue-note">優先處理商戶確認與年份來源</div></div></div></div></section></aside></div>`;
}

function initAdminMap() {
  const target = document.querySelector('#admin-live-map');
  if (!target || !window.L) return;
  const status = state.districtFilter;
  const places = [
    { name: currentProject()?.name || '禮記雪糕', area: '荷蘭園 / 水坑尾', status: '待確認', next: '確認訪談公開範圍', color: '#b87923', coords: [22.2012, 113.5486] },
    { name: '佛笑樓', area: '新馬路 / 營地大街', status: '可公開', next: '可進入商戶內容包', color: '#2f625f', coords: [22.1941, 113.5415] },
    { name: '龍華茶樓', area: '紅街市 / 望廈', status: '需復核', next: '處理開業年份衝突', color: '#a54739', coords: [22.2073, 113.5489] },
  ].filter(place => status === 'all' || (status === 'public' ? place.status === '可公開' : place.status !== '可公開'));
  adminMap = window.L.map(target, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(adminMap);
  places.forEach(place => window.L.circleMarker(place.coords, { radius: 9, color: '#fffdf8', weight: 2, fillColor: place.color, fillOpacity: 1 }).bindPopup(`<strong>${escapeHtml(place.name)}</strong><br><span>${escapeHtml(place.area)} · ${place.status}</span><br><small>下一步：${place.next}</small>`).addTo(adminMap));
  adminMap.fitBounds(places.map(place => place.coords), { padding: [32, 32], maxZoom: 15 });
  window.setTimeout(() => adminMap?.invalidateSize(), 0);
}

async function acceptGuidedDraft() {
  const draft = state.aiDraft;
  if (!draft) return;
  try {
    const created = [];
    for (const item of draft.draft.claims) {
      const result = await api('/api/claims', { method: 'POST', body: JSON.stringify({ project_id: currentProject().id, claim: item.claim, source: `Qwen 引導草稿 · 來源 #${item.source_indexes.join('、#')} · ${item.evidence_excerpt}` }) });
      created.push(result);
    }
    state.claims = [...state.claims, ...created.map(item => item.claim)];
    state.projects = state.projects.map(project => created[created.length - 1]?.project?.id === project.id ? created[created.length - 1].project : project);
    state.aiDraft = null;
    state.guidedDraft = false;
    state.modal = null;
    state.tab = 'verify';
    showToast(`已把 ${created.length} 條 Qwen 候選帶入 Verifier 待核驗清單。`);
  } catch (_) {
    showToast('引導草稿未能寫入，請確認目前帳戶具有 Archivist 或 Admin 權限。');
  }
}

document.addEventListener('click', async event => {
  const filter = event.target.closest('[data-district-filter]')?.dataset.districtFilter;
  if (filter) {
    state.districtFilter = filter;
    render();
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'guided-ai-draft') {
    state.aiDraft = guidedDraftRecord();
    state.guidedDraft = true;
    state.modal = 'ai-draft';
    render();
    return;
  }
  if (action === 'accept-guided-draft') await acceptGuidedDraft();
});

function renderLogin() {
  return `<main class="login-page"><section class="login-card"><span class="login-mark">${icon('landmark')}</span><div class="record-kicker">QWENPAW HERITAGE TRACE</div><h1>文化資產工作台</h1><p>這是供 Archivist、Verifier 與發布人員使用的內部工作區。登入後依序完成「來源 → Qwen 候選 → 人工核驗 → 地圖 → 成品」。</p><div class="login-workflow"><span>01 來源</span><span>02 Qwen</span><span>03 核驗</span><span>04 地圖</span><span>05 成品</span></div><form id="login-form" class="login-form"><label>帳戶<input name="username" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label>${state.loginError ? `<div class="form-error" role="alert">${state.loginError}</div>` : ''}<button class="btn btn-primary" type="submit">${icon('log-in')} 登入工作台</button></form><div class="login-note">僅限受邀帳戶 · 所有新增、核驗與發布操作均會記錄在伺服器資料庫</div></section></main>`;
}

function renderSidebar() {
  const workflow = [
    ['overview', '01', '工作總覽', '看下一步要做什麼', 'layout-dashboard'],
    ['archive', '02', '來源與 Qwen', '整理來源、生成候選', 'sparkles'],
    ['verify', '03', 'Paw-Verifier', '決定公開邊界', 'shield-check'],
    ['district', '04', '街區地圖', '安排補訪與位置', 'map-pinned'],
    ['publish', '05', '發布成品', '輸出 G / B / C', 'send'],
  ];
  return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('landmark')}</span><div><div class="brand-name">澳憶・千尋</div><div class="brand-sub">城市文化資產工作台</div></div></div><section class="sidebar-section"><div class="sidebar-label"><span>試點項目</span><button title="新增項目" aria-label="新增項目" data-action="new-project">${icon('plus')}</button></div><div class="project-list">${state.projects.map(project => `<button class="project-item ${project.id === state.projectId ? 'is-active' : ''}" data-project="${project.id}"><span class="project-sigil ${project.tone}">${icon(project.icon)}</span><span class="project-copy"><strong>${project.name}</strong><span>${project.area}</span></span>${project.pending ? `<span class="count">${project.pending}</span>` : ''}</button>`).join('')}</div></section><section class="sidebar-section"><div class="sidebar-label"><span>建檔工作流</span></div><nav class="nav-list admin-workflow-nav" aria-label="建檔工作流">${workflow.map(([id, number, label, note, glyph]) => `<button class="nav-item ${state.tab === id ? 'is-active' : ''}" data-tab="${id}"><b>${number}</b>${icon(glyph)}<span><strong>${label}</strong><small>${note}</small></span>${id === 'verify' && state.claims.filter(claim => claim.status === 'pending').length ? `<em>${state.claims.filter(claim => claim.status === 'pending').length}</em>` : ''}</button>`).join('')}</nav></section><div class="sidebar-bottom"><strong>${state.user.username} · ${state.user.role}</strong><span>${state.aiStatus.configured ? `Qwen 已連接：${escapeHtml(state.aiStatus.model)}` : 'Qwen 引導模式：不發送資料到模型'}</span><span>所有核驗與發布動作都會記錄。</span></div></aside>`;
}

function renderRecordHead(project) {
  return `<section class="record-head"><div class="record-image"><img src="assets/heritage-cover.jpeg" alt="澳門老街文化記憶插畫"></div><div><div class="record-kicker">文化資產個案 · 已登入內部工作區</div><h1>${project.name}</h1><div class="record-meta">${project.area} · 已知年份 ${project.year} · 資料完整度 ${project.completeness}%</div></div><div class="head-actions"><button class="btn" data-tab="archive">${icon('sparkles')} 來源與 Qwen</button><button class="btn btn-primary" data-tab="verify">${icon('shield-check')} 前往人工核驗</button></div></section>`;
}
