import { DemoShopSync } from "@/components/demo/demo-shop-sync";
import { MerchantPawly } from "@/components/merchant/merchant-pawly";
import { MerchantSurfaceFrame } from "@/components/merchant/merchant-surface-frame";
import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";

export default async function MerchantPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const { shop } = await searchParams;
  const heritageShop = getDemoHeritageShop(shop);

  return (
    <>
      <DemoShopSync shopId={heritageShop.shop_id} />
      <MerchantSurfaceFrame activeSurface="pawly" shopId={heritageShop.shop_id}>
        <MerchantPawly shop={heritageShop} />
      </MerchantSurfaceFrame>
    </>
  );
}
