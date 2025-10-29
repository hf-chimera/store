import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import './styles.css';
import { ChimeraStoreProvider } from '../../../../packages/adapters/react';
import { store } from '@/store';

// Import the generated route tree
import { routeTree } from './routeTree.gen';


// Create a new router instance
const router = createRouter({
	routeTree,
	context: {},
	defaultPreload: 'intent',
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

// Render the app
const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<ChimeraStoreProvider store={store}>
				<RouterProvider router={router}/>
			</ChimeraStoreProvider>
		</StrictMode>,
	);
}
