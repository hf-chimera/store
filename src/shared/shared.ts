import type {
	AnyObject,
	ChimeraCancellablePromise,
	ChimeraEntityGetter,
	ChimeraPropertyGetter,
	Constructable,
} from "./types.ts";

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

const TypedArray = Object.getPrototypeOf(Int8Array);

export const deepObjectClone = <T>(value: T, refs?: Map<any, any>): T => {
	if (value === null) return null as T;
	if (value === undefined) return undefined as T;
	if (typeof value !== "object") return value;

	if (refs) {
		const ref = refs.get(value);
		if (ref !== undefined) return ref;
	}

	if (value.constructor === Object) {
		const keys = Object.keys(value).concat(Object.getOwnPropertySymbols(value) as unknown as string[]);
		const length = keys.length;
		const clone = {} as T;
		// biome-ignore lint/style/noParameterAssign: ok
		refs ??= new Map();
		refs.set(value, clone);
		for (let i = 0; i < length; i++) clone[keys[i] as keyof T] = deepObjectClone(value[keys[i] as keyof T], refs);
		return clone;
	}
	if (Array.isArray(value)) {
		const length = value.length;
		const clone = new Array(length) as T;
		// biome-ignore lint/style/noParameterAssign: ok
		refs ??= new Map();
		refs.set(value, clone);
		for (let i = 0; i < length; i++) clone[i as keyof T] = deepObjectClone(value[i], refs);
		return clone;
	}
	if (value instanceof Date) return new (value.constructor as Constructable)(value.valueOf());
	if (value instanceof RegExp) return value.constructor as Constructable as T;
	if (value instanceof Map) {
		const clone = new (value.constructor as Constructable)();
		// biome-ignore lint/style/noParameterAssign: ok
		refs ??= new Map();
		refs.set(value, clone);
		for (const entry of value.entries()) clone.set(entry[0], deepObjectClone(entry[1], refs));
		return clone;
	}
	if (value instanceof Set) {
		const clone = new (value.constructor as Constructable)();
		// biome-ignore lint/style/noParameterAssign: ok
		refs ??= new Map();
		refs.set(value, clone);
		for (const entry of value.values()) clone.add(deepObjectClone(entry, refs));
		return clone;
	}
	if (value instanceof Error) {
		const clone = new (value.constructor as Constructable)(value.message);
		const keys = Object.keys(value).concat(Object.getOwnPropertySymbols(value) as unknown as string[]);
		const length = keys.length;
		// biome-ignore lint/style/noParameterAssign: ok
		refs ??= new Map();
		refs.set(value, clone);
		for (let i = 0; i < length; i++) clone[keys[i] as keyof T] = deepObjectClone(value[keys[i] as keyof T], refs);
		return clone;
	}
	if (value instanceof ArrayBuffer) return value.slice() as T;
	if (value instanceof TypedArray) return (value as unknown as Int8Array).slice() as T;
	if (value instanceof DataView) return new DataView(value.buffer.slice()) as T;
	if (value instanceof WeakMap) return value;
	if (value instanceof WeakSet) return value;

	const clone = Object.create(value.constructor.prototype) as T;
	const keys = Object.keys(value).concat(Object.getOwnPropertySymbols(value) as unknown as string[]);
	const length = keys.length;
	// biome-ignore lint/style/noParameterAssign: ok
	refs ??= new Map();
	refs.set(value, clone);
	for (let i = 0; i < length; i++) clone[keys[i] as keyof T] = deepObjectClone(value[keys[i] as keyof T], refs);
	return clone;
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
