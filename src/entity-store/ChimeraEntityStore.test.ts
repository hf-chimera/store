import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import { ChimeraOrderNulls } from "../order/types.ts";
import type { ChimeraQueryEntityConfig } from "../query/types.ts";
import { ChimeraEntityStore, createChimeraEntityStore } from "./ChimeraEntityStore.ts";

interface Item {
	id: string;
	name: string;
	value: number;
}

const operators = {
	eq: (a: unknown, b: unknown) => a === b,
	gt: (a: number | Date | string | bigint, b: number | Date | string | bigint) => (a as number) > (b as number),
};
type OperatorMap = typeof operators;

const makeFilterConfig = (): Required<ChimeraFilterConfig<OperatorMap>> => ({
	getFilterKey: (f) => JSON.stringify(f ?? null),
	getOperatorKey: (op) => (op ? `${op.op}:${op.key}:${String(op.test)}` : ""),
	operators,
});

const makeOrderConfig = (): Required<ChimeraOrderConfig> => ({
	getKey: (o) => JSON.stringify(o ?? []),
	primitiveComparator: (a: any, b: any) => (a === b ? 0 : a > b ? 1 : -1),
});

const makeEntityConfig = () => {
	const collectionFetcher = vi.fn();
	const itemFetcher = vi.fn();
	const itemUpdater = vi.fn();
	const batchedUpdater = vi.fn();
	const itemDeleter = vi.fn();
	const batchedDeleter = vi.fn();
	const itemCreator = vi.fn();
	const batchedCreator = vi.fn();
	return {
		name: "t-items" as const,
		devMode: true,
		trustQuery: false,
		updateDebounceTimeout: 0,
		idGetter: vi.fn((i: Item) => i.id),
		collectionFetcher,
		itemFetcher,
		itemUpdater,
		batchedUpdater,
		itemDeleter,
		batchedDeleter,
		itemCreator,
		batchedCreator,
	};
};

describe("ChimeraEntityStore", () => {
	let cfg: ReturnType<typeof makeEntityConfig>;
	let filterCfg: Required<ChimeraFilterConfig<OperatorMap>>;
	let orderCfg: Required<ChimeraOrderConfig>;

	beforeEach(() => {
		cfg = makeEntityConfig();
		filterCfg = makeFilterConfig();
		orderCfg = makeOrderConfig();
	});
	afterEach(() => vi.clearAllMocks());

	it("emits initialized event on construction", () => {
		const events: any[] = [];
		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
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
		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		expect(repo.getCollection({})).toBe(repo.getCollection({}));
		// @ts-expect-error
		expect(() => repo.emit("initialized", { instance: repo })).toThrowError;
	});

	it("propagates item updates from item query to collection and emits events", async () => {
		const items: Item[] = [
			{ id: "1", name: "A", value: 1 },
			{ id: "2", name: "B", value: 2 },
		];
		const upd: Item = { id: "2", name: "B*", value: 20 };
		cfg.collectionFetcher.mockResolvedValue({ data: items });
		cfg.itemUpdater.mockResolvedValue({ data: upd });

		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		const col = repo.getCollection({ order: [] });
		await col.progress;

		const events: any[] = [];
		repo.on("itemUpdated", (e) => events.push(e));

		const itemQ = repo.getItem("2");
		await itemQ.update(upd);
		await new Promise<void>((r) => queueMicrotask(r));

		expect(col.getById("2")).toEqual(upd);
		expect(events).toHaveLength(1);
	});

	it("propagates delete from item query to collection and emits", async () => {
		const items: Item[] = [
			{ id: "1", name: "A", value: 1 },
			{ id: "2", name: "B", value: 2 },
		];
		cfg.collectionFetcher.mockResolvedValue({ data: items });
		cfg.itemDeleter.mockResolvedValue({ result: { id: "1", success: true } });

		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		const col = repo.getCollection({ order: [] });
		await col.progress;

		const events: any[] = [];
		repo.on("itemDeleted", (e) => events.push(e));

		const itemQ = repo.getItem("1");
		await itemQ.delete();
		await new Promise<void>((r) => queueMicrotask(r));

		expect(col.getById("1")).toBeUndefined();
		expect(events).toHaveLength(1);
	});

	it("reacts to collection self events: update/create/delete flow", async () => {
		cfg.collectionFetcher.mockResolvedValue({ data: [{ id: "1", name: "A", value: 1 }] });
		const upd: Item = { id: "1", name: "A+", value: 10 };
		cfg.itemUpdater.mockResolvedValue({ data: upd });
		const created: Item = { id: "2", name: "B", value: 2 };
		cfg.itemCreator.mockResolvedValue({ data: created });
		cfg.itemDeleter.mockResolvedValue({ result: { id: "1", success: true } });

		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		const col = repo.getCollection({ order: [] });
		await col.progress;

		// update existing via collection.update
		const itemQ = repo.getItem("1");
		repo.on("itemUpdated", vi.fn());
		await col.update(upd);
		await new Promise<void>((r) => queueMicrotask(r));
		expect(itemQ.data).toEqual(upd);

		// create new via collection.create
		await col.create({ name: "B", value: 2 });
		await new Promise<void>((r) => queueMicrotask(r));
		expect(col.getById("2")).toEqual(created);

		// delete via collection.delete
		await col.delete("1");
		await new Promise<void>((r) => queueMicrotask(r));
		expect(col.getById("1")).toBeUndefined();
	});

	test.each<[label: string, op: (r: any, col: any) => void, expectIds: string[]]>([
		["set one", (r) => r.updateOne({ id: "3", name: "C", value: 3 }), ["1", "2", "3"]],
		["delete one", (r) => r.deleteOne("2"), ["1"]],
		[
			"set many",
			(r) =>
				r.updateMany([
					{ id: "3", name: "C", value: 3 },
					{ id: "4", name: "D", value: 4 },
				]),
			["1", "2", "3", "4"],
		],
		["delete many", (r) => r.deleteMany(["1", "2"]), []],
		["update mixed", (r) => r.updateMixed([{ id: "3", name: "C", value: 3 }], ["1"]), ["2", "3"]],
	])("repository symbols propagate to collections: %s", async (_label, op, expectedIds) => {
		cfg.collectionFetcher.mockResolvedValue({
			data: [
				{ id: "1", name: "A", value: 1 },
				{ id: "2", name: "B", value: 2 },
			],
		});
		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
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
		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		const a = repo.getCollection({ order: [] });
		const b = repo.getCollection({
			order: [{ desc: true, key: { get: "value", key: "value" }, nulls: ChimeraOrderNulls.Last }],
		});
		expect(a).not.eq(b);
	});

	it("exposes entity name via getter", () => {
		const repo = new ChimeraEntityStore<"t-items", Item, OperatorMap>(
			cfg,
			filterCfg,
			orderCfg,
			chimeraDefaultDebugConfig,
		);
		expect(repo.name).toBe("t-items");
	});

	it("createChimeraEntityStore creates instance with same behavior", async () => {
		cfg.collectionFetcher.mockResolvedValue({ data: [] });
		const repo = createChimeraEntityStore(cfg, filterCfg, orderCfg);
		expect(repo.name).toBe("t-items");

		const col = repo.getCollection({ order: [] });
		await col.progress;
		expect(col.ready).toBe(true);
	});

	it("populates default values when config fields are missing", () => {
		const minimalConfig: ChimeraQueryEntityConfig<"minimal", Item, OperatorMap> = {
			name: "minimal",
			idGetter: (i: Item) => i.id,
		};
		const repo = createChimeraEntityStore(minimalConfig, filterCfg, orderCfg, chimeraDefaultDebugConfig);
		expect(repo.name).toBe("minimal");
		// Should not throw when accessing default idGetter
		const item: Item = { id: "1", name: "Test", value: 1 };
		expect(() => repo.updateOne(item)).not.toThrow();
	});
});
