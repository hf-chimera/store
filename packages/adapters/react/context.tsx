import { createContext, type ReactNode, useMemo } from 'react';
import type { AnyChimeraStore } from '../../../src/store';

export interface ChimeraStoreContextValue<T extends AnyChimeraStore> {
	store: T;
}

export interface ChimeraStoreProviderProps<T extends AnyChimeraStore> {
	children: ReactNode;
	store: T;
}

export const ChimeraStoreContext = createContext<ChimeraStoreContextValue<AnyChimeraStore> | null>(null);

export const ChimeraStoreProvider = <T extends AnyChimeraStore>({ children, store }: ChimeraStoreProviderProps<T>) => (
	<ChimeraStoreContext.Provider value={useMemo(() => ({ store }), [store])}>{children}</ChimeraStoreContext.Provider>
);
