"use client";

import { useEffect, useState } from "react";

import { Lightbulb, MessageCircle, PawPrint, TrendingDown } from "lucide-react";

import type { HeritageShop } from "@/lib/heritage/application-types";
import { HERO_SHOP_ID, createHeritageShopFromWorkflow } from "@/lib/heritage/demo-seeds";
import { getMerchantTelemetry } from "@/lib/heritage/merchant-telemetry-fixtures";

import { useDemoState } from "../demo/demo-state-provider";

import { MerchantChatComposer } from "./merchant-chat-composer";
import { MerchantChatMessage } from "./merchant-chat-message";
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
  if (request === "sentiment") return "正在調用小紅書工具，整理市民評價";
  if (request === "overview") return "Pawly 正在整理最近訊號";
  return "Pawly 正在整理已核實資料";
}

export function MerchantPawly({ shop }: { shop: HeritageShop }) {
  const { state } = useDemoState();
  const [composerValue, setComposerValue] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [showDetailChoices, setShowDetailChoices] = useState(false);
  const [publicationState, setPublicationState] = useState<PublicationFlowState>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const sharedShop =
    state.selectedShopId === HERO_SHOP_ID && state.pipeline.workflowResult?.workflow_status === "finished"
      ? createHeritageShopFromWorkflow(HERO_SHOP_ID, state.pipeline.workflowResult)
      : shop;
  const telemetry = getMerchantTelemetry(sharedShop.shop_id);
  const heroCopy = merchantHeroCopy[sharedShop.shop_id];

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
    if (!isResponding) return;
    const timer = window.setTimeout(() => {
      setTurns((current) => [
        ...current,
        { id: `reply-${Date.now()}`, kind: "reply", speaker: "pawly", text: freeTextReply },
      ]);
      setIsResponding(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isResponding]);

  function askTopic(topic: MerchantTopic) {
    const label = merchantTopics.find((item) => item.id === topic)?.label;
    if (!label) return;

    setTurns((current) => [
      ...current,
      { id: `owner-${topic}-${Date.now()}`, kind: "text", speaker: "owner", text: label },
    ]);
    setShowDetailChoices(false);
    setPendingRequest(topic);
  }

  function askOpeningPrompt() {
    setTurns((current) => [
      ...current,
      { id: `owner-overview-${Date.now()}`, kind: "text", speaker: "owner", text: merchantOpeningPrompt },
    ]);
    setPendingRequest("overview");
  }

  function sendMessage() {
    const text = composerValue.trim();
    if (!text || isResponding) return;

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
          <span className="text-muted-foreground text-sm">商戶對話</span>
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
                <p>{turn.text}</p>
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
            {(turns.length > 0 && !showDetailChoices && !pendingRequest ? merchantTopics : []).map((topic) => {
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
            })}
            {turns.length === 0 ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-heritage-border bg-heritage-surface px-4 font-medium text-sm transition-colors hover:border-heritage/60 hover:bg-heritage-success-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage"
                onClick={askOpeningPrompt}
                type="button"
              >
                <MessageCircle aria-hidden="true" className="size-4 text-heritage-gold-foreground" />
                {merchantOpeningPrompt}
              </button>
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
