# Merchant Chat Workspace + Data Workspace Design

## Decision

Adopt the Claude-like transcript workspace direction for Merchant while preserving Heritage Trace's warm archival identity. The Merchant surface has two distinct experiences:

- `/merchant`: a full conversation transcript between Pawly and the role **老闆**.
- `/merchant/data`: a calm, premium operations workspace for telemetry, publication, and verified heritage evidence.

The two surfaces share the existing Merchant rail, shop query, data boundary, and visual tokens, but they do not share the same information architecture.

## Chat surface

### Structure

Replace the current topic-card-first layout with a message transcript. The page remains a full-bleed warm-neutral canvas; it must not be placed inside a large yellow or beige frame.

The reading order is:

1. compact shop/Pawly identity;
2. Pawly greeting message;
3. accumulated Pawly and 老闆 messages;
4. suggested prompts;
5. contextual evidence, recommendation, and Xiaohongshu messages;
6. sticky or naturally anchored composer.

### Roles and avatars

- Pawly messages use a small Pawly/paw avatar with Heritage Gold as a restrained identity accent.
- Owner messages use a neutral owner avatar labelled **老闆**. Do not use `李`, `李記`, or a personal owner name in the avatar or role label.
- Role names are visible text, not colour-only distinctions.

### Conversation state

Keep conversation state local to `MerchantPawly`; do not change Workflow types or backend contracts.

```text
messages: ChatMessage[]
composerValue: string
isResponding: boolean
publicationState: existing PublicationFlowState
```

Suggested prompt clicks append a 老闆 message and then the existing deterministic topic response as a Pawly message. Free-text send appends a 老闆 message and receives a deterministic, clearly bounded Pawly acknowledgement that points back to verified signals; it must not invent heritage facts or imply a live backend request.

The response transition should expose a short loading state such as `Pawly 正在整理已核實資料`, preserve keyboard focus, and use `aria-live` for the new response. Existing progressive topic and publication tests remain valid and gain transcript assertions.

### Composer

Use a Claude-like quiet composer at the bottom of the conversation:

- placeholder: `想問 Pawly？`;
- text input with visible focus ring;
- send button with icon and `aria-label="發送訊息"`;
- disabled while empty or responding;
- Enter submits; Shift+Enter keeps a newline only if a textarea is used;
- mobile safe-area padding and at least 44px touch target.

No fake backend send is introduced. The composer is a deterministic demo interaction over current `HeritageShop` state.

## Data workspace

Keep `/merchant/data` as the detailed data surface, but refine it away from a generic KPI dashboard.

- Preserve the left Merchant workspace rail and shop query.
- Use a full-bleed paper/neutral canvas with a quiet identity header.
- Replace the four equal KPI cards as the dominant visual with a compact metric strip or typographic summary.
- Give the exposure log and sentiment signals the primary reading weight.
- Keep publication and Workflow/RevisedAssetCard evidence as a secondary right-side inspector on wide screens; stack in reading order on narrow screens.
- Prefer hairline dividers, restrained 12–16px radii, typography, and surface contrast over nested cards and heavy shadows.
- Keep tables horizontally scrollable on narrow screens.

The data workspace continues to use `MerchantTelemetry`, `ShopSignals`, `ShopInsight`, `SuccessfulResult`, and `RevisedAssetCard` exactly as currently defined.

## Visual language

Use the following semantic direction without changing global Government tokens:

```text
Canvas:         #F7F6F2
Paper:          #FFFDF9
Ink:            #252A27
Muted Ink:      #70756F
Heritage Green: #355C48  action / selected / verified
Heritage Gold:  #9A7B35  Pawly / heritage identity only
Border:         #DEDAD1
```

Gold must not become the page background. Green owns primary actions and selected states. Avoid purple/pink AI gradients, glass effects, decorative phone chrome, and SaaS dashboard ornament.

## File boundaries

Likely Merchant-only changes:

- `src/components/merchant/merchant-pawly.tsx`
- `src/components/merchant/merchant-topic-response.tsx`
- `src/components/merchant/merchant-draft-preview.tsx`
- `src/components/merchant/merchant-surface-frame.tsx`
- `src/components/merchant/merchant-data-console.tsx`
- new focused chat message/composer components and tests where they reduce complexity

Do not modify Government components, OpenAPI contracts, generated Workflow types, or backend payloads.

## Acceptance criteria

- `/merchant` reads immediately as a conversation, not a yellow-framed dashboard.
- Both Pawly and 老闆 have visible avatars and role labels.
- Suggested prompts and free-text messages append to one transcript.
- Send/loading/response states are deterministic, accessible, and do not invent facts.
- Existing draft/publication flow remains grounded in the same `shop_id` and verified asset card.
- `/merchant/data` feels like a premium research/operations workspace while retaining all required telemetry and evidence.
- 375px, 768px, and 1440px layouts have no overflow and maintain logical reading/focus order.
- Scoped Biome and focused tests pass; known Government baseline failures remain isolated and documented.
