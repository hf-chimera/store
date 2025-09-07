import type { AnyObject, ChimeraCancellablePromise, ChimeraEntityGetter, ChimeraPropertyGetter } from "./types.ts";

export const deepObjectAssign = <T>(dst: AnyObject, srcObj: AnyObject, visited = new WeakSet()): T => {
	for (const { 0: key, 1: srcVal } of Object.entries(srcObj)) {
		if (srcVal === null || typeof srcVal !== "object" || Array.isArray(srcVal)) {
			dst[key] = srcVal;
			continue;
		}

		// Check for circular references
		if (visited.has(srcVal)) {
			dst[key] = srcVal;
			continue;
		}

		visited.add(srcVal);
		const destVal = dst[key];
		dst[key] = destVal === null || typeof destVal !== "object" || Array.isArray(destVal) ? {} : destVal;
		deepObjectAssign(dst[key], srcVal, visited);
		visited.delete(srcVal);
	}

	return dst as T;
};

export const deepObjectFreeze = <T>(obj: T, frozenObjects = new WeakSet()): T => {
	if (obj === null || typeof obj !== "object" || Object.isFrozen(obj) || frozenObjects.has(obj)) return obj;

	frozenObjects.add(obj);
	for (const value of Object.values(obj))
		if (value && typeof value === "object") deepObjectFreeze(value, frozenObjects);
	return Object.freeze(obj);
};

export const compilePropertyGetter = <Entity>({ get }: ChimeraPropertyGetter<Entity>): ChimeraEntityGetter<Entity> =>
	typeof get === "function" ? get : (e: Entity) => e[get];

export const simplifyPropertyGetter = <Entity>({ key }: ChimeraPropertyGetter<Entity>): string => key;

export const makeCancellablePromise = <Result>(
	promise: Promise<Result> | ChimeraCancellablePromise<Result>,
	controller = new AbortController(),
): ChimeraCancellablePromise<Result> => {
	const signal = controller.signal;

	const newPromise = promise.then(
		(v) => (signal.aborted ? new Promise(() => null) : v),
		(err) => {
			return signal.aborted ? new Promise(() => null) : Promise.reject(err);
		},
	) as ChimeraCancellablePromise<Result>;

	newPromise.cancel = () => controller.abort();
	newPromise.cancelled = (cb) => (signal.aborted ? queueMicrotask(cb) : signal.addEventListener("abort", cb));

	if ("cancelled" in promise) {
		promise.cancelled(() => newPromise.cancel());
		controller.signal.addEventListener("abort", () => promise.cancel());
	}
	return newPromise;
};
