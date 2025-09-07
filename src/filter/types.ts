import type { ChimeraPropertyGetter } from "../shared/types.ts";
import type { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";

export type ChimeraFilterChecker<Entity> = (item: Entity) => boolean;

export type ChimeraConjunctionType = "and" | "or";

export type ConjunctionFunction = (operations: Array<() => boolean>) => boolean;
export type ChimeraConjunctionMap = {
	[K in ChimeraConjunctionType]: ConjunctionFunction;
};

export type ChimeraOperatorFunction = (itemValue: any, testValue: any) => boolean;
export type ChimeraOperatorMap = Record<string, ChimeraOperatorFunction>;

export type ChimeraFilterOperatorDescriptor<
	Config extends ChimeraFilterConfig,
	Entity,
	Op extends keyof Config["operators"] & string = keyof Config["operators"] & string,
> = {
	[K in Op]: {
		type: typeof ChimeraOperatorSymbol;
		op: K;
		value: ChimeraPropertyGetter<Entity, Parameters<Config["operators"][K]>[0]>;
		test: Parameters<Config["operators"][K]>[1];
	};
}[Op];

export type ChimeraConjunctionOperation<Config extends ChimeraFilterConfig, Entity> =
	| ChimeraFilterOperatorDescriptor<Config, Entity>
	| ChimeraConjunctionDescriptor<Config, Entity>;
export type ChimeraConjunctionDescriptor<
	Config extends ChimeraFilterConfig,
	Entity,
	Conj extends ChimeraConjunctionType = ChimeraConjunctionType,
> = {
	[K in Conj]: {
		type: typeof ChimeraConjunctionSymbol;
		kind: K;
		operations: ChimeraConjunctionOperation<Config, Entity>[];
	};
}[Conj];

export type ChimeraFilterDescriptor<Config extends ChimeraFilterConfig, Entity> = ChimeraConjunctionDescriptor<
	Config,
	Entity
>;

export type ChimeraSimplifiedOperator<
	Config extends ChimeraFilterConfig = ChimeraFilterConfig,
	Keys extends string = string,
	Op extends keyof Config["operators"] & string = keyof Config["operators"] & string,
> = {
	[K in Op]: {
		type: typeof ChimeraOperatorSymbol;
		op: K;
		key: Keys | string;
		test: Parameters<Config["operators"][K]>[1];
	};
}[Op];

export type SimplifiedConjunction<
	Config extends ChimeraFilterConfig = ChimeraFilterConfig,
	Keys extends string = string,
	Conj extends ChimeraConjunctionType = ChimeraConjunctionType,
> = {
	[K in Conj]: {
		type: typeof ChimeraConjunctionSymbol;
		kind: K;
		operations: (ChimeraSimplifiedOperator<Config, Keys> | SimplifiedConjunction<Config, Keys>)[];
	};
}[Conj];

export type ChimeraSimplifiedFilter<
	Config extends ChimeraFilterConfig = ChimeraFilterConfig,
	Keys extends string = string,
> = SimplifiedConjunction<Config, Keys> | null;

export type ChimeraKeyFromFilterGetter = <Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	filter: ChimeraSimplifiedFilter<Config> | null,
) => string;

export type ChimeraKeyFromOperatorGetter = <Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	operator: ChimeraSimplifiedOperator<Config> | null,
) => string;

export type ChimeraFilterConfig = {
	operators: ChimeraOperatorMap;
	getFilterKey: ChimeraKeyFromFilterGetter;
	getOperatorKey: ChimeraKeyFromOperatorGetter;
};
