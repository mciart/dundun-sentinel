// Wrapper for Pages Functions: delegate API handling to canonical backend implementation
import { handleAPI } from '../../../src/api.js';

export async function onRequest(context) {
  const { request, env } = context;
  return await handleAPI(request, env, context);
}
