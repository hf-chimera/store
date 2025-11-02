import { Outlet, createRootRoute, Link } from '@tanstack/react-router';

export const Route = createRootRoute({
	component: () => (
		<div className="min-h-screen bg-gray-100">
			<nav className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex items-center">
							<Link to="/" className="text-xl font-bold text-gray-900">
								Admin Panel
							</Link>
						</div>
					<div className="flex items-center space-x-8">
						<Link
							to="/"
							className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
						>
							Dashboard
						</Link>
						<Link
							to="/orders"
							className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
						>
							Orders
						</Link>
						<Link
							to="/customers"
							className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
						>
							Customers
						</Link>
					</div>
					</div>
				</div>
			</nav>

			<main>
				<Outlet/>
			</main>
		</div>
	),
});
