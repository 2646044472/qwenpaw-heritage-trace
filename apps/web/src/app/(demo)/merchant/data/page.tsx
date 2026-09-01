import { DemoShopSync } from "@/components/demo/demo-shop-sync";
import { MerchantDataConsole } from "@/components/merchant/merchant-data-console";
import { MerchantSurfaceFrame } from "@/components/merchant/merchant-surface-frame";
import { getDemoHeritageShop } from "@/lib/heritage/demo-seeds";
import { getMerchantTelemetry } from "@/lib/heritage/merchant-telemetry-fixtures";

export default async function MerchantDataPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const { shop } = await searchParams;
  const heritageShop = getDemoHeritageShop(shop);
  const telemetry = getMerchantTelemetry(heritageShop.shop_id);

  return (
    <>
      <DemoShopSync shopId={heritageShop.shop_id} />
      <MerchantSurfaceFrame activeSurface="data" shopId={heritageShop.shop_id}>
        <MerchantDataConsole shop={heritageShop} telemetry={telemetry} />
      </MerchantSurfaceFrame>
    </>
  );
}
