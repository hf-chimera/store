import type { AnyObject, ChimeraCancellablePromise, ChimeraEntityGetter, ChimeraPropertyGetter } from "./types.ts";

type DeepObjectAssignStackRecord = { t: AnyObject; s: AnyObject };
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity:
export const deepObjectAssign = <T extends AnyObject, U extends AnyObject>(target: T, ...sources: U[]): T & U => {
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
};

export const compilePropertyGetter = <Entity>({get}: ChimeraPropertyGetter<Entity>): ChimeraEntityGetter<Entity> =>
	typeof get === "function" ? get : (e: Entity) => e[get];

export const simplifyPropertyGetter = <Entity>({key}: ChimeraPropertyGetter<Entity>): string => key;

export const makeCancellablePromise = <Result>(
	promise: Promise<Result>,
	controller = new AbortController(),
): ChimeraCancellablePromise<Result> => {
	const signal = controller.signal;

	const newPromise = promise.then(
		(v) => (signal.aborted ? new Promise(() => null) : v),
		(err) => (signal.aborted ? new Promise(() => null) : Promise.reject(err)),
	) as ChimeraCancellablePromise<Result>;

	newPromise.cancel = () => controller.abort();
	return newPromise;
};
