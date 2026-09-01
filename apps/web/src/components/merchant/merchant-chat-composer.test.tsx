import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MerchantChatComposer } from "./merchant-chat-composer";
import { MerchantChatMessage } from "./merchant-chat-message";

describe("Merchant chat primitives", () => {
  it("identifies Pawly and 老闆 while disabling an empty composer", () => {
    const onChange = vi.fn();
    const onSend = vi.fn();
    const { rerender } = render(
      <>
        <MerchantChatMessage speaker="pawly">已核實資料已準備好。</MerchantChatMessage>
        <MerchantChatMessage speaker="owner">我想了解今日情況。</MerchantChatMessage>
        <MerchantChatComposer disabled={false} onChange={onChange} onSend={onSend} value="" />
      </>,
    );

    expect(screen.getByText("Pawly")).toBeVisible();
    expect(screen.getAllByText("老闆")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "發送訊息" })).toBeDisabled();

    rerender(<MerchantChatComposer disabled={false} onChange={onChange} onSend={onSend} value="想知道更多" />);

    expect(screen.getByRole("button", { name: "發送訊息" })).toBeEnabled();
  });
});
