const demoSteps = [
  { id: 1, label: '項目建立', note: '找回既有記錄' },
  { id: 2, label: '初始診斷', note: '明確資料缺口' },
  { id: 3, label: '補證資料', note: '保留素材與權限' },
  { id: 4, label: '文化資產卡', note: '建檔與來源核驗' },
  { id: 5, label: 'G 端看板', note: '街區決策資料' },
  { id: 6, label: '活化輸出', note: 'G / B / C 成品' },
];

const demoProjects = [
  { name: '禮記雪糕', area: '荷蘭園 / 水坑尾', year: '1933', status: '已有資料，待補證', type: '懷舊雪糕店' },
  { name: '佛笑樓', area: '新馬路 / 營地大街', year: '1905', status: '待核驗', type: '百年飲食保存樣本' },
  { name: '龍華茶樓', area: '紅街市 / 望廈', year: '待查', status: '資料缺口', type: '傳統茶樓' },
];

const demoState = {
  step: 1,
  toast: '',
  selectedProject: '禮記雪糕',
  interviewPlanned: false,
  extraSourceAdded: false,
  traceOpen: false,
  cardRefreshed: false,
  dashboardFilter: 'all',
  outputPreview: '',
};

const selectedProject = () => demoProjects.find(project => project.name === demoState.selectedProject) || demoProjects[0];

function demoRender() {
  document.querySelector('#app').innerHTML = `
    <div class="demo-app">
      <header class="demo-header">
        <a class="demo-brand" href="#top"><span>澳憶・千尋</span><small>QWENPAW HERITAGE TRACE</small></a>
        <div class="demo-header-meta"><span class="demo-pill">比賽演示模式</span><span class="demo-case">案例：${selectedProject().name}</span><a href="admin.html">管理端</a></div>
      </header>
      <main id="top" class="demo-main">
        ${demoIntro()}
        <nav class="demo-steps" aria-label="六步演示流程">${demoSteps.map(step => `<button class="demo-step ${demoState.step === step.id ? 'is-active' : ''} ${demoState.step > step.id ? 'is-done' : ''}" data-step="${step.id}" aria-current="${demoState.step === step.id ? 'step' : 'false'}"><span>${String(step.id).padStart(2, '0')}</span><strong>${step.label}</strong><small>${step.note}</small></button>`).join('')}</nav>
        <section class="demo-surface" aria-live="polite">${demoStepContent()}</section>
      </main>
      ${demoState.toast ? `<div class="demo-toast" role="status"><strong>已更新</strong><span>${demoState.toast}</span></div>` : ''}
    </div>`;
}

function demoIntro() {
  return `<section class="demo-intro">
    <div class="demo-intro-copy"><p class="demo-kicker">澳門老字號文化資產普查</p><h1>把一間老店的故事，<br>變成可以被採信的文化資產。</h1><p class="demo-lead">以澳門老字號為試點，把公開資料、訪談與實地素材整理成可追溯、可授權、可再使用的文化記錄，為街區保育、商戶內容與旅客體驗提供同一份可信底稿。</p><div class="demo-intro-actions"><button class="demo-quiet-button" data-step="4">查看核心能力</button><span>6 步 · 3 種使用場景 · 1 份可回溯底稿</span></div></div>
    <figure class="demo-heritage-visual"><img src="assets/heritage-cover.jpeg" alt="澳門街區文化記憶插畫"><figcaption><span>澳門記憶 · 城市根脈</span><b>不生成故事，只整理證據。</b></figcaption></figure>
    <aside class="demo-truth"><strong>本次演示</strong><div><span>已實現核心</span><b>文化建檔 / 來源核驗</b></div><div><span>交互原型</span><b>採集、訪談、圖譜與活化輸出</b></div><p>所有示例資料僅供比賽展示，公開前仍需取得授權與人工確認。</p></aside>
  </section>`;
}

function demoStepContent() {
  return ({ 1: demoProject, 2: demoDiagnosis, 3: demoSources, 4: demoAssetCard, 5: demoDashboard, 6: demoOutputs })[demoState.step]();
}

function demoHeading(kicker, title, text, action = '') {
  return `<div class="demo-section-head"><div><p class="demo-kicker">${kicker}</p><h2>${title}</h2><p>${text}</p></div>${action}</div>`;
}

function demoNext(label = '進入下一步') {
  const completed = demoState.step - 1;
  return `<div class="demo-next"><span><b>${completed}</b> / 6 個環節已走完</span><button data-action="next">${label}<b>→</b></button></div>`;
}

function demoProject() {
  const project = selectedProject();
  return `${demoHeading('STEP 01 · 項目入口', '先確認這是不是一個已被記錄的故事。', '以店名、街區或品類搜尋；先避免重複建檔，再決定是建立新案還是補強現有記錄。')}<div class="demo-search-row"><label>店名或街區<input value="${project.name}" aria-label="店名或街區"></label><button data-action="search">檢索項目</button></div><div class="demo-project-grid">${demoProjects.map(item => `<button class="demo-project ${project.name === item.name ? 'is-selected' : ''}" data-project="${item.name}"><strong>${item.name}</strong><span>${item.area} · 創立於 ${item.year}</span><em>${item.status}</em></button>`).join('')}</div><div class="demo-selection-note"><span>目前示範個案</span><strong>${project.name}</strong><b>${project.type}</b><p>已有 ${project.name === '禮記雪糕' ? '4' : '2'} 條來源線索，先進入初始診斷。</p></div>${demoNext('查看初始診斷')}`;
}

function demoDiagnosis() {
  const plan = demoState.interviewPlanned ? '<span class="demo-state-ok">已加入補訪清單</span>' : '<button class="demo-inline-action" data-action="plan-interview">加入補訪清單</button>';
  return `${demoHeading('STEP 02 · 初始診斷', '先說清楚知道甚麼，還缺甚麼。', 'Paw-Miner 整理已知線索與缺口，將未證實內容轉成下一次採集要問的問題，而不是直接生成一段看似完整的故事。')}<div class="demo-two-col"><section class="demo-panel"><div class="demo-panel-title"><h3>目前可引用資料</h3><span>4 項</span></div><ul class="demo-checks"><li>公開報道與店舖歷史線索</li><li>地圖 POI 與街區位置</li><li>懷舊甜品品類標籤</li><li>創立年份：1933</li></ul></section><section class="demo-panel demo-panel-amber"><div class="demo-panel-title"><h3>待補證問題</h3><span>4 項</span></div><ol class="demo-gaps"><li>老顧客與街坊的共同記憶</li><li>家族傳承與經營細節</li><li>歷史照片的使用權限</li><li>可公開與僅內部的邊界</li></ol></section></div><div class="demo-callout"><div><strong>下一次採集任務</strong><span>以「老顧客故事」為主題安排訪談，並向商戶確認公開範圍與影像授權。</span></div>${plan}</div>${demoNext('補上訪談與素材')}`;
}

function demoSources() {
  const extra = demoState.extraSourceAdded ? `<div class="demo-new-source"><b>街坊口述_補訪 01.txt</b><span>老顧客訪談 · 已加入 · 仍待同意公開</span><em>新增素材</em></div>` : '';
  return `${demoHeading('STEP 03 · 補證資料', '把「有人說過」變成可以追溯的資料。', '每一份記錄先保留來源、日期、授權和公開邊界；資料未被確認前，只能留在待核驗佇列。')}<div class="demo-upload-grid"><button data-action="add-source"><b>訪談文字</b><span>保留說話者、日期與同意範圍</span><small>加入示範素材</small></button><button data-action="add-source"><b>現場錄音</b><span>轉寫後回到原始檔案與時間點</span><small>加入示範素材</small></button><button data-action="add-source"><b>照片 / 菜單</b><span>先記錄持有人與使用授權</span><small>加入示範素材</small></button></div><div class="demo-source-list"><div><b>禮記雪糕_訪談摘錄.txt</b><span>店主訪談 · 已分段 · 待確認公開範圍</span><em>訪談</em></div><div><b>1933_創立年份_報道.pdf</b><span>公開報道 · 已加入來源鏈</span><em>公開資料</em></div><div><b>店面與舊包裝_06.jpg</b><span>實地素材 · 待標記使用權</span><em>圖片</em></div>${extra}</div>${demoNext('整理文化資產卡')}`;
}

function demoAssetCard() {
  const project = selectedProject();
  const trace = demoState.traceOpen ? `<aside class="demo-trace-panel"><div class="demo-trace-head"><div><p class="demo-kicker">SOURCE TRACE</p><h3>「1933 年創立」的來源回鏈</h3></div><button class="demo-icon-button" data-action="trace">關閉</button></div><div class="demo-trace-row"><span>01</span><div><b>《澳門日報》歷史專題</b><p>公開報道 · 創立年份記載</p></div><em>可公開</em></div><div class="demo-trace-row"><span>02</span><div><b>店主訪談摘錄 02</b><p>街坊回憶與代際消費故事</p></div><em class="wait">待確認</em></div><p class="demo-trace-note">Verifier 只會把來源足夠、公開範圍清楚的內容標為可公開。</p></aside>` : '';
  const refreshLabel = demoState.cardRefreshed ? '已按現有來源重新整理' : 'Paw-Archivist 重新整理';
  return `${demoHeading('STEP 04 · 文化資產卡', '讓每個欄位都有來源，也有公開邊界。', '這是目前可實作的核心：Paw-Archivist 進行結構化建檔，Paw-Verifier 對每一項敘述標記可信狀態。', '<span class="demo-implemented">已實現核心</span>')}<div class="demo-asset-tools"><span>資料版本：內部草稿 v0.3</span><button class="demo-inline-action" data-action="refresh-card">${refreshLabel}</button></div><div class="demo-asset-layout"><article class="demo-asset-card"><div class="demo-card-top"><p class="demo-kicker">CULTURAL ASSET CARD</p><span>內部草稿</span></div><h3>${project.name}</h3><dl><dt>類型</dt><dd>${project.type}</dd><dt>街區</dt><dd>${project.area}</dd><dt>創立年份</dt><dd>${project.year}</dd><dt>文化標籤</dt><dd><span>懷舊甜品</span><span>街坊記憶</span><span>代際消費</span></dd></dl><blockquote>「以前很多街坊都不是只來買雪糕，還會帶小朋友來。後來小朋友長大了，又帶自己的孩子回來。」<footer>訪談摘錄 02 · 待商戶確認公開範圍</footer></blockquote></article><aside class="demo-verifier"><div class="demo-verifier-head"><div><p class="demo-kicker">PAW-VERIFIER</p><h3>可信核驗</h3></div><span>4 項</span></div><div><b>1933 年創辦</b><span class="ok">可公開</span></div><div><b>三代顧客故事</b><span class="wait">待商戶確認</span></div><div><b>家族經營細節</b><span class="private">僅內部</span></div><div><b>歷史照片授權</b><span class="wait">待補證</span></div><button data-action="trace">${demoState.traceOpen ? '收起來源回鏈' : '查看來源回鏈'}</button></aside></div>${trace}${demoNext('查看街區活化看板')}`;
}

function demoDashboard() {
  const filter = demoState.dashboardFilter;
  const queue = filter === 'public' ? [['禮記雪糕', '1933 年創辦', '已可公開'], ['佛笑樓', '街區飲食記憶', '已可公開']] : filter === 'pending' ? [['禮記雪糕', '老顧客故事', '需商戶確認'], ['龍華茶樓', '開業年份', '來源衝突']] : [['禮記雪糕', '老顧客故事', '需商戶確認'], ['佛笑樓', '街區飲食記憶', '已可公開'], ['龍華茶樓', '開業年份', '來源衝突']];
  return `${demoHeading('STEP 05 · G 端文化資產看板', '一間店的資料，可以成為一個街區的決策基礎。', '政府或文旅單位不只看單一故事，而是看採集進度、補證優先級和街區主題關聯。')}<div class="demo-metrics"><div><strong>3</strong><span>已建檔商戶</span></div><div><strong>2</strong><span>可公開事項</span></div><div><strong>2</strong><span>優先補訪</span></div><div><strong>1</strong><span>來源衝突</span></div></div><div class="demo-dashboard-controls"><span>核驗篩選</span><button class="${filter === 'all' ? 'is-active' : ''}" data-dashboard="all">全部</button><button class="${filter === 'pending' ? 'is-active' : ''}" data-dashboard="pending">待處理</button><button class="${filter === 'public' ? 'is-active' : ''}" data-dashboard="public">可公開</button></div><div class="demo-two-col"><section class="demo-panel"><h3>優先處理清單</h3><div class="demo-rows">${queue.map(row => `<div><b>${row[0]}</b><span>補證：${row[1]}</span><em>${row[2]}</em></div>`).join('')}</div></section><section class="demo-panel demo-map-panel"><div class="demo-map-label">街區主題關聯</div><div class="demo-map-dot demo-map-one">禮記雪糕</div><div class="demo-map-dot demo-map-two">佛笑樓</div><div class="demo-map-dot demo-map-three">龍華茶樓</div><b>老澳門飲食記憶</b><span>荷蘭園 · 水坑尾 · 新馬路</span></section></div>${demoNext('查看活化輸出')}`;
}

function demoOutputs() {
  const preview = demoOutputPreview();
  return `${demoHeading('STEP 06 · 活化輸出', '同一張文化資產卡，服務三種真實使用場景。', '底層資料只建一次；不同對象只取用已核驗且已授權的欄位，避免故事在傳播中失真。')}<div class="demo-output-grid"><article><strong>G</strong><h3>文化資產看板</h3><p>街區普查、採集進度、補訪優先級與保育路線規劃。</p><button data-output="G">預覽 G 端結果</button></article><article><strong>B</strong><h3>商戶內容包</h3><p>經商戶確認的品牌故事、三語簡介、POI 與社媒素材。</p><button data-output="B">預覽 B 端結果</button></article><article><strong>C</strong><h3>城市故事路線</h3><p>把可公開故事轉成旅客可以走進去的街區體驗。</p><button data-output="C">預覽 C 端結果</button></article></div>${preview}<div class="demo-finish"><strong>演示完成</strong><span>不是讓系統編出更多故事，而是讓故事可以被理解、查詢、核驗和重新使用。</span><button data-action="restart">重新開始</button></div>`;
}

function demoOutputPreview() {
  if (!demoState.outputPreview) return '';
  const copy = {
    G: ['G 端文化資產看板', '荷蘭園 / 水坑尾', '3 間店舖完成初步建檔；優先處理 2 項商戶確認與 1 項來源衝突。', '供街區保育與採集資源排程使用。'],
    B: ['B 端商戶內容包', '禮記雪糕 · 已核驗欄位', '1933 年創立；位於荷蘭園 / 水坑尾；承載本地懷舊甜品與街坊記憶。', '未確認的家族故事與照片不會出現在對外文案。'],
    C: ['C 端故事路線', '老澳門飲食記憶', '禮記雪糕 → 佛笑樓 → 龍華茶樓', '每一站只顯示有來源、可公開的故事片段。'],
  }[demoState.outputPreview];
  return `<section class="demo-output-preview"><div><p class="demo-kicker">${demoState.outputPreview} OUTPUT PREVIEW</p><h3>${copy[0]}</h3><b>${copy[1]}</b><p>${copy[2]}</p><small>${copy[3]}</small></div><button class="demo-icon-button" data-action="close-output">關閉預覽</button></section>`;
}

function demoToast(message) {
  demoState.toast = message;
  demoRender();
  window.setTimeout(() => { demoState.toast = ''; demoRender(); }, 2400);
}

function demoMoveToStep(step) {
  demoState.step = Math.max(1, Math.min(6, step));
  demoState.outputPreview = '';
  demoRender();
  document.querySelector('.demo-surface')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', event => {
  const step = event.target.closest('[data-step]')?.dataset.step;
  if (step) { demoMoveToStep(Number(step)); return; }
  const project = event.target.closest('[data-project]')?.dataset.project;
  if (project) { demoState.selectedProject = project; demoToast(`已選擇「${project}」，後續流程會以此個案示範。`); return; }
  const dashboard = event.target.closest('[data-dashboard]')?.dataset.dashboard;
  if (dashboard) { demoState.dashboardFilter = dashboard; demoRender(); return; }
  const output = event.target.closest('[data-output]')?.dataset.output;
  if (output) { demoState.outputPreview = output; demoRender(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'next') demoMoveToStep(demoState.step + 1);
  else if (action === 'restart') { demoState.step = 1; demoState.outputPreview = ''; demoToast('已回到項目建立，可重新選擇個案。'); }
  else if (action === 'search') demoToast('已找到既有項目、公開來源與待補證資料。');
  else if (action === 'plan-interview') { demoState.interviewPlanned = true; demoToast('補訪任務已加入採集清單。'); }
  else if (action === 'add-source') { demoState.extraSourceAdded = true; demoToast('示範素材已加入待核驗佇列，尚未公開。'); }
  else if (action === 'trace') { demoState.traceOpen = !demoState.traceOpen; demoRender(); }
  else if (action === 'refresh-card') { demoState.cardRefreshed = true; demoToast('Paw-Archivist 已按目前來源更新內部草稿。'); }
  else if (action === 'close-output') { demoState.outputPreview = ''; demoRender(); }
});

demoRender();
