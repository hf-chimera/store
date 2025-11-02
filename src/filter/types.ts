import type { ChimeraPropertyGetter } from "../shared/types.ts";
import type { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";

export type ChimeraFilterChecker<Entity> = (item: Entity) => boolean;

export type ChimeraConjunctionType = "and" | "or" | "not";

export type ConjunctionFunction = (operations: Array<() => boolean>) => boolean;
export type ConjunctionMap = {
	[K in ChimeraConjunctionType]: ConjunctionFunction;
};

export type ChimeraOperatorFunction = (itemValue: any, testValue: any) => boolean;
export type ChimeraOperatorMap = Record<string, ChimeraOperatorFunction>;

export type ChimeraFilterOperatorDescriptor<
	OperatorsMap extends ChimeraOperatorMap,
	Entity,
	Op extends keyof OperatorsMap & string = keyof OperatorsMap & string,
> = {
	[K in Op]: {
		type: typeof ChimeraOperatorSymbol;
		op: K;
		value: ChimeraPropertyGetter<Entity, Parameters<OperatorsMap[K]>[0]>;
		test: Parameters<OperatorsMap[K]>[1];
	};
}[Op];

export type ChimeraConjunctionOperationDescriptor<OperatorsMap extends ChimeraOperatorMap, Entity> =
	| ChimeraFilterOperatorDescriptor<OperatorsMap, Entity>
	| ChimeraConjunctionDescriptor<OperatorsMap, Entity>;
export type ChimeraConjunctionDescriptor<
	OperatorsMap extends ChimeraOperatorMap,
	Entity,
	Conj extends ChimeraConjunctionType = ChimeraConjunctionType,
> = {
	[K in Conj]: {
		type: typeof ChimeraConjunctionSymbol;
		kind: K;
		operations: ChimeraConjunctionOperationDescriptor<OperatorsMap, Entity>[];
	};
}[Conj];

export type ChimeraFilterDescriptor<OperatorsMap extends ChimeraOperatorMap, Entity> = ChimeraConjunctionDescriptor<
	OperatorsMap,
	Entity
>;

export type ChimeraSimplifiedOperator<
	OperatorsMap extends ChimeraOperatorMap,
	Keys extends string = string,
	Op extends keyof OperatorsMap & string = keyof OperatorsMap & string,
> = {
	[K in Op]: {
		type: typeof ChimeraOperatorSymbol;
		op: K;
		key: Keys | string;
		test: Parameters<OperatorsMap[K]>[1];
	};
}[Op];

export type ChimeraSimplifiedConjunctionOperation<
	OperatorsMap extends ChimeraOperatorMap,
	Keys extends string = string,
> = ChimeraSimplifiedOperator<OperatorsMap, Keys> | SimplifiedConjunction<OperatorsMap, Keys>;
export type SimplifiedConjunction<
	OperatorsMap extends ChimeraOperatorMap,
	Keys extends string = string,
	Conj extends ChimeraConjunctionType = ChimeraConjunctionType,
> = {
	[K in Conj]: {
		type: typeof ChimeraConjunctionSymbol;
		kind: K;
		operations: ChimeraSimplifiedConjunctionOperation<OperatorsMap, Keys>[];
	};
}[Conj];

export type ChimeraSimplifiedFilter<
	OperatorsMap extends ChimeraOperatorMap,
	Keys extends string = string,
> = SimplifiedConjunction<OperatorsMap, Keys> | null;

export type ChimeraKeyFromFilterGetter = <OperatorsMap extends ChimeraOperatorMap>(
	filter: ChimeraSimplifiedFilter<OperatorsMap> | null,
) => string;

export type ChimeraKeyFromOperatorGetter = <OperatorsMap extends ChimeraOperatorMap>(
	operator: ChimeraSimplifiedOperator<OperatorsMap> | null,
) => string;

export type ChimeraFilterConfig<OperatorsMap extends ChimeraOperatorMap> = {
	operators: OperatorsMap;
	getFilterKey?: ChimeraKeyFromFilterGetter;
	getOperatorKey?: ChimeraKeyFromOperatorGetter;
};
