import type { MayBePromise, OneOrMany, Todo } from "./internal/utils.ts";

export type ChimeraEntityFetcher<Entity> = (params: Todo) => MayBePromise<OneOrMany<Entity>>;

export type ChimeraEntityMutator<Entity> = (newEntity: Entity) => MayBePromise<Entity>;
