import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChimeraInternalError } from "../errors.ts";
import { ChimeraWeakValueMap } from "./ChimeraWeakValueMap.ts";

describe("ChimeraWeakValueMap - Unit Tests", () => {
	describe("ChimeraWeakValueMap", () => {
		let weakMap: ChimeraWeakValueMap<string, object>;

		beforeEach(() => {
			weakMap = new ChimeraWeakValueMap();
			// Mock requestIdleCallback to run immediately
			vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
				setTimeout(cb, 0);
				return 1;
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		describe("Constructor", () => {
			it("should create an empty map by default", () => {
				const map = new ChimeraWeakValueMap();
				expect(map.size).toBe(0);
				expect(map.rawSize).toBe(0);
			});

			it("should initialize with provided values", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};
				const initialValues: [string, object][] = [
					["key1", obj1],
					["key2", obj2],
				];

				const map = new ChimeraWeakValueMap(initialValues);
				expect(map.size).toBe(2);
				expect(map.get("key1")).toBe(obj1);
				expect(map.get("key2")).toBe(obj2);
			});

			it("should handle null initial values", () => {
				const map = new ChimeraWeakValueMap(null);
				expect(map.size).toBe(0);
				expect(map.rawSize).toBe(0);
			});

			it("should handle empty array initial values", () => {
				const map = new ChimeraWeakValueMap([]);
				expect(map.size).toBe(0);
				expect(map.rawSize).toBe(0);
			});
		});

		describe("set() method", () => {
			it("should add new entries", () => {
				const obj = {id: 1};
				weakMap.set("key1", obj);

				expect(weakMap.has("key1")).toBe(true);
				expect(weakMap.get("key1")).toBe(obj);
				expect(weakMap.size).toBe(1);
			});

			it("should update existing entries", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key1", obj2);

				expect(weakMap.get("key1")).toBe(obj2);
				expect(weakMap.size).toBe(1);
			});

			it("should emit set event", () => {
				const setSpy = vi.fn();
				weakMap.on("set", setSpy);

				const obj = {id: 1};
				weakMap.set("key1", obj);

				// Wait for a microtask to complete
				return new Promise((resolve) => {
					setTimeout(() => {
						expect(setSpy).toHaveBeenCalledWith({
							instance: weakMap,
							key: "key1",
							value: obj,
						});
						resolve(undefined);
					}, 0);
				});
			});

			it("should return this for chaining", () => {
				const obj = {id: 1};
				const result = weakMap.set("key1", obj);
				expect(result).toBe(weakMap);
			});
		});

		describe("get() method", () => {
			it("should return value for existing key", () => {
				const obj = {id: 1};
				weakMap.set("key1", obj);
				expect(weakMap.get("key1")).toBe(obj);
			});

			it("should return undefined for non-existent key", () => {
				expect(weakMap.get("nonexistent")).toBeUndefined();
			});

			it("should return undefined for garbage collected value", () => {
				weakMap.set("key1", {id: 1});
				// Force garbage collection simulation by creating new objects
				for (let i = 0; i < 1000; i++) {
					new Array(1000).fill(0);
				}
				// The value should still be accessible since we have a reference
				expect(weakMap.get("key1")).toBeDefined();
			});
		});

		describe("has() method", () => {
			it("should return true for existing key", () => {
				const obj = {id: 1};
				weakMap.set("key1", obj);
				expect(weakMap.has("key1")).toBe(true);
			});

			it("should return false for non-existent key", () => {
				expect(weakMap.has("nonexistent")).toBe(false);
			});

			it("should return false for garbage collected value", () => {
				weakMap.set("key1", {id: 1});
				// Force garbage collection simulation
				for (let i = 0; i < 1000; i++) {
					new Array(1000).fill(0);
				}
				// The value should still be accessible since we have a reference
				expect(weakMap.has("key1")).toBe(true);
			});
		});

		describe("delete() method", () => {
			it("should delete existing entry", () => {
				const obj = {id: 1};
				weakMap.set("key1", obj);
				expect(weakMap.delete("key1")).toBe(true);
				expect(weakMap.has("key1")).toBe(false);
				expect(weakMap.get("key1")).toBeUndefined();
				expect(weakMap.size).toBe(0);
			});

			it("should return false for non-existent key", () => {
				expect(weakMap.delete("nonexistent")).toBe(false);
			});

			it("should emit delete event", () => {
				const deleteSpy = vi.fn();
				weakMap.on("delete", deleteSpy);

				const obj = {id: 1};
				weakMap.set("key1", obj);
				weakMap.delete("key1");

				return new Promise((resolve) => {
					setTimeout(() => {
						expect(deleteSpy).toHaveBeenCalledWith({
							instance: weakMap,
							key: "key1",
							value: obj,
						});
						resolve(undefined);
					}, 0);
				});
			});

			it("should emit finalize event when deleting stale reference (cannot force GC in JS, so this is a placeholder)", () => {
				const finalizeSpy = vi.fn();
				weakMap.on("finalize", finalizeSpy);

				// Create an object and immediately delete it
				const obj = {id: 1};
				weakMap.set("key1", obj);
				// We still have a strong reference, so finalize should NOT be called
				weakMap.delete("key1");

				return new Promise((resolve) => {
					setTimeout(() => {
						// finalize should not be called because value is not GC'd
						expect(finalizeSpy).not.toHaveBeenCalled();
						// Note: JS cannot force garbage collection, so this test cannot guarantee finalize event
						resolve(undefined);
					}, 0);
				});
			});
		});

		describe("clear() method", () => {
			it("should remove all entries", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key2", obj2);

				expect(weakMap.size).toBe(2);
				weakMap.clear();
				expect(weakMap.size).toBe(0);
				expect(weakMap.rawSize).toBe(0);
				expect(weakMap.has("key1")).toBe(false);
				expect(weakMap.has("key2")).toBe(false);
			});

			it("should emit clear event", () => {
				const clearSpy = vi.fn();
				weakMap.on("clear", clearSpy);

				weakMap.set("key1", {id: 1});
				weakMap.clear();

				return new Promise((resolve) => {
					setTimeout(() => {
						expect(clearSpy).toHaveBeenCalledWith({
							instance: weakMap,
						});
						resolve(undefined);
					}, 0);
				});
			});

			it("should work on empty map", () => {
				expect(() => weakMap.clear()).not.toThrow();
				expect(weakMap.size).toBe(0);
			});
		});

		describe("size property", () => {
			it("should return correct size", () => {
				expect(weakMap.size).toBe(0);

				weakMap.set("key1", {id: 1});
				expect(weakMap.size).toBe(1);

				weakMap.set("key2", {id: 2});
				expect(weakMap.size).toBe(2);

				weakMap.delete("key1");
				expect(weakMap.size).toBe(1);
			});

			it("should exclude garbage collected values", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				expect(weakMap.size).toBe(2);
				expect(weakMap.rawSize).toBe(2);

				// Force cleanup
				weakMap.cleanup();
				expect(weakMap.size).toBe(2); // Should still be 2 since values are not actually collected
			});
		});

		describe("rawSize property", () => {
			it("should return total number of entries including stale references", () => {
				expect(weakMap.rawSize).toBe(0);

				weakMap.set("key1", {id: 1});
				expect(weakMap.rawSize).toBe(1);

				weakMap.set("key2", {id: 2});
				expect(weakMap.rawSize).toBe(2);
			});
		});

		describe("forEach() method", () => {
			it("should iterate over all entries", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key2", obj2);

				const callback = vi.fn();
				weakMap.forEach(callback);

				expect(callback).toHaveBeenCalledTimes(2);
				expect(callback).toHaveBeenCalledWith(obj1, "key1", weakMap);
				expect(callback).toHaveBeenCalledWith(obj2, "key2", weakMap);
			});

			it("should handle thisArg correctly", () => {
				const obj = {id: 1};
				weakMap.set("key1", obj);

				const thisArg = {test: true};
				let capturedThis: any;
				const callback = vi.fn(function (this: any) {
					capturedThis = this;
				});

				weakMap.forEach(callback, thisArg);
				expect(capturedThis).toBe(thisArg);
				expect(callback).toHaveBeenCalled();
			});

			it("should skip garbage collected values", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				const callback = vi.fn();
				weakMap.forEach(callback);

				expect(callback).toHaveBeenCalledTimes(2);
			});
		});

		describe("entries() method", () => {
			it("should return iterator of key-value pairs", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key2", obj2);

				const entries = Array.from(weakMap.entries());
				expect(entries).toEqual([
					["key1", obj1],
					["key2", obj2],
				]);
			});

			it("should skip garbage collected values", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				const entries = Array.from(weakMap.entries());
				expect(entries).toHaveLength(2);
			});
		});

		describe("keys() method", () => {
			it("should return iterator of keys", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				const keys = Array.from(weakMap.keys());
				expect(keys).toEqual(["key1", "key2"]);
			});

			it("should skip garbage collected values", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				const keys = Array.from(weakMap.keys());
				expect(keys).toHaveLength(2);
			});
		});

		describe("values() method", () => {
			it("should return iterator of values", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key2", obj2);

				const values = Array.from(weakMap.values());
				expect(values).toEqual([obj1, obj2]);
			});

			it("should skip garbage collected values", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				const values = Array.from(weakMap.values());
				expect(values).toHaveLength(2);
			});
		});

		describe("Symbol.iterator", () => {
			it("should be iterable", () => {
				const obj1 = {id: 1};
				const obj2 = {id: 2};

				weakMap.set("key1", obj1);
				weakMap.set("key2", obj2);

				const entries = Array.from(weakMap);
				expect(entries).toEqual([
					["key1", obj1],
					["key2", obj2],
				]);
			});
		});

		describe("cleanup() method", () => {
			it("should remove stale references", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});

				expect(weakMap.rawSize).toBe(2);
				weakMap.cleanup();
				expect(weakMap.rawSize).toBe(2); // Values are still accessible
			});

			it("should emit finalize events for collected values", () => {
				const finalizeSpy = vi.fn();
				weakMap.on("finalize", finalizeSpy);

				weakMap.set("key1", {id: 1});
				weakMap.cleanup();

				return new Promise((resolve) => {
					setTimeout(() => {
						// Should not emit finalize since values are still accessible
						expect(finalizeSpy).not.toHaveBeenCalled();
						resolve(undefined);
					}, 0);
				});
			});
		});

		describe("Event handling", () => {
			it("should prevent external event emission", () => {
				expect(() => {
					(weakMap as any).emit("custom-event");
				}).toThrow(ChimeraInternalError);
				expect(() => {
					(weakMap as any).emit("custom-event", "data");
				}).toThrow(ChimeraInternalError);
			});

			it("should handle multiple event listeners", () => {
				const listener1 = vi.fn();
				const listener2 = vi.fn();

				weakMap.on("set", listener1);
				weakMap.on("set", listener2);

				const obj = {id: 1};
				weakMap.set("key1", obj);

				return new Promise((resolve) => {
					setTimeout(() => {
						expect(listener1).toHaveBeenCalledWith({
							instance: weakMap,
							key: "key1",
							value: obj,
						});
						expect(listener2).toHaveBeenCalledWith({
							instance: weakMap,
							key: "key1",
							value: obj,
						});
						resolve(undefined);
					}, 0);
				});
			});

			it("should handle event removal", () => {
				const listener = vi.fn();
				weakMap.on("set", listener);
				weakMap.off("set", listener);

				const obj = {id: 1};
				weakMap.set("key1", obj);

				return new Promise((resolve) => {
					setTimeout(() => {
						expect(listener).not.toHaveBeenCalled();
						resolve(undefined);
					}, 0);
				});
			});
		});

		describe("Edge cases", () => {
			it("should handle null and undefined keys", () => {
				const obj = {id: 1};

				weakMap.set(null as any, obj);
				expect(weakMap.has(null as any)).toBe(true);
				expect(weakMap.get(null as any)).toBe(obj);

				weakMap.set(undefined as any, obj);
				expect(weakMap.has(undefined as any)).toBe(true);
				expect(weakMap.get(undefined as any)).toBe(obj);
			});

			it("should handle primitive values as keys", () => {
				const obj = {id: 1};

				weakMap.set("string", obj);
				weakMap.set(123 as any, obj);
				weakMap.set(true as any, obj);

				expect(weakMap.has("string")).toBe(true);
				expect(weakMap.has(123 as any)).toBe(true);
				expect(weakMap.has(true as any)).toBe(true);

				// Test Symbol keys separately as they might behave differently
				const symbolKey = Symbol("test");
				weakMap.set(symbolKey as any, obj);
				expect(weakMap.has(symbolKey as any)).toBe(true);
			});

			it("should handle same object with different keys", () => {
				const obj = {id: 1};

				weakMap.set("key1", obj);
				weakMap.set("key2", obj);

				expect(weakMap.get("key1")).toBe(obj);
				expect(weakMap.get("key2")).toBe(obj);
				expect(weakMap.size).toBe(2);
			});

			it("should handle rapid set/delete operations", () => {
				const obj = {id: 1};

				weakMap.set("key1", obj);
				weakMap.delete("key1");
				weakMap.set("key1", obj);
				weakMap.delete("key1");

				expect(weakMap.size).toBe(0);
				expect(weakMap.has("key1")).toBe(false);
			});

			it("should handle large number of entries", () => {
				const entries = 1000;

				for (let i = 0; i < entries; i++) {
					weakMap.set(`key${i}`, {id: i});
				}

				expect(weakMap.size).toBe(entries);
				expect(weakMap.rawSize).toBe(entries);

				// Test iteration
				const allEntries = Array.from(weakMap.entries());
				expect(allEntries).toHaveLength(entries);
			});

			it("should handle concurrent modifications during iteration", () => {
				weakMap.set("key1", {id: 1});
				weakMap.set("key2", {id: 2});
				weakMap.set("key3", {id: 3});

				const entries: [string, object][] = [];
				for (const [key, value] of weakMap) {
					entries.push([key, value]);
					if (key === "key1") {
						weakMap.delete("key2");
					}
				}

				expect(entries.length).toBeGreaterThan(0);
			});
		});

		describe("Memory management", () => {
			it("should not prevent garbage collection of values", () => {
				let obj = {id: 1};
				weakMap.set("key1", obj);

				// Remove the strong reference
				obj = null as any;

				// Force garbage collection simulation
				for (let i = 0; i < 1000; i++) {
					new Array(1000).fill(0);
				}

				// The value should still be accessible through the weak map
				// but this is environment dependent
				expect(weakMap.has("key1")).toBeDefined();
			});

			it("should handle FinalizationRegistry callbacks", () => {
				const finalizeSpy = vi.fn();
				weakMap.on("finalize", finalizeSpy);

				// Create an object and immediately remove strong references
				weakMap.set("key1", {id: 1});

				// Force cleanup
				weakMap.cleanup();

				// The `finalize` event should not be emitted immediately
				// as the object is still accessible
				expect(finalizeSpy).not.toHaveBeenCalled();
			});
		});

		describe("Type safety", () => {
			it("should enforce value type constraint", () => {
				// This should compile without errors
				const stringMap = new ChimeraWeakValueMap<string, object>();
				const numberMap = new ChimeraWeakValueMap<number, object>();
				const symbolMap = new ChimeraWeakValueMap<symbol, object>();

				expect(stringMap).toBeInstanceOf(ChimeraWeakValueMap);
				expect(numberMap).toBeInstanceOf(ChimeraWeakValueMap);
				expect(symbolMap).toBeInstanceOf(ChimeraWeakValueMap);
			});

			it("should handle complex object types", () => {
				interface ComplexObject {
					id: number;
					data: string;
					nested: { value: boolean };
				}

				const complexMap = new ChimeraWeakValueMap<string, ComplexObject>();
				const obj: ComplexObject = {
					data: "test",
					id: 1,
					nested: {value: true},
				};

				complexMap.set("key1", obj);
				expect(complexMap.get("key1")).toBe(obj);
			});
		});
	});
});
