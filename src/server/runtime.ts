/**
 * @module @polumeyv/lib/server/runtime
 *
 * Build a long-lived `ManagedRuntime` for a server app from its service `Layer`, applying the logging + shutdown
 * policy every app shares. Prod emits single-line JSON (`Logger.formatJson`, Error/Fatal routed to stderr) — greppable
 * in the journal; dev emits human-readable pretty lines (`Logger.consolePretty`) so the terminal is legible while
 * `Debug` level is on. Either way every `Effect.logError`/`logWarning` (notably `makeRun`'s 5xx cause dump) actually
 * lands somewhere. `Layer.empty` here previously meant prod had NO logger at all,
 * silently swallowing every server-side fault that flowed through the Effect boundary. Prod additionally registers
 * shutdown disposal so the `acquireRelease` finalizers (Postgres pool, Redis client) run on SIGTERM/SIGINT; dev skips
 * disposal on purpose — Vite owns the signals and re-imports this module on HMR, which would stack handlers onto stale
 * runtimes.
 */
import { Layer, Logger, ManagedRuntime, References } from 'effect';
import { disposeOnShutdown } from './shutdown';

// Prod: one structured JSON line per entry, routed by severity — Error/Fatal → stderr, the rest → stdout (both
// captured by journald, so `journalctl -p err` isolates faults). Dev: pretty console lines. Minimum level gates the
// volume — Debug in dev, Info in prod.
const LoggerLayer = (dev: boolean) =>
	Logger.layer([dev ? Logger.consolePretty() : Logger.withLeveledConsole(Logger.formatJson)]).pipe(
		Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, dev ? 'Debug' : 'Info')),
	);

export const makeManagedRuntime = <R, ER>(layer: Layer.Layer<R, ER>, dev: boolean): ManagedRuntime.ManagedRuntime<R, ER> => {
	const runtime = ManagedRuntime.make(Layer.provideMerge(layer, LoggerLayer(dev)));
	if (!dev) disposeOnShutdown(runtime);
	return runtime;
};
