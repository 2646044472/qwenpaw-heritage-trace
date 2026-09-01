---
name: public_source_mining
description: "Create a traceable source bundle only from explicitly supplied local demo material."
qwenpaw:
  emoji: "🔎"
  requires: {}
---

# Public source mining

Read only the local material named in the task. Match the requested shop name
and explicit aliases conservatively. Keep a small, diverse set of sources with
their original URL, publisher, date when present, and verbatim evidence.

Never call web search, browser automation, social platforms, or a login tool.
Never fabricate source metadata, evidence, dates, people, or historical facts.
If no reliable match exists, return a failed bundle with empty `sources` and a
clear `failed_sources` reason. Output one `public_source_bundle` JSON object
and nothing else.
