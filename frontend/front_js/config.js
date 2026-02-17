/**
 * API Configuration
 * Supports both development (same-origin) and production (cross-origin)
 */

(function () {
  // Default to same-origin (relative paths work if frontend and backend share host)
  // In production (Netlify + Render), set window.API_BASE_URL before loading app
  // OR set it via data attribute on script tag: <script data-api-base="https://..."></script>

  let apiBase = '/api';

  // 1. Check for explicitly set window.API_BASE_URL (highest priority)
  if (typeof window !== 'undefined' && window.API_BASE_URL) {
    apiBase = window.API_BASE_URL;
  }
  // 2. Check for environment variable (injected at build time via HTML meta tag)
  else if (typeof window !== 'undefined' && window.__API_BASE__) {
    apiBase = window.__API_BASE__;
  }
  // 3. Check for data attribute on script tag (if loaded with one)
  else if (typeof window !== 'undefined' && document.currentScript?.dataset?.apiBase) {
    apiBase = document.currentScript.dataset.apiBase;
  }

  window.API_BASE_URL = apiBase;

  // Helper function for constructing API URLs
  window.getApiUrl = function (endpoint) {
    const base = window.API_BASE_URL;
    // Ensure endpoint starts with /
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return base + path;
  };

  console.log('API base URL set to:', window.API_BASE_URL);
})();
