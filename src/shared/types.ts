// TODO: remove
export type Todo = any;

export type KeysOfType<Obj, Type> = {
	[K in keyof Obj]: Obj[K] extends Type ? K : never;
}[keyof Obj];

export type OneOf<T> = {
	[K in keyof T]-?: Pick<T, K> & Partial<T>;
}[keyof T];

export type DeepPartial<T> = T extends object
	? {
		[P in keyof T]?: DeepPartial<T[P]>;
	}
	: T;

type Primitive = string | number | boolean | null | undefined;
type DeepValue = Primitive | DeepObject | DeepArray;
type DeepObject = { [key: string]: DeepValue };
type DeepArray = DeepValue[];
export type AnyObject = Record<string, DeepValue>;

export type OptionSome<T> = { some: true; value: T };
export type OptionNone = { some: false };
export type Option<T> = OptionSome<T> | OptionNone;

export type ChimeraCancellablePromise<Result = unknown> = Promise<Result> & { cancel(): void };

export type ChimeraEntityId = string | number;

export type ChimeraEntityMap = Record<string, object>;

export type ChimeraEntityGetter<Entity, Return = unknown> = (entity: Entity) => Return;
export type ChimeraPropertyGetter<Entity, Type = unknown, Return = unknown> = {
	get: ChimeraEntityGetter<Entity, Return> | KeysOfType<Entity, Type>;
	key: string;
};

export type ChimeraIdGetterFunc<Entity> = ChimeraEntityGetter<Entity, ChimeraEntityId>;

export type ChimeraMutationRequester<Entity> = (entity: Entity, cb: (item: Entity) => void) => void;
