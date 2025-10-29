import { compilePropertyGetter } from "../shared/shared.ts";
import type { ChimeraPropertyGetter } from "../shared/types.ts";
import type {
	ChimeraOrderByComparator,
	ChimeraOrderDescriptor,
	ChimeraOrderPriority,
	ChimeraPrimitiveComparator,
	ChimeraSimplifiedOrderDescriptor,
	CompiledOrderDescriptor,
} from "./types.ts";
import { ChimeraOrderNulls } from "./types.ts";

export const compileOrderDescriptor = <Entity>({
	key,
	desc,
	nulls,
}: ChimeraOrderDescriptor<Entity>): CompiledOrderDescriptor<Entity> => ({
	desc,
	get: compilePropertyGetter(key),
	nulls,
});

export const chimeraCreateOrderBy = <Entity>(
	key: ChimeraPropertyGetter<Entity> | (keyof Entity & string),
	desc = false,
	nulls: ChimeraOrderNulls = ChimeraOrderNulls.Last,
): ChimeraOrderDescriptor<Entity> => ({
	desc,
	key: (typeof key === "string" ? { get: key, key } : key) as ChimeraPropertyGetter<Entity>,
	nulls,
});

const nullsComparator = (a: unknown, b: unknown, nulls: ChimeraOrderNulls): number => {
	// biome-ignore lint/suspicious/noDoubleEquals: At least one of the operands should be null or undefined. If one of them is null and the other is undefined, we should get true.
	return a == b ? 0 : (a == null ? -1 : 1) * (nulls === ChimeraOrderNulls.First ? 1 : -1);
};

export const buildComparator = <Entity>(
	comparator: ChimeraPrimitiveComparator,
	orderBy?: ChimeraOrderPriority<Entity> | null,
): ChimeraOrderByComparator<Entity> => {
	if (!orderBy) return () => 0;

	const compiledPriority = orderBy.map((ob) => compileOrderDescriptor(ob));
	return (a: Entity, b: Entity) => {
		let result = 0;
		for (const descriptor of compiledPriority) {
			const vA = descriptor.get(a);
			const vB = descriptor.get(b);
			if (vA == null || vB == null) {
				result = nullsComparator(vA, vB, descriptor.nulls);
				if (result) break;
				continue;
			}
			result = comparator(descriptor.get(a), descriptor.get(b));
			descriptor.desc && (result *= -1);
			if (!result) break;
		}
		return result;
	};
};

export const simplifyOrderBy = <Entity>(
	orderBy?: ChimeraOrderPriority<Entity> | null,
): ChimeraSimplifiedOrderDescriptor<keyof Entity & string>[] | null =>
	orderBy ? orderBy.map((ob) => ({ desc: ob.desc, field: ob.key.key, nulls: ob.nulls })) : null;
