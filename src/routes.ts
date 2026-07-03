/**
 * The auth server's published page surface — every path another app (or this lib itself) links on the
 * polumeyv auth origin. The auth app asserts each entry against its generated route tree
 * (`src/lib/auth-routes.check.ts`, `satisfies Pathname`), so renaming a route over there breaks `check`
 * before it can 404 a tenant link. Build links as `${PUBLIC_AUTH_POLUMEYV_URL}${AUTH_ROUTES.account}` —
 * never hand-spell an auth path outside this map.
 */
export const AUTH_ROUTES = {
	/** Account management (name, email, security) — the tenant "Manage account" link-out target. */
	account: '/account',
	/** IdP sign-out; reached via native form POST only (see IdpClient.logout). */
	oauth2Logout: '/oauth2/logout',
} as const;
