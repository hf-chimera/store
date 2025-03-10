import type { EntityGetter } from "./internal/utils.ts";

export type ChimeraOrderDescriptor<Entity> = {
	key: EntityGetter<Entity>;
	desc: boolean;
};

export type ChimeraOrderPriority<Entity> = ChimeraOrderDescriptor<Entity>[];

export type ChimeraOrderByComparator<Entity> = (a: Entity, b: Entity) => number;

export type ChimeraPrimitiveComparator = (a: unknown, b: unknown) => number;

export const chimeraDefaultComparator = (a: unknown, b: unknown) => {
	let result = 0;
	if (typeof a === "string" && typeof b === "string") {
		result = a.localeCompare(b);
	} else if (typeof a === "number" && typeof b === "number") {
		result = a - b;
	} else if (a instanceof Date && b instanceof Date) {
		result = a.getTime() - b.getTime();
	} else {
		throw new Error(`Unsupported types for sorting: ${typeof a} with ${typeof b}`);
	}
	return result;
};

export const buildComparator =
	<Entity>(
		orderBy: ChimeraOrderPriority<Entity>,
		comparator: ChimeraPrimitiveComparator = chimeraDefaultComparator,
	): ChimeraOrderByComparator<Entity> =>
		(a: Entity, b: Entity) => {
			let result = 0;
			for (const descriptor of orderBy) {
				result = comparator(descriptor.key(a), descriptor.key(b));
				descriptor.desc && (result *= -1);
				if (!result) break;
			}
			return result;
		};
