/**
 * @module @polumeyv/lib/server/runtime
 *
 * Build a long-lived `ManagedRuntime` for a server app from its service `Layer`, applying the logging + shutdown
 * policy every app shares. Both dev and prod emit single-line JSON logs (`Logger.consoleJson`) to stdout — machine-
 * legible, pastable in dev and greppable in the journal in prod — so every `Effect.logError`/`logWarning` (notably
 * `makeRun`'s 5xx cause dump) actually lands somewhere. `Layer.empty` here previously meant prod had NO logger at all,
 * silently swallowing every server-side fault that flowed through the Effect boundary. Prod additionally registers
 * shutdown disposal so the `acquireRelease` finalizers (Postgres pool, Redis client) run on SIGTERM/SIGINT; dev skips
 * disposal on purpose — Vite owns the signals and re-imports this module on HMR, which would stack handlers onto stale
 * runtimes.
 */
import { Layer, Logger, ManagedRuntime } from 'effect';
import { disposeOnShutdown } from './shutdown';

export const makeManagedRuntime = <R, ER>(layer: Layer.Layer<R, ER>, dev: boolean): ManagedRuntime.ManagedRuntime<R, ER> => {
	const runtime = ManagedRuntime.make(Layer.provideMerge(layer, Logger.layer([Logger.consoleJson])));
	if (!dev) disposeOnShutdown(runtime);
	return runtime;
};
