import { GovernmentEvidenceDetail } from "@/components/government/government-evidence-detail";
import { getDemoHeritageShop, getDemoShopSeed } from "@/lib/heritage/demo-seeds";

export default async function GovernmentEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seed = getDemoShopSeed(id);
  return <GovernmentEvidenceDetail shop={getDemoHeritageShop(seed.shop_id)} />;
}
