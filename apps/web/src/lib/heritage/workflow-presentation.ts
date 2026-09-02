import type { SuccessfulResult } from "./application-types";

type WorkflowIssue = SuccessfulResult["issues"][number];

// These checks protect the workflow's fixture/demo contract. They remain in
// audit data but are not actionable for reviewers, so raw codes never render
// in public-facing views.
const INTERNAL_ISSUE_TYPES = new Set<WorkflowIssue["issue_type"]>([
  "content_nature_violation",
]);

export function getPublicWorkflowIssues(issues: WorkflowIssue[]): WorkflowIssue[] {
  return issues.filter((issue) => !INTERNAL_ISSUE_TYPES.has(issue.issue_type));
}
