/**
 * WordPress / WooCommerce REST API client for rebar.shop
 * Reads credentials from environment variables.
 * Provides typed GET / POST / PUT / DELETE with Basic Auth,
 * concurrency throttle, and error formatting.
 */

const MAX_CONCURRENT = 5;
let activeRequests = 0;
const queue: Array<{ resolve: () => void }> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push({ resolve }));
}

function releaseSlot() {
  activeRequests--;
  if (queue.length > 0) {
    activeRequests++;
    queue.shift()!.resolve();
  }
}

export class WPClient {
  private baseUrl: string;
  private authHeader: string;
  private wcConsumerKey: string | null;
  private wcConsumerSecret: string | null;

  constructor() {
    const url = Deno.env.get("WP_BASE_URL");
    const user = Deno.env.get("WP_USERNAME");
    const pass = Deno.env.get("WP_APP_PASSWORD");
    if (!url || !user || !pass) {
      throw new Error("WordPress credentials not configured (WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD)");
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
    this.wcConsumerKey = Deno.env.get("WC_CONSUMER_KEY") || null;
    this.wcConsumerSecret = Deno.env.get("WC_CONSUMER_SECRET") || null;
  }

  private isWcEndpoint(endpoint: string): boolean {
    return endpoint.startsWith("/wc/v3");
  }

  private async request(
    method: string,
    endpoint: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<any> {
    await acquireSlot();
    try {
      // WC endpoints use a different base: /wp-json/wc/v3 instead of /wp-json/wp/v2
      const base = this.isWcEndpoint(endpoint)
        ? this.baseUrl.replace(/\/wp\/v2\/?$/, "")
        : this.baseUrl;
      const url = new URL(`${base}${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const useWcAuth = this.isWcEndpoint(endpoint) && this.wcConsumerKey && this.wcConsumerSecret;

      const headers: Record<string, string> = {};
      if (useWcAuth) {
        url.searchParams.set("consumer_key", this.wcConsumerKey!);
        url.searchParams.set("consumer_secret", this.wcConsumerSecret!);
      } else {
        headers.Authorization = this.authHeader;
      }
      const init: RequestInit = { method, headers };

      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }

      let res = await fetch(url.toString(), init);

      // Fallback: if WC auth failed with 401, retry with Basic Auth
      if (useWcAuth && res.status === 401) {
        console.warn("WC consumer key auth failed (401), retrying with Basic Auth...");
        const fallbackUrl = new URL(`${base}${endpoint}`);
        if (params) {
          Object.entries(params).forEach(([k, v]) => fallbackUrl.searchParams.set(k, v));
        }
        const fallbackHeaders: Record<string, string> = { Authorization: this.authHeader };
        if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
          fallbackHeaders["Content-Type"] = "application/json";
        }
        res = await fetch(fallbackUrl.toString(), {
          method,
          headers: fallbackHeaders,
          body: init.body,
        });
      }

      const text = await res.text();

      if (!res.ok) {
        // Try to extract WP error message
        try {
          const err = JSON.parse(text);
          throw new Error(`WP API ${res.status}: ${err.message || text}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("WP API")) throw e;
          throw new Error(`WP API ${res.status}: ${text.slice(0, 300)}`);
        }
      }

      return text ? JSON.parse(text) : null;
    } finally {
      releaseSlot();
    }
  }

  /** GET with optional query params */
  async get(endpoint: string, params?: Record<string, string>) {
    return this.request("GET", endpoint, params);
  }

  /** POST with JSON body */
  async post(endpoint: string, body: Record<string, unknown>) {
    return this.request("POST", endpoint, undefined, body);
  }

  /** PUT with JSON body */
  async put(endpoint: string, body: Record<string, unknown>) {
    return this.request("PUT", endpoint, undefined, body);
  }

  /** DELETE */
  async delete(endpoint: string, params?: Record<string, string>) {
    return this.request("DELETE", endpoint, params);
  }

  // ─── Convenience: WordPress REST API ───

  async listPosts(params: Record<string, string> = {}) {
    return this.get("/posts", { per_page: "20", ...params });
  }

  async listPages(params: Record<string, string> = {}) {
    return this.get("/pages", { per_page: "20", ...params });
  }

  async getPost(id: string) {
    return this.get(`/posts/${id}`);
  }

  async getPage(id: string) {
    return this.get(`/pages/${id}`);
  }

  async createPost(data: Record<string, unknown>) {
    return this.post("/posts", data);
  }

  async updatePost(id: string, data: Record<string, unknown>) {
    return this.put(`/posts/${id}`, data);
  }

  async updatePage(id: string, data: Record<string, unknown>) {
    return this.put(`/pages/${id}`, data);
  }

  // ─── Convenience: WooCommerce REST API ───

  async listProducts(params: Record<string, string> = {}) {
    return this.get(`/wc/v3/products`, { per_page: "20", ...params });
  }

  async listOrders(params: Record<string, string> = {}) {
    return this.get(`/wc/v3/orders`, { per_page: "20", ...params });
  }

  async getProduct(id: string) {
    return this.get(`/wc/v3/products/${id}`);
  }

  async createProduct(data: Record<string, unknown>) {
    return this.post(`/wc/v3/products`, data);
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    return this.put(`/wc/v3/products/${id}`, data);
  }

  async deleteProduct(id: string, force = false) {
    return this.delete(`/wc/v3/products/${id}`, force ? { force: "true" } : {});
  }

  async getOrder(id: string) {
    return this.get(`/wc/v3/orders/${id}`);
  }

  async updateOrder(id: string, data: Record<string, unknown>) {
    return this.put(`/wc/v3/orders/${id}`, data);
  }
}
