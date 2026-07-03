/**
 * `defineEnvVars` vocabulary for the apps' `src/env.ts`. Its own subpath (not the `/kit` barrel) on purpose:
 * the build evaluates `src/env.ts` to generate the `$app/env/*` modules, so this module must stay free of
 * heavyweight or side-effectful imports (the barrel pulls in the IdP client and the error reporter).
 *
 * Every var is `static: true` (build-time, inlined): the apps build their Effect runtime at module load, and
 * the remote-functions plugin loads those modules outside the request lifecycle, so values must be present
 * synchronously at import — dynamic (`static: false`) env isn't populated until `set_env` runs per request
 * and would read `undefined`.
 */
import * as S from 'effect/Schema';

/** A required server-side build-time var. */
export const req = { static: true } as const;
/** A client-exposed build-time var — importable from `$app/env/public`. */
export const pub = { static: true, public: true } as const;
/** Coerce + validate a numeric env string: "5432" → 5432 (rejects non-numeric). */
export const Port = S.toStandardSchemaV1(S.NumberFromString);
