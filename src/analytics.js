import {inject} from '@vercel/analytics';
import {sanitizePageview} from './analytics-privacy.js';

if (import.meta.env.PROD && sanitizePageview({type: 'pageview', url: location.href})) {
  inject({mode: 'production', beforeSend: sanitizePageview});
}
