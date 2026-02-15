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

  constructor() {
    const url = Deno.env.get("WP_BASE_URL");
    const user = Deno.env.get("WP_USERNAME");
    const pass = Deno.env.get("WP_APP_PASSWORD");
    if (!url || !user || !pass) {
      throw new Error("WordPress credentials not configured (WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD)");
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
  }

  private async request(
    method: string,
    endpoint: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<any> {
    await acquireSlot();
    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const headers: Record<string, string> = {
        Authorization: this.authHeader,
      };
      const init: RequestInit = { method, headers };

      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }

      const res = await fetch(url.toString(), init);
      const text = await res.text();

      if (!res.ok) {
        // Try to extract WP error message
        try {
          const err = JSON.parse(text);
          throw new Error(`WP API ${res.status}: ${err.message || text}`);
        } catch {
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

  async updatePost(id: string, data: Record<string, unknown>) {
    return this.put(`/posts/${id}`, data);
  }

  async updatePage(id: string, data: Record<string, unknown>) {
    return this.put(`/pages/${id}`, data);
  }

  // ─── Convenience: WooCommerce REST API ───

  private wcBase(): string {
    // WooCommerce uses a different base path
    // WP_BASE_URL is like https://rebar.shop/wp-json/wp/v2
    // We need https://rebar.shop/wp-json/wc/v3
    return this.baseUrl.replace(/\/wp\/v2\/?$/, "/wc/v3");
  }

  async listProducts(params: Record<string, string> = {}) {
    try {
      return await this.get(
        this.baseUrl.replace(/\/wp\/v2\/?$/, "") ? `/wc/v3/products` : `/wc/v3/products`,
        { per_page: "20", ...params },
      );
    } catch (e: any) {
      if (e.message?.includes("404") || e.message?.includes("rest_no_route")) {
        return { error: "WooCommerce not available on this site" };
      }
      throw e;
    }
  }

  async listOrders(params: Record<string, string> = {}) {
    try {
      return await this.get(`/wc/v3/orders`, { per_page: "20", ...params });
    } catch (e: any) {
      if (e.message?.includes("404") || e.message?.includes("rest_no_route")) {
        return { error: "WooCommerce not available on this site" };
      }
      throw e;
    }
  }

  async getProduct(id: string) {
    return this.get(`/wc/v3/products/${id}`);
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    return this.put(`/wc/v3/products/${id}`, data);
  }

  async getOrder(id: string) {
    return this.get(`/wc/v3/orders/${id}`);
  }

  async updateOrder(id: string, data: Record<string, unknown>) {
    return this.put(`/wc/v3/orders/${id}`, data);
  }
}
