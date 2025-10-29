import type { ChimeraEntityGetter, ChimeraPropertyGetter } from "../shared/types.ts";

export enum ChimeraOrderNulls {
	First = "first",
	Last = "last",
}

export type ChimeraOrderDescriptor<Entity> = {
	key: ChimeraPropertyGetter<Entity>;
	desc: boolean;
	nulls: ChimeraOrderNulls;
};

export type ChimeraOrderPriority<Entity> = ChimeraOrderDescriptor<Entity>[];

export type ChimeraOrderByComparator<Entity> = (a: Entity, b: Entity) => number;

export type ChimeraPrimitiveComparator = (a: unknown, b: unknown) => number;

export type CompiledOrderDescriptor<Entity> = {
	get: ChimeraEntityGetter<Entity>;
	desc: boolean;
	nulls: ChimeraOrderNulls;
};

export type ChimeraSimplifiedOrderDescriptor<Keys extends string = string> = {
	field: Keys | string;
	desc: boolean;
	nulls: ChimeraOrderNulls;
};

export type ChimeraKeyFromOrderGetter = (order: ChimeraSimplifiedOrderDescriptor[] | null) => string;

export type ChimeraOrderConfig = {
	primitiveComparator: ChimeraPrimitiveComparator;
	getKey: ChimeraKeyFromOrderGetter;
};
