/** Keep the browser on the Kakao app's registered localhost origin while testing a separate local Next server. */
export async function configureMapTestOrigin(context) {
  const backend = process.env.FOUNDY_TEST_WEB_UPSTREAM;
  if (!backend) return;
  const web = new URL(process.env.FOUNDY_URL || 'http://localhost:3000');
  const upstream = new URL(backend);
  const local = hostname => hostname === 'localhost' || hostname === '127.0.0.1';
  if (!local(web.hostname) || !local(upstream.hostname) || web.origin === upstream.origin) {
    throw new Error('Map test proxy requires two different local origins');
  }
  await context.route(url => url.origin === web.origin, async route => {
    const { pathname, search } = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(pathname + search, upstream).href });
    try {
      await route.fulfill({ response });
    } finally {
      await response.dispose();
    }
  });
}
