import { Context, Effect, Layer } from 'effect';
import { Postgres } from './postgres';
import type { UserSub, UserName } from '@polumeyv/lib/schemas';

/**
 * The one slice of the global `users` row every app reads and writes: the display name. Auth's account page and
 * the tenant apps' profile forms all go through this service, so the name columns keep a single owner. Everything
 * else on `users` is the auth server's business (its app-local `AuthUserRepository`).
 * A name is a single indexed point lookup — not worth caching, so it reads straight from Postgres.
 */
export class UsernameService extends Context.Service<UsernameService>()('UsernameService', {
	make: Effect.gen(function* () {
		const pg = yield* Postgres;
		return {
			getName: (sub: UserSub) => pg.one((sql) => sql<UserName[]>`SELECT f_name, l_name FROM users WHERE sub = ${sub}`),
			updateName: (sub: UserSub, data: UserName) => pg.use((sql) => sql`UPDATE users SET ${sql(data)} WHERE sub = ${sub}`),
		};
	}),
}) {
	static readonly layer = Layer.effect(this, this.make);
}
