export default function useSafeFetch() {
  async function safeFetch(url, fallback, timeout = 2000) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch {
      return fallback;
    }
  }

  return safeFetch;
}
