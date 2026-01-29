import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useChimeraCustomerItem } from '../../store';
import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';

export const Route = createFileRoute('/customers/$id')({
	component: UpdateCustomer,
});

function UpdateCustomer() {
	const navigate = useNavigate();
	const { id } = Route.useParams();
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		phone: ''
	});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const customerQuery = useChimeraCustomerItem(+id);

	useEffect(() => {
		if (customerQuery.ready) {
			setFormData({
				name: customerQuery.data.name,
				email: customerQuery.data.email,
				phone: customerQuery.data.phone
			});
		}
	}, [customerQuery.ready]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			await customerQuery.update({
				id: +id,
				name: formData.name,
				email: formData.email,
				phone: formData.phone
			});

			await navigate({ to: '/customers' });
		} catch (error) {
			console.error('Failed to update customer:', error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setFormData(prev => ({
			...prev,
			[e.target.name]: e.target.value
		}));
	};

	if (!customerQuery.ready) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-lg">Loading customer...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex items-center mb-6">
				<Link
					to="/customers"
					className="text-blue-600 hover:text-blue-800 mr-4"
				>
					← Back to Customers
				</Link>
				<h1 className="text-3xl font-bold">Update Customer #{id}</h1>
			</div>

			<div className="bg-white rounded-lg shadow p-6 max-w-2xl">
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
							Name
						</label>
						<input
							type="text"
							id="name"
							name="name"
							value={formData.name}
							onChange={handleChange}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
							Email
						</label>
						<input
							type="email"
							id="email"
							name="email"
							value={formData.email}
							onChange={handleChange}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
							Phone
						</label>
						<input
							type="text"
							id="phone"
							name="phone"
							value={formData.phone}
							onChange={handleChange}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div className="flex justify-end space-x-4">
						<Link
							to="/customers"
							className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</Link>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
						>
							{isSubmitting ? 'Updating...' : 'Update Customer'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

