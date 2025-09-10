import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import type { ChimeraDebugConfig } from "../debug/types.ts";
import { chimeraDefaultFilterConfig } from "../filter/defaults.ts";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import { chimeraDefaultOrderConfig } from "../order/defaults.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
} from "../query/constants.ts";
import { chimeraDefaultQueryConfig } from "../query/defaults.ts";
import type {
	ChimeraQueryDefaultEntityIdGetter,
	ChimeraQueryDefaultsConfig,
	ChimeraQueryEntityConfig,
	ChimeraQueryEntityIdGetter,
	QueryEntityConfig,
} from "../query/types.ts";
import { ChimeraInternalError } from "../shared";
import { ChimeraEventEmitter, type EventArgs, type EventNames } from "../shared/ChimeraEventEmitter";
import { deepObjectAssign, deepObjectClone } from "../shared/shared.ts";
import type { ChimeraEntityId, ChimeraEntityMap, ChimeraIdGetterFunc, StrKeys } from "../shared/types.ts";
import { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";
import type { ChimeraRepositoryConfigMap, ChimeraRepositoryMap, ChimeraStoreConfig } from "./types.ts";

const resolveIdGetter = <EntityMap extends ChimeraEntityMap>(
	key: string,
	def: ChimeraQueryDefaultEntityIdGetter<EntityMap>,
	val?: ChimeraQueryEntityIdGetter<object>,
): ChimeraIdGetterFunc<object> => {
	if (val) return typeof val === "function" ? val : (v) => v[val as keyof typeof v] as unknown as ChimeraEntityId;
	return typeof def === "function"
		? (v) => def(key, v as keyof typeof def)
		: (v) => v[def as keyof typeof v] as unknown as ChimeraEntityId;
};

type ItemEvent<EntityMap extends ChimeraEntityMap> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		item: EntityMap[K];
	};
}[StrKeys<EntityMap>];

type ManyItemEvent<EntityMap extends ChimeraEntityMap> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		items: EntityMap[K][];
	};
}[StrKeys<EntityMap>];

type ItemDeleteEvent<EntityMap extends ChimeraEntityMap> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		id: ChimeraEntityId;
	};
}[StrKeys<EntityMap>];

type ManyDeleteEvent<EntityMap extends ChimeraEntityMap> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		ids: ChimeraEntityId[];
	};
}[StrKeys<EntityMap>];

type RepositoryEvent<EntityMap extends ChimeraEntityMap, FilterConfig extends ChimeraFilterConfig> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		repository: ChimeraEntityRepository<EntityMap[K], FilterConfig>;
	};
}[StrKeys<EntityMap>];

type ChimeraStoreEventMap<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
> = {
	/** Once the store is initialized */
	initialized: [{ instance: ChimeraStore<EntityMap, FilterConfig> }];

	repositoryInitialized: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig>,
	];

	/** Each time item added */
	itemAdded: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig> &
			ItemEvent<EntityMap>,
	];

	/** Each time many items updated */
	updated: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig> &
			ManyItemEvent<EntityMap>,
	];
	/** Each time item updated */
	itemUpdated: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig> &
			ItemEvent<EntityMap>,
	];

	/** Each time many items deleted */
	deleted: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig> &
			ManyDeleteEvent<EntityMap>,
	];
	/** Each time item deleted */
	itemDeleted: [
		{ instance: ChimeraStore<EntityMap, FilterConfig> } & RepositoryEvent<EntityMap, FilterConfig> &
			ItemDeleteEvent<EntityMap>,
	];
};

export class ChimeraStore<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
	Config extends ChimeraStoreConfig<EntityMap, FilterConfig> = ChimeraStoreConfig<EntityMap, FilterConfig>,
> extends ChimeraEventEmitter<ChimeraStoreEventMap<EntityMap, FilterConfig>> {
	readonly #reposMap: ChimeraRepositoryMap<EntityMap, FilterConfig>;
	readonly #queryConfig: ChimeraRepositoryConfigMap<EntityMap>;
	readonly #filterConfig: FilterConfig;
	readonly #orderConfig: ChimeraOrderConfig;
	readonly #debugConfig: Required<ChimeraDebugConfig>;

	#emit<T extends EventNames<ChimeraStoreEventMap<EntityMap, FilterConfig>>>(
		event: T,
		arg: EventArgs<ChimeraStoreEventMap<EntityMap, FilterConfig>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#addRepository<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
	): ChimeraEntityRepository<EntityMap[EntityName], FilterConfig> {
		const repo = (this.#reposMap[entityName] = new ChimeraEntityRepository(
			this.#queryConfig[entityName],
			this.#filterConfig,
			this.#orderConfig,
		));

		repo.once("initialized", (e) =>
			this.#emit("repositoryInitialized", {
				entityName: entityName,
				instance: this,
				repository: e.instance as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			}),
		);

		return repo;
	}

	constructor({ query: queryConfig, order: orderConfig, filter: filterConfig, debug: debugConfig }: Config) {
		super();

		this.#filterConfig = deepObjectAssign<FilterConfig>(
			deepObjectClone(chimeraDefaultFilterConfig),
			filterConfig ?? {},
		);
		this.#orderConfig = deepObjectAssign<ChimeraOrderConfig>(
			deepObjectClone(chimeraDefaultOrderConfig),
			orderConfig ?? {},
		);
		this.#debugConfig = deepObjectAssign<Required<ChimeraDebugConfig>>(
			deepObjectClone(chimeraDefaultDebugConfig),
			debugConfig ?? {},
		);

		const query = deepObjectAssign<Required<ChimeraQueryDefaultsConfig<Record<string, object>>>>(
			deepObjectClone(chimeraDefaultQueryConfig),
			queryConfig?.defaults ?? {},
		);
		this.#queryConfig = Object.fromEntries(
			(
				Object.entries(queryConfig?.entities ?? chimeraDefaultQueryConfig.entities) as [
					string,
					ChimeraQueryEntityConfig<object, FilterConfig>,
				][]
			).map(([key, value]) => [
				key,
				{
					batchedCreator: value.batchedCreator ? value.batchedCreator : (...args) => query.batchedCreator(key, ...args),
					batchedDeleter: value.batchedDeleter ? value.batchedDeleter : (...args) => query.batchedDeleter(key, ...args),
					batchedUpdater: value.batchedUpdater ? value.batchedUpdater : (...args) => query.batchedUpdater(key, ...args),

					collectionFetcher: value.collectionFetcher
						? value.collectionFetcher
						: (...args) => query.collectionFetcher(key, ...args),

					devMode: this.#debugConfig.devMode,

					idGetter: resolveIdGetter(key, query.idGetter, value.idGetter),

					itemCreator: value.itemCreator ? value.itemCreator : (...args) => query.itemCreator(key, ...args),
					itemDeleter: value.itemDeleter ? value.itemDeleter : (...args) => query.itemDeleter(key, ...args),
					itemFetcher: value.itemFetcher ? value.itemFetcher : (...args) => query.itemFetcher(key, ...args),
					itemUpdater: value.itemUpdater ? value.itemUpdater : (...args) => query.itemUpdater(key, ...args),
					name: key,
					trustQuery: value.trustQuery ?? query.trustQuery,
					updateDebounceTimeout: value.updateDebounceTimeout ?? query.updateDebounceTimeout,
				} satisfies QueryEntityConfig<object>,
			]),
		) as unknown as ChimeraRepositoryConfigMap<EntityMap>;

		this.#reposMap = {};

		this.#emit("initialized", { instance: this });
	}

	from<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
	): ChimeraEntityRepository<EntityMap[EntityName], FilterConfig> {
		return this.#reposMap[entityName] ?? this.#addRepository(entityName);
	}

	updateOne<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, item: EntityMap[EntityName]) {
		const repo = this.#reposMap[entityName];
		if (repo) {
			repo[ChimeraSetOneSym](item);
			this.#emit("itemUpdated", {
				entityName,
				instance: this,
				item,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
		}
	}

	updateMany<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, items: EntityMap[EntityName][]) {
		const repo = this.#reposMap[entityName];
		if (repo) {
			repo[ChimeraSetManySym](items);
			this.#emit("updated", {
				entityName,
				instance: this,
				items,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
		}
	}

	deleteOne<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, id: ChimeraEntityId) {
		const repo = this.#reposMap[entityName];
		if (repo) {
			repo[ChimeraDeleteOneSym](id);
			this.#emit("itemDeleted", {
				entityName,
				id,
				instance: this,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
		}
	}

	deleteMany<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, ids: ChimeraEntityId[]) {
		const repo = this.#reposMap[entityName];
		if (repo) {
			repo[ChimeraDeleteManySym](ids);
			this.#emit("deleted", {
				entityName,
				ids,
				instance: this,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
		}
	}

	updateMixed<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
		toAdd: EntityMap[EntityName][],
		toDelete: ChimeraEntityId[],
	) {
		const repo = this.#reposMap[entityName];
		if (repo) {
			repo[ChimeraUpdateMixedSym](toAdd, toDelete);
			this.#emit("deleted", {
				entityName,
				ids: toDelete,
				instance: this,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
			this.#emit("updated", {
				entityName,
				instance: this,
				items: toAdd,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], FilterConfig>,
			});
		}
	}
}
