import { afterEach, describe, expect, it, test, vi } from "vitest";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import { ChimeraStore } from "./ChimeraStore.ts";
import type { ChimeraStoreConfig } from "./types.ts";

interface TUser {
	id: string;
	name: string;
	email: string;
}

interface TPost {
	id: string;
	title: string;
	userId: string;
}

type EntityMap = {
	users: TUser;
	posts: TPost;
};

const operators = {
	eq: (a: unknown, b: unknown) => a === b,
	gt: (a: number | Date | string | bigint, b: number | Date | string | bigint) => (a as number) > (b as number),
};

type OperatorsMap = typeof operators;

const makeFilterConfig = (): ChimeraFilterConfig<OperatorsMap> => ({
	getFilterKey: (f) => JSON.stringify(f ?? null),
	getOperatorKey: (op) => (op ? `${op.op}:${op.key}:${String(op.test)}` : ""),
	operators,
});

const makeOrderConfig = (): ChimeraOrderConfig => ({
	getKey: (o) => JSON.stringify(o ?? []),
	primitiveComparator: (a: any, b: any) => (a === b ? 0 : a > b ? 1 : -1),
});

const makeStoreConfig = (): ChimeraStoreConfig<EntityMap, OperatorsMap> => ({
	debug: { devMode: true },
	filter: makeFilterConfig(),
	order: makeOrderConfig(),
	query: {
		defaults: {
			batchedCreator: vi.fn().mockResolvedValue({ data: [] }),
			batchedDeleter: vi.fn().mockResolvedValue({ result: [] }),
			batchedUpdater: vi.fn().mockResolvedValue({ data: [] }),

			collectionFetcher: vi.fn().mockResolvedValue({ data: [] }),
			idGetter: "id",
			itemCreator: vi.fn().mockResolvedValue({ data: {} as any }),
			itemDeleter: vi.fn().mockResolvedValue({ result: { id: "", success: true } }),
			itemFetcher: vi.fn().mockResolvedValue({ data: {} as any }),
			itemUpdater: vi.fn().mockResolvedValue({ data: {} as any }),
			trustQuery: true,
			updateDebounceTimeout: 0,
		},
		entities: {
			posts: {
				collectionFetcher: vi.fn().mockResolvedValue({ data: [] }),
				itemCreator: vi.fn().mockResolvedValue({ data: {} as TPost }),
				itemDeleter: vi.fn().mockResolvedValue({ result: { id: "", success: true } }),
				itemFetcher: vi.fn().mockResolvedValue({ data: {} as TPost }),
				itemUpdater: vi.fn().mockResolvedValue({ data: {} as TPost }),
			},
			users: {
				collectionFetcher: vi.fn().mockResolvedValue({ data: [] }),
				itemCreator: vi.fn().mockResolvedValue({ data: {} as TUser }),
				itemDeleter: vi.fn().mockResolvedValue({ result: { id: "", success: true } }),
				itemFetcher: vi.fn().mockResolvedValue({ data: {} as TUser }),
				itemUpdater: vi.fn().mockResolvedValue({ data: {} as TUser }),
			},
		},
	},
});

describe("ChimeraStore", () => {
	const config = makeStoreConfig();

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("emits initialized event on construction", () => {
		const events: any[] = [];
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		store.on("initialized", (e) => events.push(e));

		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({ instance: store });
				resolve();
			});
		});
	});

	it("forbids external emit", () => {
		// @ts-expect-error
		expect(() => store.emit("initialized", { instance: store })).toThrowError();
	});

	it("creates repository on first access and caches it", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const repo1 = store.from("users");
		const repo2 = store.from("users");
		expect(repo1).toBe(repo2);
	});

	it("creates different repositories for different entities", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const usersRepo = store.from("users");
		const postsRepo = store.from("posts");
		expect(usersRepo).not.toBe(postsRepo);
	});

	it("emits repositoryInitialized event when repository is created", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const events: any[] = [];
		store.on("repositoryInitialized", (e) => events.push(e));

		store.from("users");

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({
					entityName: "users",
					instance: store,
					repository: expect.any(Object),
				});
				resolve();
			});
		});
	});

	test.each<[string, (store: ChimeraStore<EntityMap, OperatorsMap>, entityName: keyof EntityMap) => void, string]>([
		["updateOne", (s, e) => s.updateOne(e, { email: "test@test.com", id: "1", name: "Test" } as any), "itemUpdated"],
		["updateMany", (s, e) => s.updateMany(e, [{ email: "test@test.com", id: "1", name: "Test" }] as any), "updated"],
		["deleteOne", (s, e) => s.deleteOne(e, "1"), "itemDeleted"],
		["deleteMany", (s, e) => s.deleteMany(e, ["1", "2"]), "deleted"],
	])("emits %s event when repository exists", (method, action, eventName) => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const events: any[] = [];
		store.on(eventName as any, (e) => events.push(e));

		// Create a repository first
		store.from("users");

		action(store, "users");

		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({
					entityName: "users",
					instance: store,
					repository: expect.any(Object),
					...(eventName === "itemUpdated" ? { item: expect.any(Object) } : {}),
					...(eventName === "updated" ? { items: expect.any(Array) } : {}),
					...(eventName === "itemDeleted" ? { id: "1" } : {}),
					...(eventName === "deleted" ? { ids: ["1", "2"] } : {}),
				});
				resolve();
			});
		});
	});

	test.each<[string, (store: ChimeraStore<EntityMap, OperatorsMap>, entityName: keyof EntityMap) => void]>([
		["updateOne", (s, e) => s.updateOne(e, { email: "test@test.com", id: "1", name: "Test" } as any)],
		["updateMany", (s, e) => s.updateMany(e, [{ email: "test@test.com", id: "1", name: "Test" }] as any)],
		["deleteOne", (s, e) => s.deleteOne(e, "1")],
		["deleteMany", (s, e) => s.deleteMany(e, ["1", "2"])],
	])("does not emit events when repository does not exist for %s", (method, action) => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const events: any[] = [];
		store.on("itemUpdated", (e) => events.push(e));
		store.on("updated", (e) => events.push(e));
		store.on("itemDeleted", (e) => events.push(e));
		store.on("deleted", (e) => events.push(e));

		action(store, "users");

		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(events).toHaveLength(0);
				resolve();
			});
		});
	});

	it("emits both deleted and updated events for updateMixed", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const deletedEvents: any[] = [];
		const updatedEvents: any[] = [];
		store.on("deleted", (e) => deletedEvents.push(e));
		store.on("updated", (e) => updatedEvents.push(e));

		// Create a repository first
		store.from("users");

		const toAdd = [{ email: "new@test.com", id: "3", name: "New" }] as TUser[];
		const toDelete = ["1", "2"];

		store.updateMixed("users", toAdd, toDelete);

		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(deletedEvents).toHaveLength(1);
				expect(updatedEvents).toHaveLength(1);
				expect(deletedEvents[0]).toEqual({
					entityName: "users",
					ids: toDelete,
					instance: store,
					repository: expect.any(Object),
				});
				expect(updatedEvents[0]).toEqual({
					entityName: "users",
					instance: store,
					items: toAdd,
					repository: expect.any(Object),
				});
				resolve();
			});
		});
	});

	it("does not emit events for updateMixed when repository does not exist", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const deletedEvents: any[] = [];
		const updatedEvents: any[] = [];
		store.on("deleted", (e) => deletedEvents.push(e));
		store.on("updated", (e) => updatedEvents.push(e));

		store.updateMixed("users", [], []);

		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(deletedEvents).toHaveLength(0);
				expect(updatedEvents).toHaveLength(0);
				resolve();
			});
		});
	});

	it("preserves repository instances across multiple from calls", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const repo1 = store.from("users");
		const repo2 = store.from("users");
		const repo3 = store.from("users");

		expect(repo1).toBe(repo2);
		expect(repo2).toBe(repo3);
	});

	it("handles concurrent repository creation", () => {
		const store = new ChimeraStore<EntityMap, OperatorsMap>(config);
		const repo1 = store.from("users");
		const repo2 = store.from("posts");
		const repo3 = store.from("users");

		expect(repo1).toBe(repo3);
		expect(repo2).not.toBe(repo1);
		expect(repo2).not.toBe(repo3);
	});
});
