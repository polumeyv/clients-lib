/**
 * Browser-side beacon for client faults. Deliberately dependency-free (no effect, no kit) so importing it from
 * `hooks.client.ts` adds nothing to the client bundle. Pairs with `makeClientErrorEndpoint` — every app mounts the
 * receiving POST at `/client-error`.
 */

/** Beacon a client fault to the server so it lands in the journal. Never throws. */
export function reportClientError(error: unknown, url: string, status?: number) {
	const e = Error.isError(error) ? error : undefined;
	// A non-Error throw (e.g. a SvelteKit `{ status, body }` or a plain object) stringifies to "[object Object]" and
	// hides everything; capture its own properties instead so the journal shows the actual payload.
	let detail: string | undefined;
	if (!e) {
		try {
			detail = JSON.stringify(error, Object.getOwnPropertyNames(Object(error) as object)).slice(0, 1000);
		} catch {
			detail = String(error);
		}
	}
	try {
		const body = JSON.stringify({ message: e?.message ?? detail ?? String(error), stack: e?.stack, detail, url, status });
		navigator.sendBeacon('/client-error', new Blob([body], { type: 'application/json' }));
	} catch {
		// reporting must never mask the original failure
	}
}
