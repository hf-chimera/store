import type { ChimeraFilterDescriptor, ChimeraOperatorMap } from "../filter/types.ts";
import type { ChimeraOrderPriority } from "../order/types.ts";

export type ChimeraCollectionParams<OperatorsMap extends ChimeraOperatorMap, Entity, Meta = any> = {
	filter?: ChimeraFilterDescriptor<OperatorsMap, Entity> | null;
	order?: ChimeraOrderPriority<Entity> | null;
	meta?: Meta;
};
