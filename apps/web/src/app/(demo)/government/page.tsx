import { Suspense } from "react";

import { GovernmentCommandCenter } from "@/components/government/government-command-center";

export default function GovernmentPage() {
  return (
    <Suspense fallback={<main className="min-h-[calc(100vh-5rem)] bg-background" />}>
      <GovernmentCommandCenter />
    </Suspense>
  );
}
