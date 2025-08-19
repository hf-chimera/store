import { ChimeraInternalError } from "../shared/errors.ts";
import { compilePropertyGetter, simplifyPropertyGetter } from "../shared/shared.ts";
import type { ChimeraPropertyGetter, KeysOfType } from "../shared/types.ts";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";
import { ChimeraFilterConjunctionNotFoundError, ChimeraFilterOperatorNotFoundError } from "./errors.ts";
import type {
	ChimeraConjunctionDescriptor,
	ChimeraConjunctionOperation,
	ChimeraFilterChecker,
	ChimeraFilterConfig,
	ChimeraFilterDescriptor,
	ChimeraFilterOperatorDescriptor,
	ChimeraSimplifiedFilter,
	SimplifiedConjunction,
	SimplifiedOperator,
} from "./types.ts";

const compileOperator = <Config extends ChimeraFilterConfig, Entity>(
	config: Config,
	{ op, value, test }: ChimeraFilterOperatorDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => {
	const operatorFunc = config.operators[op];
	if (!operatorFunc) throw new ChimeraFilterOperatorNotFoundError(op);
	const getter = compilePropertyGetter(value);
	return (entity) => operatorFunc(getter(entity), test);
};

export const compileConjunction = <Config extends ChimeraFilterConfig, Entity>(
	config: Config,
	{ kind, operations }: ChimeraConjunctionDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => {
	const conjunction = config.conjunctions[kind];
	if (!conjunction) throw new ChimeraFilterConjunctionNotFoundError(kind);

	const compiledOperations = operations.map((operation) => {
		switch (operation.type) {
			case ChimeraOperatorSymbol:
				return compileOperator(config, operation);
			case ChimeraConjunctionSymbol:
				return compileConjunction(config, operation);
			default:
				// @ts-expect-error: `operation.type` should always be type `never` here
				throw new ChimeraInternalError(`Invalid filter operation ${operation.type}`);
		}
	});

	return (entity) => conjunction(compiledOperations.map((op) => () => op(entity)));
};

export const simplifyOperator = <Config extends ChimeraFilterConfig, Entity>({
	op,
	value,
	test,
}: ChimeraFilterOperatorDescriptor<Config, Entity>): SimplifiedOperator<Config> => ({
	key: simplifyPropertyGetter(value),
	op,
	test,
	type: ChimeraOperatorSymbol,
});

export const simplifyConjunction = <Config extends ChimeraFilterConfig, Entity>({
	kind,
	operations,
}: ChimeraConjunctionDescriptor<Config, Entity>): SimplifiedConjunction<Config> => ({
	kind,
	operations: operations.map((op) => {
		switch (op.type) {
			case ChimeraOperatorSymbol:
				return simplifyOperator(op);
			case ChimeraConjunctionSymbol:
				return simplifyConjunction(op);
			default:
				// @ts-expect-error: `op.type` should always be type `never` here
				throw new ChimeraInternalError(`Invalid filter operation ${op.type}`);
		}
	}),
	type: ChimeraConjunctionSymbol,
});

export const chimeraCreateOperator = <
	Entity,
	Config extends ChimeraFilterConfig,
	Op extends keyof Config["operators"] & string,
>(
	op: Op,
	value:
		| ChimeraPropertyGetter<Entity, Parameters<Config["operators"][Op]>[0]>
		| (KeysOfType<Entity, Parameters<Config["operators"][Op]>[0]> & string),
	test: Parameters<Config["operators"][Op]>[1],
): ChimeraFilterOperatorDescriptor<Config, Entity, Op> => ({
	op,
	test,
	type: ChimeraOperatorSymbol,
	value: (typeof value === "string"
		? {
				get: value,
				key: value,
			}
		: value) as ChimeraPropertyGetter<Entity, Parameters<Config["operators"][Op]>[0]>,
});

export const chimeraCreateConjunction = <
	Entity,
	Config extends ChimeraFilterConfig,
	Conj extends keyof Config["conjunctions"] & string = keyof Config["conjunctions"] & string,
>(
	kind: Conj,
	operations: ChimeraConjunctionOperation<Config, Entity>[],
): ChimeraConjunctionDescriptor<Config, Entity, Conj> => ({
	kind,
	operations,
	type: ChimeraConjunctionSymbol,
});

export const compileFilter = <Entity, Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	config: Config,
	descriptor?: ChimeraFilterDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => (descriptor ? compileConjunction(config, descriptor) : () => true);

export const simplifyFilter = <Entity, Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	descriptor?: ChimeraFilterDescriptor<Config, Entity>,
): ChimeraSimplifiedFilter<Config> => (descriptor ? simplifyConjunction(descriptor) : null);
