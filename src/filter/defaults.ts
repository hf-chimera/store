import type {
	ChimeraConjunctionMap,
	ChimeraFilterConfig,
	ChimeraKeyFromFilterGetter,
	ChimeraOperatorMap,
} from "./types.ts";

export const chimeraDefaultGetKeyFromFilter: ChimeraKeyFromFilterGetter = (filter) => JSON.stringify(filter);

export const chimeraDefaultFilterConjunctions = {
	and: (operations) => {
		for (const operation of operations) if (!operation()) return false;
		return true;
	},
	or: (operations) => {
		for (const operation of operations) if (operation()) return true;
		return false;
	},
} satisfies ChimeraConjunctionMap;

export const chimeraDefaultFilterOperators = {
	eq: <T>(a: T, b: T) => a === b,
	neq: <T>(a: T, b: T) => a !== b,
	gt: (a, b) => a > b,
	gte: (a, b) => a >= b,
	lt: (a, b) => a < b,
	lte: (a, b) => a <= b,
	contains: <
		I extends string | unknown[],
		T extends I extends unknown[] ? I[number] | I : I extends string ? string : never,
	>(
		a: I,
		b: T,
	) => {
		if (typeof a === "string") return a.includes(b as string);
		if (Array.isArray(a)) return Array.isArray(b) ? b.every((v) => a.includes(v)) : a.includes(b);
		return false;
	},
	startsWith: (a: string, b: string) => a.startsWith(b),
	endsWith: (a: string, b: string) => a.endsWith(b),
	in: <I, T extends I extends unknown[] ? I : I[]>(a: I, b: T) =>
		(Array.isArray(a) ? a : [a]).some((v) => b.includes(v)),
	notIn: (a, b) => (Array.isArray(a) ? a : [a]).every((v) => !b.includes(v)),
} satisfies ChimeraOperatorMap;

export const chimeraDefaultFilterConfig = {
	conjunctions: chimeraDefaultFilterConjunctions,
	operators: chimeraDefaultFilterOperators,
	getKey: chimeraDefaultGetKeyFromFilter,
} satisfies ChimeraFilterConfig;
