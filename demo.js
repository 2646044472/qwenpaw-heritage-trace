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
  qwen: { mode: 'checking', live: false },
  qwenDraftGenerated: false,
  qwenDraftAccepted: false,
};

const selectedProject = () => demoProjects.find(project => project.name === demoState.selectedProject) || demoProjects[0];

let demoLiveMap = null;

function demoRender() {
  if (demoLiveMap) {
    demoLiveMap.remove();
    demoLiveMap = null;
  }
  document.querySelector('#app').innerHTML = `
    <div class="demo-app">
      <header class="demo-header">
        <a class="demo-brand" href="#top"><span>澳憶・千尋</span><small>QWENPAW HERITAGE TRACE</small></a>
        <div class="demo-header-meta"><span class="demo-pill">比賽演示模式</span><span class="demo-case">案例：${selectedProject().name}</span><a href="admin.html">管理端</a></div>
      </header>
      <main id="top" class="demo-main">
        ${demoIntro()}
        ${demoWorkspaceBar()}
        <nav class="demo-steps" aria-label="六步演示流程">${demoSteps.map(step => `<button class="demo-step ${demoState.step === step.id ? 'is-active' : ''} ${demoState.step > step.id ? 'is-done' : ''}" data-step="${step.id}" aria-current="${demoState.step === step.id ? 'step' : 'false'}"><span>${String(step.id).padStart(2, '0')}</span><strong>${step.label}</strong><small>${step.note}</small></button>`).join('')}</nav>
        <section class="demo-surface" aria-live="polite">${demoStepContent()}</section>
      </main>
      ${demoState.toast ? `<div class="demo-toast" role="status"><strong>已更新</strong><span>${demoState.toast}</span></div>` : ''}
    </div>`;
  demoInitLiveMap();
}

function demoInitLiveMap() {
  const target = document.querySelector('#demo-live-map');
  if (!target) return;

  if (!window.L) {
    target.textContent = '地圖服務暫時無法載入，請檢查網絡後重試。';
    return;
  }

  const places = [
    { name: '禮記雪糕', status: '待商戶確認', color: '#b87923', coords: [22.2012, 113.5486] },
    { name: '佛笑樓', status: '可公開', color: '#2f625f', coords: [22.1941, 113.5415] },
    { name: '龍華茶樓', status: '來源衝突', color: '#a54739', coords: [22.2073, 113.5489] },
  ];

  demoLiveMap = window.L.map(target, {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true,
  });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(demoLiveMap);

  places.forEach((place) => {
    window.L.circleMarker(place.coords, {
      radius: 9,
      color: '#fffdf8',
      weight: 2,
      fillColor: place.color,
      fillOpacity: 1,
    }).bindPopup(`<strong>${place.name}</strong><br><span>演示點位 · ${place.status}</span>`).addTo(demoLiveMap);
  });

  demoLiveMap.fitBounds(places.map(place => place.coords), { padding: [30, 30] });
  window.setTimeout(() => demoLiveMap?.invalidateSize(), 0);
}

function demoIntro() {
  return `<section class="demo-intro">
    <div class="demo-intro-copy"><p class="demo-kicker">澳門老字號文化資產普查</p><h1>把一間老店的故事，<br>變成可以被採信的文化資產。</h1><p class="demo-lead">以澳門老字號為試點，把公開資料、訪談與實地素材整理成可追溯、可授權、可再使用的文化記錄，為街區保育、商戶內容與旅客體驗提供同一份可信底稿。</p><div class="demo-intro-actions"><button class="demo-quiet-button" data-step="4">查看核心能力</button><span>6 步 · 3 種使用場景 · 1 份可回溯底稿</span></div></div>
    <figure class="demo-heritage-visual"><img src="assets/heritage-cover.jpeg" alt="澳門街區文化記憶插畫"><figcaption><span>澳門記憶 · 城市根脈</span><b>不生成故事，只整理證據。</b></figcaption></figure>
    <aside class="demo-truth"><strong>本次演示</strong><div><span>已實現核心</span><b>文化建檔 / 來源核驗</b></div><div><span>交互原型</span><b>採集、訪談、圖譜與活化輸出</b></div><p>所有示例資料僅供比賽展示，公開前仍需取得授權與人工確認。</p></aside>
  </section>`;
}

function demoWorkspaceBar() {
  const qwenLabel = demoState.qwen.mode === 'live' ? 'Qwen 已连接 · 管理端可生成真实草稿' : demoState.qwen.mode === 'guided' ? 'Qwen 引导模式 · 使用示例草稿' : '正在检查 Qwen 状态';
  const progress = demoState.qwenDraftAccepted ? '候选内容已进入待核验' : demoState.extraSourceAdded ? '补证资料已加入队列' : '等待补证资料';
  return `<section class="demo-workspace-bar" aria-label="当前工作状态"><div><span>当前个案</span><strong>${selectedProject().name}</strong><b>${selectedProject().area}</b></div><div><span>资料状态</span><strong>${progress}</strong><b>公开前仍须核验</b></div><div class="demo-qwen-state ${demoState.qwen.mode}"><span>Qwen / Paw-Archivist</span><strong>${qwenLabel}</strong><b>${demoState.qwen.mode === 'live' ? '不直接发布事实' : '不发送访客输入到模型'}</b></div></section>`;
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

function demoQwenWorkbench() {
  const live = demoState.qwen.mode === 'live';
  if (!demoState.qwenDraftGenerated) {
    return `<section class="demo-qwen-workbench"><div><p class="demo-kicker">QWEN ASSISTED ARCHIVING</p><h3>让 Qwen 整理来源，不替人下结论。</h3><p>它只读取本案已登记的来源，输出带来源编号的候选说法、证据摘录与核验提示。没有来源的内容不能成为候选项。</p></div><div class="demo-qwen-action"><span class="${live ? 'live' : 'guided'}">${live ? '实时模型可用' : '引导体验模式'}</span><button data-action="generate-qwen">${live ? '在管理端生成真实草稿' : '生成示例 Qwen 草稿'}</button></div></section>`;
  }
  const accepted = demoState.qwenDraftAccepted;
  return `<section class="demo-qwen-result"><div class="demo-qwen-result-head"><div><p class="demo-kicker">QWEN DRAFT · ${live ? 'LIVE RULES' : 'GUIDED SAMPLE'}</p><h3>候选文化记录</h3></div><span class="${accepted ? 'accepted' : 'pending'}">${accepted ? '已送往 Verifier' : '等待人工采纳'}</span></div><p class="demo-qwen-summary">根据来源 01 的公开报道及来源 02 的访谈摘录，建议把“1933 年创立”与“街坊记忆”拆分处理：前者可优先核验，后者须先确认公开范围。</p><div class="demo-qwen-candidates"><article><b>候选 01 · 1933 年创立</b><p>证据：公开报道记载店铺创立年份。</p><span>来源 01 · 建议：核验后可公开</span></article><article><b>候选 02 · 代际街坊记忆</b><p>证据：访谈提及顾客带子女重访。</p><span>来源 02 · 建议：取得商户确认后再公开</span></article></div><div class="demo-qwen-footer"><small>${live ? '真实草稿必须在管理端登录后生成并记录审计事件。' : '这是离线示例草稿，不调用模型，也不写入服务器。'}</small>${accepted ? '<b>2 条候选项已成为待核验资料</b>' : '<button class="demo-inline-action" data-action="accept-qwen">采纳为待核验项</button>'}</div></section>`;
}

function demoAssetCard() {
  const project = selectedProject();
  const trace = demoState.traceOpen ? `<aside class="demo-trace-panel"><div class="demo-trace-head"><div><p class="demo-kicker">SOURCE TRACE</p><h3>「1933 年創立」的來源回鏈</h3></div><button class="demo-icon-button" data-action="trace">關閉</button></div><div class="demo-trace-row"><span>01</span><div><b>《澳門日報》歷史專題</b><p>公開報道 · 創立年份記載</p></div><em>可公開</em></div><div class="demo-trace-row"><span>02</span><div><b>店主訪談摘錄 02</b><p>街坊回憶與代際消費故事</p></div><em class="wait">待確認</em></div><p class="demo-trace-note">Verifier 只會把來源足夠、公開範圍清楚的內容標為可公開。</p></aside>` : '';
  return `${demoHeading('STEP 04 · Qwen 建檔與人工核驗', '先让 Qwen 帮忙整理，再由人决定能不能相信。', 'Qwen 只产生候选说法；Archivist 采纳后，Verifier 决定公开、待确认或仅内部。', '<span class="demo-implemented">核心工作流</span>')}<div class="demo-asset-tools"><span>资料版本：内部草稿 v0.3</span><button class="demo-inline-action" data-action="refresh-card">${demoState.cardRefreshed ? '已按现有来源重新整理' : '更新结构化资料'}</button></div>${demoQwenWorkbench()}<div class="demo-asset-layout"><article class="demo-asset-card"><div class="demo-card-top"><p class="demo-kicker">CULTURAL ASSET CARD</p><span>内部草稿</span></div><h3>${project.name}</h3><dl><dt>类型</dt><dd>${project.type}</dd><dt>街区</dt><dd>${project.area}</dd><dt>创立年份</dt><dd>${project.year}</dd><dt>文化标签</dt><dd><span>怀旧甜品</span><span>街坊记忆</span><span>代际消费</span></dd></dl><blockquote>「以前很多街坊都不是只来买雪糕，还会带小朋友来。后来小朋友长大了，又带自己的孩子回来。」<footer>访谈摘录 02 · 待商户确认公开范围</footer></blockquote></article><aside class="demo-verifier"><div class="demo-verifier-head"><div><p class="demo-kicker">PAW-VERIFIER</p><h3>可信核验</h3></div><span>${demoState.qwenDraftAccepted ? '6 项' : '4 项'}</span></div><div><b>1933 年创办</b><span class="ok">可公开</span></div><div><b>三代顾客故事</b><span class="wait">待商户确认</span></div><div><b>家族经营细节</b><span class="private">仅内部</span></div><div><b>历史照片授权</b><span class="wait">待补证</span></div><button data-action="trace">${demoState.traceOpen ? '收起来源回链' : '查看来源回链'}</button></aside></div>${trace}${demoNext('把可信资料带进街区看板')}`;
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

function demoQwenWorkbench() {
  const live = demoState.qwen.mode === 'live';
  if (!demoState.qwenDraftGenerated) {
    return `<section class="demo-qwen-workbench demo-qwen-process"><div class="demo-qwen-process-copy"><p class="demo-kicker">QWEN / PAW-ARCHIVIST</p><h3>把杂乱素材变成“可核验的候选资料”。</h3><p>Qwen 不写一篇故事，也不决定真伪。它把来源逐条拆开，抽取时间、地点、人物、说法和授权边界，并把每一个候选结论绑回原始来源。</p></div><div class="demo-qwen-flow"><div><span>输入</span><b>4</b><small>来源记录</small></div><i>→</i><div><span>Qwen 整理</span><b>7</b><small>字段提取</small></div><i>→</i><div><span>输出</span><b>2</b><small>候选结论</small></div></div><div class="demo-qwen-action"><span class="${live ? 'live' : 'guided'}">${live ? '实时模型可用' : '引导体验模式'}</span><button data-action="generate-qwen">${live ? '在管理端生成真实草稿' : '运行 Qwen 建档示例'}</button></div></section>`;
  }
  const accepted = demoState.qwenDraftAccepted;
  return `<section class="demo-qwen-result"><div class="demo-qwen-result-head"><div><p class="demo-kicker">QWEN / PAW-ARCHIVIST OUTPUT</p><h3>来源已经被整理成核验任务</h3></div><span class="${accepted ? 'accepted' : 'pending'}">${accepted ? '已送往 Verifier' : '等待人工采纳'}</span></div><div class="demo-qwen-compare"><section><p>Qwen 读取的来源</p><div class="demo-qwen-source"><span>01</span><b>1933_创立年份_报道.pdf</b><small>公开报道</small></div><div class="demo-qwen-source"><span>02</span><b>礼记雪糕_访谈摘录.txt</b><small>商户访谈</small></div></section><section><p>Qwen 输出的候选资料</p><div class="demo-qwen-claim"><b>创立年份：1933</b><span>证据摘录：报道明确记载年份</span><em>来源 01</em></div><div class="demo-qwen-claim"><b>代际街坊记忆</b><span>证据摘录：顾客带子女重访</span><em>来源 02</em></div></section></div><div class="demo-qwen-review"><div><strong>Verifier 接下来做什么？</strong><span>核对原文、确认商户授权、决定公开边界。</span></div>${accepted ? '<b>2 条候选已进入待核验队列</b>' : '<button class="demo-inline-action" data-action="accept-qwen">采纳为待核验项</button>'}</div><small class="demo-qwen-legal">${live ? '真实草稿只在登录的管理端生成，并记录模型、操作者和采纳动作。' : '这是离线引导数据：展示真实规则，但不调用模型，也不写入服务器。'}</small></section>`;
}

function demoDashboard() {
  const filter = demoState.dashboardFilter;
  const queue = filter === 'public' ? [['禮記雪糕', '历史年份已核验', '可进入商户内容包', 'ready'], ['佛笑樓', '饮食记忆已确认', '可进入路线素材', 'ready']] : filter === 'pending' ? [['禮記雪糕', '老顾客故事', '等待商户公开确认', 'urgent'], ['龍華茶樓', '开业年份', '两条来源存在冲突', 'risk']] : [['禮記雪糕', '老顾客故事', '等待商户公开确认', 'urgent'], ['佛笑樓', '饮食记忆已确认', '可进入路线素材', 'ready'], ['龍華茶樓', '开业年份', '两条来源存在冲突', 'risk']];
  return `${demoHeading('STEP 05 · 街区文化资产运营板', '从“记录一间店”走到“安排一个街区”。', 'G 端使用者能一眼判断哪里可以发布、哪里要补访、哪些问题会影响街区活化排程。')}<div class="demo-g-kpis"><div><span>建档覆盖</span><strong>3 <small>/ 12</small></strong><b>本期试点 · 荷兰园 / 水坑尾</b></div><div><span>资料可信度</span><strong>68<small>%</small></strong><b>较上次普查 +12%</b></div><div><span>待决策事项</span><strong>3</strong><b>2 项商户确认 · 1 项来源冲突</b></div><div><span>可释放内容</span><strong>2</strong><b>已满足公开与授权条件</b></div></div><div class="demo-dashboard-controls"><span>任务视图</span><button class="${filter === 'all' ? 'is-active' : ''}" data-dashboard="all">全部</button><button class="${filter === 'pending' ? 'is-active' : ''}" data-dashboard="pending">待处理</button><button class="${filter === 'public' ? 'is-active' : ''}" data-dashboard="public">可公开</button><button class="demo-export-button" data-action="export-board">导出本周工作单</button></div><div class="demo-governance-grid"><section class="demo-district-map"><div class="demo-map-heading"><div><p class="demo-kicker">DISTRICT OVERVIEW</p><h3>荷兰园 / 水坑尾</h3></div><span>试点范围</span></div><div class="demo-street-line demo-line-a"></div><div class="demo-street-line demo-line-b"></div><div class="demo-map-place place-a"><b>禮記雪糕</b><span>待商户确认</span></div><div class="demo-map-place place-b"><b>佛笑樓</b><span>可公开</span></div><div class="demo-map-place place-c"><b>龍華茶樓</b><span>来源冲突</span></div><div class="demo-map-legend"><span><i class="ready"></i>可公开</span><span><i class="urgent"></i>待确认</span><span><i class="risk"></i>需复核</span></div></section><section class="demo-priority-board"><div class="demo-priority-head"><div><p class="demo-kicker">FIELD QUEUE</p><h3>本周优先处理</h3></div><span>${queue.length} 项</span></div>${queue.map((row, index) => `<div class="demo-priority-row"><b>${String(index + 1).padStart(2, '0')}</b><div><strong>${row[0]} · ${row[1]}</strong><span>${row[2]}</span></div><em class="${row[3]}">${row[3] === 'ready' ? '可发布' : row[3] === 'risk' ? '需复核' : '待确认'}</em></div>`).join('')}<div class="demo-priority-footer"><span>建议行动</span><b>${filter === 'public' ? '生成可公开内容包' : '安排 2 次商户确认与 1 次来源复核'}</b></div></section></div><section class="demo-evidence-meter"><div><p class="demo-kicker">EVIDENCE HEALTH</p><h3>资料不是越多越好，而是每一条都要知道能不能用。</h3></div><div class="demo-meter-bars"><div><span>已回链来源</span><b><i style="width: 82%"></i></b><em>82%</em></div><div><span>已授权素材</span><b><i style="width: 55%"></i></b><em>55%</em></div><div><span>可公开叙述</span><b><i style="width: 41%"></i></b><em>41%</em></div></div></section>${demoNext('把可信资料转成不同成品')}`;
}

function demoOutputs() {
  const mode = demoState.outputPreview || 'G';
  const content = {
    G: `<section class="demo-deliverable-g"><div class="demo-deliverable-top"><div><p class="demo-kicker">G · GOVERNMENT / CULTURE</p><h3>街区文化资产周报</h3><span>荷兰园 / 水坑尾 · 第 01 期</span></div><button data-action="export-board">导出 PDF 摘要</button></div><div class="demo-report-strip"><div><b>3</b><span>完成初步建档</span></div><div><b>2</b><span>可进入公开内容</span></div><div><b>3</b><span>需要现场处理</span></div></div><div class="demo-report-actions"><strong>本周建议</strong><p>优先完成礼记雪糕的商户公开确认，再处理龙华茶楼的年份冲突；两项完成后，可形成“老澳门饮食记忆”试点路线。</p></div></section>`,
    B: `<section class="demo-deliverable-b"><div class="demo-merchant-cover"><img src="assets/heritage-cover.jpeg" alt="澳门街区文化记忆"><div><p>已核验商户内容</p><h3>禮記雪糕</h3><span>荷兰园 / 水坑尾 · 创立于 1933 年</span></div></div><div class="demo-merchant-copy"><div><p class="demo-kicker">BRAND STORY · READY TO REVIEW</p><h3>把可以被确认的记忆，说给新的顾客听。</h3><p>禮記雪糕自 1933 年起扎根澳门。有关街坊代际回访的故事仍在等待商户确认，因此不会进入公开版文字。</p></div><aside><span>内容权限</span><b>2 项可用</b><small>年份与地点已核验</small></aside></div></section>`,
    C: `<section class="demo-deliverable-c"><div class="demo-route-head"><div><p class="demo-kicker">C · CITY WALK</p><h3>老澳门饮食记忆路线</h3><span>约 80 分钟 · 3 个文化停靠点</span></div><button data-action="route-save">保存路线</button></div><ol class="demo-route-stops"><li><b>01</b><div><strong>禮記雪糕</strong><span>从一间店的创立年份，走进荷兰园的街坊记忆。</span></div><em>已核验</em></li><li><b>02</b><div><strong>佛笑樓</strong><span>了解百年饮食保存样本与街区商业脉络。</span></div><em>已核验</em></li><li><b>03</b><div><strong>龍華茶樓</strong><span>保留“待考证”的问题，邀请游客理解历史仍在被补全。</span></div><em class="wait">待补证</em></li></ol></section>`,
  }[mode];
  return `${demoHeading('STEP 06 · 把可信资料交到真正使用的人手上', '同一份底稿，形成三种有边界的交付物。', 'G 端拿到决策清单，商户拿到可审核的内容包，旅客看到的是已经确认、可以公开的城市故事。')}<div class="demo-deliverable-tabs"><button class="${mode === 'G' ? 'is-active' : ''}" data-output="G"><b>G</b><span>街区周报</span></button><button class="${mode === 'B' ? 'is-active' : ''}" data-output="B"><b>B</b><span>商户内容包</span></button><button class="${mode === 'C' ? 'is-active' : ''}" data-output="C"><b>C</b><span>城市路线</span></button></div><div class="demo-deliverable-stage">${content}</div><div class="demo-finish"><strong>交付不是终点</strong><span>新的访谈、授权和核验会回到同一条资料链，让下一版内容更完整而不失真。</span><button data-action="restart">开始另一个个案</button></div>`;
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
  else if (action === 'generate-qwen') {
    if (demoState.qwen.mode === 'live') { window.location.href = 'admin.html'; return; }
    demoState.qwenDraftGenerated = true;
    demoToast('已生成带来源编号的 Qwen 引导草稿，等待人工采纳。');
  }
  else if (action === 'accept-qwen') { demoState.qwenDraftAccepted = true; demoToast('候选项已加入 Verifier 待核验队列，尚未公开。'); }
  else if (action === 'export-board') demoToast('已准备街区文化资产周报，内容只包含已核验资料。');
  else if (action === 'route-save') demoToast('路线草稿已保存，待补证站点会保留核验提示。');
  else if (action === 'trace') { demoState.traceOpen = !demoState.traceOpen; demoRender(); }
  else if (action === 'refresh-card') { demoState.cardRefreshed = true; demoToast('Paw-Archivist 已按目前來源更新內部草稿。'); }
  else if (action === 'close-output') { demoState.outputPreview = ''; demoRender(); }
});

demoRender();

fetch('/api/public/demo-status', { headers: { Accept: 'application/json' } })
  .then(response => response.ok ? response.json() : Promise.reject(new Error('status_unavailable')))
  .then(status => {
    demoState.qwen = { mode: status.archivist_mode === 'live' ? 'live' : 'guided', live: status.model_ready === true };
    demoRender();
  })
  .catch(() => {
    demoState.qwen = { mode: 'guided', live: false };
    demoRender();
  });

function demoDashboard() {
  const filter = demoState.dashboardFilter;
  const queue = filter === 'public'
    ? [['禮記雪糕', '歷史年份已核驗', '可進入商戶內容包', 'ready'], ['佛笑樓', '飲食記憶已確認', '可進入路線素材', 'ready']]
    : filter === 'pending'
      ? [['禮記雪糕', '老顧客故事', '等待商戶公開確認', 'urgent'], ['龍華茶樓', '開業年份', '兩條來源存在衝突', 'risk']]
      : [['禮記雪糕', '老顧客故事', '等待商戶公開確認', 'urgent'], ['佛笑樓', '飲食記憶已確認', '可進入路線素材', 'ready'], ['龍華茶樓', '開業年份', '兩條來源存在衝突', 'risk']];

  return `${demoHeading('STEP 05 · 街區文化資產運營板', '從「記錄一間店」走到「安排一個街區」。', 'G 端使用者能一眼判斷哪裡可以發布、哪裡要補訪、哪些問題會影響街區活化排程。')}<div class="demo-g-kpis"><div><span>建檔覆蓋</span><strong>3 <small>/ 12</small></strong><b>本期試點 · 荷蘭園 / 水坑尾</b></div><div><span>資料可信度</span><strong>68<small>%</small></strong><b>較上次普查 +12%</b></div><div><span>待決策事項</span><strong>3</strong><b>2 項商戶確認 · 1 項來源衝突</b></div><div><span>可釋放內容</span><strong>2</strong><b>已滿足公開與授權條件</b></div></div><div class="demo-dashboard-controls"><span>任務視圖</span><button class="${filter === 'all' ? 'is-active' : ''}" data-dashboard="all">全部</button><button class="${filter === 'pending' ? 'is-active' : ''}" data-dashboard="pending">待處理</button><button class="${filter === 'public' ? 'is-active' : ''}" data-dashboard="public">可公開</button><button class="demo-export-button" data-action="export-board">導出本週工作單</button></div><div class="demo-governance-grid"><section class="demo-district-map"><div class="demo-map-heading"><div><p class="demo-kicker">DISTRICT OVERVIEW</p><h3>荷蘭園 / 水坑尾</h3></div><span>實際地理底圖 · 演示點位</span></div><div id="demo-live-map" class="demo-live-map" aria-label="澳門荷蘭園與水坑尾的互動地圖"></div><div class="demo-map-legend"><span><i class="ready"></i>可公開</span><span><i class="urgent"></i>待確認</span><span><i class="risk"></i>需復核</span></div></section><section class="demo-priority-board"><div class="demo-priority-head"><div><p class="demo-kicker">FIELD QUEUE</p><h3>本週優先處理</h3></div><span>${queue.length} 項</span></div>${queue.map((row, index) => `<div class="demo-priority-row"><b>${String(index + 1).padStart(2, '0')}</b><div><strong>${row[0]} · ${row[1]}</strong><span>${row[2]}</span></div><em class="${row[3]}">${row[3] === 'ready' ? '可發布' : row[3] === 'risk' ? '需復核' : '待確認'}</em></div>`).join('')}<div class="demo-priority-footer"><span>建議行動</span><b>${filter === 'public' ? '生成可公開內容包' : '安排 2 次商戶確認與 1 次來源復核'}</b></div></section></div><section class="demo-evidence-meter"><div><p class="demo-kicker">EVIDENCE HEALTH</p><h3>資料不是越多越好，而是每一條都要知道能不能用。</h3></div><div class="demo-meter-bars"><div><span>已回鏈來源</span><b><i style="width: 82%"></i></b><em>82%</em></div><div><span>已授權素材</span><b><i style="width: 55%"></i></b><em>55%</em></div><div><span>可公開敘述</span><b><i style="width: 41%"></i></b><em>41%</em></div></div></section>${demoNext('把可信資料轉成不同成品')}`;
}
