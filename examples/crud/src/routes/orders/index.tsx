import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useChimeraOrderCollection } from '../../store';
import type { Order } from '../../../../server/types';

export const Route = createFileRoute('/orders/')({
	component: OrdersList,
});

type SortOptions = `${keyof Order}:${'+' | '-'}`

function OrdersList() {
	const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all');
	const [minAmount, setMinAmount] = useState<number>(0);
	const [sortBy, setSortBy] = useState<SortOptions>('createdAt:-');

	const ordersQuery = useChimeraOrderCollection(
		(q) => {
			// Filter: exclude canceled orders if statusFilter is not 'all'
			if (statusFilter !== 'all') {
				q.where('status', 'eq', statusFilter);
			}

			// Filter: orders with totalAmount >= minAmount
			if (minAmount > 0) {
				q.where('totalAmount', 'gte', minAmount);
			}

			const [orderField, orderDirection] = sortBy.split(':')
			q.orderBy(orderField as keyof Order, orderDirection !== '+')

			// Secondary sort: always sort by id as tiebreaker
			q.orderBy('id', false); // Ascending
		},
		[statusFilter, minAmount, sortBy],
	);

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

			{/* Filters and Sorting Controls */}
			<div className="bg-white rounded-lg shadow p-4 mb-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Status Filter */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Filter by Status
						</label>
						<div className="flex flex-wrap gap-2">
							{(['all', 'completed', 'pending', 'cancelled'] as const).map((status) => (
								<button
									key={status}
									onClick={() => setStatusFilter(status)}
									className={`px-3 py-1 text-sm rounded ${
										statusFilter === status
											? 'bg-blue-500 text-white'
											: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
									}`}
								>
									{status.charAt(0).toUpperCase() + status.slice(1)}
								</button>
							))}
						</div>
					</div>

					{/* Minimum Amount Filter */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Minimum Amount ($)
						</label>
						<input
							type="number"
							min="0"
							step="0.01"
							value={minAmount}
							onChange={(e) => setMinAmount(Number.parseFloat(e.target.value) || 0)}
							className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="0.00"
						/>
					</div>

					{/* Sort By */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Sort By
						</label>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortOptions)}
							className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="totalAmount:-">Total Amount (High to Low)</option>
							<option value="totalAmount:+">Total Amount (Low to High)</option>
							<option value="createdAt:-">Created Date (Newest First)</option>
							<option value="createdAt:+">Created Date (Oldest First)</option>
						</select>
					</div>
				</div>
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
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Created at
						</th>
						<th></th>
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
							<td>
								{order.createdAt}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								<button
									className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
									onClick={() => ordersQuery.delete(order.id)}
								>Delete</button>
							</td>
						</tr>
					))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
