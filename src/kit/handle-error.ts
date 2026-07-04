import type { HandleServerError } from '@sveltejs/kit';
import { Cause, Effect, type ManagedRuntime } from 'effect';
import { reportError } from '../server/error-reporter';

/**
 * The `handleError` hook, shared by every app. This hook only sees throws that bypass the Effect boundary
 * (render-time crashes, raw throws) — `makeRun` already logs every 5xx that flows through it. Two sinks:
 *
 * - the journal, always: a structured `Effect.logError` through the app's runtime, annotated
 *   `{ source: 'render', id, status, route, url }`, so render crashes read like every other fault;
 * - GitHub issues in prod: `reportError` files/comments a deduped issue carrying the same `id` so a journal
 *   line and its issue correlate. An empty `token` (dev .env) disables that sink. `report` is a test seam.
 *
 * 404s are skipped entirely — an unmatched path is bot noise, not a fault (in-route 4xx never land here).
 */
export const makeHandleServerError =
	({
		repo,
		token,
		runtime,
		report = reportError,
	}: {
		repo: string;
		token: string;
		runtime: ManagedRuntime.ManagedRuntime<any, any>;
		report?: typeof reportError;
	}): HandleServerError =>
	({ error, event, status }) => {
		if (status === 404) return;
		const id = Bun.randomUUIDv7();
		const url = `${event.url.pathname}${event.url.search}`;
		runtime.runFork(
			Effect.annotateLogs(Effect.logError('unhandled render error', Cause.die(error)), {
				source: 'render',
				id,
				status,
				route: event.route.id,
				url,
			}),
		);
		if (!token) return;
		report({ repo, token, error, status, route: event.route.id, url, id });
	};
