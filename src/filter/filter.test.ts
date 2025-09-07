import { describe, expect, it, test } from "vitest";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";
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

describe("Filter", () => {
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
