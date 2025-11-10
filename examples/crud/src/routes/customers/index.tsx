import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useChimeraCollection } from '../../store';
import type { Customer } from '../../../../server/types';

export const Route = createFileRoute('/customers/')({
	component: CustomersList,
});

type SortOptions = `${keyof Customer}:${'+' | '-'}`

function CustomersList() {
	const [sortBy, setSortBy] = useState<SortOptions>('createdAt:-');
	const [nameSearch, setNameSearch] = useState('');

	const customersQuery = useChimeraCollection(
		'customer',
		(q) => {
			if (nameSearch) {
				q.where('name', 'contains', nameSearch)
			}

			const [orderField, orderDirection] = sortBy.split(':')
			q.orderBy(orderField as keyof Customer, orderDirection !== '+')

			// Secondary sort: always sort by id as tiebreaker
			q.orderBy('id', false); // Ascending
		},
		[sortBy, nameSearch],
	);

	if (!customersQuery.ready) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-lg">Loading customers...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold">Customers</h1>
				<Link
					to="/customers/new"
					className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
				>
					Create New Customer
				</Link>
			</div>

			{/* Sorting Controls */}
			<div className="bg-white rounded-lg shadow p-4 mb-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Name Search */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Search by Name
						</label>
						<input
							type="text"
							value={nameSearch}
							onChange={(e) => setNameSearch(e.target.value)}
							placeholder="Enter name..."
							className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
							<option value="name:+">Name (A to Z)</option>
							<option value="name:-">Name (Z to A)</option>
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
							Name
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Email
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Phone
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
					{customersQuery.map((customer) => (
						<tr key={customer.id} className="hover:bg-gray-50">
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{customer.id}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{customer.name}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{customer.email}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								{customer.phone}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<Link
									to="/customers/$id"
									params={{ id: customer.id.toString() }}
									className="text-blue-600 hover:text-blue-900"
								>
									Edit
								</Link>
							</td>
							<td>
								{customer.createdAt}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
								<button
									className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
									onClick={() => customersQuery.delete(customer.id)}
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

