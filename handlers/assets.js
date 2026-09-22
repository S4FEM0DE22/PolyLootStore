import { json, method, fail } from '../lib/http.js';
import { listAssets } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'GET');
    return json({ assets: (await listAssets()).map(({ file, ...asset }) => asset), demoOnly: true });
  } catch (error) { return fail(error); }
} };
