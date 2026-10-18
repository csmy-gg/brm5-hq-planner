const PUBLIC_ORIGIN = 'https://brm5-hq-planner.vercel.app';
const PUBLIC_PATHS = new Set(['/', '/index.html']);

// Only public planner page views leave the browser. Never send callback codes,
// query strings, fragments, profile data or custom event properties.
export function sanitizePageview(event) {
  if (event?.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (url.origin !== PUBLIC_ORIGIN || !PUBLIC_PATHS.has(url.pathname)) return null;
    return {type: 'pageview', url: url.origin + url.pathname};
  } catch {
    return null;
  }
}
