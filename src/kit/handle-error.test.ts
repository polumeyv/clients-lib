import { describe, it, expect } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import { makeHandleServerError } from './handle-error';

const event = { route: { id: '/(app)/settings' }, url: new URL('https://app.example/settings?tab=danger') } as RequestEvent;

describe('makeHandleServerError', () => {
	it('adapts the hook input to reportError args (route id + path?search)', () => {
		const calls: unknown[] = [];
		const handler = makeHandleServerError({ repo: 'polumeyv/mono', token: 'tok', report: (o) => void calls.push(o) });
		const boom = new Error('boom');
		handler({ error: boom, event, status: 500, message: 'Internal Error' });
		expect(calls).toEqual([
			{ repo: 'polumeyv/mono', token: 'tok', error: boom, status: 500, route: '/(app)/settings', url: '/settings?tab=danger' },
		]);
	});

	it('an empty token (dev .env) disables reporting', () => {
		const calls: unknown[] = [];
		const handler = makeHandleServerError({ repo: 'polumeyv/mono', token: '', report: (o) => void calls.push(o) });
		handler({ error: new Error('x'), event, status: 500, message: '' });
		expect(calls).toEqual([]);
	});
});
