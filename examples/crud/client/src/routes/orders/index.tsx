import { createFileRoute, Link } from '@tanstack/react-router';
import { useChimeraCollection } from '../../store';

export const Route = createFileRoute('/orders/')({
	component: OrdersList,
});

function OrdersList() {
	const ordersQuery = useChimeraCollection('order', {});

	if (!ordersQuery.ready) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-lg">Loading orders...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold">Orders</h1>
				<Link
					to="/orders/new"
					className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
				>
					Create New Order
				</Link>
			</div>

			<div className="bg-white rounded-lg shadow overflow-hidden">
				<table className="min-w-full divide-y divide-gray-200">
					<thead className="bg-gray-50">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							ID
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Customer ID
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Product
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Quantity
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Total Amount
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Actions
						</th>
					</tr>
					</thead>
					<tbody className="bg-white divide-y divide-gray-200">
					{ordersQuery.map((order) => (
						<tr key={order.id} className="hover:bg-gray-50">
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{order.id}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{order.customerId}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{order.productName}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{order.quantity}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								${order.totalAmount.toFixed(2)}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
	                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
		                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
			                  'bg-red-100 text-red-800'
                  }`}>
                    {order.status}
                  </span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<Link
									to="/orders/$id"
									params={{ id: order.id.toString() }}
									className="text-blue-600 hover:text-blue-900"
								>
									Edit
								</Link>
							</td>
						</tr>
					))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
