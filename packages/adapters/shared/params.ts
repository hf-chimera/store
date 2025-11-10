import type {
	AnyChimeraStore,
	ChimeraCollectionParams,
	ChimeraStoreEntities,
	ChimeraStoreEntityType,
	ChimeraStoreOperatorMap,
} from "../../../src";
import { ChimeraQueryBuilder, type QueryBuilderCreator } from "../../qb";

export type AnyChimeraParams<T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>, Meta = any> =
	| ChimeraCollectionParams<ChimeraStoreOperatorMap<T>, ChimeraStoreEntityType<T, EntityName>, Meta>
	| QueryBuilderCreator<T, ChimeraStoreEntityType<T, EntityName>, ChimeraStoreOperatorMap<T>>;

export const normalizeParams = <T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>, Meta = any>(
	params: AnyChimeraParams<T, EntityName, Meta>,
) => {
	if (typeof params !== "function") return params;
	const q = new ChimeraQueryBuilder();
	params(q);
	return q.build();
};
