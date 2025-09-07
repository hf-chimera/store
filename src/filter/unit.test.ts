import { describe, expect, it, test } from "vitest";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";
import { chimeraDefaultFilterConfig, chimeraDefaultFilterOperators } from "./defaults.ts";
import {
	chimeraCreateConjunction,
	chimeraCreateOperator,
	compileConjunction,
	compileFilter,
	isFilterSubset,
	simplifyConjunction,
	simplifyFilter,
	simplifyOperator,
} from "./filter.ts";

// Shared types for tests
type TestEntity = { a: number; b: string; c: boolean };
type TestConfig = {
	getFilterKey: (filter: any) => string;
	getOperatorKey: (operator: any) => string;
	operators: {
		eq: (a: any, b: any) => boolean;
		gt: (a: any, b: any) => boolean;
		lt: (a: any, b: any) => boolean;
		neq: (a: any, b: any) => boolean;
	};
};

describe("Filter Module - Unit Tests", () => {
	describe("defaults", () => {
		describe("chimeraDefaultFilterOperators", () => {
			describe("eq", () => {
				test.each([
					{a: 5, b: 5, description: "equal numbers", expected: true},
					{a: "hello", b: "hello", description: "equal strings", expected: true},
					{a: true, b: true, description: "equal booleans", expected: true},
					{a: null, b: null, description: "equal nulls", expected: true},
					{a: undefined, b: undefined, description: "equal undefined", expected: true},
					{a: 5, b: 6, description: "different numbers", expected: false},
					{a: "hello", b: "world", description: "different strings", expected: false},
					{a: true, b: false, description: "different booleans", expected: false},
					{a: null, b: undefined, description: "null vs undefined", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.eq(a, b)).toBe(expected);
				});

				test.each([
					{a: 0, b: false, expected: false},
					{a: 1, b: true, expected: false},
					{a: "", b: false, expected: false},
				])("should handle type coercion edge cases", ({a, b, expected}) => {
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.eq(a, b)).toBe(expected);
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
				test.each([
					{a: 5, b: 6, description: "different numbers", expected: true},
					{a: "hello", b: "world", description: "different strings", expected: true},
					{a: true, b: false, description: "different booleans", expected: true},
					{a: 5, b: 5, description: "equal numbers", expected: false},
					{a: "hello", b: "hello", description: "equal strings", expected: false},
					{a: true, b: true, description: "equal booleans", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.neq(a, b)).toBe(expected);
				});
			});

			describe("gt", () => {
				test.each([
					{a: 5, b: 3, description: "number greater than number", expected: true},
					{a: 10.5, b: 5.2, description: "decimal greater than decimal", expected: true},
					{a: "z", b: "a", description: "string greater than string", expected: true},
					{a: 3, b: 5, description: "number not greater than number", expected: false},
					{a: 5, b: 5, description: "equal numbers", expected: false},
					{a: "a", b: "z", description: "string not greater than string", expected: false},
					{a: 0, b: -0, description: "zero vs negative zero", expected: false},
					{a: Number.POSITIVE_INFINITY, b: 1000, description: "infinity greater than number", expected: true},
					{
						a: Number.NEGATIVE_INFINITY,
						b: 1000,
						description: "negative infinity not greater than number",
						expected: false,
					},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.gt(a, b)).toBe(expected);
				});
			});

			describe("gte", () => {
				test.each([
					{a: 5, b: 3, description: "number greater than number", expected: true},
					{a: 5, b: 5, description: "equal numbers", expected: true},
					{a: "z", b: "a", description: "string greater than string", expected: true},
					{a: "a", b: "a", description: "equal strings", expected: true},
					{a: 3, b: 5, description: "number less than number", expected: false},
					{a: "a", b: "z", description: "string less than string", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.gte(a, b)).toBe(expected);
				});
			});

			describe("lt", () => {
				test.each([
					{a: 3, b: 5, description: "number less than number", expected: true},
					{a: 5.2, b: 10.5, description: "decimal less than decimal", expected: true},
					{a: "a", b: "z", description: "string less than string", expected: true},
					{a: 5, b: 3, description: "number not less than number", expected: false},
					{a: 5, b: 5, description: "equal numbers", expected: false},
					{a: "z", b: "a", description: "string not less than string", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.lt(a, b)).toBe(expected);
				});
			});

			describe("lte", () => {
				test.each([
					{a: 3, b: 5, description: "number less than number", expected: true},
					{a: 5, b: 5, description: "equal numbers", expected: true},
					{a: "a", b: "z", description: "string less than string", expected: true},
					{a: "a", b: "a", description: "equal strings", expected: true},
					{a: 5, b: 3, description: "number greater than number", expected: false},
					{a: "z", b: "a", description: "string greater than string", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.lte(a, b)).toBe(expected);
				});
			});

			describe("contains", () => {
				test.each([
					{a: "hello world", b: "hello", description: "string contains substring", expected: true},
					{a: "hello world", b: "world", description: "string contains substring", expected: true},
					{a: "hello world", b: "xyz", description: "string does not contain substring", expected: false},
					{a: "hello world", b: "", description: "string contains empty string", expected: true},
					{a: [1, 2, 3], b: 2, description: "array contains number", expected: true},
					{a: [1, 2, 3], b: 4, description: "array does not contain number", expected: false},
					{a: ["a", "b", "c"], b: "b", description: "array contains string", expected: true},
					{a: [1, 2, 3, 4], b: [2, 3], description: "array contains subarray", expected: true},
					{a: [1, 2, 3, 4], b: [2, 5], description: "array does not contain subarray", expected: false},
					{a: [1, 2, 3], b: [1, 2, 3], description: "array contains identical array", expected: true},
					{a: "", b: "", description: "empty string contains empty string", expected: true},
					{a: [], b: 1, description: "empty array does not contain value", expected: false},
					{a: [], b: [], description: "empty array contains empty array", expected: true},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.contains(a, b)).toBe(expected);
				});

				test.each([
					{a: 123, b: "2"},
					{a: {a: 1}, b: "a"},
					{a: null, b: "test"},
					{a: undefined, b: "test"},
				])("should return false for non-string and non-array values", ({a, b}) => {
					// @ts-expect-error
					expect(chimeraDefaultFilterOperators.contains(a, b)).toBe(false);
				});
			});

			describe("startsWith", () => {
				test.each([
					{a: "hello world", b: "hello", description: "string starts with prefix", expected: true},
					{a: "hello world", b: "h", description: "string starts with single character", expected: true},
					{a: "hello world", b: "hello world", description: "string starts with itself", expected: true},
					{a: "hello world", b: "world", description: "string does not start with suffix", expected: false},
					{a: "hello world", b: "xyz", description: "string does not start with different prefix", expected: false},
					{a: "hello", b: "", description: "string starts with empty string", expected: true},
					{a: "", b: "hello", description: "empty string does not start with prefix", expected: false},
					{a: "", b: "", description: "empty string starts with empty string", expected: true},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.startsWith(a, b)).toBe(expected);
				});
			});

			describe("endsWith", () => {
				test.each([
					{a: "hello world", b: "world", description: "string ends with suffix", expected: true},
					{a: "hello world", b: "d", description: "string ends with single character", expected: true},
					{a: "hello world", b: "hello world", description: "string ends with itself", expected: true},
					{a: "hello world", b: "hello", description: "string does not end with prefix", expected: false},
					{a: "hello world", b: "xyz", description: "string does not end with different suffix", expected: false},
					{a: "hello", b: "", description: "string ends with empty string", expected: true},
					{a: "", b: "hello", description: "empty string does not end with suffix", expected: false},
					{a: "", b: "", description: "empty string ends with empty string", expected: true},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.endsWith(a, b)).toBe(expected);
				});
			});

			describe("in", () => {
				test.each([
					{a: 2, b: [1, 2, 3], description: "number in array", expected: true},
					{a: 4, b: [1, 2, 3], description: "number not in array", expected: false},
					{a: "b", b: ["a", "b", "c"], description: "string in array", expected: true},
					{a: [1, 2], b: [1, 2, 3, 4], description: "array in array", expected: true},
					{a: [6, 5], b: [1, 2, 3, 4], description: "array not in array", expected: false},
					{a: 1, b: [], description: "value in empty array", expected: false},
					{a: [], b: [1, 2, 3], description: "empty array in array", expected: false},
					{a: [], b: [], description: "empty array in empty array", expected: false},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.in(a, b)).toBe(expected);
				});
			});

			describe("notIn", () => {
				test.each([
					{a: 4, b: [1, 2, 3], description: "number not in array", expected: true},
					{a: 2, b: [1, 2, 3], description: "number in array", expected: false},
					{a: "d", b: ["a", "b", "c"], description: "string not in array", expected: true},
					{a: [6, 5], b: [1, 2, 3, 4], description: "array not in array", expected: true},
					{a: [1, 2], b: [1, 2, 3, 4], description: "array in array", expected: false},
					{a: 1, b: [], description: "value not in empty array", expected: true},
					{a: [], b: [1, 2, 3], description: "empty array not in array", expected: true},
					{a: [], b: [], description: "empty array not in empty array", expected: true},
				])("should return $expected for $description", ({a, b, expected}) => {
					expect(chimeraDefaultFilterOperators.notIn(a, b)).toBe(expected);
				});
			});
		});

		describe("chimeraDefaultFilterConfig", () => {
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

			test.each([
				{property: "operators", type: "object"},
				{property: "getFilterKey", type: "function"},
				{property: "getOperatorKey", type: "function"},
			])("should have $property", ({property, type}) => {
				expect(chimeraDefaultFilterConfig).toHaveProperty(property);
				expect(typeof chimeraDefaultFilterConfig[property as keyof typeof chimeraDefaultFilterConfig]).toBe(type);
			});

			test.each(expectedOperators)("should have %s operator", (operator) => {
				expect(chimeraDefaultFilterConfig.operators).toHaveProperty(operator);
				expect(
					typeof chimeraDefaultFilterConfig.operators[operator as keyof typeof chimeraDefaultFilterConfig.operators],
				).toBe("function");
			});
		});
	});

	describe("filter", () => {
		const config: TestConfig = {
			getFilterKey: (filter: any) => JSON.stringify(filter),
			getOperatorKey: (operator: any) => JSON.stringify(operator),
			operators: {
				eq: (a: any, b: any) => a === b,
				gt: (a: any, b: any) => a > b,
				lt: (a: any, b: any) => a < b,
				neq: (a: any, b: any) => a !== b,
			},
		};

		describe("compileConjunction", () => {
			it("should compile and evaluate conjunctions", () => {
				const desc = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 5),
					chimeraCreateOperator<TestEntity, TestConfig, "gt">("gt", "a", 2),
				]);
				const checker = compileConjunction(config, desc);
				expect(checker({a: 5, b: "x", c: true})).toBe(true);
				expect(checker({a: 2, b: "x", c: true})).toBe(false);
			});

			it("throws on unknown conjunction", () => {
				const desc = {kind: "notAConj", operations: [], type: Symbol.for("ChimeraConjunctionSymbol")} as any;
				expect(() => compileConjunction(config, desc)).toThrow();
			});

			it("throws on invalid operation type", () => {
				const desc = {kind: "and", operations: [{type: "badType"}], type: ChimeraConjunctionSymbol};
				expect(() => compileConjunction(config, desc as any)).toThrow();
			});
		});

		describe("simplifyOperator", () => {
			it("should simplify operator descriptor", () => {
				const opDesc = chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1);
				const simplified = simplifyOperator(opDesc);
				expect(simplified).toMatchObject({key: "a", op: "eq", test: 1, type: expect.any(Symbol)});
			});
		});

		describe("simplifyConjunction", () => {
			it("should simplify conjunction descriptor recursively", () => {
				const conjDesc = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
					chimeraCreateConjunction<TestEntity, TestConfig>("or", [
						chimeraCreateOperator<TestEntity, TestConfig, "gt">("gt", "a", 0),
					]),
				]);
				const simplified = simplifyConjunction(conjDesc);
				expect(simplified).toMatchObject({
					kind: "and",
					operations: [
						{key: "a", op: "eq", test: 1, type: expect.any(Symbol)},
						{
							kind: "or",
							operations: [{key: "a", op: "gt", test: 0, type: expect.any(Symbol)}],
							type: expect.any(Symbol),
						},
					],
					type: expect.any(Symbol),
				});
			});

			it("throws on invalid operation type", () => {
				const desc = {kind: "and", operations: [{type: "badType"}], type: ChimeraConjunctionSymbol};
				expect(() => simplifyConjunction(desc as any)).toThrow();
			});

			it("should sort operations consistently", () => {
				// Create two identical filters with operations in different order
				const filter1 = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "b", "test"),
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
				]);

				const filter2 = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "b", "test"),
				]);

				const simplified1 = simplifyFilter(filter1);
				const simplified2 = simplifyFilter(filter2);

				// Both should be subsets of each other (identical after sorting)
				expect(isFilterSubset(simplified1, simplified2, config.getOperatorKey)).toBe(true);
				expect(isFilterSubset(simplified2, simplified1, config.getOperatorKey)).toBe(true);
			});

			it("should sort by key first, then operator, then test value", () => {
				const filter = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "b", "z"),
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 2),
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
					chimeraCreateOperator<TestEntity, TestConfig, "gt">("gt", "a", 1),
				]);

				const simplified = simplifyFilter(filter);

				// Check that operations are sorted correctly
				expect(simplified?.operations[0]).toMatchObject({key: "a", op: "eq", test: 1});
				expect(simplified?.operations[1]).toMatchObject({key: "a", op: "eq", test: 2});
				expect(simplified?.operations[2]).toMatchObject({key: "a", op: "gt", test: 1});
				expect(simplified?.operations[3]).toMatchObject({key: "b", op: "eq", test: "z"});
			});

			it("should sort operators before conjunctions", () => {
				const filter = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateConjunction<TestEntity, TestConfig>("or", [
						chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
					]),
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1),
				]);

				const simplified = simplifyFilter(filter);

				// Operator should come before conjunction
				expect(simplified?.operations[0]?.type).toBe(ChimeraOperatorSymbol); // Operator symbol
				expect(simplified?.operations[1]?.type).toBe(ChimeraConjunctionSymbol); // Conjunction symbol
			});
		});

		describe("chimeraCreateOperator", () => {
			it("should create operator descriptor from string key", () => {
				const opDesc = chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 1);
				expect(opDesc).toMatchObject({op: "eq", test: 1, type: expect.any(Symbol)});
				expect(typeof opDesc.value).toBe("object");
			});

			it("should create operator descriptor from property getter", () => {
				const getter = {get: (e: TestEntity) => e.a, key: "a"};
				const opDesc = chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", getter, 1);
				expect(opDesc.value).toBe(getter);
			});

			it("type error if op not in config", () => {
				// @ts-expect-error
				chimeraCreateOperator<TestEntity, TestConfig, "notAnOp">("notAnOp", "a", 1);
			});
		});

		describe("chimeraCreateConjunction", () => {
			it("should create conjunction descriptor", () => {
				const conjDesc = chimeraCreateConjunction<TestEntity, TestConfig>("and", []);
				expect(conjDesc).toMatchObject({kind: "and", operations: [], type: expect.any(Symbol)});
			});

			it("type error if kind not in config", () => {
				// @ts-expect-error
				chimeraCreateConjunction<TestEntity, TestConfig, "notAConj">("notAConj", []);
			});
		});

		describe("compileFilter", () => {
			it("should return always-true if no descriptor", () => {
				const checker = compileFilter<TestEntity>(config);
				expect(checker({a: 1, b: "x", c: true})).toBe(true);
			});

			it("should compile and check filter", () => {
				const desc = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 2),
				]);
				const checker = compileFilter<TestEntity>(config, desc);
				expect(checker({a: 2, b: "y", c: true})).toBe(true);
				expect(checker({a: 3, b: "y", c: true})).toBe(false);
			});
		});

		describe("simplifyFilter", () => {
			it("should return null if no descriptor", () => {
				expect(simplifyFilter<TestEntity>()).toBeNull();
			});

			it("should simplify filter descriptor", () => {
				const desc = chimeraCreateConjunction<TestEntity, TestConfig>("and", [
					chimeraCreateOperator<TestEntity, TestConfig, "eq">("eq", "a", 2),
				]);
				const simplified = simplifyFilter<TestEntity>(desc);
				expect(simplified).toMatchObject({kind: "and", type: expect.any(Symbol)});
			});
		});

		describe("isFilterSubset", () => {
			// Helper functions for creating test scenarios
			const createFilter = (kind: "and" | "or", operations: any[]) =>
				chimeraCreateConjunction<TestEntity, TestConfig>(kind, operations);

			const createOperator = (op: keyof TestConfig["operators"], key: keyof TestEntity, value: any) =>
				chimeraCreateOperator<TestEntity, TestConfig, typeof op>(op, key, value);

			describe("null filter handling", () => {
				test.each([
					{
						candidate: null,
						description: "candidate is null",
						expected: true,
						target: createFilter("and", [createOperator("eq", "a", 1)]),
					},
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1)]),
						description: "target is null but candidate is not",
						expected: false,
						target: null,
					},
					{
						candidate: null,
						description: "both filters are null",
						expected: true,
						target: null,
					},
				])("should return $expected when $description", ({candidate, target, expected}) => {
					if (candidate === null || target === null) {
						expect(isFilterSubset(simplifyFilter(candidate), simplifyFilter(target), config.getOperatorKey)).toBe(
							expected,
						);
					} else {
						const candidateSimplified = simplifyFilter(candidate);
						const targetSimplified = simplifyFilter(target);
						expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(expected);
					}
				});
			});

			describe("basic flat filter tests", () => {
				test.each([
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1)]),
						description: "identical single operator filters",
						expected: true,
						target: createFilter("and", [createOperator("eq", "a", 1)]),
					},
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1)]),
						description: "different single operator filters",
						expected: false,
						target: createFilter("and", [createOperator("eq", "a", 2)]),
					},
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1)]),
						description: "candidate AND has fewer conditions than target AND",
						expected: true,
						target: createFilter("and", [createOperator("eq", "a", 1), createOperator("eq", "b", "test")]),
					},
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1), createOperator("eq", "c", true)]),
						description: "candidate AND has different conditions than target AND",
						expected: false,
						target: createFilter("and", [createOperator("eq", "a", 1), createOperator("eq", "b", "test")]),
					},
					{
						candidate: createFilter("or", [createOperator("eq", "a", 1), createOperator("eq", "b", "test")]),
						description: "candidate OR has more conditions than target OR",
						expected: true,
						target: createFilter("or", [createOperator("eq", "a", 1)]),
					},
					{
						candidate: createFilter("or", [createOperator("eq", "a", 1), createOperator("eq", "c", true)]),
						description: "candidate OR has different conditions than target OR",
						expected: false,
						target: createFilter("or", [createOperator("eq", "a", 1), createOperator("eq", "b", "test")]),
					},
					{
						candidate: createFilter("and", [createOperator("eq", "a", 1)]),
						description: "candidate and target have different conjunction types",
						expected: false,
						target: createFilter("or", [createOperator("eq", "a", 1)]),
					},
				])("should return $expected for $description", ({candidate, target, expected}) => {
					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);
					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(expected);
				});
			});

			describe("identical filters", () => {
				it("should return true for identical simple filters", () => {
					const filter = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const simplified = simplifyFilter(filter);
					expect(isFilterSubset(simplified, simplified, config.getOperatorKey)).toBe(true);
				});

				it("should return true for identical complex filters", () => {
					const filter = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 0),
							chimeraCreateOperator<TestEntity, typeof config, "lt">("lt", "a", 10),
						]),
					]);
					const simplified = simplifyFilter(filter);
					expect(isFilterSubset(simplified, simplified, config.getOperatorKey)).toBe(true);
				});
			});

			describe("AND conjunction subset relationships", () => {
				it("should return true when candidate AND is subset of target AND", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});

				it("should return false when candidate AND is not subset of target AND", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "different"),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});

				it("should return false when candidate has more operations than target", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});
			});

			describe("OR conjunction subset relationships", () => {
				it("should return true when candidate OR has all target conditions", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});

				it("should return false when candidate OR is not subset of target OR", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "different"),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});
			});

			describe("mixed conjunction types", () => {
				it("should return false when candidate and target have different conjunction types", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});
			});

			describe("nested conjunction subset relationships", () => {
				it("should handle nested conjunctions correctly", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 2),
						]),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						]),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});
			});

			describe("complex deep variant tests", () => {
				it("should handle deeply nested AND-OR combinations", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
							chimeraCreateConjunction<TestEntity, typeof config>("and", [
								chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 0),
								chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "c", true),
							]),
						]),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "other"),
							chimeraCreateConjunction<TestEntity, typeof config>("and", [
								chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 0),
								chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "c", true),
								chimeraCreateOperator<TestEntity, typeof config, "lt">("lt", "a", 100),
							]),
						]),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});

				it("should handle complex OR-AND combinations", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateConjunction<TestEntity, typeof config>("and", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
						]),
						chimeraCreateConjunction<TestEntity, typeof config>("and", [
							chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 5),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "c", false),
						]),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 10),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("or", [
						chimeraCreateConjunction<TestEntity, typeof config>("and", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
						]),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 10),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});

				it("should return false for complex mismatched nested structures", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						]),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
							chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 2),
						]),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", "test"),
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "c", true),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});

				it("should handle mixed operator types in nested structures", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 0),
							chimeraCreateOperator<TestEntity, typeof config, "lt">("lt", "a", 10),
							chimeraCreateOperator<TestEntity, typeof config, "neq">("neq", "a", 5),
						]),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
						chimeraCreateConjunction<TestEntity, typeof config>("or", [
							chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 0),
							chimeraCreateOperator<TestEntity, typeof config, "lt">("lt", "a", 10),
						]),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});
			});

			describe("operator comparison", () => {
				it("should return true for identical operators", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(true);
				});

				it("should return false for different operators", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 2),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});

				it("should return false for different operator types", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "gt">("gt", "a", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});

				it("should return false for different keys", () => {
					const candidate = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "a", 1),
					]);
					const target = chimeraCreateConjunction<TestEntity, typeof config>("and", [
						chimeraCreateOperator<TestEntity, typeof config, "eq">("eq", "b", 1),
					]);

					const candidateSimplified = simplifyFilter(candidate);
					const targetSimplified = simplifyFilter(target);

					expect(isFilterSubset(candidateSimplified, targetSimplified, config.getOperatorKey)).toBe(false);
				});
			});
		});
	});
});
