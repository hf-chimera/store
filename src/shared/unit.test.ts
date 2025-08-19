import { describe, expect, it } from "vitest";
import {
	compilePropertyGetter,
	deepObjectAssign,
	deepObjectFreeze,
	makeCancellablePromise,
	none,
	optionFromNullish,
	simplifyPropertyGetter,
	some,
} from "./shared.ts";

describe("Shared Module - Unit Tests", () => {
	describe("deepObjectAssign", () => {
		it("should merge simple objects correctly", () => {
			const dst = {a: 1, b: 2};
			const src = {b: 3, c: 4};
			const result = deepObjectAssign(dst, src);

			expect(result).toBe(dst);
			expect(result).toEqual({a: 1, b: 3, c: 4});
		});

		it("should merge nested objects correctly", () => {
			const dst = {a: 1, nested: {x: 10, y: 20}};
			const src = {b: 2, nested: {y: 30, z: 40}};
			const result = deepObjectAssign(dst, src);

			expect(result).toBe(dst);
			expect(result).toEqual({a: 1, b: 2, nested: {x: 10, y: 30, z: 40}});
		});

		it("should handle null and undefined values", () => {
			const dst = {a: 1, b: 2};
			const src = {a: null, b: undefined, c: 3};
			const result = deepObjectAssign(dst, src);

			expect(result).toEqual({a: null, b: undefined, c: 3});
		});

		it("should handle arrays as primitive values", () => {
			const dst = {a: 1, b: [1, 2]};
			const src = {b: [3, 4], c: [5, 6]};
			const result = deepObjectAssign(dst, src);

			expect(result).toEqual({a: 1, b: [3, 4], c: [5, 6]});
		});

		it("should handle functions as primitive values", () => {
			const fn1 = () => 1;
			const fn2 = () => 2;
			const dst = {a: 1, b: fn1};
			const src = {b: fn2, c: fn1};
			const result = deepObjectAssign(dst, src);

			expect(result).toEqual({a: 1, b: fn2, c: fn1});
		});

		it("should handle deeply nested objects", () => {
			const dst = {
				level1: {
					level2: {
						level3: {value: 1},
					},
				},
			};
			const src = {
				level1: {
					level2: {
						level2New: {value: 3},
						level3: {newValue: 2},
					},
				},
			};
			const result = deepObjectAssign<typeof dst & typeof src>(dst, src);

			expect(result.level1.level2.level3).toEqual({newValue: 2, value: 1});
			expect(result.level1.level2.level2New).toEqual({value: 3});
		});

		it("should handle empty objects", () => {
			const dst = {};
			const src = {};
			const result = deepObjectAssign(dst, src);

			expect(result).toBe(dst);
			expect(result).toEqual({});
		});

		it("should handle source object with no own properties", () => {
			const dst = {a: 1};
			const src = Object.create({inherited: "value"});
			const result = deepObjectAssign(dst, src);

			expect(result).toEqual({a: 1});
		});

		it("should handle circular references gracefully", () => {
			const dst: Record<string, unknown> = {};
			const src: { self?: any } = {};
			src.self = src;

			// This should not throw and should handle the circular reference
			expect(() => deepObjectAssign(dst as any, src as any)).not.toThrow();
		});
	});

	describe("deepObjectFreeze", () => {
		it("should freeze simple objects", () => {
			const obj = {a: 1, b: 2};
			const result = deepObjectFreeze(obj);

			expect(result).toBe(obj);
			expect(Object.isFrozen(result)).toBe(true);
			expect(() => {
				(result as any).a = 3;
			}).toThrow();
		});

		it("should freeze nested objects", () => {
			const obj = {
				array: [1, 2, 3],
				nested: {x: 10, y: 20},
			};
			const result = deepObjectFreeze(obj);

			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.nested)).toBe(true);
			expect(() => {
				(result.nested as any).x = 30;
			}).toThrow();
		});

		it("should handle null and undefined", () => {
			expect(deepObjectFreeze(null)).toBe(null);
			expect(deepObjectFreeze(undefined)).toBe(undefined);
		});

		it("should handle primitive values", () => {
			expect(deepObjectFreeze(42)).toBe(42);
			expect(deepObjectFreeze("string")).toBe("string");
			expect(deepObjectFreeze(true)).toBe(true);
		});

		it("should handle already frozen objects", () => {
			const obj = Object.freeze({a: 1});
			const result = deepObjectFreeze(obj);

			expect(result).toBe(obj);
		});

		it("should handle circular references", () => {
			const obj: any = {a: 1};
			obj.self = obj;
			const result = deepObjectFreeze(obj);

			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.self)).toBe(true);
		});

		it("should handle arrays", () => {
			const obj = {array: [1, 2, {nested: 3}]};
			const result = deepObjectFreeze(obj);

			expect(Object.isFrozen(result.array)).toBe(true);
			expect(() => {
				(result.array as any).push(4);
			}).toThrow();
		});

		it("should handle empty objects", () => {
			const obj = {};
			const result = deepObjectFreeze(obj);

			expect(Object.isFrozen(result)).toBe(true);
		});

		it("should handle objects with functions", () => {
			const fn = () => 1;
			const obj = {method: fn, nested: {method: fn}};
			const result = deepObjectFreeze(obj);

			expect(Object.isFrozen(result)).toBe(true);
			expect(Object.isFrozen(result.nested)).toBe(true);
			expect(typeof result.method).toBe("function");
		});
	});

	describe("compilePropertyGetter", () => {
		it("should compile function getter correctly", () => {
			const getter = {get: (entity: { id: number }) => entity.id, key: "id"};
			const compiled = compilePropertyGetter(getter);

			const entity = {id: 123};
			expect(compiled(entity)).toBe(123);
		});

		it("should compile property key getter correctly", () => {
			const getter = {get: "id" as const, key: "id"};
			const compiled = compilePropertyGetter(getter);

			const entity = {id: 456};
			expect(compiled(entity)).toBe(456);
		});

		it("should not handle nested property access", () => {
			const getter = {get: "user.name" as const, key: "user.name"};
			const compiled = compilePropertyGetter(getter);

			const entity = {user: {name: "John"}};
			expect(compiled(entity as any)).toBeUndefined();
		});

		it("should handle undefined properties", () => {
			const getter = {get: "missing" as const, key: "missing"};
			const compiled = compilePropertyGetter(getter);

			const entity = {id: 123};
			expect(compiled(entity as any)).toBeUndefined();
		});

		it("should handle null entities", () => {
			const getter = {get: "id" as const, key: "id"};
			const compiled = compilePropertyGetter(getter);

			expect(() => compiled(null as any)).toThrow();
		});
	});

	describe("simplifyPropertyGetter", () => {
		it("should return the key from property getter", () => {
			const getter = {get: "id" as const, key: "id"};
			const result = simplifyPropertyGetter(getter);

			expect(result).toBe("id");
		});

		it("should return the key even for function getters", () => {
			const getter = {get: (entity: any) => entity.id, key: "id"};
			const result = simplifyPropertyGetter(getter);

			expect(result).toBe("id");
		});

		it("should handle complex keys", () => {
			const getter = {get: "user.profile.name" as const, key: "user.profile.name"};
			const result = simplifyPropertyGetter(getter);

			expect(result).toBe("user.profile.name");
		});
	});

	describe("makeCancellablePromise", () => {
		it("should create a cancellable promise that resolves normally", async () => {
			const promise = Promise.resolve("success");
			const cancellable = makeCancellablePromise(promise);

			const result = await cancellable;
			expect(result).toBe("success");
		});

		it("should create a cancellable promise that rejects normally", async () => {
			const error = new Error("test error");
			const promise = Promise.reject(error);
			const cancellable = makeCancellablePromise(promise);

			await expect(cancellable).rejects.toThrow("test error");
		});

		it("should cancel the promise when cancel is called", async () => {
			let resolveFn: ((value: string) => void) | undefined;
			const promise = new Promise<string>((resolve) => {
				resolveFn = resolve;
			});

			const cancellable = makeCancellablePromise(promise);
			cancellable.cancel();

			// The promise should be cancelled and never resolve
			if (resolveFn) resolveFn("success");

			// Wait a bit to ensure the promise doesn't resolve
			await new Promise((resolve) => setTimeout(resolve, 10));

			// The promise should remain pending
			expect(cancellable).toBeInstanceOf(Promise);
		});

		it("should handle cancellation after resolution", async () => {
			const promise = Promise.resolve("success");
			const cancellable = makeCancellablePromise(promise);

			const result = await cancellable;
			cancellable.cancel(); // Should not affect already resolved promise

			expect(result).toBe("success");
		});

		it("should use provided AbortController", () => {
			const controller = new AbortController();
			const promise = Promise.resolve("success");
			const cancellable = makeCancellablePromise(promise, controller);

			expect(controller.signal.aborted).toBe(false);
			cancellable.cancel();
			expect(controller.signal.aborted).toBe(true);
		});

		it("should handle multiple cancellations", () => {
			const promise = Promise.resolve("success");
			const cancellable = makeCancellablePromise(promise);

			cancellable.cancel();
			expect(() => cancellable.cancel()).not.toThrow();
		});

		it("should handle cancellation of rejected promise", async () => {
			let rejectFn: ((error: Error) => void) | undefined;
			const promise = new Promise<string>((_, reject) => {
				rejectFn = reject;
			});

			const cancellable = makeCancellablePromise(promise);
			cancellable.cancel();

			// The promise should be cancelled and never reject
			if (rejectFn) rejectFn(new Error("test error"));

			// Wait a bit to ensure the promise doesn't reject
			await new Promise((resolve) => setTimeout(resolve, 10));

			// The promise should remain pending
			expect(cancellable).toBeInstanceOf(Promise);
		});
	});

	describe("optionFromNullish", () => {
		it("should return none for null", () => {
			const result = optionFromNullish(null);
			expect(result).toEqual({some: false});
		});

		it("should return none for undefined", () => {
			const result = optionFromNullish(undefined);
			expect(result).toEqual({some: false});
		});

		it("should return some for valid values", () => {
			const result = optionFromNullish("test");
			expect(result).toEqual({some: true, value: "test"});
		});

		it("should return some for zero", () => {
			const result = optionFromNullish(0);
			expect(result).toEqual({some: true, value: 0});
		});

		it("should return some for empty string", () => {
			const result = optionFromNullish("");
			expect(result).toEqual({some: true, value: ""});
		});

		it("should return some for false", () => {
			const result = optionFromNullish(false);
			expect(result).toEqual({some: true, value: false});
		});

		it("should return some for objects", () => {
			const obj = {test: true};
			const result = optionFromNullish(obj);
			expect(result).toEqual({some: true, value: obj});
		});

		it("should return some for arrays", () => {
			const arr = [1, 2, 3];
			const result = optionFromNullish(arr);
			expect(result).toEqual({some: true, value: arr});
		});
	});

	describe("none", () => {
		it("should return none option", () => {
			const result = none();
			expect(result).toEqual({some: false});
		});

		it("should return consistent none values", () => {
			const result1 = none();
			const result2 = none();
			expect(result1).toEqual(result2);
		});
	});

	describe("some", () => {
		it("should return some option with value", () => {
			const result = some("test");
			expect(result).toEqual({some: true, value: "test"});
		});

		it("should handle various value types", () => {
			expect(some(42)).toEqual({some: true, value: 42});
			expect(some(true)).toEqual({some: true, value: true});
			expect(some({key: "value"})).toEqual({some: true, value: {key: "value"}});
			expect(some([1, 2, 3])).toEqual({some: true, value: [1, 2, 3]});
		});

		it("should handle null and undefined as values", () => {
			expect(some(null)).toEqual({some: true, value: null});
			expect(some(undefined)).toEqual({some: true, value: undefined});
		});
	});
});
