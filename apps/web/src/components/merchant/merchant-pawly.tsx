"use client";

import { useEffect, useState } from "react";

import { Lightbulb, MessageCircle, PawPrint, Send, TrendingDown } from "lucide-react";

import type { HeritageShop } from "@/lib/heritage/application-types";
import { HERO_SHOP_ID, createHeritageShopFromWorkflow } from "@/lib/heritage/demo-seeds";
import { getMerchantTelemetry } from "@/lib/heritage/merchant-telemetry-fixtures";

import { useDemoState } from "../demo/demo-state-provider";

import { MerchantChatComposer } from "./merchant-chat-composer";
import { MerchantChatMessage } from "./merchant-chat-message";
import { PawlyMarkdown } from "./pawly-markdown";
import { type MerchantTopic, merchantOpeningPrompt, merchantTopics } from "./merchant-demo-copy";
import { MerchantDraftPreview } from "./merchant-draft-preview";
import { merchantHeroCopy } from "./merchant-hero-copy";
import { MerchantPublicationStatus, type PublicationFlowState } from "./merchant-publication-status";
import { MerchantTopicResponse } from "./merchant-topic-response";

const icons = { sentiment: MessageCircle, exposure: TrendingDown, action: Lightbulb };

type ConversationTurn =
  | { id: string; speaker: "pawly"; kind: "reply"; text: string }
  | { id: string; speaker: "pawly"; kind: "topic"; topic: MerchantTopic }
  | { id: string; speaker: "owner"; kind: "text"; text: string };

const freeTextReply = "收到，我會以目前已核實文化資料和可追溯訊號協助你整理重點。你亦可以選擇下方主題查看具體分析。";
type PendingRequest = "overview" | MerchantTopic;

function getThinkingLabel(request: PendingRequest | null) {
  if (request === "sentiment") return "正在整理固定 Demo 評價訊號";
  if (request === "overview") return "Pawly 正在整理最近訊號";
  return "Pawly 正在整理已核實資料";
}

function getLiveFollowUps(message: string, reply: string): string[] {
  const conversation = `${message} ${reply}`;
  if (/產品|雪糕|紅豆|椰子/.test(conversation)) {
    return ["想整理一段招牌產品介紹", "哪些產品資料仍要向店主確認？", "點樣講好傳統雪糕故事？"];
  }
  if (/歷史|創立|1933|傳承|故事|地址/.test(conversation)) {
    return ["幫我整理一條店舖歷史時間線", "想補充第三代傳承故事", "哪些歷史資料仍要確認？"];
  }
  if (/曝光|網上|瀏覽|流量|宣傳/.test(conversation)) {
    return ["曝光下降可以先做哪三件事？", "幫我設計一個老店故事貼文", "想比較不同宣傳渠道"];
  }
  if (/評價|市民|客人|遊客|口碑/.test(conversation)) {
    return ["怎樣回應客人的正面評價？", "幫我整理客人最重視的特色", "如何把評價變成宣傳內容？"];
  }
  return ["可以再講具體一點嗎？", "哪些資料仍需要我確認？", "幫我整理下一步行動"];
}

async function requestLivePawlyReply(message: string, shop: HeritageShop): Promise<string> {
  const response = await fetch("/api/pawly/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      context: {
        shop_name: shop.name,
        verified_asset: shop.workflow.asset_card,
        verification_summary: shop.workflow.verification_summary,
        signals: shop.signals,
      },
    }),
  });
  const payload = (await response.json()) as { reply?: unknown; error?: unknown };
  if (!response.ok || typeof payload.reply !== "string") {
    throw new Error(typeof payload.error === "string" ? payload.error : "pawly_request_failed");
  }
  return payload.reply;
}

export function MerchantPawly({ shop }: { shop: HeritageShop }) {
  const { state } = useDemoState();
  const [composerValue, setComposerValue] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [showDetailChoices, setShowDetailChoices] = useState(false);
  const [publicationState, setPublicationState] = useState<PublicationFlowState>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [liveFollowUps, setLiveFollowUps] = useState<string[]>([]);
  const sharedShop =
    state.selectedShopId === HERO_SHOP_ID && state.pipeline.workflowResult?.workflow_status === "finished"
      ? createHeritageShopFromWorkflow(HERO_SHOP_ID, state.pipeline.workflowResult)
      : shop;
  const isLiveMode = liveMode;
  const telemetry = getMerchantTelemetry(sharedShop.shop_id);
  const heroCopy = merchantHeroCopy[sharedShop.shop_id];

  useEffect(() => {
    let active = true;
    void fetch("/api/pawly/chat", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (active && payload && typeof payload === "object" && "mode" in payload) {
          setLiveMode(payload.mode === "live");
        }
      })
      .catch(() => {
        if (active) setLiveMode(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingRequest) return;
    const timer = window.setTimeout(() => {
      if (pendingRequest === "overview") {
        setTurns((current) => [
          ...current,
          {
            id: `overview-${Date.now()}`,
            kind: "reply",
            speaker: "pawly",
            text: heroCopy?.overviewReply ?? "店舖曝光數據，以及市民對店舖的評價。你想先了解哪一項？",
          },
        ]);
        setShowDetailChoices(true);
        setPendingRequest(null);
        return;
      }

      setTurns((current) => [
        ...current,
        { id: `topic-${pendingRequest}-${Date.now()}`, kind: "topic", speaker: "pawly", topic: pendingRequest },
      ]);
      setPendingRequest(null);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [heroCopy?.overviewReply, pendingRequest]);

  // Keep the receipt fields in the dependency list so Fast Refresh preserves the hook shape
  // while the demo's publication presentation changes independently from receipt metadata.
  // biome-ignore lint/correctness/useExhaustiveDependencies: receipt fields intentionally keep a stable Fast Refresh dependency shape
  useEffect(() => {
    if (publicationState !== "generating" && publicationState !== "publishing") return;
    const timer = window.setTimeout(() => {
      if (publicationState === "generating") {
        setPublicationState("ready");
        return;
      }

      // Publication is an ephemeral demo interaction. Only show receipt metadata
      // when the shared telemetry fixture has recorded it; never invent a receipt.
      setPublicationState("published");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [publicationState, telemetry.publication.post_id, telemetry.publication.published_at]);

  useEffect(() => {
    if (!isResponding || isLiveMode) return;
    const timer = window.setTimeout(() => {
      setTurns((current) => [
        ...current,
        { id: `reply-${Date.now()}`, kind: "reply", speaker: "pawly", text: freeTextReply },
      ]);
      setIsResponding(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isLiveMode, isResponding]);

  function askLive(message: string) {
    setShowDetailChoices(false);
    setLiveFollowUps([]);
    setTurns((current) => [...current, { id: `owner-live-${Date.now()}`, kind: "text", speaker: "owner", text: message }]);
    setIsResponding(true);
    void requestLivePawlyReply(message, sharedShop)
      .then((reply) => {
        setTurns((current) => [...current, { id: `reply-live-${Date.now()}`, kind: "reply", speaker: "pawly", text: reply }]);
        setLiveFollowUps(getLiveFollowUps(message, reply));
      })
      .catch(() => {
        setTurns((current) => [
          ...current,
          {
            id: `reply-live-error-${Date.now()}`,
            kind: "reply",
            speaker: "pawly",
            text: "Pawly 暫時未能連線到模型，請稍後再試。",
          },
        ]);
        setLiveFollowUps(["可以再試一次嗎？", "哪些資料仍需要我確認？", "先幫我整理目前重點"]);
      })
      .finally(() => setIsResponding(false));
  }

  function askTopic(topic: MerchantTopic) {
    const label = merchantTopics.find((item) => item.id === topic)?.label;
    if (!label) return;

    if (isLiveMode) {
      askLive(label);
      return;
    }

    setTurns((current) => [
      ...current,
      { id: `owner-${topic}-${Date.now()}`, kind: "text", speaker: "owner", text: label },
    ]);
    setShowDetailChoices(false);
    setPendingRequest(topic);
  }

  function askOpeningPrompt() {
    if (isLiveMode) {
      askLive(merchantOpeningPrompt);
      return;
    }

    setTurns((current) => [
      ...current,
      { id: `owner-overview-${Date.now()}`, kind: "text", speaker: "owner", text: merchantOpeningPrompt },
    ]);
    setPendingRequest("overview");
  }

  function openSocialDraftPreview() {
    setShowDetailChoices(false);
    setTurns((current) => [
      ...current,
      { id: `owner-xiaohongshu-${Date.now()}`, kind: "text", speaker: "owner", text: "預覽小紅書內容（Demo）" },
    ]);
    setPublicationState("generating");
  }

  function sendMessage() {
    const text = composerValue.trim();
    if (!text || isResponding) return;

    if (isLiveMode) {
      askLive(text);
      setComposerValue("");
      return;
    }

    setTurns((current) => [...current, { id: `owner-free-${Date.now()}`, kind: "text", speaker: "owner", text }]);
    setComposerValue("");
    setIsResponding(true);
  }

  return (
    <main className="flex min-h-full flex-col bg-heritage-soft text-foreground">
      <header className="border-heritage-border border-b bg-heritage-surface/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-heritage-gold/15 text-heritage-gold">
              <PawPrint aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h1 className="font-heritage-display font-semibold text-2xl">Pawly</h1>
              <p className="mt-0.5 text-muted-foreground text-sm">{heroCopy?.displayName ?? shop.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {liveMode ? <span className="rounded-full bg-heritage-success/15 px-2.5 py-1 text-heritage-success text-xs">Live LLM</span> : null}
            <span className="text-muted-foreground text-sm">商戶對話</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div className="space-y-7">
          <MerchantChatMessage speaker="pawly">
            <div className="space-y-2">
              <h2 className="font-heritage-display font-semibold text-2xl">你好，老闆！</h2>
              <p>
                {heroCopy?.opening ??
                  "今日最值得留意的是：遊客對店舖故事有興趣，但相關內容曝光仍然值得你留意。我可以同你逐樣睇。"}
              </p>
            </div>
          </MerchantChatMessage>

          {turns.map((turn) => (
            <MerchantChatMessage key={turn.id} speaker={turn.speaker}>
              {turn.kind === "topic" ? (
                <MerchantTopicResponse
                  onGenerate={() => setPublicationState("generating")}
                  presentation={heroCopy}
                  shop={sharedShop}
                  topic={turn.topic}
                />
              ) : (
                turn.speaker === "pawly" ? <PawlyMarkdown>{turn.text}</PawlyMarkdown> : <p>{turn.text}</p>
              )}
            </MerchantChatMessage>
          ))}

          {isResponding || pendingRequest ? (
            <MerchantChatMessage isThinking speaker="pawly" thinkingLabel={getThinkingLabel(pendingRequest)} />
          ) : null}

          {showDetailChoices ? (
            <MerchantChatMessage speaker="pawly">
              <div className="space-y-4">
                <p className="font-heritage-display font-semibold text-xl">你想知道店舖曝光數據，定係市民評價？</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {merchantTopics.slice(0, 2).map((topic) => {
                    const Icon = icons[topic.id];
                    return (
                      <button
                        className="flex min-h-12 items-center gap-3 rounded-xl border border-heritage-border bg-heritage-soft/50 px-4 text-left font-medium text-sm transition-colors hover:border-heritage/60 hover:bg-heritage-success-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage"
                        key={topic.id}
                        onClick={() => askTopic(topic.id)}
                        type="button"
                      >
                        <Icon aria-hidden="true" className="size-4 text-heritage-gold-foreground" />
                        {topic.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </MerchantChatMessage>
          ) : null}

          {publicationState === "generating" ? <MerchantChatMessage isThinking speaker="pawly" /> : null}
          {publicationState === "ready" || publicationState === "publishing" || publicationState === "published" ? (
            <MerchantChatMessage speaker="pawly">
              <MerchantDraftPreview
                onPublish={() => setPublicationState("publishing")}
                postId={publicationState === "published" ? telemetry.publication.post_id : null}
                publishedAt={publicationState === "published" ? telemetry.publication.published_at : null}
                state={publicationState}
                shop={sharedShop}
                telemetry={telemetry}
                presentation={heroCopy}
              />
            </MerchantChatMessage>
          ) : null}
          {publicationState === "failed" ? (
            <MerchantChatMessage speaker="pawly">
              <MerchantPublicationStatus postId={null} publishedAt={null} state={publicationState} />
            </MerchantChatMessage>
          ) : null}
        </div>

        <section aria-label="Pawly 建議問題" className="mt-9 border-heritage-border border-t pt-5">
          <p className="text-muted-foreground text-sm">{turns.length === 0 ? "你可以問 Pawly：" : "繼續問 Pawly："}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {turns.length > 0 && !showDetailChoices && !pendingRequest && !isResponding
              ? isLiveMode
                ? liveFollowUps.map((prompt) => (
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-heritage-border bg-heritage-surface px-4 font-medium text-sm transition-colors hover:border-heritage/60 hover:bg-heritage-success-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage"
                      key={prompt}
                      onClick={() => askLive(prompt)}
                      type="button"
                    >
                      <MessageCircle aria-hidden="true" className="size-4 text-heritage-gold-foreground" />
                      {prompt}
                    </button>
                  ))
                : merchantTopics.map((topic) => {
                    const Icon = icons[topic.id];
                    return (
                      <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-heritage-border bg-heritage-surface px-4 font-medium text-sm transition-colors hover:border-heritage/60 hover:bg-heritage-success-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage"
                        key={topic.id}
                        onClick={() => askTopic(topic.id)}
                        type="button"
                      >
                        <Icon aria-hidden="true" className="size-4 text-heritage-gold-foreground" />
                        {topic.label}
                      </button>
                    );
                  })
              : null}
            {turns.length === 0 ? (
              <>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-heritage-border bg-heritage-surface px-4 font-medium text-sm transition-colors hover:border-heritage/60 hover:bg-heritage-success-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage"
                  onClick={askOpeningPrompt}
                  type="button"
                >
                  <MessageCircle aria-hidden="true" className="size-4 text-heritage-gold-foreground" />
                  {merchantOpeningPrompt}
                </button>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#efc2ba] bg-[#fff7f5] px-4 font-medium text-[#b54235] text-sm transition-colors hover:border-[#c95043] hover:bg-[#ffefec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c95043] focus-visible:ring-offset-2"
                  onClick={openSocialDraftPreview}
                  type="button"
                >
                  <Send aria-hidden="true" className="size-4" />
                  預覽小紅書內容（Demo）
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 border-heritage-border border-t bg-heritage-soft/95">
        <div className="mx-auto w-full max-w-5xl">
          <MerchantChatComposer
            disabled={isResponding || pendingRequest !== null}
            onChange={setComposerValue}
            onSend={sendMessage}
            value={composerValue}
          />
        </div>
      </div>
    </main>
  );
}
