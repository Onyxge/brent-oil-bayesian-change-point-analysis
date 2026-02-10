import { fetchUtils } from 'react-admin';

const apiUrl = 'http://127.0.0.1:5000/api';
const httpClient = fetchUtils.fetchJson;

export const dataProvider = {
    getList: (resource, params) => {
        const url = `${apiUrl}/${resource}`;
        return httpClient(url).then(({ json }) => ({
            data: json,
            total: json.length, // React-Admin needs to know the total count
        }));
    },

    getOne: (resource, params) => {
        // Since our API gets ALL events, we find the specific one manually
        // In a real app, you'd have an endpoint like /api/events/1
        const url = `${apiUrl}/${resource}`;
        return httpClient(url).then(({ json }) => ({
            data: json.find(item => item.id == params.id),
        }));
    },

    // These are required placeholders even if we don't use them yet
    getMany: () => Promise.resolve({ data: [] }),
    getManyReference: () => Promise.resolve({ data: [], total: 0 }),
    create: () => Promise.resolve({ data: {} }),
    update: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ data: {} }),
};