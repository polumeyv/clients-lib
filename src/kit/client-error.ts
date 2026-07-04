import type { RequestHandler } from '@sveltejs/kit';
import { Effect, type ManagedRuntime } from 'effect';

/**
 * Sink for client-side crashes. A hydration/render fault happens in the browser and never reaches the server logs,
 * so `hooks.client.ts` beacons it here via `reportClientError`. The fault lands in the journal as a structured
 * `Effect.logError` annotated `{ source: 'client', url, status, message, stack, detail }` — same shape as every
 * server fault, so `journalctl -p err` and the `"level":"ERROR"` grep see client crashes too.
 *
 * Mount per app as `routes/(server)/client-error/+server.ts`:
 * `export const POST = makeClientErrorEndpoint(AppRuntime);`
 */
export const makeClientErrorEndpoint = (runtime: ManagedRuntime.ManagedRuntime<any, any>): RequestHandler => {
	return async ({ request }) => {
		const payload = (await request.json().catch(() => ({}))) as {
			message?: string;
			stack?: string;
			detail?: string;
			url?: string;
			status?: number;
		};
		runtime.runFork(
			Effect.annotateLogs(Effect.logError('client error'), {
				source: 'client',
				url: payload.url,
				status: payload.status,
				message: payload.message,
				stack: payload.stack,
				detail: payload.detail,
			}),
		);
		return new Response(null, { status: 204 });
	};
};
