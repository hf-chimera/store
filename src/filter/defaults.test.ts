import { describe, expect, it, test } from "vitest";
import { chimeraDefaultFilterConfig, chimeraDefaultFilterOperators } from "./defaults.ts";

describe("Filter Defaults", () => {
	describe("chimeraDefaultFilterOperators", () => {
		describe("eq", () => {
			test.each([
				{ a: 5, b: 5, description: "equal numbers", expected: true },
				{ a: "hello", b: "hello", description: "equal strings", expected: true },
				{ a: true, b: true, description: "equal booleans", expected: true },
				{ a: null, b: null, description: "equal nulls", expected: true },
				{ a: undefined, b: undefined, description: "equal undefined", expected: true },
				{ a: 5, b: 6, description: "different numbers", expected: false },
				{ a: "hello", b: "world", description: "different strings", expected: false },
				{ a: true, b: false, description: "different booleans", expected: false },
				{ a: null, b: undefined, description: "null vs undefined", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.eq(a, b)).toBe(expected);
			});

			test.each([
				{ a: 0, b: false, expected: false },
				{ a: 1, b: true, expected: false },
				{ a: "", b: false, expected: false },
			])("should handle type coercion edge cases", ({ a, b, expected }) => {
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
				{ a: 5, b: 6, description: "different numbers", expected: true },
				{ a: "hello", b: "world", description: "different strings", expected: true },
				{ a: true, b: false, description: "different booleans", expected: true },
				{ a: 5, b: 5, description: "equal numbers", expected: false },
				{ a: "hello", b: "hello", description: "equal strings", expected: false },
				{ a: true, b: true, description: "equal booleans", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.neq(a, b)).toBe(expected);
			});
		});

		describe("gt", () => {
			test.each([
				{ a: 5, b: 3, description: "number greater than number", expected: true },
				{ a: 10.5, b: 5.2, description: "decimal greater than decimal", expected: true },
				{ a: "z", b: "a", description: "string greater than string", expected: true },
				{ a: 3, b: 5, description: "number not greater than number", expected: false },
				{ a: 5, b: 5, description: "equal numbers", expected: false },
				{ a: "a", b: "z", description: "string not greater than string", expected: false },
				{ a: 0, b: -0, description: "zero vs negative zero", expected: false },
				{ a: Number.POSITIVE_INFINITY, b: 1000, description: "infinity greater than number", expected: true },
				{
					a: Number.NEGATIVE_INFINITY,
					b: 1000,
					description: "negative infinity not greater than number",
					expected: false,
				},
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.gt(a, b)).toBe(expected);
			});
		});

		describe("gte", () => {
			test.each([
				{ a: 5, b: 3, description: "number greater than number", expected: true },
				{ a: 5, b: 5, description: "equal numbers", expected: true },
				{ a: "z", b: "a", description: "string greater than string", expected: true },
				{ a: "a", b: "a", description: "equal strings", expected: true },
				{ a: 3, b: 5, description: "number less than number", expected: false },
				{ a: "a", b: "z", description: "string less than string", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.gte(a, b)).toBe(expected);
			});
		});

		describe("lt", () => {
			test.each([
				{ a: 3, b: 5, description: "number less than number", expected: true },
				{ a: 5.2, b: 10.5, description: "decimal less than decimal", expected: true },
				{ a: "a", b: "z", description: "string less than string", expected: true },
				{ a: 5, b: 3, description: "number not less than number", expected: false },
				{ a: 5, b: 5, description: "equal numbers", expected: false },
				{ a: "z", b: "a", description: "string not less than string", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.lt(a, b)).toBe(expected);
			});
		});

		describe("lte", () => {
			test.each([
				{ a: 3, b: 5, description: "number less than number", expected: true },
				{ a: 5, b: 5, description: "equal numbers", expected: true },
				{ a: "a", b: "z", description: "string less than string", expected: true },
				{ a: "a", b: "a", description: "equal strings", expected: true },
				{ a: 5, b: 3, description: "number greater than number", expected: false },
				{ a: "z", b: "a", description: "string greater than string", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.lte(a, b)).toBe(expected);
			});
		});

		describe("contains", () => {
			test.each([
				{ a: "hello world", b: "hello", description: "string contains substring", expected: true },
				{ a: "hello world", b: "world", description: "string contains substring", expected: true },
				{ a: "hello world", b: "xyz", description: "string does not contain substring", expected: false },
				{ a: "hello world", b: "", description: "string contains empty string", expected: true },
				{ a: [1, 2, 3], b: 2, description: "array contains number", expected: true },
				{ a: [1, 2, 3], b: 4, description: "array does not contain number", expected: false },
				{ a: ["a", "b", "c"], b: "b", description: "array contains string", expected: true },
				{ a: [1, 2, 3, 4], b: [2, 3], description: "array contains subarray", expected: true },
				{ a: [1, 2, 3, 4], b: [2, 5], description: "array does not contain subarray", expected: false },
				{ a: [1, 2, 3], b: [1, 2, 3], description: "array contains identical array", expected: true },
				{ a: "", b: "", description: "empty string contains empty string", expected: true },
				{ a: [], b: 1, description: "empty array does not contain value", expected: false },
				{ a: [], b: [], description: "empty array contains empty array", expected: true },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.contains(a, b)).toBe(expected);
			});

			test.each([
				{ a: 123, b: "2" },
				{ a: { a: 1 }, b: "a" },
				{ a: null, b: "test" },
				{ a: undefined, b: "test" },
			])("should return false for non-string and non-array values", ({ a, b }) => {
				// @ts-expect-error
				expect(chimeraDefaultFilterOperators.contains(a, b)).toBe(false);
			});
		});

		describe("startsWith", () => {
			test.each([
				{ a: "hello world", b: "hello", description: "string starts with prefix", expected: true },
				{ a: "hello world", b: "h", description: "string starts with single character", expected: true },
				{ a: "hello world", b: "hello world", description: "string starts with itself", expected: true },
				{ a: "hello world", b: "world", description: "string does not start with suffix", expected: false },
				{ a: "hello world", b: "xyz", description: "string does not start with different prefix", expected: false },
				{ a: "hello", b: "", description: "string starts with empty string", expected: true },
				{ a: "", b: "hello", description: "empty string does not start with prefix", expected: false },
				{ a: "", b: "", description: "empty string starts with empty string", expected: true },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.startsWith(a, b)).toBe(expected);
			});
		});

		describe("endsWith", () => {
			test.each([
				{ a: "hello world", b: "world", description: "string ends with suffix", expected: true },
				{ a: "hello world", b: "d", description: "string ends with single character", expected: true },
				{ a: "hello world", b: "hello world", description: "string ends with itself", expected: true },
				{ a: "hello world", b: "hello", description: "string does not end with prefix", expected: false },
				{ a: "hello world", b: "xyz", description: "string does not end with different suffix", expected: false },
				{ a: "hello", b: "", description: "string ends with empty string", expected: true },
				{ a: "", b: "hello", description: "empty string does not end with suffix", expected: false },
				{ a: "", b: "", description: "empty string ends with empty string", expected: true },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.endsWith(a, b)).toBe(expected);
			});
		});

		describe("in", () => {
			test.each([
				{ a: 2, b: [1, 2, 3], description: "number in array", expected: true },
				{ a: 4, b: [1, 2, 3], description: "number not in array", expected: false },
				{ a: "b", b: ["a", "b", "c"], description: "string in array", expected: true },
				{ a: [1, 2], b: [1, 2, 3, 4], description: "array in array", expected: true },
				{ a: [6, 5], b: [1, 2, 3, 4], description: "array not in array", expected: false },
				{ a: 1, b: [], description: "value in empty array", expected: false },
				{ a: [], b: [1, 2, 3], description: "empty array in array", expected: false },
				{ a: [], b: [], description: "empty array in empty array", expected: false },
			])("should return $expected for $description", ({ a, b, expected }) => {
				expect(chimeraDefaultFilterOperators.in(a, b)).toBe(expected);
			});
		});

		describe("notIn", () => {
			test.each([
				{ a: 4, b: [1, 2, 3], description: "number not in array", expected: true },
				{ a: 2, b: [1, 2, 3], description: "number in array", expected: false },
				{ a: "d", b: ["a", "b", "c"], description: "string not in array", expected: true },
				{ a: [6, 5], b: [1, 2, 3, 4], description: "array not in array", expected: true },
				{ a: [1, 2], b: [1, 2, 3, 4], description: "array in array", expected: false },
				{ a: 1, b: [], description: "value not in empty array", expected: true },
				{ a: [], b: [1, 2, 3], description: "empty array not in array", expected: true },
				{ a: [], b: [], description: "empty array not in empty array", expected: true },
			])("should return $expected for $description", ({ a, b, expected }) => {
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
			{ property: "operators", type: "object" },
			{ property: "getFilterKey", type: "function" },
			{ property: "getOperatorKey", type: "function" },
		])("should have $property", ({ property, type }) => {
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
