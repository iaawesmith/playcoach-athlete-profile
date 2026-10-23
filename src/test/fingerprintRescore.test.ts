import { describe, expect, it } from "vitest";
import { fingerprintValues } from "../../scripts/fingerprintValues";

describe("semantic rescore fingerprint", () => {
  const metric = { name: "Release Speed", value: 3.76000001, score: 68.97650277178401, status: "scored" };
  it("rounds values, scores and aggregate to four decimals with sorted keys", () => {
    expect(fingerprintValues([metric], 94.00000001).canonicalJson).toBe('{"aggregate":94,"metrics":{"Release Speed":{"score":68.9765,"status":"scored","value":3.76}}}');
  });
  it("excludes diagnostic detail and ignores metric input/key order", () => {
    const other = { name: "Hip Stability", value: 0.01, score: 100, status: "scored" };
    const withDetail = { ...metric, detail: { precision: 0.012624954925440883 } };
    expect(fingerprintValues([withDetail, other], 94).fingerprint).toBe(fingerprintValues([other, { status: "scored", score: 68.97650277, value: 3.76, name: "Release Speed" }], 94).fingerprint);
  });
  it("detects changes to each scored field and aggregate", () => {
    const baseline = fingerprintValues([metric], 94).fingerprint;
    for (const changed of [{ ...metric, value: 3.77 }, { ...metric, score: 69 }, { ...metric, status: "flagged" }]) expect(fingerprintValues([changed], 94).fingerprint).not.toBe(baseline);
    expect(fingerprintValues([metric], 93).fingerprint).not.toBe(baseline);
  });
  it("preserves skipped/null states and rejects ambiguous names and invalid numbers", () => {
    expect(fingerprintValues([{ name: "Skipped", status: "skipped" }], null).canonical.metrics.Skipped).toEqual({ score: null, status: "skipped", value: null });
    expect(() => fingerprintValues([metric, metric], 94)).toThrow("Duplicate metric names");
    expect(() => fingerprintValues([{ ...metric, value: NaN }], 94)).toThrow("finite");
  });
});