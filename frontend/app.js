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
  sources: [],
  publications: [],
  frontendResult: null,
  projectId: 'laikei',
  toast: '',
  loginError: '',
  modal: null,
  aiStatus: { configured: false, model: null },
  aiDraft: null,
  guidedDraft: false,
  districtFilter: 'all',
  statusChange: null,
  evidenceClaimId: null,
  publicationPreview: null,
};

const validTabs = new Set(tabs.map(([id]) => id));
if (!validTabs.has(state.tab)) state.tab = 'overview';
const apiBase = String(window.HERITAGE_CONFIG?.apiBase || '/api').replace(/\/+$/, '');
const apiUrl = path => path.startsWith('/api/') ? `${apiBase}/${path.slice('/api/'.length)}` : path;
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
  const response = await fetch(apiUrl(path), { ...options, headers, credentials: apiBase.startsWith('/') ? 'same-origin' : 'include' });
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
  await loadSources();
  await loadPublications();
  await loadFrontendResult();
  state.aiStatus = await api('/api/ai/status');
}

async function loadClaims() {
  const project = currentProject();
  if (!project) return;
  const result = await api(`/api/claims?project_id=${encodeURIComponent(project.id)}`);
  state.claims = result.claims;
}

async function loadSources() {
  const project = currentProject();
  if (!project) return;
  const result = await api(`/api/sources?project_id=${encodeURIComponent(project.id)}`);
  state.sources = result.sources;
}

async function loadPublications() {
  const project = currentProject();
  if (!project) return;
  const result = await api(`/api/publications?project_id=${encodeURIComponent(project.id)}`);
  state.publications = result.publications;
}

async function loadFrontendResult() {
  const project = currentProject();
  if (!project) return;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(project.id)}/frontend-result`);
    state.frontendResult = result.frontend_result;
  } catch (error) {
    state.frontendResult = null;
    if (error.message !== 'workflow_not_run') throw error;
  }
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

function legacyRenderModalBase() {
  if (!state.modal) return '';
  if (state.modal === 'ai-draft') return renderAiDraftModal();
  if (state.modal === 'publication' && state.publicationPreview) {
    const publication = state.publicationPreview;
    const facts = publication.content.facts.map(fact => `<div class="admin-publication-fact"><strong>${escapeHtml(fact.claim)}</strong><span>${escapeHtml(fact.source)}</span></div>`).join('');
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="publication-title"><header><div><div class="record-kicker">已保存发布版本 · ${publication.channel}</div><h2 id="publication-title">${escapeHtml(publication.content.title)}</h2></div><button class="icon-button" aria-label="關閉" data-action="close-modal">${icon('x')}</button></header><p>${escapeHtml(publication.content.summary)}</p><div class="admin-publication-facts">${facts}</div><div class="admin-draft-boundary"><strong>下一步：${escapeHtml(publication.content.next_action)}</strong><span>这份版本由服务器保存，可在发布审计中追溯生成者与时间。</span></div></section></div>`;
  }
  if (state.modal === 'project') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"><header><div><div class="record-kicker">文化資產項目</div><h2 id="project-modal-title">新增項目</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><form id="project-form" class="modal-form"><label>項目名稱<input name="name" maxlength="100" required placeholder="例如：新中央酒店"></label><label>所在街區<input name="area" maxlength="120" required placeholder="例如：新馬路 / 葡京"></label><label>創立年份<input name="year" maxlength="20" required placeholder="例如：1928 或 待查"></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">建立項目</button></div></form></section></div>`;
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title"><header><div><div class="record-kicker">核驗資料</div><h2 id="claim-modal-title">新增核驗項目</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><form id="claim-form" class="modal-form"><label>資產敘述<textarea name="claim" maxlength="500" required placeholder="例如：店舖於 1928 年開始營業"></textarea></label><label>證據來源<input name="source" maxlength="300" required placeholder="例如：訪談記錄 01 / 報紙檔案"></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">寫入核驗資料</button></div></form></section></div>`;
}

function legacyRenderSidebar() {
  return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('landmark')}</span><div><div class="brand-name">澳憶・千尋</div><div class="brand-sub">城市文化資產工作台</div></div></div><section class="sidebar-section"><div class="sidebar-label"><span>試點項目</span><button title="新增項目" aria-label="新增項目" data-action="new-project">${icon('plus')}</button></div><div class="project-list">${state.projects.map(project => `<button class="project-item ${project.id === state.projectId ? 'is-active' : ''}" data-project="${project.id}"><span class="project-sigil ${project.tone}">${icon(project.icon)}</span><span class="project-copy"><strong>${project.name}</strong><span>${project.area}</span></span>${project.pending ? `<span class="count">${project.pending}</span>` : ''}</button>`).join('')}</div></section><section class="sidebar-section"><div class="sidebar-label"><span>工作區</span></div><nav class="nav-list" aria-label="工作區導覽"><button class="nav-item ${state.tab === 'overview' ? 'is-active' : ''}" data-tab="overview">${icon('files')} <span>文化資產項目</span></button><button class="nav-item ${state.tab === 'verify' ? 'is-active' : ''}" data-tab="verify">${icon('list-checks')} <span>待辦核驗</span><span class="count">${state.claims.filter(claim => claim.status === 'pending').length}</span></button><button class="nav-item ${state.tab === 'district' ? 'is-active' : ''}" data-tab="district">${icon('map-pinned')} <span>街區資產庫</span></button></nav></section><div class="sidebar-bottom"><strong>${state.user.username} · ${state.user.role}</strong>所有核驗和發布動作會記錄在專案日誌。</div></aside>`;
}

function renderTopbar() {
  return `<header class="topbar"><div class="crumbs"><span>文化資產項目</span>${icon('chevron-right')}<strong>${currentProject().name}</strong></div><div class="top-actions"><label class="search">${icon('search')}<input type="search" aria-label="搜尋項目或來源" placeholder="搜尋項目、來源或標籤"></label><span class="user-chip">${icon('user-round')} ${state.user.username}</span><button class="btn" data-action="logout">${icon('log-out')} 登出</button></div></header>`;
}

function legacyRenderRecordHead(project) {
  const archived = project.archive_status === 'archived';
  return `<section class="record-head"><div class="record-image"><img src="assets/heritage-cover.jpeg" alt="澳門老街文化記憶插畫"></div><div><div class="record-kicker">文化資產項目 · MCA-HP-026</div><h1>${project.name}</h1><div class="record-meta">${project.area} · 創立年份 ${project.year} · 資料完整度 ${project.completeness}%</div></div><div class="head-actions"><button class="btn" data-tab="archive">${icon('folder-plus')} 歸檔資料</button><button class="btn btn-primary" data-tab="verify">${icon('shield-check')} ${archived ? '查看核驗' : '進入核驗'}</button></div></section>`;
}

document.addEventListener('submit', async event => {
  if (event.target.id !== 'source-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const result = await api('/api/sources', { method: 'POST', body: JSON.stringify({ project_id: currentProject().id, title: form.get('title'), source_type: form.get('source_type'), excerpt: form.get('excerpt'), rights_status: form.get('rights_status') }) });
    state.sources.push(result.source);
    state.modal = null;
    showToast('来源已保存；现在可以运行 Qwen 建档。');
  } catch (_) {
    showToast('来源保存失败，请检查账号权限和字段内容。');
  }
});

document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const claimId = Number(event.target.closest('[data-claim-id]')?.dataset.claimId);
  const nextStatus = event.target.closest('[data-status]')?.dataset.status;
  if (action === 'new-source') {
    state.modal = 'source';
    render();
    return;
  }
  if (action === 'request-status' && claimId && nextStatus) {
    state.statusChange = { claimId, status: nextStatus };
    render();
    return;
  }
  if (action === 'confirm-status' && state.statusChange) {
    const change = state.statusChange;
    try {
      const result = await api(`/api/claims/${change.claimId}`, { method: 'PATCH', body: JSON.stringify({ status: change.status }) });
      state.claims = state.claims.map(claim => claim.id === change.claimId ? result.claim : claim);
      state.projects = state.projects.map(project => project.id === result.claim.project_id ? { ...project, pending: state.claims.filter(claim => claim.status === 'pending').length, pending_count: state.claims.filter(claim => claim.status === 'pending').length, public_count: state.claims.filter(claim => claim.status === 'public').length } : project);
      state.statusChange = null;
      state.modal = null;
      showToast('公开边界已保存，并写入审计日志。');
    } catch (_) {
      showToast('状态保存失败，请检查 Verifier 权限。');
    }
    return;
  }
  if (action === 'generate-publication') {
    const channel = event.target.closest('[data-channel]')?.dataset.channel;
    if (!channel) return;
    try {
      const result = await api(`/api/projects/${currentProject().id}/publications`, { method: 'POST', body: JSON.stringify({ channel }) });
      state.publications = [result.publication, ...state.publications];
      render();
      showToast(`${channel} 版本已保存，可在下方查看内容。`);
    } catch (error) {
      showToast(error.message === 'no_public_claims' ? '目前没有可公开字段，不能生成正式版本。' : '发布版本生成失败，请确认 Publisher 权限。');
    }
    return;
  }
  const publicationId = event.target.closest('[data-publication-id]')?.dataset.publicationId;
  if (publicationId) {
    state.publicationPreview = state.publications.find(item => item.id === publicationId) || null;
    if (state.publicationPreview) {
      state.modal = 'publication';
      render();
    }
    return;
  }
  if (action === 'export-claims') {
    window.location.href = apiUrl(`/api/projects/${currentProject().id}/exports/claims.csv`);
  }
});

function renderTabs() { return `<nav class="tabs" aria-label="項目分頁">${tabs.map(([id, label, glyph]) => `<button class="tab ${state.tab === id ? 'is-active' : ''}" data-tab="${id}">${icon(glyph)} ${label}</button>`).join('')}</nav>`; }
function renderTabContent(project) { return { overview: renderOverview, archive: renderArchiveWithAi, verify: renderVerify, publish: renderPublish, district: renderCurrentDistrict }[state.tab](project); }
function badge(status) { return status === 'public' ? `<span class="badge green">${icon('circle-check')} 可公開</span>` : status === 'internal' ? `<span class="badge red">${icon('lock-keyhole')} 僅內部</span>` : `<span class="badge amber">${icon('clock-3')} 待確認</span>`; }

function legacyRenderOverview(project) {
  const summary = state.frontendResult?.summary;
  const pending = summary?.review_required ?? state.claims.filter(claim => claim.status === 'pending').length;
  const publicCount = summary?.supported ?? state.claims.filter(claim => claim.status === 'public').length;
  return `<div class="notice"><div class="notice-copy">${icon('circle-alert')}<div><strong>還有 ${pending} 個欄位需要商戶確認</strong><span>核驗結果已儲存於伺服器本地資料庫，確認後可進入發布流程。</span></div></div><button class="btn" data-tab="verify">查看核驗項目 ${icon('arrow-right')}</button></div><section class="metrics"><div class="metric"><div class="metric-label">已入庫來源</div><div class="metric-value">08</div><div class="metric-note">公開資料與訪談素材</div></div><div class="metric"><div class="metric-label">可公開欄位</div><div class="metric-value">${publicCount}</div><div class="metric-note">已完成核驗</div></div><div class="metric"><div class="metric-label">待確認項目</div><div class="metric-value">${pending}</div><div class="metric-note">需商戶或校對人處理</div></div><div class="metric"><div class="metric-label">資料完整度</div><div class="metric-value">${project.completeness}%</div><div class="metric-note">${project.archive_status === 'archived' ? '已生成內部檔案' : '目標：可發布版本'}</div></div></section><div class="split"><div><section class="section"><div class="section-heading"><h2>資產摘要</h2><button class="text-action" data-tab="archive">編輯檔案 ${icon('arrow-up-right')}</button></div><div class="fields"><div class="field-label">資產類型</div><div class="field-value">懷舊雪糕店 / 飲食文化</div><div class="field-label">所在街區</div><div class="field-value">${project.area}</div><div class="field-label">文化標籤</div><div class="field-value"><div class="chips"><span class="chip">懷舊甜品</span><span class="chip">街坊記憶</span><span class="chip">代際消費</span><span class="chip">老澳門味道</span></div></div><div class="field-label">內部版本</div><div class="field-value">${project.archive_status === 'archived' ? '已歸檔 · 等待發布審核' : '草稿 · 尚未生成資產檔案'}</div></div></section><section class="section"><div class="section-heading"><h2>已整理的故事片段</h2><span class="badge teal">可回溯</span></div><blockquote class="excerpt">「以前很多街坊都不是只來買雪糕，還會帶小朋友來。後來小朋友長大了，又帶自己的孩子回來。」<footer>來源：店主訪談摘錄 02 · 需確認公開範圍</footer></blockquote></section></div><div><section class="section"><div class="section-heading"><h2>核驗狀態</h2><span class="badge amber">${pending} 項待辦</span></div><div class="queue">${state.claims.map(claim => `<div class="queue-row"><span class="queue-mark ${claim.status === 'public' ? 'green' : claim.status === 'internal' ? 'red' : ''}">${icon(claim.status === 'public' ? 'circle-check' : claim.status === 'internal' ? 'lock-keyhole' : 'clock-3')}</span><div><div class="queue-title">${claim.claim}</div><div class="queue-note">${claim.source}</div></div>${badge(claim.status)}</div>`).join('')}</div></section></div></div>`;
}

function legacyRenderArchive(project) {
  return `<div class="toolbar"><div class="toolbar-copy"><h2>資料歸檔</h2><p>來源、訪談與實地素材會整理成可核驗的內部文化資產檔案。</p></div><button class="btn btn-primary" data-action="archive" ${project.archive_status === 'archived' ? 'disabled' : ''}>${icon('archive')} ${project.archive_status === 'archived' ? '資產檔案已生成' : '生成資產檔案'}</button></div><div class="archive-layout"><div><div class="dropzone">${icon('upload')}<div><strong>加入新的文化記錄</strong><span>上傳功能會在下一階段連接檔案隔離與掃描服務。</span></div><button class="text-action" data-action="upload">查看歸檔資料 ${icon('arrow-up-right')}</button></div><div class="table-scroll"><table class="source-table"><thead><tr><th>資料</th><th>來源類型</th><th>處理狀態</th><th></th></tr></thead><tbody><tr><td><span class="source-title"><span class="file">${icon('file-text')}</span>禮記雪糕_訪談摘錄.txt</span></td><td class="muted">店主訪談</td><td><span class="badge green">已分段</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr><tr><td><span class="source-title"><span class="file">${icon('image')}</span>店面與舊包裝_06.jpg</span></td><td class="muted">實地圖片</td><td><span class="badge amber">待標記權利</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr><tr><td><span class="source-title"><span class="file">${icon('newspaper')}</span>1933_創立年份_報道.pdf</span></td><td class="muted">公開報道</td><td><span class="badge green">已引用</span></td><td><button class="table-action" data-action="view-source">查看 ${icon('arrow-up-right')}</button></td></tr></tbody></table></div></div><aside class="side-sheet"><h3>歸檔進度</h3><p>${project.archive_status === 'archived' ? '內部資產檔案已生成，後續內容仍需核驗才能對外發布。' : '目前資料足夠生成一份內部文化資產卡，對外欄位仍會經過核驗。'}</p><div class="progress"><span style="width:${project.completeness}%"></span></div><div class="progress-meta"><span>資料完整度</span><strong>${project.completeness}%</strong></div><div class="mini-list"><div>${icon('circle-check')}<span>08 筆來源已建立回鏈</span></div><div>${icon('circle-check')}<span>04 個文化標籤已整理</span></div><div>${icon('clock-3')}<span>${state.claims.filter(claim => claim.status === 'pending').length} 個公開權限待確認</span></div></div></aside></div>`;
}

function legacyRenderArchiveWithAi(project) {
  const aiReady = state.aiStatus.configured;
  const aiLabel = aiReady ? `用 ${escapeHtml(state.aiStatus.model)} 生成建檔草稿` : 'AI 尚未配置';
  return `<div class="toolbar"><div class="toolbar-copy"><h2>資料歸檔</h2><p>來源、訪談與實地素材會整理成可核驗的內部文化資產檔案。</p></div><div class="head-actions"><button class="btn" data-action="ai-draft" ${aiReady ? '' : 'disabled'}>${icon('sparkles')} ${aiLabel}</button><button class="btn btn-primary" data-action="archive" ${project.archive_status === 'archived' ? 'disabled' : ''}>${icon('archive')} ${project.archive_status === 'archived' ? '資產檔案已生成' : '生成資產檔案'}</button></div></div><div class="notice"><div class="notice-copy">${icon('shield-check')}<div><strong>AI 只產生待核驗草稿</strong><span>草稿必須回鏈現有來源，採納後仍是「待確認」，不會自動發布。</span></div></div><span class="badge ${aiReady ? 'teal' : 'amber'}">${aiReady ? '模型已配置' : '等待安全配置'}</span></div>${renderArchive(project).replace(/^<div class="toolbar">[\s\S]*?<\/div><div class="archive-layout">/, '<div class="archive-layout">')}`;
}

function legacyRenderAiDraftModal() {
  const record = state.aiDraft;
  if (!record) return '';
  const claims = record.draft.claims.map((item, index) => `<article class="section"><div class="section-heading"><h3>${index + 1}. ${escapeHtml(item.claim)}</h3><span class="badge amber">待確認</span></div><p class="muted">${escapeHtml(item.evidence_excerpt)}</p><div class="queue-note">來源編號：${item.source_indexes.join('、')} · ${escapeHtml(item.verification_note)}</div></article>`).join('');
  return `<div class="modal-backdrop"><section class="modal ai-draft-modal" role="dialog" aria-modal="true" aria-labelledby="ai-draft-title"><header><div><div class="record-kicker">Paw-Archivist · ${escapeHtml(record.model)}</div><h2 id="ai-draft-title">AI 建檔草稿</h2></div><button class="icon-button" aria-label="關閉" title="關閉" data-action="close-modal">${icon('x')}</button></header><p>${escapeHtml(record.draft.summary)}</p><div class="ai-draft-list">${claims}</div><div class="notice"><div class="notice-copy">${icon('circle-alert')}<div><strong>尚未寫入公開資料</strong><span>採納後，每條內容會以「待確認」加入核驗清單。</span></div></div></div><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">保留草稿</button><button class="btn btn-primary" type="button" data-action="accept-ai-draft">採納為待核驗資料</button></div></section></div>`;
}

function legacyRenderVerify() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  return `<div class="toolbar"><div class="toolbar-copy"><h2>核驗審核</h2><p>每次狀態變更會立即寫入資料庫和審計日誌。</p></div><button class="btn btn-primary" data-tab="publish">${icon('send')} 進入發布版本</button></div><div class="verify-summary"><div><strong>${publicCount}</strong><span>可公開欄位</span></div><div><strong>${pendingCount}</strong><span>待商戶確認</span></div><div><strong>${state.claims.filter(item => item.status === 'internal').length}</strong><span>僅內部使用</span></div></div><div class="table-scroll"><table class="verify-table"><thead><tr><th>資產敘述</th><th>證據來源</th><th>目前狀態</th><th></th></tr></thead><tbody>${state.claims.map(claim => `<tr><td class="claim">${claim.claim}</td><td class="muted">${claim.source}</td><td>${badge(claim.status)}</td><td><button class="table-action" data-claim="${claim.id}">更改狀態 ${icon('chevron-right')}</button></td></tr>`).join('')}</tbody></table></div><div class="verify-footer"><p>${icon('info')} 更改狀態會循環切換「可公開 → 待確認 → 僅內部」，並在伺服器記錄操作者與時間。</p><button class="btn" data-action="report">${icon('file-down')} 匯出核驗清單</button></div>`;
}

function legacyRenderPublish() { return `<div class="toolbar"><div class="toolbar-copy"><h2>發布與活化</h2><p>同一份已核驗資料，可在不同使用場景下保持一致。</p></div><button class="btn btn-primary" data-action="publish">${icon('send')} 建立對外版本</button></div><div class="publish-grid"><article class="publish-channel"><div class="channel-top"><span class="channel-letter">G</span><h3>文化資產看板</h3></div><p>供政府或文旅單位查看街區採集進度、待辦優先級與可公開資產。</p><span class="badge green">已具備資料</span><button class="btn" data-action="preview">預覽看板 ${icon('arrow-up-right')}</button></article><article class="publish-channel channel-b"><div class="channel-top"><span class="channel-letter">B</span><h3>商戶介紹內容</h3></div><p>由商戶確認後使用的 POI 描述、三語介紹與故事素材。</p><span class="badge amber">${state.claims.filter(claim => claim.status === 'pending').length} 項待確認</span><button class="btn" data-action="copy">複製介紹文案 ${icon('copy')}</button></article><article class="publish-channel channel-c"><div class="channel-top"><span class="channel-letter">C</span><h3>城市故事路線</h3></div><p>把已核驗的資料串成可步行體驗的街區故事線。</p><span class="badge teal">可預覽</span><button class="btn" data-action="preview">預覽路線 ${icon('arrow-up-right')}</button></article></div>`; }
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
  if (event.target.id === 'verification-form') {
    const form = new FormData(event.target);
    const status = form.get('verification_status');
    const publicationStatus = form.get('publication_status');
    const candidateSourceIds = form.getAll('source_id');
    const validSourceIds = form.getAll('valid_source_id');
    const invalidSourceIds = form.getAll('invalid_source_id');
    const payload = {
      verification_status: status,
      verification_level: form.get('verification_level'),
      citation_status: form.get('citation_status'),
      source_ids: status === 'supported' ? validSourceIds : candidateSourceIds,
      source_ids_checked: [...new Set([...validSourceIds, ...invalidSourceIds])],
      valid_source_ids: validSourceIds,
      invalid_source_ids: invalidSourceIds,
      risk_flags: form.getAll('risk_flag'),
      reason: form.get('reason'),
      publication_status: publicationStatus,
    };
    try {
      const result = await api(`/api/claims/${state.statusChange.claimId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      state.claims = state.claims.map(item => item.id === result.claim.id ? result.claim : item);
      state.frontendResult = null;
      state.statusChange = null;
      render();
      showToast('最終核驗結論已保存；請執行 Coordinator 更新前端結果。');
    } catch (error) {
      showToast(error.message === 'public_claim_requires_clean_supported_verification' ? '可公開需要已支持結論與無風險來源。' : '核驗結論不符合結構規則。');
    }
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
  if (projectId) { state.projectId = projectId; await loadClaims(); await loadSources(); await loadPublications(); await loadFrontendResult(); setTab('overview'); return; }
  const claimId = event.target.closest('[data-claim]')?.dataset.claim;
  if (claimId) { await changeClaim(Number(claimId)); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'run-workflow') {
    try {
      const result = await api(`/api/projects/${currentProject().id}/workflow`, { method: 'POST', body: JSON.stringify({}) });
      state.frontendResult = result.frontend_result;
      render();
      showToast(result.frontend_result.workflow.status === 'finished' ? 'Coordinator 已完成，資料可進入發布。' : 'Coordinator 已完成，請處理人工審核佇列。');
    } catch (_) {
      showToast('輸出未通過完整性驗證，已標記為需要處理。');
    }
    return;
  }
  if (action === 'close-modal') { state.modal = null; state.statusChange = null; state.publicationPreview = null; state.guidedDraft = false; render(); return; }
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
      const messages = { ai_unconfigured: '模型尚未配置，請只在伺服器環境檔設定金鑰。', no_sources: '請先加入至少一條來源資料。', ai_authentication_failed: '模型憑據無效或不適用於此服務端，請由管理員檢查後端設定。', ai_rate_limited: '模型服務暫時達到用量限制，請稍後重試。', ai_provider_rejected: '模型服務拒絕了這次請求，請由管理員檢查模型與端點設定。', ai_unavailable: '模型服務暫時無法連線，請稍後重試。', invalid_model_output: '模型未返回可核驗格式，草稿沒有寫入資料庫。' };
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
  const first = state.sources[0];
  const second = state.sources[1] || first;
  return {
    draft_id: 'guided-preview',
    model: 'Qwen / Paw-Archivist 引導示例',
    draft: {
      summary: `Qwen 會先把「${project.name}」的 ${state.sources.length} 條現有來源拆成可核驗欄位。以下是基於目前來源的候選，不是已確認事實。`,
      claims: [
        { claim: `${project.name} 的「${project.year}」年份線索需要來源核驗`, evidence_excerpt: first?.excerpt || '尚未有可用來源摘錄。', source_indexes: [1], verification_note: `請由 Verifier 對照「${first?.title || '來源 01'}」，確認年份可否作公開敘述。` },
        { claim: `${project.name} 的街坊記憶可作為候選文化敘述`, evidence_excerpt: second?.excerpt || '尚未有第二條來源摘錄。', source_indexes: [Math.min(2, Math.max(1, state.sources.length))], verification_note: `須確認「${second?.title || '來源 01'}」的公開範圍與引述方式。` },
      ],
    },
  };
}

function sourceCount() {
  return state.sources.length;
}

function legacyGuidedRenderOverview(project) {
  const summary = state.frontendResult?.summary;
  const pending = summary?.review_required ?? state.claims.filter(claim => claim.status === 'pending').length;
  const publicCount = summary?.supported ?? state.claims.filter(claim => claim.status === 'public').length;
  const aiState = state.aiStatus.configured ? `已連接 ${escapeHtml(state.aiStatus.model)}` : '引導模式可用；真實模型待伺服器配置';
  return `<section class="admin-guide"><div><p class="record-kicker">從左到右完成一次可交付建檔</p><h2>你現在要做什麼？</h2><p>先整理來源，再讓 Qwen 產生有回鏈的候選，最後由 Verifier 決定可否公開。系統不會把模型文字直接發布。</p></div><div class="admin-guide-status"><span>Qwen / Paw-Archivist</span><strong>${aiState}</strong></div></section><section class="admin-flow" aria-label="管理操作流程"><button data-tab="archive"><b>01</b><span>整理來源</span><small>${sourceCount()} 條資料可供建檔</small></button><button data-tab="archive"><b>02</b><span>Qwen 建檔</span><small>抽取候選欄位與來源編號</small></button><button data-tab="verify"><b>03</b><span>人工核驗</span><small>${pending} 項等待決定公開邊界</small></button><button data-tab="district"><b>04</b><span>落到街區</span><small>查看位置與補訪優先級</small></button><button data-tab="publish"><b>05</b><span>生成成品</span><small>G / B / C 只使用可公開內容</small></button></section><section class="metrics"><div class="metric"><div class="metric-label">已入庫來源</div><div class="metric-value">${sourceCount()}</div><div class="metric-note">公開資料與訪談素材</div></div><div class="metric"><div class="metric-label">Qwen 候選</div><div class="metric-value">${state.guidedDraft ? '02' : '—'}</div><div class="metric-note">${state.guidedDraft ? '已等待人工採納' : '尚未執行建檔'}</div></div><div class="metric"><div class="metric-label">待確認項目</div><div class="metric-value">${pending}</div><div class="metric-note">需商戶或校對人處理</div></div><div class="metric"><div class="metric-label">可公開欄位</div><div class="metric-value">${publicCount}</div><div class="metric-note">可用於對外成品</div></div></section><div class="split"><section class="section"><div class="section-heading"><h2>目前個案</h2><button class="text-action" data-tab="archive">開始整理來源 ${icon('arrow-right')}</button></div><div class="fields"><div class="field-label">資產類型</div><div class="field-value">懷舊雪糕店 / 飲食文化</div><div class="field-label">所在街區</div><div class="field-value">${project.area}</div><div class="field-label">已知年份</div><div class="field-value">${project.year} <span class="badge amber">仍須來源回鏈</span></div><div class="field-label">發布規則</div><div class="field-value">只有 Verifier 標為「可公開」的欄位會進入 G / B / C 成品。</div></div></section><section class="section"><div class="section-heading"><h2>本次建議</h2><span class="badge teal">下一步</span></div><div class="admin-next-action"><b>先在「資料歸檔」跑一次 Qwen 建檔</b><span>你會看到 Qwen 讀了哪幾條來源、抽了哪些候選，以及採納後資料會去哪裡。</span><button class="btn btn-primary" data-tab="archive">前往 Qwen 工作台 ${icon('arrow-right')}</button></div></section></div>`;
}

function legacyGuidedRenderArchiveWithAi(project) {
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

function legacyGuidedRenderVerify() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  const rows = state.claims.length ? state.claims.map(claim => `<tr><td class="claim">${escapeHtml(claim.claim)}</td><td class="muted">${escapeHtml(claim.source)}</td><td>${badge(claim.status)}</td><td><button class="table-action" data-claim="${claim.id}">決定公開邊界 ${icon('chevron-right')}</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">尚未有核驗項目。先在資料歸檔頁採納一份 Qwen 草稿，或手動新增資料。</td></tr>';
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 03 · PAW-VERIFIER</p><h2>核驗審核</h2><p>Verifier 決定的是「能不能用、能在哪裡用」，不是讓模型決定真相。</p></div><div class="head-actions"><button class="btn" data-action="add-claim">手動新增資料</button><button class="btn btn-primary" data-tab="publish">查看可發布成品</button></div></div><section class="admin-verifier-rule"><b>每條候選的三個結果</b><span><i class="public"></i>可公開：能進 G / B / C</span><span><i class="pending"></i>待確認：保留但不可發布</span><span><i class="internal"></i>僅內部：研究留存、不對外顯示</span></section><div class="verify-summary"><div><strong>${publicCount}</strong><span>可公開欄位</span></div><div><strong>${pendingCount}</strong><span>待商戶確認</span></div><div><strong>${state.claims.filter(item => item.status === 'internal').length}</strong><span>僅內部使用</span></div></div><div class="table-scroll"><table class="verify-table"><thead><tr><th>資產敘述</th><th>證據來源 / Qwen 回鏈</th><th>目前狀態</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="verify-footer"><p>${icon('info')} 點擊「決定公開邊界」會循環切換可公開、待確認、僅內部，並由後端記錄操作者和時間。</p><button class="btn" data-action="report">${icon('file-down')} 匯出核驗清單</button></div>`;
}

function legacyGuidedRenderPublish() {
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 05 · DELIVERY</p><h2>發布與活化</h2><p>同一份核驗底稿，按不同使用者輸出；沒有可公開欄位時不應製作正式對外文案。</p></div><button class="btn btn-primary" data-action="publish" ${publicCount ? '' : 'disabled'}>${icon('send')} 建立對外版本</button></div><section class="admin-release-gate"><strong>${publicCount ? `已有 ${publicCount} 條可公開欄位` : '目前沒有可公開欄位'}</strong><span>${publicCount ? '可建立有清楚來源邊界的對外成品。' : '請先回到 Verifier，逐條決定哪些內容已可公開。'}</span><button class="text-action" data-tab="verify">前往核驗 ${icon('arrow-right')}</button></section><div class="publish-grid"><article class="publish-channel"><div class="channel-top"><span class="channel-letter">G</span><h3>街區決策工作單</h3></div><p>給文旅或社區單位：位置、補訪優先級、可公開比例與待辦。</p><span class="badge teal">使用真實地圖</span><button class="btn" data-tab="district">查看街區地圖 ${icon('map-pinned')}</button></article><article class="publish-channel channel-b"><div class="channel-top"><span class="channel-letter">B</span><h3>商戶確認內容包</h3></div><p>只列出已核驗的店舖事實與可用素材，讓商戶確認後再對外。</p><span class="badge ${publicCount ? 'green' : 'amber'}">${publicCount ? `${publicCount} 條可用` : '等待核驗'}</span><button class="btn" data-action="copy" ${publicCount ? '' : 'disabled'}>複製可確認文案 ${icon('copy')}</button></article><article class="publish-channel channel-c"><div class="channel-top"><span class="channel-letter">C</span><h3>城市文化路線</h3></div><p>用地圖把可公開的文化點串成步行路線，待補證點保留核驗提示。</p><span class="badge teal">可預覽</span><button class="btn" data-tab="district">預覽路線位置 ${icon('map')}</button></article></div>`;
}

function legacyGuidedRenderDistrict() {
  const filter = state.districtFilter;
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 04 · DISTRICT OPERATIONS</p><h2>荷蘭園 / 水坑尾街區地圖</h2><p>這裡把核驗狀態放回實際地理底圖，讓採集與發布不只是一張表。</p></div><div class="filter-group"><button class="filter ${filter === 'all' ? 'is-active' : ''}" data-district-filter="all">全部資產</button><button class="filter ${filter === 'pending' ? 'is-active' : ''}" data-district-filter="pending">待核驗</button><button class="filter ${filter === 'public' ? 'is-active' : ''}" data-district-filter="public">可公開</button></div></div><div class="district-layout"><section class="admin-map-shell"><div class="admin-map-title"><div><strong>澳門實際地理底圖</strong><span>演示位置；正式發布前請以商戶授權座標覆核</span></div><b>${filter === 'all' ? '3 個資產' : filter === 'pending' ? '2 個待辦' : '1 個可公開'}</b></div><div id="admin-live-map" class="admin-live-map" aria-label="澳門街區文化資產互動地圖"></div><div class="admin-map-legend"><span><i class="public"></i>可公開</span><span><i class="pending"></i>待確認</span><span><i class="internal"></i>需復核</span></div></section><aside><section class="section"><div class="section-heading"><h2>地圖怎麼用</h2></div><div class="admin-map-instruction"><div><b>1</b><span>點擊標記，查看該店的核驗狀態與下一步。</span></div><div><b>2</b><span>用篩選只看待補訪或已可發布的資產。</span></div><div><b>3</b><span>完成核驗後，位置可進入 G 端工作單與城市路線。</span></div></div></section><section class="section"><div class="section-heading"><h2>本期採集概況</h2></div><div class="queue"><div class="queue-row"><span class="queue-mark green">${icon('circle-check')}</span><div><div class="queue-title">${publicCount} 項可公開資料</div><div class="queue-note">可進入對外成品</div></div></div><div class="queue-row"><span class="queue-mark">${icon('clock-3')}</span><div><div class="queue-title">${pendingCount || 2} 項待補訪 / 授權</div><div class="queue-note">優先處理商戶確認與年份來源</div></div></div></div></section></aside></div>`;
}

function legacyInitAdminMap() {
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

function renderWorkflowStepper(workflow) {
  if (!workflow) return '<section class="admin-empty">尚未產生 stable contract。完成核驗後執行 Coordinator。</section>';
  const statusLabels = { completed: '已完成', pending: '待處理', running: '進行中', failed: '失敗' };
  return `<section class="admin-flow" aria-label="workflow steps">${workflow.steps.map((step, index) => `<div class="admin-flow-step is-${escapeHtml(step.status)}"><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(step.label)}</span><small>${escapeHtml(step.summary)}</small><em>${escapeHtml(statusLabels[step.status] || step.status)}</em></div>`).join('')}</section>`;
}

const verificationLabels = { supported: '已支持', partially_supported: '部分支持', unsupported: '不支持', unverifiable: '待補證' };
function rawClaimForCode(claimId) {
  return state.claims.find(item => (item.claim_code || `C${String(item.id).padStart(4, '0')}`) === claimId);
}

function workflowNextAction(result) {
  if (!result) return { title: '先建立服務端結果', detail: '來源與候選資料準備好後，執行 Coordinator 產生可供前端使用的核驗結果。', action: 'run-workflow', label: '執行 Coordinator' };
  if (result.review_queue?.length) return { title: `還有 ${result.summary.review_required} 個欄位需要處理`, detail: '先查看證據，再保存每個 Claim 的最終核驗結論；完成後重新執行 Coordinator。', tab: 'verify', label: '前往人工核驗' };
  if (result.publication?.safe_to_publish) return { title: '資料已通過發布闸门', detail: '所有欄位均具備可公開的核驗條件，可以進入成品輸出。', tab: 'publish', label: '查看發布成品' };
  return { title: '結果需要補充', detail: '目前沒有可直接發布的完整結果，請回到來源頁補齊證據。', tab: 'archive', label: '查看來源與 Qwen' };
}

function renderVerificationSummary(summary) {
  if (!summary) return '';
  return `<section class="metrics" aria-label="核驗摘要"><div class="metric"><div class="metric-label">總核驗項目</div><div class="metric-value">${summary.total_claims}</div><div class="metric-note">服務端 contract</div></div><div class="metric"><div class="metric-label">已支持</div><div class="metric-value">${summary.supported}</div><div class="metric-note">可作為已核驗資料</div></div><div class="metric"><div class="metric-label">部分支持</div><div class="metric-value">${summary.partially_supported}</div><div class="metric-note">需要保留風險標記</div></div><div class="metric is-attention"><div class="metric-label">待人工處理</div><div class="metric-value">${summary.review_required}</div><div class="metric-note">先完成核驗再發布</div></div></section>`;
}

function renderAssetCard(assetCard) {
  if (!assetCard) return '';
  const labels = { basic_info: '基本資料', products: '產品', persons: '人物', key_events: '重要事件', operations: '營運資料' };
  const sections = Object.entries(assetCard).filter(([, entries]) => entries.length).map(([key, entries]) => `<div class="asset-card-group"><div class="asset-card-group-title">${escapeHtml(labels[key])}</div><div class="fields">${entries.map(entry => `<div class="field-label">${escapeHtml(entry.label || labels[key])}</div><div class="field-value">${escapeHtml(entry.value)} <span class="badge ${entry.verification_status === 'supported' ? 'green' : 'amber'}">${escapeHtml(verificationLabels[entry.verification_status] || entry.verification_status)}</span></div>`).join('')}</div></div>`).join('');
  return `<section class="section"><div class="section-heading"><h2>文化資產卡</h2><span class="badge teal">服務端結果</span></div>${sections || '<p class="muted">尚未有可呈現的欄位。</p>'}</section>`;
}

function renderReviewQueue(queue) {
  if (!queue?.length) return '<section class="section"><div class="section-heading"><h2>人工審核佇列</h2><span class="badge green">無阻擋項目</span></div></section>';
  return `<section class="section"><div class="section-heading"><div><h2>人工審核佇列</h2><p>每一項都可以直接開啟對應的最終核驗表單。</p></div><span class="badge amber">${queue.length} 項</span></div><div class="queue">${queue.map(item => { const claim = rawClaimForCode(item.claim_id); return `<div class="queue-row"><span class="queue-mark">${icon('circle-alert')}</span><div><div class="queue-title">${escapeHtml(item.title)}</div><div class="queue-note">${escapeHtml(item.claim_id)} · ${escapeHtml(item.description)}</div></div>${claim ? `<button class="table-action" data-action="request-status" data-claim-id="${claim.id}" data-status="${escapeHtml(claim.status)}">處理 ${icon('arrow-right')}</button>` : ''}</div>`; }).join('')}</div></section>`;
}

function renderClaimEvidenceDrawer() {
  const claim = state.frontendResult?.claims.find(item => item.claim_id === state.evidenceClaimId);
  if (!claim) return '';
  const sources = state.frontendResult.sources.filter(source => claim.source_ids.includes(source.source_id));
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><header><div><div class="record-kicker">CLAIM EVIDENCE</div><h2 id="evidence-title">${escapeHtml(claim.label)}</h2></div><button class="icon-button" aria-label="關閉" data-action="close-evidence">${icon('x')}</button></header><p>${escapeHtml(claim.reason || '尚未提供核驗理由。')}</p><div class="admin-draft-list">${sources.map(source => `<article class="admin-draft-claim"><h3>${escapeHtml(source.title)}</h3><p>${escapeHtml(source.publisher)} · ${escapeHtml(source.verification_ceiling)}</p><footer><b>${escapeHtml(source.source_id)}</b></footer></article>`).join('') || '<p class="muted">此項沒有可定位來源。</p>'}</div></section></div>`;
}

function renderModal() {
  return state.evidenceClaimId ? renderClaimEvidenceDrawer() : renderModalBase();
}

function renderOverview(project) {
  const result = state.frontendResult;
  const next = workflowNextAction(result);
  const nextButton = next.tab ? `<button class="btn btn-primary" data-tab="${next.tab}">${icon('arrow-right')} ${next.label}</button>` : `<button class="btn btn-primary" data-action="${next.action}" ${can(['admin', 'archivist', 'verifier']) ? '' : 'disabled'}>${icon('shield-check')} ${next.label}</button>`;
  return `<section class="admin-guide"><div><p class="record-kicker">FRONTEND RESULT · ${result ? escapeHtml(result.workflow.status) : 'PENDING'}</p><h2>${escapeHtml(project.name)} 核驗工作流</h2><p>所有摘要、風險與發布判定均由 Coordinator 的穩定 contract 提供。</p></div><div class="admin-guide-status"><span>目前帳戶：${escapeHtml(state.user?.role || 'viewer')}</span>${result ? `<strong>${result.publication.safe_to_publish ? '可以發布' : '需要人工處理'}</strong>` : '<strong>尚未執行</strong>'}<button class="btn btn-primary" data-action="run-workflow" ${can(['admin', 'archivist', 'verifier']) ? '' : 'disabled'}>${icon('shield-check')} ${result ? '重新整理結果' : '執行 Coordinator'}</button></div></section>${renderWorkflowStepper(result?.workflow)}<section class="admin-next-action"><div><span class="record-kicker">下一步</span><strong>${escapeHtml(next.title)}</strong><p>${escapeHtml(next.detail)}</p></div>${nextButton}</section>${renderVerificationSummary(result?.summary)}<div class="split"><div>${renderAssetCard(result?.asset_card)}</div><div>${renderReviewQueue(result?.review_queue)}</div></div>`;
}

document.addEventListener('click', event => {
  const evidenceClaimId = event.target.closest('[data-evidence-claim]')?.dataset.evidenceClaim;
  if (evidenceClaimId) {
    state.evidenceClaimId = evidenceClaimId;
    render();
    return;
  }
  if (event.target.closest('[data-action="close-evidence"]')) {
    state.evidenceClaimId = null;
    render();
  }
});

async function acceptGuidedDraft() {
  const draft = state.aiDraft;
  if (!draft) return;
  try {
    const created = [];
    for (const item of draft.draft.claims) {
      const sourceIds = item.source_indexes.map(index => state.sources[index - 1]).filter(Boolean).map(source => `S${source.id}`);
      const result = await api('/api/claims', { method: 'POST', body: JSON.stringify({ project_id: currentProject().id, claim: item.claim, source: `Qwen 引導草稿 · 來源 #${item.source_indexes.join('、#')} · ${item.evidence_excerpt}`, field: item.field || 'basic_info', extraction_status: 'extracted', source_ids: sourceIds }) });
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
  return `<main class="login-page"><section class="login-card"><span class="login-mark">${icon('landmark')}</span><div class="record-kicker">QWENPAW HERITAGE TRACE</div><h1>文化資產工作台</h1><p>這是供 Archivist、Verifier 與發布人員使用的內部工作區。登入後依序完成「來源 → Qwen 候選 → 人工核驗 → 地圖 → 成品」。</p><div class="login-workflow"><span>01 來源</span><span>02 Qwen</span><span>03 核驗</span><span>04 地圖</span><span>05 成品</span></div><form id="login-form" class="login-form"><label>帳戶<input name="username" autocomplete="username" required></label><label>密碼<input type="password" name="password" autocomplete="current-password" required></label>${state.loginError ? `<div class="form-error" role="alert">${state.loginError}</div>` : ''}<button class="btn btn-primary" type="submit">${icon('log-in')} 登入工作台</button></form><a class="login-guide-link" href="guide.html">${icon('circle-help')} 查看操作教程</a><div class="login-note">僅限受邀帳戶 · 所有新增、核驗與發布操作均會記錄在伺服器資料庫</div></section></main>`;
}

function renderSidebar() {
  const workflow = [
    ['overview', '01', '工作總覽', '看下一步要做什麼', 'layout-dashboard'],
    ['archive', '02', '來源與 Qwen', '整理來源、生成候選', 'sparkles'],
    ['verify', '03', 'Paw-Verifier', '決定公開邊界', 'shield-check'],
    ['district', '04', '街區地圖', '安排補訪與位置', 'map-pinned'],
    ['publish', '05', '發布成品', '輸出 G / B / C', 'send'],
  ];
  const reviewCount = state.frontendResult?.summary?.review_required ?? state.claims.filter(claim => claim.status === 'pending').length;
  return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('landmark')}</span><div><div class="brand-name">澳憶・千尋</div><div class="brand-sub">城市文化資產工作台</div></div></div><section class="sidebar-section"><div class="sidebar-label"><span>試點項目</span><button title="新增項目" aria-label="新增項目" data-action="new-project">${icon('plus')}</button></div><div class="project-list">${state.projects.map(project => `<button class="project-item ${project.id === state.projectId ? 'is-active' : ''}" data-project="${project.id}"><span class="project-sigil ${project.tone}">${icon(project.icon)}</span><span class="project-copy"><strong>${project.name}</strong><span>${project.area}</span></span>${project.pending ? `<span class="count">${project.pending}</span>` : ''}</button>`).join('')}</div></section><section class="sidebar-section"><div class="sidebar-label"><span>建檔工作流</span></div><nav class="nav-list admin-workflow-nav" aria-label="建檔工作流">${workflow.map(([id, number, label, note, glyph]) => `<button class="nav-item ${state.tab === id ? 'is-active' : ''}" data-tab="${id}"><b>${number}</b>${icon(glyph)}<span><strong>${label}</strong><small>${note}</small></span>${id === 'verify' && reviewCount ? `<em>${reviewCount}</em>` : ''}</button>`).join('')}</nav></section><div class="sidebar-bottom"><strong>${state.user.username} · ${state.user.role}</strong><span>${state.aiStatus.configured ? `Qwen 已設定：${escapeHtml(state.aiStatus.model)}` : '示範草稿模式：不會呼叫模型'}</span><a class="sidebar-guide-link" href="guide.html">${icon('circle-help')} 查看操作教程</a><span>所有核驗與發布動作都會記錄。</span></div></aside>`;
}

function renderRecordHead(project) {
  return `<section class="record-head"><div class="record-image"><img src="assets/heritage-cover.jpeg" alt="澳門老街文化記憶插畫"></div><div><div class="record-kicker">文化資產個案 · 已登入內部工作區</div><h1>${project.name}</h1><div class="record-meta">${project.area} · 已知年份 ${project.year} · 資料完整度 ${project.completeness}%</div></div><div class="head-actions"><button class="btn" data-tab="archive">${icon('sparkles')} 來源與 Qwen</button><button class="btn btn-primary" data-tab="verify">${icon('shield-check')} 前往人工核驗</button></div></section>`;
}

function can(roleSet) {
  return roleSet.includes(state.user?.role) || state.user?.role === 'admin';
}

function sourceRights(status) {
  const labels = { cleared: '可供模型引用', pending: '權利待確認', internal: '僅內部' };
  return `<span class="badge ${status === 'cleared' ? 'green' : status === 'internal' ? 'red' : 'amber'}">${labels[status] || status}</span>`;
}

function renderModalBase() {
  if (state.statusChange) {
    const claim = state.claims.find(item => item.id === state.statusChange.claimId);
    const labels = { public: '可公開', pending: '待確認', internal: '僅內部' };
    const sourceOptions = state.sources.map(source => `<option value="S${source.id}">${escapeHtml(source.title)}</option>`).join('');
    const isPublic = state.statusChange.status === 'public';
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="status-modal-title"><header><div><div class="record-kicker">Paw-Verifier · 最終核驗結論</div><h2 id="status-modal-title">${labels[state.statusChange.status]}</h2></div><button class="icon-button" aria-label="關閉" data-action="close-modal">${icon('x')}</button></header><div class="admin-status-confirm"><strong>${escapeHtml(claim?.claim || '')}</strong><span>${escapeHtml(claim?.source || '')}</span></div><form id="verification-form" class="modal-form"><label>核驗結論<select name="verification_status"><option value="supported" ${isPublic ? 'selected' : ''}>已支持</option><option value="partially_supported">部分支持</option><option value="unsupported">不支持</option><option value="unverifiable" ${isPublic ? '' : 'selected'}>不可核驗</option></select></label><label>核驗等級<select name="verification_level"><option value="source_evidence" ${isPublic ? 'selected' : ''}>原始來源證據</option><option value="search_extract">搜尋摘要</option><option value="insufficient_evidence" ${isPublic ? '' : 'selected'}>證據不足</option></select></label><label>引文狀態<select name="citation_status"><option value="correct" ${isPublic ? 'selected' : ''}>對應正確</option><option value="partially_incorrect">部分不正確</option><option value="not_checked" ${isPublic ? '' : 'selected'}>尚未核對</option></select></label><label>候選來源<select name="source_id" multiple size="3">${sourceOptions}</select></label><label>有效來源<select name="valid_source_id" multiple size="3">${sourceOptions}</select></label><label>無效來源<select name="invalid_source_id" multiple size="3">${sourceOptions}</select></label><fieldset><legend>風險標記</legend><label><input type="checkbox" name="risk_flag" value="source_conflict">來源衝突</label><label><input type="checkbox" name="risk_flag" value="time_context_loss">時間語境缺失</label><label><input type="checkbox" name="risk_flag" value="citation_error">引文錯誤</label><label><input type="checkbox" name="risk_flag" value="insufficient_locator">來源定位不足</label><label><input type="checkbox" name="risk_flag" value="authorization_risk">公開授權風險</label></fieldset><label>理由<textarea name="reason" maxlength="800" required placeholder="只保留最終結論；不要填寫初始判斷或修正過程。"></textarea></label><input type="hidden" name="publication_status" value="${state.statusChange.status}"><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存核驗結論</button></div></form></section></div>`;
  }
  if (state.modal === 'ai-draft') return renderAiDraftModal();
  if (state.modal === 'source') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title"><header><div><div class="record-kicker">來源歸檔</div><h2 id="source-modal-title">新增一條可追溯來源</h2></div><button class="icon-button" aria-label="關閉" data-action="close-modal">${icon('x')}</button></header><p class="muted">這條來源會先保存為素材，不會自動變成可公開事實。</p><form id="source-form" class="modal-form"><label>資料名稱<input name="title" maxlength="180" required placeholder="例如：店主訪談 2026-08-03"></label><label>來源類型<input name="source_type" maxlength="60" required placeholder="訪談 / 報道 / 圖片 / 地圖"></label><label>證據摘錄<textarea name="excerpt" maxlength="1200" required placeholder="只寫來源中實際記錄的內容"></textarea></label><label>權利狀態<select name="rights_status"><option value="pending">權利待確認</option><option value="cleared">可供模型引用</option><option value="internal">僅內部</option></select></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存來源</button></div></form></section></div>`;
  if (state.modal === 'project') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"><header><div><div class="record-kicker">文化資產項目</div><h2 id="project-modal-title">新增項目</h2></div><button class="icon-button" aria-label="關閉" data-action="close-modal">${icon('x')}</button></header><form id="project-form" class="modal-form"><label>項目名稱<input name="name" maxlength="100" required></label><label>所在街區<input name="area" maxlength="120" required></label><label>創立年份<input name="year" maxlength="20" required></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">建立項目</button></div></form></section></div>`;
  if (state.modal === 'claim') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title"><header><div><div class="record-kicker">核驗資料</div><h2 id="claim-modal-title">手動新增核驗項目</h2></div><button class="icon-button" aria-label="關閉" data-action="close-modal">${icon('x')}</button></header><form id="claim-form" class="modal-form"><label>資產敘述<textarea name="claim" maxlength="500" required></textarea></label><label>證據來源<input name="source" maxlength="300" required></label><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">寫入待核驗</button></div></form></section></div>`;
  return '';
}

function renderArchiveWithAi(project) {
  const live = state.aiStatus.configured;
  const hasSources = state.sources.length > 0;
  const sourceRows = state.sources.map((source, index) => `<div class="admin-source-row"><b>${String(index + 1).padStart(2, '0')}</b><div><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.source_type)} · ${escapeHtml(source.excerpt)}</small></div>${sourceRights(source.rights_status)}</div>`).join('');
  const mode = live ? `真實 Qwen 已設定 · ${escapeHtml(state.aiStatus.model)}` : 'Qwen 引導模式 · 未傳送任何資料至模型';
  const primaryLabel = live ? '生成 Qwen 候選草稿' : '查看 Qwen 引導草稿';
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 01 / 02 · SOURCES TO VERIFIED CANDIDATES</p><h2>資料歸檔與 Qwen 建檔</h2><p>只會把下方已歸檔來源送入 Paw-Archivist；輸出一律是待人工採納與核驗的候選資料。</p></div><div class="head-actions"><button class="btn" data-action="new-source" ${can(['admin', 'archivist']) ? '' : 'disabled'}>${icon('file-plus-2')} 1. 新增來源</button><button class="btn" data-action="archive" ${project.archive_status === 'archived' || !can(['admin', 'archivist']) ? 'disabled' : ''}>${icon('archive')} 生成內部檔案</button></div></div><section class="admin-qwen-workbench"><div class="admin-qwen-intro"><p class="record-kicker">QWEN-PAW / PAW-ARCHIVIST</p><h2>先歸檔來源，再生成候選，最後交給人核驗。</h2><p>模型只能使用來源名稱、類型、證據摘錄與權利狀態；它不具備 Verifier 或發布權限。</p><div class="admin-qwen-rules"><span>1. 新增可追溯來源</span><span>2. 生成候選草稿</span><span>3. 採納後進入核驗</span></div></div><div class="admin-qwen-run"><span class="badge ${live ? 'green' : 'amber'}">${mode}</span><strong>${hasSources ? `目前可使用 ${state.sources.length} 條來源生成候選。` : '先新增至少一條來源，才可以開始建檔。'}</strong><button class="btn btn-primary" data-action="${live ? 'ai-draft' : 'guided-ai-draft'}" ${hasSources ? '' : 'disabled'}>${icon('sparkles')} ${primaryLabel}</button><small>${live ? 'Qwen 請求僅由伺服器發出；生成、採納與後續核驗均會寫入審計紀錄。' : '引導模式用本地示例說明格式，不會呼叫 Qwen；採納後仍是待核驗資料。'}</small></div></section><div class="admin-pipeline"><section><div class="admin-pipeline-head"><span>INPUT · 已歸檔來源</span><b>${state.sources.length} 條</b></div>${sourceRows || '<div class="admin-empty">尚未有來源。先點選「新增來源」，再生成 Qwen 候選。</div>'}</section><section><div class="admin-pipeline-head"><span>OUTPUT · 待核驗候選</span><b>不會直接發布</b></div><div class="admin-output-item"><span>候選欄位</span><strong>時間、地點、人物、文化標籤與權利邊界</strong></div><div class="admin-output-item"><span>證據回鏈</span><strong>每條候選都保留來源編號與證據摘錄</strong></div><div class="admin-output-item"><span>下一位處理人</span><strong>Verifier 對照原文，再決定公開範圍</strong></div></section></div><section class="admin-safe-note"><div>${icon('shield-check')}</div><p><strong>安全邊界：</strong>API Key 只在伺服器環境檔；瀏覽器拿不到 Key。任何 Qwen-Paw 輸出先是待核驗資料，不會自動變成公開事實。</p></section>`;
}

function renderVerify() {
  const result = state.frontendResult;
  const summary = result?.summary;
  const claims = result?.claims || [];
  const statusLabel = { supported: '已支持', partially_supported: '部分支持', unsupported: '不支持', unverifiable: '待補證' };
  const riskLabel = { source_conflict: '來源衝突', time_context_loss: '時間脈絡不足', citation_error: '引文需修正', insufficient_locator: '來源定位不足', authorization_risk: '授權待確認' };
  const rows = claims.length ? claims.map(claim => {
    const rawClaim = state.claims.find(item => (item.claim_code || `C${String(item.id).padStart(4, '0')}`) === claim.claim_id);
    const reviewAction = rawClaim ? `<button class="table-action" data-action="request-status" data-claim-id="${rawClaim.id}" data-status="${escapeHtml(rawClaim.status)}">開始核驗</button>` : '<span class="muted">—</span>';
    return `<tr><td class="claim"><button class="table-action" data-evidence-claim="${escapeHtml(claim.claim_id)}">${escapeHtml(claim.label)}</button></td><td class="muted">${escapeHtml(claim.valid_source_ids.join('、') || '未提供可定位來源')}</td><td><span class="badge ${claim.verification_status === 'supported' ? 'green' : 'amber'}">${escapeHtml(statusLabel[claim.verification_status])}</span></td><td>${claim.risk_flags.length ? escapeHtml(claim.risk_flags.map(flag => riskLabel[flag] || flag).join('、')) : '—'}</td><td>${reviewAction}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="muted">尚未生成可供前端使用的核驗結果。先完成資料核驗，再執行 Coordinator。</td></tr>';
  const queue = result?.review_queue || [];
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 03 · PAW-VERIFIER</p><h2>核驗審核</h2><p>核驗狀態、風險標記與發布判定均由服務端 Coordinator 生成；頁面不自行推導。</p></div><div class="head-actions"><button class="btn" data-action="add-claim" ${can(['admin', 'archivist']) ? '' : 'disabled'}>手動新增資料</button><button class="btn" data-action="export-claims">${icon('file-down')} 匯出 CSV</button><button class="btn btn-primary" data-action="run-workflow" ${can(['admin', 'archivist', 'verifier']) ? '' : 'disabled'}>${icon('shield-check')} 執行 Coordinator</button></div></div><div class="verify-summary"><div><strong>${summary?.supported ?? '—'}</strong><span>已支持欄位</span></div><div><strong>${summary?.review_required ?? '—'}</strong><span>需要人工處理</span></div><div><strong>${summary?.unverifiable ?? '—'}</strong><span>尚不可核驗</span></div></div><div class="table-scroll"><table class="verify-table"><thead><tr><th>資產敘述</th><th>有效來源</th><th>核驗狀態</th><th>風險標記</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${queue.length ? `<section class="section"><div class="section-heading"><h2>人工審核佇列</h2><span class="badge amber">${queue.length} 項</span></div><div class="queue">${queue.map(item => { const rawClaim = state.claims.find(claim => (claim.claim_code || `C${String(claim.id).padStart(4, '0')}`) === item.claim_id); return `<div class="queue-row"><span class="queue-mark">${icon('circle-alert')}</span><div><div class="queue-title">${escapeHtml(item.title)}</div><div class="queue-note">${escapeHtml(item.claim_id)} · ${escapeHtml(item.description)}</div></div>${rawClaim ? `<button class="table-action" data-action="request-status" data-claim-id="${rawClaim.id}" data-status="${escapeHtml(rawClaim.status)}">處理</button>` : ''}</div>`; }).join('')}</div></section>` : ''}`;
}

function renderPublish() {
  const publication = state.frontendResult?.publication;
  const publicCount = state.frontendResult?.summary?.supported ?? state.claims.filter(item => item.status === 'public').length;
  const safeToPublish = publication?.safe_to_publish === true;
  const publicationCards = state.publications.map(publication => `<article class="admin-publication-row"><div><b>${publication.channel} · ${escapeHtml(publication.content.title)}</b><span>${escapeHtml(publication.created_at)} · 已保存版本</span></div><button class="table-action" data-publication-id="${publication.id}">查看内容</button></article>`).join('');
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 05 · DELIVERY</p><h2>發布與活化</h2><p>發布闸门只读取 Coordinator 的 stable contract；浏览器不自行决定可否发布。</p></div><button class="btn" data-action="export-claims">${icon('file-down')} 匯出核驗清單</button></div><section class="admin-release-gate"><strong>${safeToPublish ? `已有 ${publicCount} 條可發布欄位` : '目前仍需人工審核'}</strong><span>${safeToPublish ? '可以生成 G / B / C 版本。' : `尚有 ${publication?.blocking_claim_ids?.length ?? '—'} 條資料阻擋發布。`}</span><button class="text-action" data-tab="verify">前往核驗 ${icon('arrow-right')}</button></section><div class="publish-grid"><article class="publish-channel"><div class="channel-top"><span class="channel-letter">G</span><h3>街區決策工作單</h3></div><p>給文旅或社區單位：位置、補訪優先級、可公開比例與待辦。</p><span class="badge teal">服務端資料生成</span><button class="btn" data-action="generate-publication" data-channel="G" ${safeToPublish && can(['admin', 'publisher']) ? '' : 'disabled'}>生成 G 版本 ${icon('file-plus-2')}</button></article><article class="publish-channel channel-b"><div class="channel-top"><span class="channel-letter">B</span><h3>商戶確認內容包</h3></div><p>只列出已核驗的店舖事實與可用素材，生成后可让商户逐项确认。</p><span class="badge ${safeToPublish ? 'green' : 'amber'}">${safeToPublish ? `${publicCount} 條可用` : '等待核驗'}</span><button class="btn" data-action="generate-publication" data-channel="B" ${safeToPublish && can(['admin', 'publisher']) ? '' : 'disabled'}>生成 B 版本 ${icon('file-plus-2')}</button></article><article class="publish-channel channel-c"><div class="channel-top"><span class="channel-letter">C</span><h3>城市文化路線</h3></div><p>用真实项目位置串成路线，待补证站点会保留研究提示。</p><span class="badge teal">服務端資料生成</span><button class="btn" data-action="generate-publication" data-channel="C" ${safeToPublish && can(['admin', 'publisher']) ? '' : 'disabled'}>生成 C 版本 ${icon('file-plus-2')}</button></article></div>${state.publications.length ? `<section class="admin-publications"><div class="section-heading"><h2>已保存发布版本</h2><span class="badge green">${state.publications.length} 个</span></div>${publicationCards}</section>` : '<section class="admin-empty admin-publish-empty">生成后，版本会出现在这里并可继续审计。</section>'}`;
}

function renderCurrentDistrict() {
  const filter = state.districtFilter;
  const projects = state.projects.filter(project => project.latitude && project.longitude);
  const publicCount = state.claims.filter(item => item.status === 'public').length;
  const pendingCount = state.claims.filter(item => item.status === 'pending').length;
  return `<div class="toolbar"><div class="toolbar-copy"><p class="record-kicker">STEP 04 · DISTRICT OPERATIONS</p><h2>荷蘭園 / 水坑尾街區地圖</h2><p>地图标记来自项目坐标和核验统计；点击项目查看现场下一步。</p></div><div class="filter-group"><button class="filter ${filter === 'all' ? 'is-active' : ''}" data-district-filter="all">全部資產</button><button class="filter ${filter === 'pending' ? 'is-active' : ''}" data-district-filter="pending">待核驗</button><button class="filter ${filter === 'public' ? 'is-active' : ''}" data-district-filter="public">可公開</button></div></div><div class="district-layout"><section class="admin-map-shell"><div class="admin-map-title"><div><strong>澳門實際地理底圖</strong><span>演示坐标已写入项目数据；正式发布前请用授权坐标替换</span></div><b>${projects.length} 个已定位项目</b></div><div id="admin-live-map" class="admin-live-map" aria-label="澳門街區文化資產互動地圖"></div><div class="admin-map-legend"><span><i class="public"></i>可公開</span><span><i class="pending"></i>待確認</span><span><i class="internal"></i>需復核</span></div></section><aside><section class="section"><div class="section-heading"><h2>地图怎麼用</h2></div><div class="admin-map-instruction"><div><b>1</b><span>点击标记查看项目、位置、公开数量和下一步。</span></div><div><b>2</b><span>用筛选只看待补访或可公开项目。</span></div><div><b>3</b><span>完成核验后，项目才会进入 G / B / C 发布。</span></div></div></section><section class="section"><div class="section-heading"><h2>当前个案</h2></div><div class="queue"><div class="queue-row"><span class="queue-mark green">${icon('circle-check')}</span><div><div class="queue-title">${publicCount} 项可公开资料</div><div class="queue-note">可进入对外成品</div></div></div><div class="queue-row"><span class="queue-mark">${icon('clock-3')}</span><div><div class="queue-title">${pendingCount} 项待补证</div><div class="queue-note">优先处理授权和来源</div></div></div></div></section></aside></div>`;
}

function initAdminMap() {
  const target = document.querySelector('#admin-live-map');
  if (!target || !window.L) return;
  const projects = state.projects.filter(project => project.latitude && project.longitude).filter(project => {
    const publicCount = Number(project.public_count || 0);
    return state.districtFilter === 'all' || (state.districtFilter === 'public' ? publicCount > 0 : Number(project.pending_count || project.pending || 0) > 0);
  });
  adminMap = window.L.map(target, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(adminMap);
  projects.forEach(project => {
    const publicCount = Number(project.public_count || 0);
    const pendingCount = Number(project.pending_count || project.pending || 0);
    const status = publicCount ? '可公開' : pendingCount ? '待確認' : '需復核';
    const color = publicCount ? '#2f625f' : pendingCount ? '#b87923' : '#a54739';
    window.L.circleMarker([project.latitude, project.longitude], { radius: 9, color: '#fffdf8', weight: 2, fillColor: color, fillOpacity: 1 }).bindPopup(`<strong>${escapeHtml(project.name)}</strong><br><span>${escapeHtml(project.area)} · ${status}</span><br><small>${publicCount} 项可公开 · ${pendingCount} 项待确认</small>`).addTo(adminMap);
  });
  if (projects.length) adminMap.fitBounds(projects.map(project => [project.latitude, project.longitude]), { padding: [32, 32], maxZoom: 15 });
  else adminMap.setView([22.198, 113.545], 14);
  window.setTimeout(() => adminMap?.invalidateSize(), 0);
}
