import { getStore } from '@netlify/blobs';
import { makeHandler } from './handler.mjs';
export default makeHandler(() => getStore({ name: 'catanduanes', consistency: 'strong' }), process.env);
