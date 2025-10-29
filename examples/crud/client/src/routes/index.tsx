import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: Dashboard,
});

function Dashboard() {
	return (
		<div className="p-6">
			<h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div className="bg-white p-6 rounded-lg shadow">
					<h2 className="text-xl font-semibold mb-4">Orders</h2>
					<p className="text-gray-600 mb-4">Manage customer orders</p>
					<Link
						to="/orders"
						className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
					>
						View Orders
					</Link>
				</div>

				<div className="bg-white p-6 rounded-lg shadow">
					<h2 className="text-xl font-semibold mb-4">Customers</h2>
					<p className="text-gray-600 mb-4">Manage customer information</p>
					<button
						className="inline-block bg-gray-500 text-white px-4 py-2 rounded cursor-not-allowed"
						disabled
					>
						Coming Soon
					</button>
				</div>

				<div className="bg-white p-6 rounded-lg shadow">
					<h2 className="text-xl font-semibold mb-4">Reports</h2>
					<p className="text-gray-600 mb-4">View analytics and reports</p>
					<button
						className="inline-block bg-gray-500 text-white px-4 py-2 rounded cursor-not-allowed"
						disabled
					>
						Coming Soon
					</button>
				</div>
			</div>
		</div>
	);
}
