import { describe, it, expect } from 'bun:test';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { makeRun } from './index';
import { HttpError, Unauthorized } from '../error';
import type { reportError } from '../server/error-reporter';

const runtime = ManagedRuntime.make(Layer.empty);
type Reported = Parameters<typeof reportError>[0];

describe('makeRun issues sink', () => {
	it('a 5xx files the issue and the report carries a correlating id', async () => {
		const calls: Reported[] = [];
		const run = makeRun(runtime, { issues: { repo: 'polumeyv/mono', token: 'tok' }, report: (o) => void calls.push(o) });
		await expect(run(Effect.fail(new HttpError({ status: 500, message: 'boom' })))).rejects.toMatchObject({ status: 500 });
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ repo: 'polumeyv/mono', token: 'tok', status: 500, route: null, url: '' });
		expect(typeof calls[0]!.id).toBe('string');
	});

	it('4xx never report — the boundary logs them, issues are for server faults', async () => {
		const calls: Reported[] = [];
		const run = makeRun(runtime, { issues: { repo: 'polumeyv/mono', token: 'tok' }, report: (o) => void calls.push(o) });
		await expect(run(Effect.fail(new Unauthorized()))).rejects.toMatchObject({ status: 401 });
		expect(calls).toEqual([]);
	});

	it('an empty token (dev .env) disables the sink', async () => {
		const calls: Reported[] = [];
		const run = makeRun(runtime, { issues: { repo: 'polumeyv/mono', token: '' }, report: (o) => void calls.push(o) });
		await expect(run(Effect.fail(new HttpError({ status: 500, message: 'boom' })))).rejects.toMatchObject({ status: 500 });
		expect(calls).toEqual([]);
	});
});
