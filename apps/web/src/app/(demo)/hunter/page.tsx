import { DemoShopSync } from "@/components/demo/demo-shop-sync";
import { HunterPresentation } from "@/components/hunter/hunter-presentation";
import { getHunterShops, resolveHunterShop } from "@/lib/heritage/hunter-data";

export default async function HunterPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const { shop } = await searchParams;
  const resolution = resolveHunterShop(shop);
  const shops = getHunterShops();

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#f5f1e8] px-3 py-5 sm:px-6 sm:py-8">
      <DemoShopSync shopId={resolution.shop.shopId} />
      <HunterPresentation initialShopId={resolution.shop.shopId} shops={shops} />
    </main>
  );
}
