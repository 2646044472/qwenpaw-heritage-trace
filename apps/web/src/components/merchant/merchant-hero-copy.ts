export type MerchantHeroCopy = {
  displayName: string;
  opening: string;
  overviewReply: string;
  sentiment: {
    heading: string;
    body: string;
    quotes: string[];
    conclusion: string;
  };
  exposure: {
    heading: string;
    context: string;
    conclusion: string;
  };
  action: {
    heading: string;
    body: string;
    pendingFacts: string[];
    generateLabel: string;
  };
  draft: {
    title: string;
    paragraphs: string[];
    hashtags: string;
    verifiedFactCount: number;
  };
};

export const merchantHeroCopy: Record<string, MerchantHeroCopy> = {
  "lei-kei-001": {
    displayName: "禮記雪糕",
    opening: "今日有樣嘢值得留意：最近禮記雪糕嘅曝光跌咗，但客人對老店味道同懷舊故事幾有興趣。",
    overviewReply: "店舖曝光數據，以及市民對店舖的評價。你想先睇客人點講，定係睇曝光？",
    sentiment: {
      heading: "大家最有感覺嘅係「澳門老味道」",
      body: "近期評價入面，較多人鍾意禮記雪糕嘅懷舊感，亦有人覺得呢啲老店故事值得俾更多遊客知道。",
      quotes: [
        "細個已經食過，而家經過都會想食返。",
        "好有澳門老店嘅感覺，唔只係食雪糕。",
        "如果網上有多啲老店故事，遊客應該會更容易認識。",
      ],
      conclusion: "所以問題唔係大家對禮記雪糕冇興趣，而係呢份澳門老味道仲未俾足夠多人見到。",
    },
    exposure: {
      heading: "最近曝光明顯回落",
      context: "但同一時間，客人對「懷舊」、「老店」、「澳門回憶」相關內容反應較正面。",
      conclusion: "有值得講嘅故事，但最近見到故事嘅人少咗。",
    },
    action: {
      heading: "我建議：由一杯雪糕講禮記嘅故事",
      body: "與其淨係介紹產品，可以試下將「食雪糕」同「澳門老店記憶」放埋一齊講。",
      pendingFacts: ["創辦年份及早期經營時間線", "個別產品是否由創店時期一直售賣至今"],
      generateLabel: "幫我生成商戶內容草稿",
    },
    draft: {
      title: "在澳門食一杯雪糕，也是在吃一段老城記憶 🍨",
      paragraphs: [
        "行澳門，除咗睇景點，有時一間老店先係最容易令人記住一座城市嘅地方。",
        "禮記雪糕陪住澳門街坊走過好多日常。一杯簡單嘅雪糕，對有人嚟講係第一次到澳門嘅新鮮感，對另一班人嚟講，可能係細個食過、今日又返嚟食嘅味道。",
        "老店最有意思嘅地方，未必只係「有幾多年歷史」，而係多年之後，仲有人願意行返入嚟，搵返熟悉嘅一啖。",
        "下次行過澳門，不妨留低少少時間，試下呢份老城味道。",
      ],
      hashtags: "#澳門 #澳門美食 #禮記雪糕 #澳門老店 #澳門旅行 #澳門故事",
      verifiedFactCount: 3,
    },
  },
};
