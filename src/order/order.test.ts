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
		expect(simplified).toEqual([{ desc: true, field: 'name', nulls: ChimeraOrderNulls.First }]);
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
		expect(cmp(entityA, { ...entityA })).toBe(0);
		// nulls first
		const orderByNulls = [chimeraCreateOrderBy<TestEntity>("age", true, ChimeraOrderNulls.First)];
		const cmpNulls = buildComparator<TestEntity>(chimeraDefaultComparator, orderByNulls);
		expect(cmpNulls(entityNull, entityA)).toBeLessThan(0);
		expect(cmpNulls(entityA, entityNull)).toBeGreaterThan(0);
	});
});
