import type {
	ChimeraFilterConfig,
	ChimeraKeyFromFilterGetter,
	ChimeraKeyFromOperatorGetter,
	ChimeraOperatorMap,
} from "./types.ts";

export const getKeyFromOperation: ChimeraKeyFromOperatorGetter = (operator) => JSON.stringify(operator);
export const chimeraDefaultGetKeyFromFilter: ChimeraKeyFromFilterGetter = (filter) => JSON.stringify(filter);

export const chimeraDefaultFilterOperators = {
	contains: <
		I extends string | unknown[],
		T extends I extends never[] ? unknown : I extends unknown[] ? I[number] | I : I extends string ? string : never,
	>(
		a: I,
		b: T,
	) => {
		if (typeof a === "string") return a.includes(b as string);
		if (Array.isArray(a)) return Array.isArray(b) ? b.every((v) => a.includes(v)) : a.includes(b);
		return false;
	},
	endsWith: (a: string, b: string) => a.endsWith(b),
	eq: <T>(a: T, b: T) => a === b,
	gt: (a, b) => a > b,
	gte: (a, b) => a >= b,
	in: <I, T extends I extends never[] ? unknown[] : I extends unknown[] ? I : I[]>(a: I, b: T) =>
		(Array.isArray(a) ? a : [a]).some((v) => b.includes(v)),
	lt: (a, b) => a < b,
	lte: (a, b) => a <= b,
	neq: <T>(a: T, b: T) => a !== b,
	notIn: (a, b) => (Array.isArray(a) ? a : [a]).every((v) => !b.includes(v)),
	startsWith: (a: string, b: string) => a.startsWith(b),
} satisfies ChimeraOperatorMap;

export const chimeraDefaultFilterConfig = {
	getFilterKey: chimeraDefaultGetKeyFromFilter,
	getOperatorKey: getKeyFromOperation,
	operators: chimeraDefaultFilterOperators,
} satisfies ChimeraFilterConfig<typeof chimeraDefaultFilterOperators>;
