import { describe, expect, it } from "vitest";

import type { SuccessfulResult } from "./application-types";
import { getPublicWorkflowIssues } from "./workflow-presentation";

type Issue = SuccessfulResult["issues"][number];

describe("workflow presentation", () => {
  it("does not render internal fixture-contract warnings", () => {
    const issues: Issue[] = [
      {
        claim_id: "fixture-1",
        issue_type: "content_nature_violation",
        description: "Internal fixture warning",
        recommended_action: "Do not render this",
      },
      {
        claim_id: "claim-2",
        issue_type: "insufficient_locator",
        description: "需要補充來源位置。",
        recommended_action: "補充原始資料。",
      },
    ];

    expect(getPublicWorkflowIssues(issues)).toEqual([issues[1]]);
  });
});
