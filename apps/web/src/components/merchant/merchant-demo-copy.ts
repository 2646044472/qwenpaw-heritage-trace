export type MerchantTopic = "sentiment" | "exposure" | "action";

export const merchantTopics: { id: MerchantTopic; label: string }[] = [
  { id: "exposure", label: "店舖曝光數據" },
  { id: "sentiment", label: "市民評價" },
  { id: "action", label: "點樣改善？" },
];

export const merchantOpeningPrompt = "最近鋪頭點啊？";

export const merchantDemoComments: Record<string, string[]> = {
  "lei-kei-001": [
    "最鍾意聽老店背後嘅故事。",
    "如果網上多啲介紹傳統手藝就更好。",
    "有歷史感，但平時比較少見到相關內容。",
  ],
  "sun-fong-002": ["傳統飲品好有澳門味道。", "會介紹朋友嚟試。"],
  "tak-hing-003": ["竹升麵手藝令人印象深刻。", "想更容易搵到最新店舖資訊。"],
};

export const merchantSentimentSummaries: Record<string, string> = {
  "lei-kei-001": "遊客重視店舖的家族故事，但平時較少在網上看到相關內容。",
  "sun-fong-002": "遊客持續推薦店內的傳統飲品。",
  "tak-hing-003": "遊客欣賞傳統手藝，但營業資訊有時不一致。",
};

export const merchantActionCopy: Record<string, { title: string; description: string }> = {
  "review-evidence": { title: "審視核實依據", description: "先處理阻礙事項，再把文化資料用於公開內容。" },
  "review-open-issues": { title: "確認尚待處理的資料", description: "發布前先確認仍需補充或核對的文化資料。" },
  "interview-owner": { title: "補充店主口述資料", description: "補回欠缺的日期、人物和重要事件，令文化紀錄更完整。" },
  "publish-heritage-story": {
    title: "發布已核實的老店故事",
    description: "利用已核實內容提升曝光，同時避免誇大未有依據的說法。",
  },
};

export const merchantReasonCopy: Record<string, string> = {
  publication_blocked: "目前核實結果未適合公開使用。",
  publication_review: "目前核實結果在發布前仍需要審視。",
  founding_date_gap: "創立日期仍需要店主確認。",
  low_completeness: "文化資料仍有部分重要欄位未完整。",
  exposure_decline: "近期曝光較上一期下跌。",
  negative_sentiment: "近期遊客評價訊號需要留意。",
};

export const merchantProductTranslations: Record<string, string> = {
  "Almond cookies": "杏仁餅",
};
