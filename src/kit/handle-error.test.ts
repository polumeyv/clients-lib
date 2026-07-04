import { describe, it, expect } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import type { Effect, ManagedRuntime } from 'effect';
import { makeHandleServerError } from './handle-error';

const event = { route: { id: '/(app)/settings' }, url: new URL('https://app.example/settings?tab=danger') } as RequestEvent;

/** Capture what the adapter forks at the journal instead of running it. */
const stubRuntime = (forked: Effect.Effect<unknown, unknown, never>[]) =>
	({ runFork: (e: Effect.Effect<unknown, unknown, never>) => void forked.push(e) }) as unknown as ManagedRuntime.ManagedRuntime<any, any>;

describe('makeHandleServerError', () => {
	it('adapts the hook input to reportError args (route id + path?search) and correlates via id', () => {
		const calls: Array<Record<string, unknown>> = [];
		const forked: Effect.Effect<unknown, unknown, never>[] = [];
		const handler = makeHandleServerError({
			repo: 'polumeyv/mono',
			token: 'tok',
			runtime: stubRuntime(forked),
			report: (o) => void calls.push(o),
		});
		const boom = new Error('boom');
		handler({ error: boom, event, status: 500, message: 'Internal Error' });
		expect(calls).toEqual([
			{
				repo: 'polumeyv/mono',
				token: 'tok',
				error: boom,
				status: 500,
				route: '/(app)/settings',
				url: '/settings?tab=danger',
				id: expect.any(String),
			},
		]);
		expect(forked).toHaveLength(1); // the structured journal line
	});

	it('an empty token (dev .env) disables the issue sink but still journals', () => {
		const calls: unknown[] = [];
		const forked: Effect.Effect<unknown, unknown, never>[] = [];
		const handler = makeHandleServerError({ repo: 'polumeyv/mono', token: '', runtime: stubRuntime(forked), report: (o) => void calls.push(o) });
		handler({ error: new Error('x'), event, status: 500, message: '' });
		expect(calls).toEqual([]);
		expect(forked).toHaveLength(1);
	});

	it('skips 404s entirely (unmatched-path bot noise): no journal line, no issue', () => {
		const calls: unknown[] = [];
		const forked: Effect.Effect<unknown, unknown, never>[] = [];
		const handler = makeHandleServerError({ repo: 'polumeyv/mono', token: 'tok', runtime: stubRuntime(forked), report: (o) => void calls.push(o) });
		handler({ error: new Error('Not found'), event, status: 404, message: 'Not Found' });
		expect(calls).toEqual([]);
		expect(forked).toEqual([]);
	});
});
