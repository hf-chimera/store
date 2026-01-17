import type {
	AnyChimeraStore,
	ChimeraCollectionParams,
	ChimeraStoreEntities,
	ChimeraStoreEntityType,
	ChimeraStoreOperatorMap,
} from "../../../src";
import type { ChimeraQueryBuilder, QueryBuilderCreator } from "../../qb";

export type AnyChimeraParams<
	TStore extends AnyChimeraStore,
	TEntityName extends ChimeraStoreEntities<TStore>,
	TMeta = any,
	QueryBuilder extends ChimeraQueryBuilder<TStore, TEntityName> = ChimeraQueryBuilder<TStore, TEntityName>,
> =
	| ChimeraCollectionParams<ChimeraStoreOperatorMap<TStore>, ChimeraStoreEntityType<TStore, TEntityName>, TMeta>
	| QueryBuilderCreator<TStore, ChimeraStoreEntityType<TStore, TEntityName>, ChimeraStoreOperatorMap<TStore>>
	| QueryBuilder;

const isQueryBuilder = <TStore extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<TStore>, Meta = any>(
	params: AnyChimeraParams<TStore, EntityName, Meta>,
): params is ChimeraQueryBuilder<TStore, EntityName> =>
	"isChimeraQueryBuilder" in params && params.isChimeraQueryBuilder;

export const normalizeParams = <
	TStore extends AnyChimeraStore,
	TEntityName extends ChimeraStoreEntities<TStore>,
	TMeta = any,
>(
	createQueryBuilder: () => ChimeraQueryBuilder<TStore, TEntityName>,
	params: AnyChimeraParams<TStore, TEntityName, TMeta>,
): ChimeraCollectionParams<ChimeraStoreOperatorMap<TStore>, TEntityName, TMeta> => {
	if (isQueryBuilder(params)) return params.build();
	if (typeof params === "function") {
		const q = createQueryBuilder();
		params(q);
		return q.build();
	}
	return params;
};
