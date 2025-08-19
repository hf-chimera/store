import { describe, expect, it } from "vitest";
import { ChimeraConjunctionSymbol } from "./constants.ts";
import {
	chimeraDefaultFilterConfig,
	chimeraDefaultFilterConjunctions,
	chimeraDefaultFilterOperators,
} from "./defaults.ts";
import {
	chimeraCreateConjunction,
	chimeraCreateOperator,
	compileConjunction,
	compileFilter,
	simplifyConjunction,
	simplifyFilter,
	simplifyOperator,
} from "./filter.ts";

describe("Filter Module - Unit Tests", () => {
	describe("defaults", () => {
		describe("chimeraDefaultFilterConjunctions", () => {
			describe("and", () => {
				it("should return true when all functions return true", () => {
					const operations = [() => true, () => true, () => true];
					expect(chimeraDefaultFilterConjunctions.and(operations)).toBe(true);
				});

				it("should return false when at least one function returns false", () => {
					const operations = [() => true, () => false, () => true];
					expect(chimeraDefaultFilterConjunctions.and(operations)).toBe(false);
				});

				it("should return false when all functions return false", () => {
					const operations = [() => false, () => false, () => false];
					expect(chimeraDefaultFilterConjunctions.and(operations)).toBe(false);
				});

				it("should return true for empty operations array", () => {
					const operations: (() => boolean)[] = [];
					expect(chimeraDefaultFilterConjunctions.and(operations)).toBe(true);
				});

				it("should short-circuit and not call remaining functions after first false", () => {
					let callCount = 0;
					const operations = [
						() => {
							callCount++;
							return true;
						},
						() => {
							callCount++;
							return false;
						},
						() => {
							callCount++;
							return true;
						},
					];

					const result = chimeraDefaultFilterConjunctions.and(operations);
					expect(result).toBe(false);
					expect(callCount).toBe(2); // Only first two functions should be called
				});

				it("should work with iterables that are not arrays", () => {
					const operations = new Set([() => true, () => false, () => true]);
					expect(chimeraDefaultFilterConjunctions.and(operations)).toBe(false);
				});
			});

			describe("or", () => {
				it("should return true when at least one function returns true", () => {
					const operations = [() => false, () => true, () => false];
					expect(chimeraDefaultFilterConjunctions.or(operations)).toBe(true);
				});

				it("should return true when all functions return true", () => {
					const operations = [() => true, () => true, () => true];
					expect(chimeraDefaultFilterConjunctions.or(operations)).toBe(true);
				});

				it("should return false when all functions return false", () => {
					const operations = [() => false, () => false, () => false];
					expect(chimeraDefaultFilterConjunctions.or(operations)).toBe(false);
				});

				it("should return false for empty operations array", () => {
					const operations: (() => boolean)[] = [];
					expect(chimeraDefaultFilterConjunctions.or(operations)).toBe(false);
				});

				it("should short-circuit and not call remaining functions after first true", () => {
					let callCount = 0;
					const operations = [
						() => {
							callCount++;
							return false;
						},
						() => {
							callCount++;
							return true;
						},
						() => {
							callCount++;
							return false;
						},
					];

					const result = chimeraDefaultFilterConjunctions.or(operations);
					expect(result).toBe(true);
					expect(callCount).toBe(2); // Only first two functions should be called
				});

				it("should work with iterables that are not arrays", () => {
					const operations = new Set([() => false, () => true, () => false]);
					expect(chimeraDefaultFilterConjunctions.or(operations)).toBe(true);
				});
			});
		});

		describe("chimeraDefaultFilterOperators", () => {
			describe("eq", () => {
				it("should return true for equal primitive values", () => {
					expect(chimeraDefaultFilterOperators.eq(5, 5)).toBe(true);
					expect(chimeraDefaultFilterOperators.eq("hello", "hello")).toBe(true);
					expect(chimeraDefaultFilterOperators.eq(true, true)).toBe(true);
					expect(chimeraDefaultFilterOperators.eq(null, null)).toBe(true);
					expect(chimeraDefaultFilterOperators.eq(undefined, undefined)).toBe(true);
				});

				it("should return false for different primitive values", () => {
					expect(chimeraDefaultFilterOperators.eq(5, 6)).toBe(false);
					expect(chimeraDefaultFilterOperators.eq("hello", "world")).toBe(false);
					expect(chimeraDefaultFilterOperators.eq(true, false)).toBe(false);
					expect(chimeraDefaultFilterOperators.eq(null, undefined)).toBe(false);
				});

				it("should handle type coercion edge cases", () => {
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.eq(0, false)).toBe(false);
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.eq(1, true)).toBe(false);
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.eq("", false)).toBe(false);
				});

				it("should handle object references", () => {
					const obj1 = { a: 1 };
					const obj2 = { a: 1 };
					const obj3 = obj1;

					expect(chimeraDefaultFilterOperators.eq(obj1, obj1)).toBe(true);
					expect(chimeraDefaultFilterOperators.eq(obj1, obj2)).toBe(false);
					expect(chimeraDefaultFilterOperators.eq(obj1, obj3)).toBe(true);
				});
			});

			describe("neq", () => {
				it("should return true for different values", () => {
					expect(chimeraDefaultFilterOperators.neq(5, 6)).toBe(true);
					expect(chimeraDefaultFilterOperators.neq("hello", "world")).toBe(true);
					expect(chimeraDefaultFilterOperators.neq(true, false)).toBe(true);
				});

				it("should return false for equal values", () => {
					expect(chimeraDefaultFilterOperators.neq(5, 5)).toBe(false);
					expect(chimeraDefaultFilterOperators.neq("hello", "hello")).toBe(false);
					expect(chimeraDefaultFilterOperators.neq(true, true)).toBe(false);
				});
			});

			describe("gt", () => {
				it("should return true when first value is greater", () => {
					expect(chimeraDefaultFilterOperators.gt(5, 3)).toBe(true);
					expect(chimeraDefaultFilterOperators.gt(10.5, 5.2)).toBe(true);
					expect(chimeraDefaultFilterOperators.gt("z", "a")).toBe(true);
				});

				it("should return false when first value is not greater", () => {
					expect(chimeraDefaultFilterOperators.gt(3, 5)).toBe(false);
					expect(chimeraDefaultFilterOperators.gt(5, 5)).toBe(false);
					expect(chimeraDefaultFilterOperators.gt("a", "z")).toBe(false);
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.gt(0, -0)).toBe(false);
					expect(chimeraDefaultFilterOperators.gt(Number.POSITIVE_INFINITY, 1000)).toBe(true);
					expect(chimeraDefaultFilterOperators.gt(Number.NEGATIVE_INFINITY, 1000)).toBe(false);
				});
			});

			describe("gte", () => {
				it("should return true when first value is greater or equal", () => {
					expect(chimeraDefaultFilterOperators.gte(5, 3)).toBe(true);
					expect(chimeraDefaultFilterOperators.gte(5, 5)).toBe(true);
					expect(chimeraDefaultFilterOperators.gte("z", "a")).toBe(true);
					expect(chimeraDefaultFilterOperators.gte("a", "a")).toBe(true);
				});

				it("should return false when first value is less", () => {
					expect(chimeraDefaultFilterOperators.gte(3, 5)).toBe(false);
					expect(chimeraDefaultFilterOperators.gte("a", "z")).toBe(false);
				});
			});

			describe("lt", () => {
				it("should return true when first value is less", () => {
					expect(chimeraDefaultFilterOperators.lt(3, 5)).toBe(true);
					expect(chimeraDefaultFilterOperators.lt(5.2, 10.5)).toBe(true);
					expect(chimeraDefaultFilterOperators.lt("a", "z")).toBe(true);
				});

				it("should return false when first value is not less", () => {
					expect(chimeraDefaultFilterOperators.lt(5, 3)).toBe(false);
					expect(chimeraDefaultFilterOperators.lt(5, 5)).toBe(false);
					expect(chimeraDefaultFilterOperators.lt("z", "a")).toBe(false);
				});
			});

			describe("lte", () => {
				it("should return true when first value is less or equal", () => {
					expect(chimeraDefaultFilterOperators.lte(3, 5)).toBe(true);
					expect(chimeraDefaultFilterOperators.lte(5, 5)).toBe(true);
					expect(chimeraDefaultFilterOperators.lte("a", "z")).toBe(true);
					expect(chimeraDefaultFilterOperators.lte("a", "a")).toBe(true);
				});

				it("should return false when first value is greater", () => {
					expect(chimeraDefaultFilterOperators.lte(5, 3)).toBe(false);
					expect(chimeraDefaultFilterOperators.lte("z", "a")).toBe(false);
				});
			});

			describe("contains", () => {
				it("should work with strings", () => {
					expect(chimeraDefaultFilterOperators.contains("hello world", "hello")).toBe(true);
					expect(chimeraDefaultFilterOperators.contains("hello world", "world")).toBe(true);
					expect(chimeraDefaultFilterOperators.contains("hello world", "xyz")).toBe(false);
					expect(chimeraDefaultFilterOperators.contains("hello world", "")).toBe(true);
				});

				it("should work with arrays", () => {
					expect(chimeraDefaultFilterOperators.contains([1, 2, 3], 2)).toBe(true);
					expect(chimeraDefaultFilterOperators.contains([1, 2, 3], 4)).toBe(false);
					expect(chimeraDefaultFilterOperators.contains(["a", "b", "c"], "b")).toBe(true);
				});

				it("should work with array-to-array matching", () => {
					expect(chimeraDefaultFilterOperators.contains([1, 2, 3, 4], [2, 3])).toBe(true);
					expect(chimeraDefaultFilterOperators.contains([1, 2, 3, 4], [2, 5])).toBe(false);
					expect(chimeraDefaultFilterOperators.contains([1, 2, 3], [1, 2, 3])).toBe(true);
				});

				it("should return false for non-string and non-array values", () => {
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.contains(123, "2"));
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.contains({ a: 1 }, "a"));
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.contains(null, "test"));
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.contains(undefined, "test"));
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.contains("", "")).toBe(true);
					expect(chimeraDefaultFilterOperators.contains([], 1)).toBe(false);
					expect(chimeraDefaultFilterOperators.contains([], [])).toBe(true);
				});
			});

			describe("startsWith", () => {
				it("should return true when string starts with prefix", () => {
					expect(chimeraDefaultFilterOperators.startsWith("hello world", "hello")).toBe(true);
					expect(chimeraDefaultFilterOperators.startsWith("hello world", "h")).toBe(true);
					expect(chimeraDefaultFilterOperators.startsWith("hello world", "hello world")).toBe(true);
				});

				it("should return false when string does not start with prefix", () => {
					expect(chimeraDefaultFilterOperators.startsWith("hello world", "world")).toBe(false);
					expect(chimeraDefaultFilterOperators.startsWith("hello world", "xyz")).toBe(false);
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.startsWith("hello", "")).toBe(true);
					expect(chimeraDefaultFilterOperators.startsWith("", "hello")).toBe(false);
					expect(chimeraDefaultFilterOperators.startsWith("", "")).toBe(true);
				});
			});

			describe("endsWith", () => {
				it("should return true when string ends with suffix", () => {
					expect(chimeraDefaultFilterOperators.endsWith("hello world", "world")).toBe(true);
					expect(chimeraDefaultFilterOperators.endsWith("hello world", "d")).toBe(true);
					expect(chimeraDefaultFilterOperators.endsWith("hello world", "hello world")).toBe(true);
				});

				it("should return false when string does not end with suffix", () => {
					expect(chimeraDefaultFilterOperators.endsWith("hello world", "hello")).toBe(false);
					expect(chimeraDefaultFilterOperators.endsWith("hello world", "xyz")).toBe(false);
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.endsWith("hello", "")).toBe(true);
					expect(chimeraDefaultFilterOperators.endsWith("", "hello")).toBe(false);
					expect(chimeraDefaultFilterOperators.endsWith("", "")).toBe(true);
				});
			});

			describe("in", () => {
				it("should work with single value in array", () => {
					expect(chimeraDefaultFilterOperators.in(2, [1, 2, 3])).toBe(true);
					expect(chimeraDefaultFilterOperators.in(4, [1, 2, 3])).toBe(false);
					expect(chimeraDefaultFilterOperators.in("b", ["a", "b", "c"])).toBe(true);
				});

				it("should work with array value in array", () => {
					expect(chimeraDefaultFilterOperators.in([1, 2], [1, 2, 3, 4])).toBe(true);
					expect(chimeraDefaultFilterOperators.in([6, 5], [1, 2, 3, 4])).toBe(false);
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.in(1, [])).toBe(false);
					expect(chimeraDefaultFilterOperators.in([], [1, 2, 3])).toBe(false);
					expect(chimeraDefaultFilterOperators.in([], [])).toBe(false);
				});
			});

			describe("notIn", () => {
				it("should work with single value not in array", () => {
					expect(chimeraDefaultFilterOperators.notIn(4, [1, 2, 3])).toBe(true);
					expect(chimeraDefaultFilterOperators.notIn(2, [1, 2, 3])).toBe(false);
					expect(chimeraDefaultFilterOperators.notIn("d", ["a", "b", "c"])).toBe(true);
				});

				it("should work with array value not in array", () => {
					expect(chimeraDefaultFilterOperators.notIn([6, 5], [1, 2, 3, 4])).toBe(true);
					expect(chimeraDefaultFilterOperators.notIn([1, 2], [1, 2, 3, 4])).toBe(false);
				});

				it("should handle edge cases", () => {
					expect(chimeraDefaultFilterOperators.notIn(1, [])).toBe(true);
					expect(chimeraDefaultFilterOperators.notIn([], [1, 2, 3])).toBe(true);
					expect(chimeraDefaultFilterOperators.notIn([], [])).toBe(true);
				});
			});
		});

		describe("chimeraDefaultFilterConfig", () => {
			it("should have correct structure", () => {
				expect(chimeraDefaultFilterConfig).toHaveProperty("conjunctions");
				expect(chimeraDefaultFilterConfig).toHaveProperty("operators");
				expect(chimeraDefaultFilterConfig).toHaveProperty("getKey");
			});

			it("should have and and or conjunctions", () => {
				expect(chimeraDefaultFilterConfig.conjunctions).toHaveProperty("and");
				expect(chimeraDefaultFilterConfig.conjunctions).toHaveProperty("or");
				expect(typeof chimeraDefaultFilterConfig.conjunctions.and).toBe("function");
				expect(typeof chimeraDefaultFilterConfig.conjunctions.or).toBe("function");
			});

			it("should have all required operators", () => {
				const expectedOperators = [
					"eq",
					"neq",
					"gt",
					"gte",
					"lt",
					"lte",
					"contains",
					"startsWith",
					"endsWith",
					"in",
					"notIn",
				];
				expectedOperators.forEach((op) => {
					expect(chimeraDefaultFilterConfig.operators).toHaveProperty(op);
					expect(
						typeof chimeraDefaultFilterConfig.operators[op as keyof typeof chimeraDefaultFilterConfig.operators],
					).toBe("function");
				});
			});

			it("should have getKey function", () => {
				expect(typeof chimeraDefaultFilterConfig.getKey).toBe("function");
			});
		});
	});

	describe("filter", () => {
		// Mock config and helpers
		const config = {
			conjunctions: {
				and: (ops: Iterable<() => boolean>) => {
					for (const op of ops) if (!op()) return false;
					return true;
				},
				or: (ops: Iterable<() => boolean>) => {
					for (const op of ops) if (op()) return true;
					return false;
				},
			},
			getKey: (filter: any) => JSON.stringify(filter),
			operators: {
				eq: (a: any, b: any) => a === b,
				gt: (a: any, b: any) => a > b,
				neq: (a: any, b: any) => a !== b,
			},
		};
		type Entity = { a: number; b: string };

		it("compileConjunction: should compile and evaluate conjunctions", () => {
			const desc = chimeraCreateConjunction<Entity, typeof config>("and", [
				chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 5),
				chimeraCreateOperator<Entity, typeof config, "gt">("gt", "a", 2),
			]);
			const checker = compileConjunction(config, desc);
			expect(checker({ a: 5, b: "x" })).toBe(true);
			expect(checker({ a: 2, b: "x" })).toBe(false);
		});

		it("compileConjunction: throws on unknown conjunction", () => {
			const desc = { kind: "notAConj", operations: [], type: Symbol.for("ChimeraConjunctionSymbol") } as any;
			expect(() => compileConjunction(config, desc)).toThrow();
		});

		it("simplifyOperator: should simplify operator descriptor", () => {
			const opDesc = chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 1);
			const simplified = simplifyOperator(opDesc);
			expect(simplified).toMatchObject({ key: "a", op: "eq", test: 1, type: expect.any(Symbol) });
		});

		it("simplifyConjunction: should simplify conjunction descriptor recursively", () => {
			const conjDesc = chimeraCreateConjunction<Entity, typeof config>("and", [
				chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 1),
				chimeraCreateConjunction<Entity, typeof config>("or", [
					chimeraCreateOperator<Entity, typeof config, "gt">("gt", "a", 0),
				]),
			]);
			const simplified = simplifyConjunction(conjDesc);
			expect(simplified).toMatchObject({
				kind: "and",
				operations: [
					{ key: "a", op: "eq", test: 1, type: expect.any(Symbol) },
					{
						kind: "or",
						operations: [{ key: "a", op: "gt", test: 0, type: expect.any(Symbol) }],
						type: expect.any(Symbol),
					},
				],
				type: expect.any(Symbol),
			});
		});

		it("chimeraCreateOperator: should create operator descriptor from string key", () => {
			const opDesc = chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 1);
			expect(opDesc).toMatchObject({ op: "eq", test: 1, type: expect.any(Symbol) });
			expect(typeof opDesc.value).toBe("object");
		});

		it("chimeraCreateOperator: should create operator descriptor from property getter", () => {
			const getter = { get: (e: Entity) => e.a, key: "a" };
			const opDesc = chimeraCreateOperator<Entity, typeof config, "eq">("eq", getter, 1);
			expect(opDesc.value).toBe(getter);
		});

		it("chimeraCreateConjunction: should create conjunction descriptor", () => {
			const conjDesc = chimeraCreateConjunction<Entity, typeof config>("and", []);
			expect(conjDesc).toMatchObject({ kind: "and", operations: [], type: expect.any(Symbol) });
		});

		it("compileFilter: should return always-true if no descriptor", () => {
			const checker = compileFilter<Entity>(config);
			expect(checker({ a: 1, b: "x" })).toBe(true);
		});

		it("compileFilter: should compile and check filter", () => {
			const desc = chimeraCreateConjunction<Entity, typeof config>("and", [
				chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 2),
			]);
			const checker = compileFilter<Entity>(config, desc);
			expect(checker({ a: 2, b: "y" })).toBe(true);
			expect(checker({ a: 3, b: "y" })).toBe(false);
		});

		it("simplifyFilter: should return null if no descriptor", () => {
			expect(simplifyFilter<Entity>()).toBeNull();
		});

		it("simplifyFilter: should simplify filter descriptor", () => {
			const desc = chimeraCreateConjunction<Entity, typeof config>("and", [
				chimeraCreateOperator<Entity, typeof config, "eq">("eq", "a", 2),
			]);
			const simplified = simplifyFilter<Entity>(desc);
			expect(simplified).toMatchObject({ kind: "and", type: expect.any(Symbol) });
		});

		it("compileConjunction: throws on invalid operation type", () => {
			const desc = { kind: "and", operations: [{ type: "badType" }], type: ChimeraConjunctionSymbol };
			expect(() => compileConjunction(config, desc as any)).toThrow();
		});

		it("simplifyConjunction: throws on invalid operation type", () => {
			const desc = { kind: "and", operations: [{ type: "badType" }], type: ChimeraConjunctionSymbol };
			expect(() => simplifyConjunction(desc as any)).toThrow();
		});

		it("chimeraCreateOperator: type error if op not in config", () => {
			// @ts-expect-error
			chimeraCreateOperator<Entity, typeof config, "notAnOp">("notAnOp", "a", 1);
		});

		it("chimeraCreateConjunction: type error if kind not in config", () => {
			// @ts-expect-error
			chimeraCreateConjunction<Entity, typeof config, "notAConj">("notAConj", []);
		});
	});
});
