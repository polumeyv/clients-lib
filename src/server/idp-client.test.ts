import { describe, it, expect } from 'bun:test';
import { Cause, Effect, Exit } from 'effect';
import type { Cookies } from '@sveltejs/kit';
import { Redirect } from '../error';
import { IdpClient, sessionCookiePolicy } from './idp-client';

// The cookie policy is the point of the centralization: per-app copies are how the dashboard once shipped with the
// access/refresh maxAges swapped (15-minute refresh cookie → silent OAuth round-trip every navigation). Pin the
// names, paths and TTLs so a drift is a failing test, not a prod incident.
describe('sessionCookiePolicy', () => {
	it('access_token: path /, 15 minutes', () => expect(sessionCookiePolicy.access_token).toEqual({ path: '/', maxAge: 900 }));
	it('refresh_token: path /, 90 days', () => expect(sessionCookiePolicy.refresh_token).toEqual({ path: '/', maxAge: 7_776_000 }));
	it('pkce_ver: scoped to the callback route, 10 minutes', () => expect(sessionCookiePolicy.pkce_ver).toEqual({ path: '/oauth2/callback', maxAge: 600 }));
});

describe('handleCallback', () => {
	it('fails with a clear sign-in-again error when the pkce_ver cookie is absent', async () => {
		const deleted: string[] = [];
		const jar: Cookies = { get: () => undefined, getAll: () => [], set: () => {}, delete: (name) => void deleted.push(name), serialize: () => '' };
		// Discovery is lazy, and the missing-verifier guard fires before any exchange — no IdP needed.
		const exit = await Effect.runPromiseExit(
			Effect.andThen(IdpClient, (idp) => idp.handleCallback(new URL('https://app.example/oauth2/callback?code=x'), () => Effect.void)).pipe(
				Effect.provide(
					IdpClient.layer({
						publicAuthUrl: new URL('http://localhost:9'),
						clientId: 'test_client',
						clientSecret: 'test_secret',
						redirectUri: 'https://app.example/oauth2/callback',
						postLogoutRedirectUri: 'https://app.example',
						cookies: () => jar,
					}),
				),
			),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const squashed = Cause.squash(exit.cause);
			expect(squashed).toBeInstanceOf(Cause.IllegalArgumentError);
			expect((squashed as Error).message).toBe('Missing session verifier. Please sign in again.');
		}
		// The guard must fail before touching any cookie — nothing to consume, nothing to delete.
		expect(deleted).toEqual([]);
	});
});

// Sign-out is a Redirect-terminated choreography: best-effort revoke → clear both token cookies (policy paths) →
// 303 to the IdP's /oauth2/logout with the configured post_logout_redirect_uri. The load-bearing contract pinned
// here: an unreachable/failing IdP must never trap the user in a session they asked to leave.
describe('logout', () => {
	const makeJar = (refreshToken?: string) => {
		const deleted: { name: string; path: string }[] = [];
		const jar: Cookies = {
			get: (name) => (name === 'refresh_token' ? refreshToken : undefined),
			getAll: () => [],
			set: () => {},
			delete: (name, opts) => void deleted.push({ name, path: opts.path }),
			serialize: () => '',
		};
		return { jar, deleted };
	};

	const runLogout = (jar: Cookies, authUrl: string) =>
		Effect.runPromiseExit(
			Effect.andThen(IdpClient, (idp) => idp.logout).pipe(
				Effect.provide(
					IdpClient.layer({
						publicAuthUrl: new URL(authUrl),
						clientId: 'test_client',
						clientSecret: 'test_secret',
						redirectUri: 'https://app.example/oauth2/callback',
						postLogoutRedirectUri: 'https://app.example',
						cookies: () => jar,
					}),
				),
			),
		);

	const expectClearedAndRedirected = (exit: Exit.Exit<unknown, unknown>, deleted: { name: string; path: string }[], authUrl: string) => {
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const squashed = Cause.squash(exit.cause);
			expect(squashed).toBeInstanceOf(Redirect);
			const redirect = squashed as Redirect;
			expect(redirect.status).toBe(303);
			expect(redirect.location.toString()).toBe(`${authUrl}/oauth2/logout?post_logout_redirect_uri=https%3A%2F%2Fapp.example`);
		}
		expect(deleted).toEqual([
			{ name: 'access_token', path: sessionCookiePolicy.access_token.path },
			{ name: 'refresh_token', path: sessionCookiePolicy.refresh_token.path },
		]);
	};

	it('with no refresh cookie: skips revocation, clears both token cookies, 303s to the IdP logout', async () => {
		const { jar, deleted } = makeJar();
		// No token → no revoke → no discovery: works (fast) with an unreachable IdP URL.
		expectClearedAndRedirected(await runLogout(jar, 'http://localhost:9'), deleted, 'http://localhost:9');
	});

	// A local one-shot IdP (discovery + revocation) so revoke's request is real, not a hand-written twin.
	const serveIdp = (onRevoke: (body: URLSearchParams) => Response) =>
		Bun.serve({
			port: 0,
			fetch: async (req) => {
				const url = new URL(req.url);
				if (url.pathname === '/.well-known/oauth-authorization-server')
					return Response.json({
						issuer: url.origin,
						authorization_endpoint: `${url.origin}/oauth2/authorize`,
						jwks_uri: `${url.origin}/jwks`,
						revocation_endpoint: `${url.origin}/oauth2/revoke`,
					});
				if (url.pathname === '/oauth2/revoke') return onRevoke(new URLSearchParams(await req.text()));
				return new Response(null, { status: 404 });
			},
		});

	it('with a refresh cookie: revokes that token at the IdP, then clears and 303s', async () => {
		const revoked: URLSearchParams[] = [];
		const server = serveIdp((body) => (revoked.push(body), new Response(null, { status: 200 })));
		try {
			const authUrl = `http://localhost:${server.port}`;
			const { jar, deleted } = makeJar('rt_1');
			expectClearedAndRedirected(await runLogout(jar, authUrl), deleted, authUrl);
			expect(revoked).toHaveLength(1);
			expect(revoked[0]?.get('token')).toBe('rt_1');
			expect(revoked[0]?.get('client_id')).toBe('test_client');
		} finally {
			server.stop(true);
		}
	});

	it('revocation failure is swallowed: the user is still signed out and redirected', async () => {
		const server = serveIdp(() => new Response(null, { status: 500 }));
		try {
			const authUrl = `http://localhost:${server.port}`;
			const { jar, deleted } = makeJar('rt_1');
			expectClearedAndRedirected(await runLogout(jar, authUrl), deleted, authUrl);
		} finally {
			server.stop(true);
		}
	});
});
