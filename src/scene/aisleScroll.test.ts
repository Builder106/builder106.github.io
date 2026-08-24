import { describe, expect, it } from "vitest";
import { aisleScroll } from "./aisleScroll";

describe("aisleScroll", () => {
  it("clamps progress and notifies subscribers only on changes", () => {
    const seen: number[] = [];
    const unsubscribe = aisleScroll.subscribe((value) => seen.push(value));
    aisleScroll.set(-1);
    aisleScroll.set(0.4);
    aisleScroll.set(0.4);
    aisleScroll.add(2);
    unsubscribe();
    aisleScroll.set(0);
    expect(seen).toEqual([0.4, 1]);
    expect(aisleScroll.progress).toBe(0);
  });
});
