import { ChimeraOrderTypeComparisonError } from "./errors.ts";
import type { ChimeraKeyFromOrderGetter, ChimeraOrderConfig, ChimeraPrimitiveComparator } from "./types.ts";

export const chimeraDefaultComparator: ChimeraPrimitiveComparator = (a: unknown, b: unknown): number => {
	let result = 0;

	if (typeof a === "string" && typeof b === "string") {
		result = a.localeCompare(b);
	} else if (typeof a === "number" && typeof b === "number") {
		result = a - b;
	} else if (a instanceof Date && b instanceof Date) {
		result = a.getTime() - b.getTime();
	} else if (a == null || b == null) {
		// biome-ignore lint/suspicious/noDoubleEquals: At least one of the operands should be null or undefined. If one of them is null and the other is undefined, we should get true.
		result = a == b ? 0 : a == null ? -1 : 1;
	} else {
		throw new ChimeraOrderTypeComparisonError(a, b);
	}
	return result;
};

export const chimeraDefaultKeyFromOrder: ChimeraKeyFromOrderGetter = (order): string => JSON.stringify(order);

export const chimeraDefaultOrderConfig = {
	getKey: chimeraDefaultKeyFromOrder,
	primitiveComparator: chimeraDefaultComparator,
} satisfies ChimeraOrderConfig;
