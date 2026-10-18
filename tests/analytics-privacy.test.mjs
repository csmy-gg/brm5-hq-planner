import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePageview} from '../src/analytics-privacy.js';

test('analytics strips credentials, query strings, fragments and extra data from page views', () => {
  const event = {type: 'pageview', url: 'https://user:secret@brm5-hq-planner.vercel.app/?code=private&email=player@example.com#access_token=secret', profile: {cash: 123}};
  const original = structuredClone(event);
  assert.deepEqual(sanitizePageview(event), {type: 'pageview', url: 'https://brm5-hq-planner.vercel.app/'});
  assert.deepEqual(event, original);
});

test('analytics excludes sign-in callbacks, unknown paths, previews and local development', () => {
  for (const url of [
    'https://brm5-hq-planner.vercel.app/auth/callback?code=private',
    'https://brm5-hq-planner.vercel.app/account/player',
    'https://preview.vercel.app/', 'http://localhost:5173/', 'invalid'
  ]) assert.equal(sanitizePageview({type: 'pageview', url}), null);
});

test('analytics rejects custom events and accepts public planner loads', () => {
  assert.equal(sanitizePageview({type: 'event', url: 'https://brm5-hq-planner.vercel.app/'}), null);
  assert.equal(sanitizePageview(null), null);
  assert.deepEqual(sanitizePageview({type: 'pageview', url: 'https://brm5-hq-planner.vercel.app/index.html#research'}), {type: 'pageview', url: 'https://brm5-hq-planner.vercel.app/index.html'});
});
