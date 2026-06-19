export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const key = url.searchParams.get('key');
      const value = url.searchParams.get('value');

      // wrangler.jsonc에 맞춘 'KV' 바인딩 사용
      const kvNamespace = env.KV; 

      if (!kvNamespace) {
        return new Response("KV 바인딩을 찾을 수 없습니다.", { status: 500 });
      }

      if (key && value) {
        await kvNamespace.put(key, value);
        return new Response(`Successfully stored [${key} = ${value}]`);
      }

      if (key) {
        const storedValue = await kvNamespace.get(key);
        if (storedValue === null) {
          return new Response("Value not found", { status: 404 });
        }
        return new Response(storedValue);
      }

      return new Response("Please provide ?key=... or ?key=...&value=...");
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
};
