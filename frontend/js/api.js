// js/api.js — Shared API helper for all frontend pages
// Change API_BASE when deploying live:
//   Development: http://localhost:5000
//   Production:  https://api.YOUR-DOMAIN.com

const API_BASE = window.RIDEPK_API_BASE || 'https://ridepk.onrender.com';

const API = {
  get: async (path) => {
    try {
      const res = await fetch(API_BASE + path, { headers: API._headers() });
      return await res.json();
    } catch (err) {
      return { error: true, message: 'Could not connect to server.' };
    }
  },
  post: async (path, body) => {
    try {
      const res = await fetch(API_BASE + path, {
        method: 'POST', headers: API._headers(), body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      return { error: true, message: 'Could not connect to server.' };
    }
  },
  put: async (path, body) => {
    try {
      const res = await fetch(API_BASE + path, {
        method: 'PUT', headers: API._headers(), body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      return { error: true, message: 'Could not connect to server.' };
    }
  },
  delete: async (path) => {
    try {
      const res = await fetch(API_BASE + path, { method: 'DELETE', headers: API._headers() });
      return await res.json();
    } catch (err) {
      return { error: true, message: 'Could not connect to server.' };
    }
  },
  upload: async (path, formData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      return await res.json();
    } catch (err) {
      return { error: true, message: 'Upload failed.' };
    }
  },
  _headers: () => {
    // Use adminToken for admin pages, regular token for others
    const adminToken = localStorage.getItem('adminToken');
    const token      = adminToken || localStorage.getItem('token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },
  getBase: () => API_BASE
};
