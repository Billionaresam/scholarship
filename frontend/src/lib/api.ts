const API = import.meta.env.VITE_API_URL;

export async function api<T>(path: string, options: RequestInit = {}) {
	const localDirectoryProxy = !API && import.meta.env.DEV && path.startsWith('/universities');
	if (!API && !import.meta.env.DEV) throw new TypeError('API URL is not configured');

	const token = localStorage.getItem('sb_token');
	const response = await fetch((API || '/api') + path, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers || {}),
		},
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data as T;
}
