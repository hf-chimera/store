export type KeysOfType<Obj, Type> = {
	[K in keyof Obj]: Obj[K] extends Type ? K : never;
}[keyof Obj];

export type Constructable = {
	new (...args: any[]): any;
};

export type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;

export type Primitive = string | number | symbol | boolean | null | undefined;
export type DeepValue = Primitive | DeepObject | DeepArray | ((...args: any) => any);
export type DeepObject = { [key: string | symbol]: DeepValue };
export type DeepArray = DeepValue[];

export type AnyObject = Record<string, DeepValue>;

export type Nullish<T> = null | undefined | T;

export type ChimeraCancellablePromise<Result = unknown> = Promise<Result> & {
	cancel(): void;
	cancelled(cb: () => void): void;
};

export type ChimeraEntityId = string | number;

export type ChimeraEntityGetter<Entity, Return = unknown> = (entity: Entity) => Return;
export type ChimeraPropertyGetter<Entity, Type = unknown, Return = unknown> = {
	get: ChimeraEntityGetter<Entity, Return> | KeysOfType<Entity, Type>;
	key: string;
};
