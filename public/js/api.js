// public/js/api.js
// API client with retry, error handling, and base URL config

const API_BASE = '/api';

class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min for TTS
  config.signal = controller.signal;

  // Retry logic for network errors
  const maxRetries = options.retries ?? 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      // Handle different response types
      const contentType = response.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('audio/') || options.responseType === 'arraybuffer') {
        data = await response.arrayBuffer();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new APIError(
          data?.error || `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry on client errors (4xx) or abort
      if (error instanceof APIError && error.status < 500) throw error;
      if (error.name === 'AbortError') throw new APIError('La petición tardó demasiado', 408);
      if (error.name === 'TypeError' && error.message.includes('fetch')) throw new APIError('Sin conexión al servidor', 0);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, {
    ...options,
    method: 'POST',
    body: options.responseType ? body : JSON.stringify(body),
  }),
  put: (endpoint, body, options = {}) => request(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};

export { APIError };
export default api;