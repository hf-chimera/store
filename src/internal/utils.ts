// TODO: remove
export type Todo = object;

export type EntityId = string | number;

export type OneOrMany<T> = T | T[];
export type MayBePromise<T> = T | Promise<T>;

export type EntityGetter<Entity, Return = unknown> = (entity: Entity) => Return;

export type IdGetterFunc<Entity> = EntityGetter<Entity, EntityId>;

export type MutationRequester<Entity> = (entity: Entity, cb: (item: Entity) => void) => void;

type DeepObjectAssignStackRecord = { t: AnyObject; s: AnyObject };
type Primitive = string | number | boolean | null | undefined;
type DeepValue = Primitive | DeepObject | DeepArray;
type DeepObject = { [key: string]: DeepValue };
type DeepArray = DeepValue[];
export type AnyObject = Record<string, DeepValue>;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity:
export function deepObjectAssign<T extends AnyObject, U extends AnyObject>(target: T, ...sources: U[]): T & U {
	const stack: DeepObjectAssignStackRecord[] = sources
		.filter((s) => s && typeof s === "object")
		.map((s) => ({t: target, s}));

	while (stack.length) {
		const {t, s} = stack.pop() as DeepObjectAssignStackRecord;

		for (const key of Object.keys(s)) {
			const sourceValue = s[key];
			const targetValue = t[key];

			if (sourceValue && typeof sourceValue === "object") {
				if (!targetValue || typeof targetValue !== "object") {
					t[key] = Array.isArray(sourceValue) ? [] : {};
				}
				stack.push({t: t[key], s: sourceValue} as DeepObjectAssignStackRecord);
			} else {
				t[key] = sourceValue;
			}
		}
	}

	return target as T & U;
}
