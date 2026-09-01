"use client";

import { useEffect } from "react";

import { useDemoState } from "./demo-state-provider";

export function DemoShopSync({ shopId }: { shopId: string }) {
  const { selectShop } = useDemoState();

  useEffect(() => selectShop(shopId), [selectShop, shopId]);
  return null;
}
