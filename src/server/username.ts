import { Effect } from 'effect';
import { Postgres } from './postgres';
import type { UserSub, UserName } from '@polumeyv/lib/schemas';

/**
 * The one `users` read every app shares: the display name. A plain function over the ambient `Postgres` — not a
 * service, because there is exactly one query and no state or invariant to own. Writing the name is
 * auth-server-only (`AuthUserRepository.updateName`, app-local there); tenant apps display the name and link out
 * to the auth app's settings to change it. A name is a single indexed point lookup — not worth caching.
 */
export const getUserName = (sub: UserSub) =>
	Effect.flatMap(Postgres, (pg) => pg.one((sql) => sql<UserName[]>`SELECT f_name, l_name FROM users WHERE sub = ${sub}`));
