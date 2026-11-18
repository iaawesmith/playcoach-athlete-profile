# Catch search from snap — November 18, 2026

Analyzer build `ebf3657-2026-11-18`, deployed source SHA256 `3c8d4939a9aac2f69d7d0602b000e72e25b4084bdfba8e18c51a3d2718fe5d2b`.

`detectCatchAfterSnap` searches snap through the final frame using the unchanged `detectCatch` methods. It prefers the existing post-break candidate if available, otherwise retains the full-range candidate. The preliminary catch used to bound break detection remains unchanged. Live analysis and stored-data event preview share this wrapper. Logs record inclusive search range, selected method or failure reason, and preference selection.

No changes to break detection, metric definitions, scoring math, node configs, Reference or pose service. Original stored baseline fingerprint fba7237f… verified unchanged (94).

## Fresh runs, submitted and read back through Testing Panel

| Clip | Before → after | Catch | Search range | Submit-to-result | Result ID |
|---|---|---|---|---|---|
| Slant Sideline | 94 → 94 | 85, hands_raised_together | 10–89 | 71.1 s | 7d3317ce-b23d-4bb2-acef-6f95be31c596 |
| Curl Sideline | 69 → 69 | 99, hands_converging_forward_reach | 21–154 | 68.8 s | fac6d48d-6b65-4e9f-95b3-50394c7dd298 |
| Corner Sideline | 79 → 79 | 126, hands_converging_forward_reach | 12–195 | 72.8 s | 7dad06cf-7c83-4fe8-8468-72f0da7c8141 |
| Wheel Sideline | 67 → 67 | not detected: no_hands_together | 58–273 | 96.5 s | 6c506001-464c-43a8-bbbc-66ff6996a81f |
| In Sideline | 98 → 98 | not detected: no_hands_together | 12–155 | 71.2 s | acb93241-f0eb-4ae6-a2c4-8eef42317a42 |

Before scores taken from latest stored results before deployment. Break frames remain Slant 44, Curl 75, Corner 57, Wheel 235, In 92. Wheel and In also failed the widened search on their prior stored data; boundary expansion alone does not make either existing hands method qualify. No thresholds or methods were altered to force detections.

204 tests pass; preview build OK; no browser page errors. Real Analysis Log lines confirmed range/method/failure reason. No stored runs were overwritten.