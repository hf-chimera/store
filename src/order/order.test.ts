import { describe, expect, it } from "vitest";
import { chimeraDefaultComparator } from "./defaults.ts";
import { buildComparator, chimeraCreateOrderBy, simplifyOrderBy } from "./order.ts";
import type { ChimeraOrderPriority } from "./types.ts";
import { ChimeraOrderNulls } from "./types.ts";

interface TestEntity {
	name: string | null;
	age: number | null;
	date: Date | null;
}

const entityA: TestEntity = { age: 30, date: new Date("2020-01-01"), name: "Alice" };
const entityB: TestEntity = { age: 25, date: new Date("2021-01-01"), name: "Bob" };
const entityNull: TestEntity = { age: null, date: null, name: null };

describe("Order", () => {
	it("should build comparator correctly", () => {
		const orderBy = [chimeraCreateOrderBy<TestEntity>("age")];
		const cmp = buildComparator<TestEntity>(chimeraDefaultComparator, orderBy);
		expect(cmp(entityA, entityB)).toBeGreaterThan(0);
		expect(cmp(entityB, entityA)).toBeLessThan(0);
		expect(cmp(entityA, entityA)).toBe(0);
	});

	it("should simplify order by correctly", () => {
		const orderBy = [chimeraCreateOrderBy<TestEntity>("name", true, ChimeraOrderNulls.First)];
		const simplified = simplifyOrderBy<TestEntity>(orderBy);
		expect(simplified).toEqual([{ desc: true, field: "name", nulls: ChimeraOrderNulls.First }]);
		expect(simplifyOrderBy<TestEntity>(undefined)).toBeNull();
		expect(simplifyOrderBy<TestEntity>(null as unknown as ChimeraOrderPriority<TestEntity>)).toBeNull();
	});

	it("should handle complex ordering expressions", () => {
		// Multiple fields, desc, nulls
		const orderBy = [
			chimeraCreateOrderBy<TestEntity>("name"),
			chimeraCreateOrderBy<TestEntity>("age", true, ChimeraOrderNulls.First),
		];
		const cmp = buildComparator<TestEntity>(chimeraDefaultComparator, orderBy);
		expect(cmp(entityA, entityB)).toBeLessThan(0); // Alice < Bob
		expect(cmp(entityB, entityA)).toBeGreaterThan(0);
		expect(cmp(entityA, { ...entityA }) || 0).toBe(0);
		// nulls first
		const orderByNulls = [chimeraCreateOrderBy<TestEntity>("age", true, ChimeraOrderNulls.First)];
		const cmpNulls = buildComparator<TestEntity>(chimeraDefaultComparator, orderByNulls);
		expect(cmpNulls(entityNull, entityA)).toBeLessThan(0);
		expect(cmpNulls(entityA, entityNull)).toBeGreaterThan(0);
	});

	it("should apply first order condition when different, second condition when first is equal", () => {
		// Create entities with same name but different ages
		const entity1: TestEntity = { name: "Alice", age: 30, date: new Date("2020-01-01") };
		const entity2: TestEntity = { name: "Alice", age: 25, date: new Date("2021-01-01") };
		const entity3: TestEntity = { name: "Bob", age: 20, date: new Date("2022-01-01") };

		// Order by name first, then age (ascending)
		const orderBy = [
			chimeraCreateOrderBy<TestEntity>("name"),
			chimeraCreateOrderBy<TestEntity>("age"),
		];
		const cmp = buildComparator<TestEntity>(chimeraDefaultComparator, orderBy);

		// When names are equal, second condition (age) should be applied
		// entity1 (age 30) > entity2 (age 25), so entity1 should be greater
		expect(cmp(entity1, entity2)).toBeGreaterThan(0);
		expect(cmp(entity2, entity1)).toBeLessThan(0);

		// When names are different, first condition should be applied
		// Alice < Bob, so entity1/entity2 should be less than entity3
		expect(cmp(entity1, entity3)).toBeLessThan(0);
		expect(cmp(entity2, entity3)).toBeLessThan(0);
		expect(cmp(entity3, entity1)).toBeGreaterThan(0);
		expect(cmp(entity3, entity2)).toBeGreaterThan(0);
	});

	it("should apply first order condition even if it would conflict with second condition", () => {
		// Create entities where first condition gives one order, second would give opposite
		const entity1: TestEntity = { name: "Alice", age: 25, date: new Date("2020-01-01") };
		const entity2: TestEntity = { name: "Bob", age: 30, date: new Date("2021-01-01") };

		// Order by name first (Alice < Bob), then age descending (30 > 25)
		// First condition should win: Alice < Bob, regardless of age
		const orderBy = [
			chimeraCreateOrderBy<TestEntity>("name"),
			chimeraCreateOrderBy<TestEntity>("age", true), // desc
		];
		const cmp = buildComparator<TestEntity>(chimeraDefaultComparator, orderBy);

		// Alice < Bob, so first condition should be applied
		expect(cmp(entity1, entity2)).toBeLessThan(0);
		expect(cmp(entity2, entity1)).toBeGreaterThan(0);
	});
});
