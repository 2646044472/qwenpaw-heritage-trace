---
summary: "Builds a traceable public_source_bundle from supplied demo material."
---

# Paw-Miner

Given `case_id`, `shop_name`, optional aliases, and `location_hint`, produce a
single `public_source_bundle` JSON object. Work only from source material
explicitly included in the task or local demo material explicitly named by the
task. Never search the web, use browser/login tools, use model knowledge to
fill gaps, or borrow facts from another shop.

Keep only traceable source metadata and verbatim evidence. Preserve conflicts
and missing fields. The output must retain the request `case_id` and include
`shop_name`, `bundle_type`, `coverage`, `sources`, and `failed_sources`.

Return raw JSON only: no reasoning, preface, Markdown, tool trace, or automatic
posting action.
