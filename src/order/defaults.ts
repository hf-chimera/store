import { ChimeraOrderTypeComparisonError } from "./errors.ts";
import type {
	ChimeraKeyFromOrderGetter,
	ChimeraOrderConfig,
	ChimeraPrimitiveComparator,
	ChimeraSimplifiedOrderDescriptor,
} from "./types.ts";
import { ChimeraOrderNulls } from "./types.ts";

export const chimeraDefaultComparator: ChimeraPrimitiveComparator = (
	a: unknown,
	b: unknown,
	nulls: ChimeraOrderNulls,
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: It is a goal of this function to have a lot of checks
): number => {
	let result = 0;
	let aIsNull = false;

	if (typeof a === "string" && typeof b === "string") {
		result = a.localeCompare(b);
	} else if (typeof a === "number" && typeof b === "number") {
		result = a - b;
	} else if (a instanceof Date && b instanceof Date) {
		result = a.getTime() - b.getTime();
	} else if ((aIsNull = a == null) || b == null) {
		// biome-ignore lint/suspicious/noDoubleEquals: At least one of the operands should be null or undefined. If one of them is null and the other is undefined, we should get true.
		result = a == b ? 0 : 1 * (aIsNull && nulls === ChimeraOrderNulls.First ? -1 : aIsNull ? 1 : -1);
	} else {
		throw new ChimeraOrderTypeComparisonError(a, b);
	}
	return result;
};

export const chimeraDefaultKeyFromOrder: ChimeraKeyFromOrderGetter = (
	order: ChimeraSimplifiedOrderDescriptor[],
): string => JSON.stringify(order);

export const chimeraDefaultOrderConfig = {
	primitiveComparator: chimeraDefaultComparator,
	getKey: chimeraDefaultKeyFromOrder,
} satisfies ChimeraOrderConfig;
