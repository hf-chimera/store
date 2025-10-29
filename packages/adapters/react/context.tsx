import { createContext, type ReactNode, useMemo } from 'react';
import type { ChimeraFilterConfig } from '../../../src/filter';
import type { ChimeraEntityMap } from '../../../src/shared/types';
import type { ChimeraStore } from '../../../src/store';

export interface ChimeraStoreContextValue<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
> {
	store: ChimeraStore<EntityMap, FilterConfig>;
}

export interface ChimeraStoreProviderProps<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
> {
	children: ReactNode;
	store: ChimeraStore<EntityMap, FilterConfig>;
}

export const ChimeraStoreContext = createContext<ChimeraStoreContextValue<any, any> | null>(null);

export const ChimeraStoreProvider = <
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
>({
	                                      children,
	                                      store,
                                      }: ChimeraStoreProviderProps<EntityMap, FilterConfig>) => (
	<ChimeraStoreContext.Provider value={useMemo(() => ({ store }), [store])}>{children}</ChimeraStoreContext.Provider>
);
