import type {
	AnyChimeraEntityStore,
	ChimeraCollectionParams,
	ChimeraEntityStoreEntity,
	ChimeraEntityStoreOperatorsMap,
} from "@hf-chimera/store";

// Minimal query builder interface that adapters expect
// This allows using any query builder implementation (including custom ones)
// The official implementation is available in @hf-chimera/query-builder
export interface ChimeraQueryBuilder<TStore extends AnyChimeraEntityStore> {
	isChimeraQueryBuilder: true;
	build(): ChimeraCollectionParams<ChimeraEntityStoreOperatorsMap<TStore>, ChimeraEntityStoreEntity<TStore>, any>;
}

export type QueryBuilderCreator<TStore extends AnyChimeraEntityStore> = (
	qb: ChimeraQueryBuilder<TStore>,
) => ChimeraQueryBuilder<TStore> | undefined;

export type AnyChimeraParams<
	TStore extends AnyChimeraEntityStore,
	TMeta = any,
	QueryBuilder extends ChimeraQueryBuilder<TStore> = ChimeraQueryBuilder<TStore>,
> =
	| ChimeraCollectionParams<ChimeraEntityStoreOperatorsMap<TStore>, ChimeraEntityStoreEntity<TStore>, TMeta>
	| QueryBuilderCreator<TStore>
	| QueryBuilder;

const isQueryBuilder = <TStore extends AnyChimeraEntityStore, Meta = any>(
	params: AnyChimeraParams<TStore, Meta>,
): params is ChimeraQueryBuilder<TStore> => "isChimeraQueryBuilder" in params && params.isChimeraQueryBuilder;

export const normalizeParams = <TStore extends AnyChimeraEntityStore, TMeta = any>(
	createQueryBuilder: (() => ChimeraQueryBuilder<TStore>) | undefined,
	params: AnyChimeraParams<TStore, TMeta>,
): ChimeraCollectionParams<ChimeraEntityStoreOperatorsMap<TStore>, ChimeraEntityStoreEntity<TStore>, TMeta> => {
	if (isQueryBuilder(params)) return params.build();
	if (typeof params === "function") {
		if (!createQueryBuilder) {
			throw new Error(
				"Query builder creator function provided but no query builder factory was supplied. " +
					"Either pass a query builder factory as the second argument to createChimeraStoreHooks/createChimeraStoreComposables, " +
					"or install the official @hf-chimera/query-builder package and use 'createDefaultQueryBuilder'. " +
					"Alternatively, use plain ChimeraCollectionParams instead of a creator function.",
			);
		}
		const q = createQueryBuilder();
		return (params(q) ?? q).build();
	}
	return params;
};
