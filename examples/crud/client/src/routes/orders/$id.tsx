import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useChimeraItem } from '@/store';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/orders/$id')({
	component: UpdateOrder,
});

function UpdateOrder() {
	const navigate = useNavigate();
	const { id } = Route.useParams();
	const [formData, setFormData] = useState({
		customerId: '',
		productName: '',
		quantity: '',
		totalAmount: '',
		status: 'pending'
	});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const orderQuery = useChimeraItem('order', +id);

	useEffect(() => {
		if (orderQuery.ready) {
			setFormData({
				customerId: orderQuery.data.customerId.toString(),
				productName: orderQuery.data.productName,
				quantity: orderQuery.data.quantity.toString(),
				totalAmount: orderQuery.data.totalAmount.toString(),
				status: orderQuery.data.status
			});
		}
	}, [orderQuery.ready]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			await orderQuery.update({
				id: +id,
				customerId: parseInt(formData.customerId),
				productName: formData.productName,
				quantity: parseInt(formData.quantity),
				totalAmount: parseFloat(formData.totalAmount),
				status: formData.status
			});

			navigate({ to: '/orders' });
		} catch (error) {
			console.error('Failed to update order:', error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setFormData(prev => ({
			...prev,
			[e.target.name]: e.target.value
		}));
	};

	if (!orderQuery.ready) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-lg">Loading order...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex items-center mb-6">
				<Link
					to="/orders"
					className="text-blue-600 hover:text-blue-800 mr-4"
				>
					← Back to Orders
				</Link>
				<h1 className="text-3xl font-bold">Update Order #{id}</h1>
			</div>

			<div className="bg-white rounded-lg shadow p-6 max-w-2xl">
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-2">
							Customer ID
						</label>
						<input
							type="number"
							id="customerId"
							name="customerId"
							value={formData.customerId}
							onChange={handleChange}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-2">
							Product Name
						</label>
						<input
							type="text"
							id="productName"
							name="productName"
							value={formData.productName}
							onChange={handleChange}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
							Quantity
						</label>
						<input
							type="number"
							id="quantity"
							name="quantity"
							value={formData.quantity}
							onChange={handleChange}
							required
							min="1"
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-2">
							Total Amount
						</label>
						<input
							type="number"
							id="totalAmount"
							name="totalAmount"
							value={formData.totalAmount}
							onChange={handleChange}
							required
							step="0.01"
							min="0"
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
							Status
						</label>
						<select
							id="status"
							name="status"
							value={formData.status}
							onChange={handleChange}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="pending">Pending</option>
							<option value="processing">Processing</option>
							<option value="completed">Completed</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</div>

					<div className="flex justify-end space-x-4">
						<Link
							to="/orders"
							className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</Link>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
						>
							{isSubmitting ? 'Updating...' : 'Update Order'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
