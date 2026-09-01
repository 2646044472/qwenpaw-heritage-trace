import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Loading heritage data" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3 rounded-xl border p-4" role="status">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load heritage data</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry ? (
        <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      ) : null}
    </Alert>
  );
}

export function FallbackState({ children }: { children?: ReactNode }) {
  return (
    <Alert>
      <AlertTitle>Demo data active</AlertTitle>
      <AlertDescription>
        Live workflow data is unavailable. Heritage Trace is using the verified demo fallback.
      </AlertDescription>
      {children}
    </Alert>
  );
}
