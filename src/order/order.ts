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
	get: compilePropertyGetter(key),
	desc,
	nulls,
});

export const chimeraCreateOrderBy = <Entity>(
	key: ChimeraPropertyGetter<Entity> | (keyof Entity & string),
	desc = false,
	nulls: ChimeraOrderNulls = ChimeraOrderNulls.Last,
): ChimeraOrderDescriptor<Entity> => ({
	key: (typeof key === "string" ? { key, get: key } : key) as ChimeraPropertyGetter<Entity>,
	desc,
	nulls,
});

export const buildComparator = <Entity>(
	comparator: ChimeraPrimitiveComparator,
	orderBy?: ChimeraOrderPriority<Entity>,
): ChimeraOrderByComparator<Entity> => {
	if (!orderBy) return () => 0;

	const compiledPriority = orderBy.map((ob) => compileOrderDescriptor(ob));
	return (a: Entity, b: Entity) => {
		let result = 0;
		for (const descriptor of compiledPriority) {
			result = comparator(descriptor.get(a), descriptor.get(b), descriptor.nulls);
			descriptor.desc && (result *= -1);
			if (!result) break;
		}
		return result;
	};
};

export const simplifyOrderBy = <Entity>(
	orderBy?: ChimeraOrderPriority<Entity>,
): ChimeraSimplifiedOrderDescriptor<keyof Entity & string>[] | null =>
	orderBy ? orderBy.map((ob) => ({ get: ob.key.key, desc: ob.desc, nulls: ob.nulls })) : null;
