import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import type { ChimeraDebugConfig } from "../debug/types.ts";
import { chimeraDefaultFilterConfig, type chimeraDefaultFilterOperators } from "../filter/defaults.ts";
import type { ChimeraFilterConfig, ChimeraOperatorMap } from "../filter/types.ts";
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
import { deepObjectAssign, deepObjectClone, deepObjectFreeze } from "../shared/shared.ts";
import type { ChimeraEntityId, ChimeraEntityMap, ChimeraIdGetterFunc, StrKeys } from "../shared/types.ts";
import { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";
import type { ChimeraStoreConfig, RepositoryConfigMap, RepositoryMap } from "./types.ts";

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

type RepositoryEvent<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	[K in StrKeys<EntityMap>]: {
		entityName: K;
		repository: ChimeraEntityRepository<EntityMap[K], OperatorsMap>;
	};
}[StrKeys<EntityMap>];

type ChimeraStoreEventMap<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	/** Once the store is initialized */
	initialized: [{ instance: ChimeraStore<EntityMap, OperatorsMap> }];

	repositoryInitialized: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap>,
	];

	/** Each time item added */
	itemAdded: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap> &
			ItemEvent<EntityMap>,
	];

	/** Each time many items updated */
	updated: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap> &
			ManyItemEvent<EntityMap>,
	];
	/** Each time item updated */
	itemUpdated: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap> &
			ItemEvent<EntityMap>,
	];

	/** Each time many items deleted */
	deleted: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap> &
			ManyDeleteEvent<EntityMap>,
	];
	/** Each time item deleted */
	itemDeleted: [
		{ instance: ChimeraStore<EntityMap, OperatorsMap> } & RepositoryEvent<EntityMap, OperatorsMap> &
			ItemDeleteEvent<EntityMap>,
	];
};

export class ChimeraStore<
	EntityMap extends ChimeraEntityMap,
	OperatorsMap extends ChimeraOperatorMap = typeof chimeraDefaultFilterOperators,
	Config extends ChimeraStoreConfig<EntityMap, OperatorsMap> = ChimeraStoreConfig<EntityMap, OperatorsMap>,
> extends ChimeraEventEmitter<ChimeraStoreEventMap<EntityMap, OperatorsMap>> {
	readonly #reposMap: RepositoryMap<EntityMap, OperatorsMap>;
	readonly #queryConfig: RepositoryConfigMap<EntityMap, OperatorsMap>;
	readonly #filterConfig: Required<ChimeraFilterConfig<OperatorsMap>>;
	readonly #orderConfig: Required<ChimeraOrderConfig>;
	readonly #debugConfig: Required<ChimeraDebugConfig>;
	readonly #initialConfig: Config;

	#emit<T extends EventNames<ChimeraStoreEventMap<EntityMap, OperatorsMap>>>(
		event: T,
		arg: EventArgs<ChimeraStoreEventMap<EntityMap, OperatorsMap>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#addRepository<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
	): ChimeraEntityRepository<EntityMap[EntityName], OperatorsMap> {
		const repo = (this.#reposMap[entityName] = new ChimeraEntityRepository(
			this.#queryConfig[entityName],
			this.#filterConfig,
			this.#orderConfig,
		));

		repo.once("initialized", (e) =>
			this.#emit("repositoryInitialized", {
				entityName: entityName,
				instance: this,
				repository: e.instance as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
			}),
		);

		return repo;
	}

	constructor(config: Config) {
		super();

		this.#initialConfig = deepObjectFreeze(deepObjectClone(config));
		const { query: queryConfig, order: orderConfig, filter: filterConfig, debug: debugConfig } = config;

		this.#filterConfig = deepObjectAssign<Required<ChimeraFilterConfig<OperatorsMap>>>(
			deepObjectClone(chimeraDefaultFilterConfig),
			filterConfig ?? {},
		);
		this.#orderConfig = deepObjectAssign<Required<ChimeraOrderConfig>>(
			deepObjectClone(chimeraDefaultOrderConfig),
			orderConfig ?? {},
		);
		this.#debugConfig = deepObjectAssign<Required<ChimeraDebugConfig>>(
			deepObjectClone(chimeraDefaultDebugConfig),
			debugConfig ?? {},
		);

		const query = deepObjectAssign<Required<ChimeraQueryDefaultsConfig<Record<string, object>, ChimeraOperatorMap>>>(
			deepObjectClone(chimeraDefaultQueryConfig),
			queryConfig?.defaults ?? {},
		);
		this.#queryConfig = Object.fromEntries(
			(
				Object.entries(queryConfig?.entities ?? chimeraDefaultQueryConfig.entities) as [
					string,
					ChimeraQueryEntityConfig<object, OperatorsMap>,
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
				} satisfies QueryEntityConfig<any, any>,
			]),
		) as unknown as RepositoryConfigMap<EntityMap, OperatorsMap>;

		this.#reposMap = {};

		this.#emit("initialized", { instance: this });
	}

	get config(): Config {
		return this.#initialConfig;
	}

	from<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
	): ChimeraEntityRepository<EntityMap[EntityName], OperatorsMap> {
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
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
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
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
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
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
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
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
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
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
			});
			this.#emit("updated", {
				entityName,
				instance: this,
				items: toAdd,
				repository: repo as unknown as ChimeraEntityRepository<EntityMap[StrKeys<EntityMap>], OperatorsMap>,
			});
		}
	}
}

// Utility types
export type AnyChimeraStore = ChimeraStore<any, any>;
type ExtractsStoreGenerics<T extends AnyChimeraStore> = T extends ChimeraStore<infer E, infer O>
	? { entityMap: E; operatorMap: O }
	: never;
export type ChimeraStoreEntityMap<T extends AnyChimeraStore> = ExtractsStoreGenerics<T>["entityMap"];
export type ChimeraStoreOperatorMap<T extends AnyChimeraStore> = ExtractsStoreGenerics<T>["operatorMap"];
export type ChimeraStoreEntities<T extends AnyChimeraStore> = keyof ChimeraStoreEntityMap<T> & string;
export type ChimeraStoreOperator<T extends AnyChimeraStore> = keyof ChimeraStoreOperatorMap<T> & string;
export type ChimeraStoreEntityType<
	T extends AnyChimeraStore,
	K extends ChimeraStoreEntities<T>,
> = ChimeraStoreEntityMap<T>[K];
