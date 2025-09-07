import { describe, expect, it } from "vitest";
import { chimeraDefaultComparator, chimeraDefaultKeyFromOrder, chimeraDefaultOrderConfig } from "./defaults.ts";
import { ChimeraOrderNulls } from "./types.ts";

describe("Order Defaults", () => {
	it("should export chimeraDefaultOrderConfig", () => {
		expect(chimeraDefaultOrderConfig.primitiveComparator).toBe(chimeraDefaultComparator);
		expect(chimeraDefaultOrderConfig.getKey).toBe(chimeraDefaultKeyFromOrder);
	});

	it("should have correct default order configuration", () => {
		// Test that the default order config has expected properties
		expect(typeof chimeraDefaultOrderConfig.primitiveComparator).toBe("function");
		expect(typeof chimeraDefaultOrderConfig.getKey).toBe("function");
	});

	it("compares strings", () => {
		expect(chimeraDefaultComparator("a", "b")).toBeLessThan(0);
		expect(chimeraDefaultComparator("b", "a")).toBeGreaterThan(0);
		expect(chimeraDefaultComparator("a", "a")).toBe(0);
	});
	it("compares numbers", () => {
		expect(chimeraDefaultComparator(1, 2)).toBeLessThan(0);
		expect(chimeraDefaultComparator(2, 1)).toBeGreaterThan(0);
		expect(chimeraDefaultComparator(1, 1)).toBe(0);
	});
	it("compares dates", () => {
		const d1 = new Date("2020-01-01");
		const d2 = new Date("2021-01-01");
		expect(chimeraDefaultComparator(d1, d2)).toBeLessThan(0);
		expect(chimeraDefaultComparator(d2, d1)).toBeGreaterThan(0);
		expect(chimeraDefaultComparator(d1, new Date("2020-01-01"))).toBe(0);
	});
	it("handles nulls and undefined", () => {
		expect(chimeraDefaultComparator(null, 1)).toBeLessThan(0);
		expect(chimeraDefaultComparator(1, null)).toBeGreaterThan(0);
	});
	it("throws on unsupported types", () => {
		expect(() => chimeraDefaultComparator({}, 1)).toThrow();
		expect(() => chimeraDefaultComparator([], 1)).toThrow();
		expect(() => chimeraDefaultComparator(Symbol("a"), "a")).toThrow();
	});
	it("serializes null and empty order", () => {
		expect(chimeraDefaultKeyFromOrder(null)).toBe("null");
		expect(chimeraDefaultKeyFromOrder([])).toBe("[]");
	});
	it("serializes simple and complex order", () => {
		const order = [
			{desc: false, get: "name", nulls: ChimeraOrderNulls.Last},
			{desc: true, get: "age", nulls: ChimeraOrderNulls.First},
		];
		expect(chimeraDefaultKeyFromOrder(order)).toBe(JSON.stringify(order));
	});
});
