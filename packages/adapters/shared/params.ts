import type { ChimeraQueryBuilder, QueryBuilderCreator } from "@hf-chimera/query-builder";
import type {
	AnyChimeraEntityStore,
	ChimeraCollectionParams,
	ChimeraEntityStoreEntity,
	ChimeraEntityStoreOperatorsMap,
} from "@hf-chimera/store";

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
	createQueryBuilder: () => ChimeraQueryBuilder<TStore>,
	params: AnyChimeraParams<TStore, TMeta>,
): ChimeraCollectionParams<ChimeraEntityStoreOperatorsMap<TStore>, ChimeraEntityStoreEntity<TStore>, TMeta> => {
	if (isQueryBuilder(params)) return params.build();
	if (typeof params === "function") {
		const q = createQueryBuilder();
		return (params(q) ?? q).build();
	}
	return params;
};
