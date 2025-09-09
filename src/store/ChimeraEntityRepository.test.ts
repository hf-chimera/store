import { afterEach, beforeEach, describe, expect, it, type Mock, test, vi } from "vitest";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import { ChimeraOrderNulls } from "../order/types.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
} from "../query/constants.ts";
import type { QueryEntityConfig } from "../query/types.ts";
import { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";

interface TItem {
	id: string;
	name: string;
	value: number;
}

const makeFilterConfig = (): ChimeraFilterConfig => ({
	getFilterKey: (f) => JSON.stringify(f ?? null),
	getOperatorKey: (op) => (op ? `${op.op}:${op.key}:${String(op.test)}` : ""),
	operators: {
		eq: (a, b) => a === b,
		gt: (a, b) => (a as number) > (b as number),
	},
});

const makeOrderConfig = (): ChimeraOrderConfig => ({
	getKey: (o) => JSON.stringify(o ?? []),
	primitiveComparator: (a: any, b: any) => (a === b ? 0 : a > b ? 1 : -1),
});

type MockedConfig<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? Mock : T[K];
};

const makeEntityConfig = (): MockedConfig<QueryEntityConfig<TItem>> => {
	const collectionFetcher = vi.fn();
	const itemFetcher = vi.fn();
	const itemUpdater = vi.fn();
	const batchedUpdater = vi.fn();
	const itemDeleter = vi.fn();
	const batchedDeleter = vi.fn();
	const itemCreator = vi.fn();
	const batchedCreator = vi.fn();
	return {
		batchedCreator,
		batchedDeleter,
		batchedUpdater,
		collectionFetcher,
		devMode: true,
		idGetter: vi.fn().mockImplementation((i: TItem) => i.id),
		itemCreator,
		itemDeleter,
		itemFetcher,
		itemUpdater,
		name: "t-items",
		trustQuery: false,
		updateDebounceTimeout: 0,
	};
};

describe("ChimeraEntityRepository", () => {
	let cfg: MockedConfig<QueryEntityConfig<TItem>>;
	let filterCfg: ChimeraFilterConfig;
	let orderCfg: ChimeraOrderConfig;

	beforeEach(() => {
		cfg = makeEntityConfig();
		filterCfg = makeFilterConfig();
		orderCfg = makeOrderConfig();
	});
	afterEach(() => vi.clearAllMocks());

	it("emits initialized event on construction", () => {
		const events: any[] = [];
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		repo.on("initialized", (e) => events.push(e));

		// Wait for the event to be emitted (it's queued with queueMicrotask)
		return new Promise<void>((resolve) => {
			queueMicrotask(() => {
				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({ instance: repo });
				resolve();
			});
		});
	});

	it("caches queries and forbids external emit", () => {
		cfg.collectionFetcher.mockResolvedValue({ data: [] });
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		expect(repo.getCollection({})).toBe(repo.getCollection({}));
		// @ts-expect-error
		expect(() => repo.emit("initialized", { instance: repo })).toThrowError;
	});

	it("propagates item updates from item query to collection and emits events", async () => {
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		const items: TItem[] = [
			{ id: "1", name: "A", value: 1 },
			{ id: "2", name: "B", value: 2 },
		];
		cfg.collectionFetcher.mockResolvedValue({ data: items });
		const col = repo.getCollection({ order: [] });
		await col.progress;

		const upd: TItem = { id: "2", name: "B*", value: 20 };
		(cfg.itemUpdater as Mock).mockResolvedValue({ data: upd });

		const events: any[] = [];
		repo.on("itemUpdated", (e) => events.push(e));

		const itemQ = repo.getItem("2");
		await itemQ.update(upd);
		await new Promise<void>((r) => queueMicrotask(r));

		expect(col.getById("2")).toEqual(upd);
		expect(events).toHaveLength(1);
	});

	it("propagates delete from item query to collection and emits", async () => {
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		const items: TItem[] = [
			{ id: "1", name: "A", value: 1 },
			{ id: "2", name: "B", value: 2 },
		];
		cfg.collectionFetcher.mockResolvedValue({ data: items });
		const col = repo.getCollection({ order: [] });
		await col.progress;

		cfg.itemDeleter.mockResolvedValue({ result: { id: "1", success: true } });
		const events: any[] = [];
		repo.on("itemDeleted", (e) => events.push(e));

		const itemQ = repo.getItem("1");
		await itemQ.delete();
		await new Promise<void>((r) => queueMicrotask(r));

		expect(col.getById("1")).toBeUndefined();
		expect(events).toHaveLength(1);
	});

	it("reacts to collection self events: update/create/delete flow", async () => {
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		cfg.collectionFetcher.mockResolvedValue({ data: [{ id: "1", name: "A", value: 1 }] });
		const col = repo.getCollection({ order: [] });
		await col.progress;

		// update existing via collection.update
		const upd: TItem = { id: "1", name: "A+", value: 10 };
		cfg.itemUpdater.mockResolvedValue({ data: upd });
		const itemQ = repo.getItem("1");
		repo.on("itemUpdated", vi.fn());
		await col.update(upd);
		await new Promise<void>((r) => queueMicrotask(r));
		expect(itemQ.data).toEqual(upd);

		// create new via collection.create
		const created: TItem = { id: "2", name: "B", value: 2 };
		cfg.itemCreator.mockResolvedValue({ data: created });
		await col.create({ name: "B", value: 2 });
		await new Promise<void>((r) => queueMicrotask(r));
		expect(col.getById("2")).toEqual(created);

		// delete via collection.delete
		cfg.itemDeleter.mockResolvedValue({ result: { id: "1", success: true } });
		await col.delete("1");
		await new Promise<void>((r) => queueMicrotask(r));
		expect(col.getById("1")).toBeUndefined();
	});

	test.each<[label: string, op: (r: any, col: any) => void, expectIds: string[]]>([
		["set one", (r) => r[ChimeraSetOneSym]({ id: "3", name: "C", value: 3 }), ["1", "2", "3"]],
		["delete one", (r) => r[ChimeraDeleteOneSym]("2"), ["1"]],
		[
			"set many",
			(r) =>
				r[ChimeraSetManySym]([
					{ id: "3", name: "C", value: 3 },
					{ id: "4", name: "D", value: 4 },
				]),
			["1", "2", "3", "4"],
		],
		["delete many", (r) => r[ChimeraDeleteManySym](["1", "2"]), []],
		["update mixed", (r) => r[ChimeraUpdateMixedSym]([{ id: "3", name: "C", value: 3 }], ["1"]), ["2", "3"]],
	])("repository symbols propagate to collections: %s", async (_label, op, expectedIds) => {
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		cfg.collectionFetcher.mockResolvedValue({
			data: [
				{ id: "1", name: "A", value: 1 },
				{ id: "2", name: "B", value: 2 },
			],
		});
		const col = repo.getCollection({ order: [] });
		await col.progress;

		op(repo, col);
		const ids = Array.from(col)
			.map((i) => i.id)
			.sort();
		expect(ids).toEqual(expectedIds.sort());
	});

	it("getCollection returns distinct instances for distinct keys", async () => {
		cfg.collectionFetcher.mockResolvedValue({ data: [] });
		const repo = new ChimeraEntityRepository<TItem, ChimeraFilterConfig>(cfg, filterCfg, orderCfg);
		const a = repo.getCollection({ order: [] });
		const b = repo.getCollection({
			order: [{ desc: true, key: { get: "value", key: "value" }, nulls: ChimeraOrderNulls.Last }],
		});
		expect(a).not.eq(b);
	});
});
