import type { HandleServerError } from '@sveltejs/kit';
import { reportError } from '../server/error-reporter';

/**
 * The production `handleError` hook, shared by every app: adapt SvelteKit's hook input to `reportError`
 * (`[server-error]` journald marker + GitHub issue file/comment). This hook only sees throws that bypass the
 * Effect boundary (render-time crashes, raw throws) — `makeRun` already logs every 5xx that flows through it.
 * An empty `token` (dev .env) disables reporting. `report` exists as an injection seam for tests only.
 */
export const makeHandleServerError =
	({ repo, token, report = reportError }: { repo: string; token: string; report?: typeof reportError }): HandleServerError =>
	({ error, event, status }) => {
		if (!token) return;
		report({ repo, token, error, status, route: event.route.id, url: `${event.url.pathname}${event.url.search}` });
	};
