import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ChimeraFilterChecker } from "../filter";
import type { ChimeraOrderByComparator } from "../order";
import { none, some } from "../shared/shared.ts";
import type { ChimeraCancellablePromise } from "../shared/types.ts";
import { ChimeraCollectionQuery } from "./ChimeraCollectionQuery.ts";
import { ChimeraItemQuery } from "./ChimeraItemQuery.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
} from "./constants.ts";
import {
	ChimeraQueryAlreadyRunningError,
	ChimeraQueryDeletedItemError,
	ChimeraQueryNotCreatedError,
	ChimeraQueryNotReadyError,
	ChimeraQueryUnsuccessfulDeletionError,
} from "./errors.ts";
import type {
	ChimeraQueryEntityBatchedCreator,
	ChimeraQueryEntityBatchedDeleter,
	ChimeraQueryEntityBatchedUpdater,
	ChimeraQueryEntityCollectionFetcher,
	ChimeraQueryEntityCollectionFetcherParams,
	ChimeraQueryEntityItemCreator,
	ChimeraQueryEntityItemDeleter,
	ChimeraQueryEntityItemFetcher,
	ChimeraQueryEntityItemUpdater,
	QueryEntityConfig,
} from "./types.ts";
import { ChimeraQueryFetchingState } from "./types.ts";

// Test data types
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

describe("Query Module - Unit Tests", () => {
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
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				expect(query.state).toBe(ChimeraQueryFetchingState.Prefetched);
				expect(query.ready).toBe(true);
				expect(query.data).toEqual(item);
				expect(query.id).toBe("test-1");
			});

			it("should initialize with creation mode", async () => {
				const createData = { name: "New Item", value: 100 };
				const createdItem: TestItem = { id: "new-1", name: "New Item", value: 100 };

				mockCreator.mockResolvedValue({ data: createdItem });

				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), some(createData));

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

				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

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
					new ChimeraItemQuery(mockConfig, mockParams, some(item), none());
				}).toThrow();
			});
		});

		describe("State Management", () => {
			it("should track inProgress states correctly", async () => {
				mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });

				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

				expect(query.inProgress).toBe(true); // Fetching

				await query.progress;

				expect(query.inProgress).toBe(false); // Fetched
			});

			it("should handle ready state correctly", () => {
				const item: TestItem = { id: "test-1", name: "Test Item", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				expect(query.ready).toBe(true);
				expect(query.data).toEqual(item);
			});

			it("should throw when accessing data before ready", async () => {
				mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

				expect(() => query.data).toThrow(ChimeraQueryNotReadyError);
			});
		});

		describe("Refetch Functionality", () => {
			it("should refetch data successfully", async () => {
				const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(initialItem), none());

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
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockFetcher.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

				const promise1 = query.refetch();
				const promise2 = query.refetch();

				expect(promise1).toBe(promise2);
			});

			it("should force refetch when force=true", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockFetcher.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

				const promise1 = query.refetch();
				const promise2 = query.refetch(true);

				expect(promise1).not.toBe(promise2);
			});

			it("should throw error when refetching during creation", () => {
				mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), some({ name: "New", value: 42 }));

				expect(() => query.refetch()).toThrow(ChimeraQueryNotCreatedError);
			});

			it("should throw error when refetching during update", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockUpdater.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

				query.update(item);
				expect(() => query.refetch()).toThrow(ChimeraQueryAlreadyRunningError);
			});
		});

		describe("Update Functionality", () => {
			it("should update item successfully", async () => {
				const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(initialItem), none());

				const updatedItem: TestItem = { id: "test-1", name: "Updated", value: 100 };
				mockUpdater.mockResolvedValue({ data: structuredClone(updatedItem) });

				const updatePromise = query.update(updatedItem);
				expect(query.state).toBe(ChimeraQueryFetchingState.Updating);

				await updatePromise;
				expect(query.data).toEqual(updatedItem);
			});

			it("should throw error when updating with different id", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const wrongItem: TestItem = { id: "different-id", name: "Wrong", value: 100 };

				expect(() => query.update(wrongItem)).toThrow();
			});

			it("should throw error when updating during creation", () => {
				mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), some({ name: "New", value: 42 }));

				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				expect(() => query.update(item)).toThrow(ChimeraQueryNotCreatedError);
			});

			it("should throw error when updating deleted item", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });
				await query.delete();

				expect(() => query.update(item)).toThrow(ChimeraQueryDeletedItemError);
			});
		});

		describe("Mutate Functionality", () => {
			it("should mutate item successfully", async () => {
				const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(initialItem), none());

				const expectedUpdated: TestItem = { id: "test-1", name: "Mutated", value: 84 };
				mockUpdater.mockResolvedValue({ data: structuredClone(expectedUpdated) });

				const mutatePromise = query.mutate((item) => ({ ...item, name: "Mutated", value: item.value * 2 }));
				expect(query.state).toBe(ChimeraQueryFetchingState.Updating);

				await mutatePromise;
				expect(query.data).toEqual(expectedUpdated);
			});

			it("should handle null return from mutator", async () => {
				const initialItem: TestItem = { id: "test-1", name: "Initial", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(initialItem), none());

				mockUpdater.mockResolvedValue({ data: structuredClone(initialItem) });

				const mutatePromise = query.mutate(() => null as any);
				await mutatePromise;

				expect(mockUpdater).toHaveBeenCalledWith(initialItem, expect.any(Object));
			});
		});

		describe("Mutable Reference", () => {
			it("should provide mutable reference", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const mutable = query.mutable;
				expect(mutable).toEqual(item);
				expect(mutable).not.toBe(item); // Should be a copy
			});

			it("should throw when accessing mutable before ready", () => {
				mockFetcher.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

				expect(() => query.mutable).toThrow(ChimeraQueryNotReadyError);
			});

			it("should commit mutable changes", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

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
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });

				const deletePromise = query.delete();
				expect(query.state).toBe(ChimeraQueryFetchingState.Deleting);

				await deletePromise;
				expect(query.state).toBe(ChimeraQueryFetchingState.Deleted);
			});

			it("should handle unsuccessful deletion", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockDeleter.mockResolvedValue({ result: { id: "test-1", success: false } });

				const deletePromise = query.delete();
				await expect(deletePromise).rejects.toThrow();
			});

			it("should throw error when deleting during creation", () => {
				mockCreator.mockResolvedValue({ data: { id: "test-1", name: "Test", value: 42 } });
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), some({ name: "New", value: 42 }));

				expect(() => query.delete()).toThrow(ChimeraQueryNotCreatedError);
			});

			it("should throw error when deleting during update", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockUpdater.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: item }), 100)));

				query.update(item);
				expect(() => query.delete()).toThrow(ChimeraQueryAlreadyRunningError);
			});
		});

		describe("Event System", () => {
			it("should emit selfUpdated event on update", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const events: any[] = [];
				query.on("selfUpdated", (q, item, old) => events.push({ item, old, query: q, type: "selfUpdated" }));

				mockUpdater.mockResolvedValue({ data: structuredClone(item) });
				await query.update(item);
				await query.progress;

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("selfUpdated");
			});

			it("should emit selfDeleted event on delete", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const events: any[] = [];
				query.on("selfDeleted", (q, id) => events.push({ id, query: q, type: "selfDeleted" }));

				mockDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });
				await query.delete();
				await query.progress;

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("selfDeleted");
			});

			it("should emit error event on fetch failure", async () => {
				mockFetcher.mockRejectedValue(new Error("Fetch failed"));
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

				const events: any[] = [];
				query.on("error", (q, error) => events.push({ error, query: q, type: "error" }));

				await expect(query.promise).rejects.toThrow();
				await query.progress;

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("error");
			});

			it("should prevent external event emission", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				// @ts-expect-error
				expect(() => query.emit("test")).toThrow();
			});
		});

		describe("Trust Query Mode", () => {
			it("should trust query provider in trust mode", async () => {
				const config = { ...mockConfig, devMode: false, trustQuery: true };
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(config, mockParams, some(item), none());

				const differentIdItem: TestItem = { id: "different-id", name: "Different", value: 100 };
				mockUpdater.mockResolvedValue({ data: structuredClone(differentIdItem) });

				// Should not throw in trust mode
				await query.update(differentIdItem);
				expect(query.data).toEqual(differentIdItem);
			});

			it("should warn in dev mode with trust query", async () => {
				const config = { ...mockConfig, devMode: true, trustQuery: true };
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(config, mockParams, some(item), none());

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
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

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

				const query = new ChimeraItemQuery(config, params, some(item), none());

				expect(query.id).toBe(1);
				expect(query.data).toEqual(item);
			});

			it("should handle cancellation of promises", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

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
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				expect(query.toJSON()).toEqual(item);
				expect(query.toString()).toBe(item.toString());
			});

			it("should handle external updates via symbol", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const updatedItem: TestItem = { id: "test-1", name: "External Update", value: 100 };

				// Simulate external update
				query[ChimeraSetOneSym](updatedItem);

				expect(query.data).toEqual(updatedItem);
				expect(query.state).toBe(ChimeraQueryFetchingState.Actualized);
			});

			it("should handle external deletion via symbol", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				// Simulate external deletion
				query[ChimeraDeleteOneSym]("test-1");

				expect(query.state).toBe(ChimeraQueryFetchingState.Deleted);
			});

			it("should ignore external deletion for different id", () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				const originalState = query.state;

				// Simulate external deletion with different id
				query[ChimeraDeleteOneSym]("different-id");

				expect(query.state).toBe(originalState);
			});
		});

		describe("Error Handling", () => {
			it("should handle fetch errors", async () => {
				mockFetcher.mockRejectedValue(new Error("Network error"));
				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), none());

				await query.progress;

				expect(query.state).toBe(ChimeraQueryFetchingState.Errored);
				expect(query.lastError).toBeInstanceOf(Error);
			});

			it("should handle update errors", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockUpdater.mockRejectedValue(new Error("Update failed"));

				await expect(query.update(item)).rejects.toThrow();
				expect(query.state).toBe(ChimeraQueryFetchingState.ReErrored);
			});

			it("should handle delete errors", async () => {
				const item: TestItem = { id: "test-1", name: "Test", value: 42 };
				const query = new ChimeraItemQuery(mockConfig, mockParams, some(item), none());

				mockDeleter.mockRejectedValue(new Error("Delete failed"));

				await expect(query.delete()).rejects.toThrow();
				expect(query.state).toBe(ChimeraQueryFetchingState.ReErrored);
			});

			it("should handle creation errors", async () => {
				mockCreator.mockRejectedValue(new Error("Creation failed"));

				const query = new ChimeraItemQuery(mockConfig, mockParams, none(), some({ name: "New", value: 42 }));

				await expect(query.promise).rejects.toThrow();
				await query.progress;
				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(query.state).toBe(ChimeraQueryFetchingState.Errored);
				expect(query.lastError).toBeInstanceOf(Error);
			});
		});
	});

	describe("ChimeraCollectionQuery", () => {
		let mockConfig: QueryEntityConfig<TestItem>;
		let mockParams: ChimeraQueryEntityCollectionFetcherParams<TestItem>;
		let mockCollectionFetcher: Mock<ChimeraQueryEntityCollectionFetcher<TestItem>>;
		let mockItemUpdater: Mock<ChimeraQueryEntityItemUpdater<TestItem>>;
		let mockItemDeleter: Mock<ChimeraQueryEntityItemDeleter>;
		let mockItemCreator: Mock<ChimeraQueryEntityItemCreator<TestItem>>;
		let mockBatchedUpdater: Mock<ChimeraQueryEntityBatchedUpdater<TestItem>>;
		let mockBatchedDeleter: Mock<ChimeraQueryEntityBatchedDeleter>;
		let mockBatchedCreator: Mock<ChimeraQueryEntityBatchedCreator<TestItem>>;
		let mockOrder: Mock<ChimeraOrderByComparator<TestItem>>;
		let mockFilter: Mock<ChimeraFilterChecker<TestItem>>;

		beforeEach(() => {
			mockCollectionFetcher = vi.fn();
			mockItemUpdater = vi.fn();
			mockItemDeleter = vi.fn();
			mockItemCreator = vi.fn();
			mockBatchedUpdater = vi.fn();
			mockBatchedDeleter = vi.fn();
			mockBatchedCreator = vi.fn();
			mockOrder = vi.fn().mockReturnValue(0);
			mockFilter = vi.fn().mockReturnValue(true);

			mockConfig = {
				batchedCreator: mockBatchedCreator,
				batchedDeleter: mockBatchedDeleter,
				batchedUpdater: mockBatchedUpdater,
				collectionFetcher: mockCollectionFetcher,
				devMode: true,
				idGetter: (item: TestItem) => item.id,
				itemCreator: mockItemCreator,
				itemDeleter: mockItemDeleter,
				itemFetcher: vi.fn(),
				itemUpdater: mockItemUpdater,
				name: "test-collection",
				trustQuery: false,
				updateDebounceTimeout: 100,
			};

			mockParams = {
				filter: null,
				meta: {},
				order: [],
			};
		});

		afterEach(() => {
			vi.clearAllMocks();
		});

		describe("Constructor and Initialization", () => {
			it("should initialize with prefetched items", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				expect(query.state).toBe(ChimeraQueryFetchingState.Prefetched);
				expect(query.ready).toBe(true);
				expect(Array.from(query)).toEqual(items);
			});

			it("should initialize with fetching mode", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Fetched Item", value: 42 }];
				mockCollectionFetcher.mockResolvedValue({ data: items });

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				expect(query.state).toBe(ChimeraQueryFetchingState.Fetching);
				expect(query.inProgress).toBe(true);

				await query.progress;

				expect(query.state).toBe(ChimeraQueryFetchingState.Fetched);
				expect(query.ready).toBe(true);
				expect(Array.from(query)).toEqual(items);
			});

			it("should apply filter and order when already valid is false", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];

				mockFilter.mockImplementation((item: TestItem) => item.value > 15);
				mockOrder.mockImplementation((a: TestItem, b: TestItem) => a.value - b.value);

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				expect(query.length).toBe(1);
				expect(query.at(0)?.id).toBe("test-2");
			});

			it("should validate items when alreadyValid is true", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 10 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, true);
				expect(Array.from(query)).toEqual(items);
			});

			it("should handle empty iterable input", () => {
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some([]), mockOrder, mockFilter, false);
				expect(Array.from(query)).toEqual([]);
				expect(query.ready).toBe(true);
			});
		});

		describe("State Management", () => {
			it("should track inProgress states correctly", async () => {
				mockCollectionFetcher.mockResolvedValue({ data: [{ id: "test-1", name: "Test", value: 42 }] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				expect(query.inProgress).toBe(true); // Fetching
				await query.progress;
				expect(query.inProgress).toBe(false); // Fetched
			});

			it("should handle ready state correctly", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test Item", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				expect(query.ready).toBe(true);
				expect(Array.from(query)).toEqual(items);
			});

			it("should throw when accessing data before ready", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [{ id: "test-1", name: "Test", value: 42 }] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				expect(() => Array.from(query)).toThrow(ChimeraQueryNotReadyError);
			});

			it("should throw when accessing length before ready", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [{ id: "test-1", name: "Test", value: 42 }] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				expect(() => query.length).toThrow(ChimeraQueryNotReadyError);
			});
		});

		describe("Data Access Methods", () => {
			it("should return item by id", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const foundItem = query.getById("test-2");
				expect(foundItem).toEqual({ id: "test-2", name: "Item 2", value: 20 });

				const notFound = query.getById("non-existent");
				expect(notFound).toBeUndefined();
			});

			it("should return mutable item by index", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 10 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const mutable = query.mutableAt(0);
				expect(mutable).toEqual(items[0]);
				expect(mutable).not.toBe(items[0]); // Should be a copy
			});

			it("should return mutable item by id", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 10 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const mutable = query.mutableGetById("test-1");
				expect(mutable).toEqual(items[0]);
				expect(mutable).not.toBe(items[0]); // Should be a copy
			});

			it("should handle at() method with negative indices", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				expect(query.at(0)).toEqual(items[0]);
				expect(query.at(-1)).toEqual(items[1]);
				expect(query.at(-2)).toEqual(items[0]);
				expect(query.at(99)).toBeUndefined();
			});
		});

		describe("Refetch Functionality", () => {
			it("should refetch data successfully", async () => {
				const initialItems: TestItem[] = [{ id: "test-1", name: "Initial", value: 42 }];
				const newItems: TestItem[] = [{ id: "test-1", name: "Updated", value: 100 }];

				const query = new ChimeraCollectionQuery(
					mockConfig,
					mockParams,
					some(initialItems),
					mockOrder,
					mockFilter,
					false,
				);

				mockCollectionFetcher.mockResolvedValue({ data: newItems });

				query.refetch();
				expect(query.state).toBe(ChimeraQueryFetchingState.Refetching);
				expect(query.inProgress).toBe(true);

				await query.progress;
				expect(Array.from(query)).toEqual(newItems);
				expect(query.state).toBe(ChimeraQueryFetchingState.Fetched);
			});

			it("should return existing promise when refetch already running", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockCollectionFetcher.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ data: items }), 100)),
				);

				const promise1 = query.refetch();
				const promise2 = query.refetch();

				expect(promise1).toBe(promise2);
			});

			it("should force refetch when force=true", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockCollectionFetcher.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ data: items }), 100)),
				);

				const promise1 = query.refetch();
				const promise2 = query.refetch(true);

				expect(promise1).not.toBe(promise2);
			});
		});

		describe("Update Functionality", () => {
			it("should update single item successfully", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Initial", value: 42 }];
				const updatedItem: TestItem = { id: "test-1", name: "Updated", value: 100 };

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockItemUpdater.mockResolvedValue({ data: updatedItem });

				await query.update(updatedItem);
				expect(mockItemUpdater).toHaveBeenCalledWith(updatedItem, expect.any(Object));
			});

			it("should update multiple items using batchedUpdate", async () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];
				const updatedItems: TestItem[] = [
					{ id: "test-1", name: "Updated 1", value: 100 },
					{ id: "test-2", name: "Updated 2", value: 200 },
				];

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockBatchedUpdater.mockResolvedValue({ data: updatedItems });

				await query.batchedUpdate(updatedItems);
				expect(mockBatchedUpdater).toHaveBeenCalledWith(updatedItems, expect.any(Object));
			});

			it("should handle update when collection is not ready", async () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				const updatedItem: TestItem = { id: "test-1", name: "Updated", value: 100 };
				mockItemUpdater.mockResolvedValue({ data: updatedItem });

				// Should not throw, but item won't be added to collection since it's not ready
				await query.update(updatedItem);
				expect(mockItemUpdater).toHaveBeenCalled();
			});
		});

		describe("Delete Functionality", () => {
			it("should delete single item successfully", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockItemDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });

				await query.delete("test-1");
				expect(mockItemDeleter).toHaveBeenCalledWith("test-1", expect.any(Object));
			});

			it("should handle delete with id mismatch in trust mode", async () => {
				const config = { ...mockConfig, devMode: false, trustQuery: true };
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(config, mockParams, some(items), mockOrder, mockFilter, false);

				// Server returns different id than requested
				mockItemDeleter.mockResolvedValue({ result: { id: "different-id", success: true } });

				await query.delete("test-1");
				expect(mockItemDeleter).toHaveBeenCalledWith("test-1", expect.any(Object));
			});

			it("should warn about id mismatch in dev mode with trust query", async () => {
				const config = { ...mockConfig, devMode: true, trustQuery: true };
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(config, mockParams, some(items), mockOrder, mockFilter, false);

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

				// Server returns different id than requested
				mockItemDeleter.mockResolvedValue({ result: { id: "different-id", success: true } });

				await query.delete("test-1");
				expect(consoleSpy).toHaveBeenCalled();
				consoleSpy.mockRestore();
			});

			it("should delete multiple items using batchedDelete", async () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockBatchedDeleter.mockResolvedValue({ result: [{ id: "test-1", success: true }] });

				await query.batchedDelete(["test-1"]);
				expect(mockBatchedDeleter).toHaveBeenCalledWith(["test-1"], expect.any(Object));
			});

			it("should handle unsuccessful deletion", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockItemDeleter.mockResolvedValue({ result: { id: "test-1", success: false } });

				await expect(query.delete("test-1")).rejects.toThrow(ChimeraQueryUnsuccessfulDeletionError);
				expect(query.state).toBe(ChimeraQueryFetchingState.ReErrored);
			});

			it("should handle unsuccessful batch deletion", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockBatchedDeleter.mockResolvedValue({
					result: [
						{ id: "test-1", success: true },
						{ id: "test-2", success: false },
					],
				});

				await expect(query.batchedDelete(["test-1", "test-2"])).rejects.toThrow(ChimeraQueryUnsuccessfulDeletionError);
			});

			it("should handle delete when collection is not ready", async () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				mockItemDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });

				// Should not throw, just emit event
				await query.delete("test-1");
				expect(mockItemDeleter).toHaveBeenCalled();
			});
		});

		describe("Create Functionality", () => {
			it("should create single item successfully", async () => {
				const items: TestItem[] = [];
				const newItemData = { name: "New Item", value: 100 };
				const createdItem: TestItem = { id: "new-1", name: "New Item", value: 100 };

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockItemCreator.mockResolvedValue({ data: createdItem });

				await query.create(newItemData);
				expect(mockItemCreator).toHaveBeenCalledWith(newItemData, expect.any(Object));
			});

			it("should create multiple items using batchedCreate", async () => {
				const items: TestItem[] = [];
				const newItemsData = [
					{ name: "New Item 1", value: 100 },
					{ name: "New Item 2", value: 200 },
				];
				const createdItems: TestItem[] = [
					{ id: "new-1", name: "New Item 1", value: 100 },
					{ id: "new-2", name: "New Item 2", value: 200 },
				];

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockBatchedCreator.mockResolvedValue({ data: createdItems });

				await query.batchedCreate(newItemsData);
				expect(mockBatchedCreator).toHaveBeenCalledWith(newItemsData, expect.any(Object));
			});

			it("should handle create when collection is not ready", async () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				const newItemData = { name: "New Item", value: 100 };
				const createdItem: TestItem = { id: "new-1", name: "New Item", value: 100 };
				mockItemCreator.mockResolvedValue({ data: createdItem });

				// Should not throw, just emit event
				await query.create(newItemData);
				expect(mockItemCreator).toHaveBeenCalled();
			});
		});

		describe("Event System", () => {
			it("should emit initialized event on construction", async () => {
				const events: any[] = [];
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				query.on("initialized", (q) => events.push({ query: q, type: "initialized" }));

				// Need to wait a microtask for the event to be emitted
				await new Promise((resolve) => queueMicrotask(() => resolve(0)));

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("initialized");
			});

			it("should emit ready event when data becomes available", async () => {
				const events: any[] = [];
				mockCollectionFetcher.mockResolvedValue({ data: [{ id: "test-1", name: "Test", value: 42 }] });

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);
				query.on("ready", (q) => events.push({ query: q, type: "ready" }));

				await query.progress;
				await new Promise((resolve) => queueMicrotask(() => resolve(0)));

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("ready");
			});

			it("should emit selfItemCreated event on create", async () => {
				const events: any[] = [];
				const items: TestItem[] = [];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				query.on("selfItemCreated", (q, item) => events.push({ item, query: q, type: "selfItemCreated" }));

				const createdItem: TestItem = { id: "new-1", name: "New Item", value: 100 };
				mockItemCreator.mockResolvedValue({ data: createdItem });

				await query.create({ name: "New Item", value: 100 });
				await new Promise((resolve) => queueMicrotask(() => resolve(0)));

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("selfItemCreated");
			});

			it("should emit selfItemDeleted event on delete", async () => {
				const events: any[] = [];
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				query.on("selfItemDeleted", (q, id) => events.push({ id, query: q, type: "selfItemDeleted" }));

				mockItemDeleter.mockResolvedValue({ result: { id: "test-1", success: true } });

				await query.delete("test-1");
				await new Promise((resolve) => queueMicrotask(() => resolve(0)));

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("selfItemDeleted");
			});

			it("should emit error event on fetch failure", async () => {
				const events: any[] = [];
				mockCollectionFetcher.mockRejectedValue(new Error("Network error"));

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);
				query.on("error", (q, error) => events.push({ error, query: q, type: "error" }));

				await expect(query.result).rejects.toThrow("Network error");

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("error");
			});

			it("should prevent external event emission", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				// @ts-expect-error
				expect(() => query.emit("test")).toThrow();
			});
		});

		describe("External Updates via Symbols", () => {
			it("should handle external item update via setOne symbol", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const updatedItem: TestItem = { id: "test-1", name: "External Update", value: 100 };
				query[ChimeraSetOneSym](updatedItem);

				const foundItem = query.getById("test-1");
				expect(foundItem).toEqual(updatedItem);
			});

			it("should handle external item deletion via deleteOne symbol", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Test 1", value: 42 },
					{ id: "test-2", name: "Test 2", value: 84 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				query[ChimeraDeleteOneSym]("test-1");

				expect(query.length).toBe(1);
				expect(query.at(0)?.id).toBe("test-2");
			});

			it("should handle external batch operations via symbols", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const newItems: TestItem[] = [
					{ id: "test-2", name: "New Item", value: 100 },
					{ id: "test-3", name: "Another Item", value: 200 },
				];

				query[ChimeraSetManySym](newItems);
				query[ChimeraDeleteManySym](["test-1"]);

				expect(query.length).toBe(2);
				expect(query.getById("test-1")).toBeUndefined();
				expect(query.getById("test-2")).toBeDefined();
				expect(query.getById("test-3")).toBeDefined();
			});

			it("should handle mixed external operations via updateMixed symbol", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Test 1", value: 42 },
					{ id: "test-2", name: "Test 2", value: 84 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const newItems: TestItem[] = [{ id: "test-3", name: "New Item", value: 100 }];
				const idsToDelete = ["test-1"];

				query[ChimeraUpdateMixedSym](newItems, idsToDelete);

				expect(query.length).toBe(2);
				expect(query.getById("test-1")).toBeUndefined();
				expect(query.getById("test-2")).toBeDefined();
				expect(query.getById("test-3")).toBeDefined();
			});
		});

		describe("Filtering and Ordering Edge Cases", () => {
			it("should maintain correct order when adding items with complex comparator", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-3", name: "Item 3", value: 30 },
				];

				mockOrder.mockImplementation((a: TestItem, b: TestItem) => a.value - b.value);

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const newItem: TestItem = { id: "test-2", name: "Item 2", value: 20 };
				query[ChimeraSetOneSym](newItem);

				expect(query.at(0)?.id).toBe("test-1");
				expect(query.at(1)?.id).toBe("test-2");
				expect(query.at(2)?.id).toBe("test-3");
			});

			it("should handle order comparator returning 0 (equal items)", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 100 }];

				// Mock order that considers items with the same value as equal
				mockOrder.mockImplementation((a: TestItem, b: TestItem) => (a.value === b.value ? 0 : a.value - b.value));

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// This item should replace the existing one since order returns 0
				const sameValueItem: TestItem = { id: "test-1", name: "Updated Item", value: 100 };
				query[ChimeraSetOneSym](sameValueItem);

				expect(query.length).toBe(1);
				expect(query.at(0)?.name).toBe("Updated Item");
			});

			it("should respect filter when adding items and handle edge cases", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 100 }];

				mockFilter.mockImplementation((item: TestItem) => item.value >= 50);

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// This should be added (value >= 50)
				const validItem: TestItem = { id: "test-2", name: "Valid Item", value: 50 }; // Edge case: exactly 50
				query[ChimeraSetOneSym](validItem);

				// This should not be added (value < 50)
				const invalidItem: TestItem = { id: "test-3", name: "Invalid Item", value: 49 }; // Edge case: just below a threshold
				query[ChimeraSetOneSym](invalidItem);

				expect(query.length).toBe(2);
				expect(query.getById("test-2")).toBeDefined();
				expect(query.getById("test-3")).toBeUndefined();
			});

			it("should handle item that doesn't match filter and doesn't exist", () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item 1", value: 100 }];

				mockFilter.mockImplementation((item: TestItem) => item.value >= 50);

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Item doesn't exist and doesn't match filter - should be ignored
				const nonMatchingNewItem: TestItem = { id: "test-new", name: "New Item", value: 25 };
				query[ChimeraSetOneSym](nonMatchingNewItem);

				expect(query.length).toBe(1);
				expect(query.getById("test-new")).toBeUndefined();
			});

			it("should handle ordering edge case where findIndex returns -1", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];

				// Mock order that always returns <= 0, so findIndex will return -1
				mockOrder.mockImplementation(() => -1);

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const newItem: TestItem = { id: "test-3", name: "Item 3", value: 30 };
				query[ChimeraSetOneSym](newItem);

				// Should be added at the end since foundIndex is -1
				expect(query.length).toBe(3);
				expect(query.at(2)?.id).toBe("test-3");
			});
		});

		describe("Trust Query Mode Edge Cases", () => {
			it("should trust server data in trust mode without dev mode", () => {
				const config = { ...mockConfig, devMode: false, trustQuery: true };
				const serverItems: TestItem[] = [
					{ id: "test-1", name: "Server Item", value: 42 },
					{ id: "test-2", name: "Another Item", value: 100 },
				];

				// Set up filter/order that would normally modify the data
				mockFilter.mockReturnValue(false); // Would normally filter out all items
				mockOrder.mockImplementation((a: TestItem, b: TestItem) => b.value - a.value); // Would reverse order

				const query = new ChimeraCollectionQuery(config, mockParams, some(serverItems), mockOrder, mockFilter, true);

				// In trust mode, should keep server data as-is
				expect(Array.from(query)).toEqual(serverItems);
			});

			it("should warn in dev mode with trust query when validation fails", () => {
				const config = { ...mockConfig, devMode: true, trustQuery: true };
				const serverItems: TestItem[] = [
					{ id: "test-1", name: "Server Item", value: 42 },
					{ id: "test-2", name: "Another Item", value: 100 },
				];

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

				// Set up filter that would normally filter out the first item
				mockFilter.mockImplementation((item: TestItem) => item.value > 50);

				new ChimeraCollectionQuery(config, mockParams, some(serverItems), mockOrder, mockFilter, true);

				expect(consoleSpy).toHaveBeenCalled();
				consoleSpy.mockRestore();
			});

			it("should not warn in dev mode when validation passes", () => {
				const config = { ...mockConfig, devMode: true, trustQuery: true };
				const serverItems: TestItem[] = [{ id: "test-1", name: "Server Item", value: 42 }];

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

				// Filter and order that wouldn't change the data
				mockFilter.mockReturnValue(true);
				mockOrder.mockReturnValue(0);

				new ChimeraCollectionQuery(config, mockParams, some(serverItems), mockOrder, mockFilter, true);

				expect(consoleSpy).not.toHaveBeenCalled();
				consoleSpy.mockRestore();
			});
		});

		describe("Array Method Edge Cases and Potential Bugs", () => {
			it("should handle array methods with custom predicate correctly", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
					{ id: "test-3", name: "Item 3", value: 15 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Test some() method
				expect(query.some((item) => item.value > 15)).toBe(true);
				expect(query.some((item) => item.value > 50)).toBe(false);

				// Test every() method
				expect(query.every((item) => item.value > 0)).toBe(true);
				expect(query.every((item) => item.value > 15)).toBe(false);

				// Test filter method
				const filtered = query.filter((item) => item.value > 12);
				expect(filtered).toHaveLength(2);

				// Test find methods
				expect(query.find((item) => item.value === 15)?.id).toBe("test-3");
				expect(query.findIndex((item) => item.value === 15)).toBe(2);
				expect(query.findLast((item) => item.value > 10)?.id).toBe("test-3");
				expect(query.findLastIndex((item) => item.value > 10)).toBe(2);
			});

			it("should handle reduce methods correctly", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
					{ id: "test-3", name: "Item 3", value: 15 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Test reduce
				const sum = query.reduce((acc, item) => acc + item.value, 0);
				expect(sum).toBe(45);

				// Test reduceRight
				const names = query.reduceRight((acc, item) => acc + item.name, "");
				expect(names).toBe("Item 3Item 2Item 1");
			});

			it("should handle slice and toSpliced correctly", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
					{ id: "test-3", name: "Item 3", value: 15 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Test slice
				const sliced = query.slice(1, 3);
				expect(sliced).toHaveLength(2);
				sliced[0] && expect(sliced[0].id).toBe("test-2");

				// Test toSpliced
				const newItem: TestItem = { id: "test-4", name: "Item 4", value: 25 };
				const spliced = query.toSpliced(1, 1, newItem);
				expect(spliced).toHaveLength(3);
				expect(spliced[1]).toBe(newItem);
			});

			it("should handle iteration protocols correctly", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Test Symbol.iterator
				const iteratedItems: TestItem[] = [];
				for (const item of query) {
					iteratedItems.push(item);
				}
				expect(iteratedItems).toEqual(items);

				// Test entries
				const entries = Array.from(query.entries());
				expect(entries).toEqual([
					[0, items[0]],
					[1, items[1]],
				]);

				// Test values
				const values = Array.from(query.values());
				expect(values).toEqual(items);

				// Test keys
				const keys = Array.from(query.keys());
				expect(keys).toEqual([0, 1]);
			});
		});

		describe("Error Handling and Edge Cases", () => {
			it("should handle fetch errors", async () => {
				mockCollectionFetcher.mockRejectedValue(new Error("Network error"));
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				await query.progress;

				expect(query.state).toBe(ChimeraQueryFetchingState.Errored);
				expect(query.lastError).toBeInstanceOf(Error);
			});

			it("should handle create errors correctly", async () => {
				const items: TestItem[] = [];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				mockItemCreator.mockRejectedValue(new Error("Create failed"));

				await expect(query.create({ name: "Test", value: 42 })).rejects.toThrow("Create failed");
			});

			it("should handle promise progress when no promise is active", async () => {
				const items: TestItem[] = [{ id: "test-1", name: "Item", value: 42 }];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Should resolve immediately when no promise is active
				await expect(query.progress).resolves.toBeUndefined();
			});

			it("should handle destructuring assignment from splice correctly", () => {
				const items: TestItem[] = [
					{ id: "test-1", name: "Item 1", value: 10 },
					{ id: "test-2", name: "Item 2", value: 20 },
				];
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				// Test the specific destructuring pattern used in #deleteAtIndex
				// const { 0: old } = items.splice(0, 1);
				query[ChimeraDeleteOneSym]("test-1");

				expect(query.length).toBe(1);
				expect(query.at(0)?.id).toBe("test-2");
			});

			it("should handle accessing data properties when not ready", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				// All these should throw ChimeraQueryNotReadyError
				expect(() => query.length).toThrow(ChimeraQueryNotReadyError);
				expect(() => query.at(0)).toThrow(ChimeraQueryNotReadyError);
				expect(() => Array.from(query)).toThrow(ChimeraQueryNotReadyError);
				expect(() => query.toJSON()).toThrow(ChimeraQueryNotReadyError);
				expect(() => query.toString()).toThrow(ChimeraQueryNotReadyError);
			});

			it("should handle accessing mutable methods when not ready", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				expect(() => query.mutableAt(0)).toThrow(ChimeraQueryNotReadyError);
				expect(() => query.mutableGetById("test-1")).toThrow(ChimeraQueryNotReadyError);
			});
		});

		describe("Potential Implementation Bugs", () => {
			it("should handle edge case in #addItem when foundIndex is exactly 0", () => {
				const items: TestItem[] = [{ id: "test-2", name: "Item 2", value: 20 }];

				// Order function that would place a new item at index 0
				mockOrder.mockImplementation((existing: TestItem, newItem: TestItem) => {
					if (newItem.id === "test-1") return 1; // existing > new, so new goes first
					return 0;
				});

				const query = new ChimeraCollectionQuery(mockConfig, mockParams, some(items), mockOrder, mockFilter, false);

				const newItem: TestItem = { id: "test-1", name: "Item 1", value: 10 };
				query[ChimeraSetOneSym](newItem);

				expect(query.at(0)?.id).toBe("test-1");
				expect(query.at(1)?.id).toBe("test-2");
			});

			it("should handle the case where #getById is called with collection not ready in internal methods", () => {
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				// This should throw ChimeraInternalError since it's called internally
				expect(() => query[ChimeraSetOneSym]({ id: "test-1", name: "Test", value: 42 })).toThrow();
			});

			it("should handle id mismatch scenarios correctly in delete operations", async () => {
				const config = { ...mockConfig, trustQuery: false };
				const items: TestItem[] = [{ id: "test-1", name: "Test", value: 42 }];
				const query = new ChimeraCollectionQuery(config, mockParams, some(items), mockOrder, mockFilter, false);

				// Server returns different id than requested
				mockItemDeleter.mockResolvedValue({ result: { id: "different-id", success: true } });

				await expect(query.delete("test-1")).rejects.toThrow();
			});

			it("should properly handle progress promise cancellation edge case", async () => {
				mockCollectionFetcher.mockImplementation(() => new Promise(() => {})); // Never resolves
				const query = new ChimeraCollectionQuery(mockConfig, mockParams, none(), mockOrder, mockFilter, false);

				// Force a new operation that should cancel the previous promise
				mockCollectionFetcher.mockResolvedValue({ data: [] });
				query.refetch(true);

				// The progress promise should still resolve
				await expect(query.progress).resolves.toBeUndefined();
			});
		});
	});
});
