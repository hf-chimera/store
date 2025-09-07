import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ChimeraCancellablePromise } from "../shared/types.ts";
import { ChimeraItemQuery } from "./ChimeraItemQuery.ts";
import { ChimeraDeleteOneSym, ChimeraSetOneSym } from "./constants.ts";
import {
	ChimeraQueryAlreadyRunningError,
	ChimeraQueryDeletedItemError,
	ChimeraQueryNotCreatedError,
	ChimeraQueryNotReadyError,
} from "./errors.ts";
import {
	type ChimeraQueryEntityItemCreator,
	type ChimeraQueryEntityItemDeleter,
	type ChimeraQueryEntityItemFetcher,
	type ChimeraQueryEntityItemUpdater,
	ChimeraQueryFetchingState,
	type QueryEntityConfig,
} from "./types.ts";

interface TestItem {
	id: string;
	name: string;
	value: number;
	nested?: {
		prop: string;
	};
}

interface TestItemWithNumberId {
	id: number;
	name: string;
}

describe("ChimeraItemQuery", () => {
	let mockConfig: QueryEntityConfig<TestItem>;
	let mockParams: { id: string; meta: any };
	let mockFetcher: Mock<ChimeraQueryEntityItemFetcher<TestItem>>;
	let mockUpdater: Mock<ChimeraQueryEntityItemUpdater<TestItem>>;
	let mockDeleter: Mock<ChimeraQueryEntityItemDeleter>;
	let mockCreator: Mock<ChimeraQueryEntityItemCreator<TestItem>>;

	beforeEach(() => {
		mockFetcher = vi.fn();
		mockUpdater = vi.fn();
		mockDeleter = vi.fn();
		mockCreator = vi.fn();

		mockConfig = {
			batchedCreator: vi.fn(),
			batchedDeleter: vi.fn(),
			batchedUpdater: vi.fn(),
			collectionFetcher: vi.fn(),
			devMode: true,
			idGetter: (item: TestItem) => item.id,
			itemCreator: mockCreator,
			itemDeleter: mockDeleter,
			itemFetcher: mockFetcher,
			itemUpdater: mockUpdater,
			name: "test",
			trustQuery: false,
			updateDebounceTimeout: 100,
		};

		mockParams = {
			id: "test-1",
			meta: {},
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Constructor and Initialization", () => {
		it("should initialize with prefetched item", () => {
			const item: TestItem = { id: "test-1", name: "Test Item", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			expect(query.state).toBe(ChimeraQueryFetchingState.Prefetched);
			expect(query.ready).toBe(true);
			expect(query.data).toEqual(item);
			expect(query.id).toBe("test-1");
		});

		it("should initialize with creation mode", async () => {
			const createData = { name: "New Item", value: 100 };
			const createdItem: TestItem = { id: "new-1", name: "New Item", value: 100 };

			mockCreator.mockResolvedValue({ data: createdItem });

			const query = new ChimeraItemQuery(mockConfig, mockParams, null, createData);

			expect(query.state).toBe(ChimeraQueryFetchingState.Creating);
			expect(query.inProgress).toBe(true);

			// Wait for creation to complete
			await query.progress;

			expect(query.state).toBe(ChimeraQueryFetchingState.Fetched);
			expect(query.ready).toBe(true);
			expect(query.data).toEqual(createdItem);
		});

		it("should initialize with fetching mode", async () => {
			const fetchedItem: TestItem = { id: "test-1", name: "Fetched Item", value: 42 };
			mockFetcher.mockResolvedValue({ data: fetchedItem });

			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			expect(query.state).toBe(ChimeraQueryFetchingState.Fetching);
			expect(query.inProgress).toBe(true);

			// Wait for fetch to complete
			await query.progress;

			expect(query.state).toBe(ChimeraQueryFetchingState.Fetched);
			expect(query.ready).toBe(true);
			expect(query.data).toEqual(fetchedItem);
		});

		it("should throw error when id mismatch in dev mode", () => {
			const item: TestItem = { id: "different-id", name: "Test Item", value: 42 };

			expect(() => {
				new ChimeraItemQuery(mockConfig, mockParams, item, null);
			}).toThrow();
		});
	});

	describe("State Management", () => {
		it("should track inProgress states correctly", async () => {
			mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });

			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			expect(query.inProgress).toBe(true); // Fetching

			await query.progress;

			expect(query.inProgress).toBe(false); // Fetched
		});

		it("should handle ready state correctly", () => {
			const item: TestItem = { id: "test-1", name: "Test Item", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			expect(query.ready).toBe(true);
			expect(query.data).toEqual(item);
		});

		it("should throw when accessing data before ready", async () => {
			mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			expect(() => query.data).toThrow(ChimeraQueryNotReadyError);
		});
	});

	describe("Refetch Functionality", () => {
		it("should refetch data successfully", async () => {
			const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, initialItem, null);

			const newItem: TestItem = { id: "test-1", name: "Updated", value: 100 };
			mockFetcher.mockResolvedValue({ data: newItem });

			const refetchPromise = query.refetch();
			expect(query.state).toBe(ChimeraQueryFetchingState.Refetching);
			expect(query.inProgress).toBe(true);

			await refetchPromise;
			expect(query.data).toEqual(newItem);
			expect(query.state).toBe(ChimeraQueryFetchingState.Fetched);
		});

		it("should return existing promise when refetch already running", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockFetcher.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

			const promise1 = query.refetch();
			const promise2 = query.refetch();

			expect(promise1).toBe(promise2);
		});

		it("should force refetch when force=true", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockFetcher.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

			const promise1 = query.refetch();
			const promise2 = query.refetch(true);

			expect(promise1).not.toBe(promise2);
		});

		it("should throw error when refetching during creation", () => {
			mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, {name: "New", value: 42});

			expect(() => query.refetch()).toThrow(ChimeraQueryNotCreatedError);
		});

		it("should throw error when refetching during update", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockUpdater.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

			query.update(item);
			expect(() => query.refetch()).toThrow(ChimeraQueryAlreadyRunningError);
		});
	});

	describe("Update Functionality", () => {
		it("should update item successfully", async () => {
			const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, initialItem, null);

			const updatedItem: TestItem = { id: "test-1", name: "Updated", value: 100 };
			mockUpdater.mockResolvedValue({ data: structuredClone(updatedItem) });

			const updatePromise = query.update(updatedItem);
			expect(query.state).toBe(ChimeraQueryFetchingState.Updating);

			await updatePromise;
			expect(query.data).toEqual(updatedItem);
		});

		it("should throw error when updating with different id", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const wrongItem: TestItem = { id: "different-id", name: "Wrong", value: 100 };

			expect(() => query.update(wrongItem)).toThrow();
		});

		it("should throw error when updating during creation", () => {
			mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, {name: "New", value: 42});

			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			expect(() => query.update(item)).toThrow(ChimeraQueryNotCreatedError);
		});

		it("should throw error when updating deleted item", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });
			await query.delete();

			expect(() => query.update(item)).toThrow(ChimeraQueryDeletedItemError);
		});
	});

	describe("Mutate Functionality", () => {
		it("should mutate item successfully", async () => {
			const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, initialItem, null);

			const expectedUpdated: TestItem = { id: "test-1", name: "Mutated", value: 84 };
			mockUpdater.mockResolvedValue({ data: structuredClone(expectedUpdated) });

			const mutatePromise = query.mutate((item) => ({ ...item, name: "Mutated", value: item.value * 2 }));
			expect(query.state).toBe(ChimeraQueryFetchingState.Updating);

			await mutatePromise;
			expect(query.data).toEqual(expectedUpdated);
		});

		it("should handle null return from mutator", async () => {
			const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, initialItem, null);

			mockUpdater.mockResolvedValue({ data: structuredClone(initialItem) });

			const mutatePromise = query.mutate(() => null as any);
			await mutatePromise;

			expect(mockUpdater).toHaveBeenCalledWith(initialItem, expect.any(Object));
		});
	});

	describe("Mutable Reference", () => {
		it("should provide mutable reference", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const mutable = query.mutable;
			expect(mutable).toEqual(item);
			expect(mutable).not.toBe(item); // Should be a copy
		});

		it("should throw when accessing mutable before ready", () => {
			mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			expect(() => query.mutable).toThrow(ChimeraQueryNotReadyError);
		});

		it("should commit mutable changes", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const mutable = query.mutable;
			mutable.name = "Updated";
			mutable.value = 100;

			mockUpdater.mockResolvedValue({ data: structuredClone(mutable) });

			const commitPromise = query.commit();
			expect(query.state).toBe(ChimeraQueryFetchingState.Updating);

			await commitPromise;
			expect(mockUpdater).toHaveBeenCalledWith(mutable, expect.any(Object));
		});
	});

	describe("Delete Functionality", () => {
		it("should delete item successfully", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });

			const deletePromise = query.delete();
			expect(query.state).toBe(ChimeraQueryFetchingState.Deleting);

			await deletePromise;
			expect(query.state).toBe(ChimeraQueryFetchingState.Deleted);
		});

		it("should handle unsuccessful deletion", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockDeleter.mockResolvedValue({ result: { id: "test-1", success: false } });

			const deletePromise = query.delete();
			await expect(deletePromise).rejects.toThrow();
		});

		it("should throw error when deleting during creation", () => {
			mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, {name: "New", value: 42});

			expect(() => query.delete()).toThrow(ChimeraQueryNotCreatedError);
		});

		it("should throw error when deleting during update", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockUpdater.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

			query.update(item);
			expect(() => query.delete()).toThrow(ChimeraQueryAlreadyRunningError);
		});
	});

	describe("Event System", () => {
		it("should emit selfUpdated event on update", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const events: any[] = [];
			query.on("selfUpdated", (event) => events.push({ event, type: "selfUpdated" }));

			mockUpdater.mockResolvedValue({ data: structuredClone(item) });
			await query.update(item);
			await query.progress;

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("selfUpdated");
		});

		it("should emit selfDeleted event on delete", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const events: any[] = [];
			query.on("selfDeleted", (event) => events.push({ event, type: "selfDeleted" }));

			mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });
			await query.delete();
			await query.progress;

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("selfDeleted");
		});

		it("should emit error event on fetch failure", async () => {
			mockFetcher.mockRejectedValue(new Error("Fetch failed"));
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			const events: any[] = [];
			query.on("error", (event) => events.push({ event, type: "error" }));

			await expect(query.promise).rejects.toThrow();
			await query.progress;

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("error");
		});

		it("should prevent external event emission", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			// @ts-expect-error
			expect(() => query.emit("test")).toThrow();
		});
	});

	describe("Trust Query Mode", () => {
		it("should trust query provider in trust mode", async () => {
			const config = { ...mockConfig, devMode: false, trustQuery: true };
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(config, mockParams, item, null);

			const differentIdItem: TestItem = { id: "different-id", name: "Different", value: 100 };
			mockUpdater.mockResolvedValue({ data: structuredClone(differentIdItem) });

			// Should not throw in trust mode
			await query.update(differentIdItem);
			expect(query.data).toEqual(differentIdItem);
		});

		it("should warn in dev mode with trust query", async () => {
			const config = { ...mockConfig, devMode: true, trustQuery: true };
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(config, mockParams, item, null);

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const differentIdItem: TestItem = { id: "different-id", name: "Different", value: 100 };
			mockUpdater.mockResolvedValue({ data: structuredClone(differentIdItem) });

			await query.update(differentIdItem);

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("Edge Cases", () => {
		it("should handle nested object updates", () => {
			const item: TestItem = {
				id: "test-1",
				name: "Test",
				nested: { prop: "original" },
				value: 42,
			};
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const mutable = query.mutable;
			// biome-ignore lint/style/noNonNullAssertion: mocked to be valid
			mutable.nested!.prop = "updated";

			// biome-ignore lint/style/noNonNullAssertion: mocked to be valid
			expect(mutable.nested!.prop).toBe("updated");
		});

		it("should handle number IDs", () => {
			const config: QueryEntityConfig<TestItemWithNumberId> = {
				...(mockConfig as unknown as QueryEntityConfig<TestItemWithNumberId>),
				idGetter: (item: TestItemWithNumberId) => item.id,
			};

			const item: TestItemWithNumberId = { id: 1, name: "Test" };
			const params = { id: 1, meta: {} };

			const query = new ChimeraItemQuery(config, params, item, null);

			expect(query.id).toBe(1);
			expect(query.data).toEqual(item);
		});

		it("should handle cancellation of promises", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockUpdater.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));
			mockFetcher.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

			const updatePromise = query.update(item);
			query.refetch(true); // This should cancel the update

			await expect(
				new Promise((resolve) =>
					(updatePromise as unknown as ChimeraCancellablePromise<void>).cancelled(() => resolve(0)),
				),
			).resolves.toBe(0);
		});

		it("should handle toJSON and toString", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			expect(query.toJSON()).toEqual(item);
			expect(query.toString()).toBe(item.toString());
		});

		it("should handle external updates via symbol", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const updatedItem: TestItem = { id: "test-1", name: "External Update", value: 100 };

			// Simulate external update
			query[ChimeraSetOneSym](updatedItem);

			expect(query.data).toEqual(updatedItem);
			expect(query.state).toBe(ChimeraQueryFetchingState.Actualized);
		});

		it("should handle external deletion via symbol", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			// Simulate external deletion
			query[ChimeraDeleteOneSym]("test-1");

			expect(query.state).toBe(ChimeraQueryFetchingState.Deleted);
		});

		it("should ignore external deletion for different id", () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			const originalState = query.state;

			// Simulate external deletion with different id
			query[ChimeraDeleteOneSym]("different-id");

			expect(query.state).toBe(originalState);
		});
	});

	describe("Error Handling", () => {
		it("should handle fetch errors", async () => {
			mockFetcher.mockRejectedValue(new Error("Network error"));
			const query = new ChimeraItemQuery(mockConfig, mockParams, null, null);

			await query.progress;

			expect(query.state).toBe(ChimeraQueryFetchingState.Errored);
			expect(query.lastError).toBeInstanceOf(Error);
		});

		it("should handle update errors", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockUpdater.mockRejectedValue(new Error("Update failed"));

			await expect(query.update(item)).rejects.toThrow();
			expect(query.state).toBe(ChimeraQueryFetchingState.ReErrored);
		});

		it("should handle delete errors", async () => {
			const item: TestItem = { id: "test-1", name: "Test", value: 42 };
			const query = new ChimeraItemQuery(mockConfig, mockParams, item, null);

			mockDeleter.mockRejectedValue(new Error("Delete failed"));

			await expect(query.delete()).rejects.toThrow();
			expect(query.state).toBe(ChimeraQueryFetchingState.ReErrored);
		});

		it("should handle creation errors", async () => {
			mockCreator.mockRejectedValue(new Error("Creation failed"));

			const query = new ChimeraItemQuery(mockConfig, mockParams, null, {name: "New", value: 42});

			await expect(query.promise).rejects.toThrow();
			await query.progress;
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(query.state).toBe(ChimeraQueryFetchingState.Errored);
			expect(query.lastError).toBeInstanceOf(Error);
		});
	});
});
