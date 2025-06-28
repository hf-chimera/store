import type {
	AnyObject,
	ChimeraCancellablePromise,
	ChimeraEntityGetter,
	ChimeraPropertyGetter,
	Option,
	OptionNone,
} from "./types.ts";

export const deepObjectAssign = <T>(dst: AnyObject, srcObj: AnyObject): T => {
	for (const { 0: key, 1: srcVal } of Object.entries(srcObj)) {
		if (srcVal === null || typeof srcVal !== "object" || Array.isArray(srcVal)) {
			dst[key] = srcVal;
			continue;
		}

		const destVal = dst[key];
		dst[key] = destVal === null || typeof destVal !== "object" || Array.isArray(destVal) ? {} : destVal;
		deepObjectAssign(dst[key], srcVal);
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

export const optionFromNullable = <T>(value: T | null | undefined): Option<T> =>
	value == null ? { some: false } : { some: true, value };

export const none = (): OptionNone => ({ some: false });

export const some = <T>(value: T): Option<T> => ({ some: true, value });
