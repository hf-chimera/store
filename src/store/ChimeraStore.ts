import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import type { ChimeraDebugConfig } from "../debug/types.ts";
import { chimeraDefaultFilterConfig } from "../filter/defaults.ts";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import { chimeraDefaultOrderConfig } from "../order/defaults.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import { ChimeraDeleteManySym, ChimeraDeleteOneSym, ChimeraSetManySym, ChimeraSetOneSym } from "../query/constants.ts";
import { chimeraDefaultQueryConfig } from "../query/defaults.ts";
import type {
	ChimeraQueryDefaultEntityIdGetter,
	ChimeraQueryDefaultsConfig,
	ChimeraQueryEntityConfig,
	ChimeraQueryEntityIdGetter,
} from "../query/types.ts";
import { ChimeraInternalError } from "../shared";
import { ChimeraEventEmitter } from "../shared/ChimeraEventEmitter";
import { deepObjectAssign } from "../shared/shared.ts";
import type { ChimeraEntityId, ChimeraEntityMap, ChimeraIdGetterFunc, StrKeys } from "../shared/types.ts";
import { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";
import type { ChimeraRepositoryMap, ChimeraStoreConfig } from "./types.ts";

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

type ChimeraStoreEventMap = {
	"": []; // TODO: add events
};

export class ChimeraStore<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
	Config extends ChimeraStoreConfig<EntityMap, FilterConfig> = ChimeraStoreConfig<EntityMap, FilterConfig>,
> extends ChimeraEventEmitter<ChimeraStoreEventMap> {
	readonly #reposMap: ChimeraRepositoryMap<EntityMap, FilterConfig>;

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	constructor({ query: queryConfig, order: orderConfig, filter: filterConfig, debug: debugConfig }: Config) {
		super();

		const query = deepObjectAssign<Required<ChimeraQueryDefaultsConfig<Record<string, object>>>>(
			structuredClone(chimeraDefaultQueryConfig),
			queryConfig ?? {},
		);
		const filter = deepObjectAssign<ChimeraFilterConfig>(
			structuredClone(chimeraDefaultFilterConfig),
			filterConfig ?? {},
		);
		const order = deepObjectAssign<ChimeraOrderConfig>(structuredClone(chimeraDefaultOrderConfig), orderConfig ?? {});
		const debug = deepObjectAssign<Required<ChimeraDebugConfig>>(
			structuredClone(chimeraDefaultDebugConfig),
			debugConfig ?? {},
		);

		this.#reposMap = Object.fromEntries(
			(
				Object.entries(queryConfig?.entities ?? chimeraDefaultQueryConfig.entities) as [
					string,
					ChimeraQueryEntityConfig<object, FilterConfig>,
				][]
			).map(([key, value]) => [
				key,
				new ChimeraEntityRepository<object, ChimeraFilterConfig>(
					{
						batchedCreator: value.batchedCreator
							? value.batchedCreator
							: (...args) => query.batchedCreator(key, ...args),
						batchedDeleter: value.batchedDeleter
							? value.batchedDeleter
							: (...args) => query.batchedDeleter(key, ...args),
						batchedUpdater: value.batchedUpdater
							? value.batchedUpdater
							: (...args) => query.batchedUpdater(key, ...args),

						collectionFetcher: value.collectionFetcher
							? value.collectionFetcher
							: (...args) => query.collectionFetcher(key, ...args),

						devMode: debug.devMode,

						idGetter: resolveIdGetter(key, query.idGetter, value.idGetter),

						itemCreator: value.itemCreator ? value.itemCreator : (...args) => query.itemCreator(key, ...args),
						itemDeleter: value.itemDeleter ? value.itemDeleter : (...args) => query.itemDeleter(key, ...args),
						itemFetcher: value.itemFetcher ? value.itemFetcher : (...args) => query.itemFetcher(key, ...args),
						itemUpdater: value.itemUpdater ? value.itemUpdater : (...args) => query.itemUpdater(key, ...args),
						name: key,
						trustQuery: value.trustQuery ?? query.trustQuery,
						updateDebounceTimeout: value.updateDebounceTimeout ?? query.updateDebounceTimeout,
					},
					filter,
					order,
				),
			]),
		) as unknown as ChimeraRepositoryMap<EntityMap, FilterConfig>;
	}

	from<EntityName extends StrKeys<EntityMap>>(
		entityName: EntityName,
	): ChimeraEntityRepository<EntityMap[EntityName], FilterConfig> {
		return this.#reposMap[entityName];
	}

	updateOne<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, updater: EntityMap[EntityName]) {
		this.#reposMap[entityName][ChimeraSetOneSym](updater);
	}
	updateMany<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, updaters: Iterable<EntityMap[EntityName]>) {
		this.#reposMap[entityName][ChimeraSetManySym](updaters);
	}
	deleteOne<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, id: ChimeraEntityId) {
		this.#reposMap[entityName][ChimeraDeleteOneSym](id);
	}
	deleteMany<EntityName extends StrKeys<EntityMap>>(entityName: EntityName, ids: Iterable<ChimeraEntityId>) {
		this.#reposMap[entityName][ChimeraDeleteManySym](ids);
	}
}
