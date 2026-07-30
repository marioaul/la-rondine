import { describe, expect, it } from 'vitest';
import { getTomorrowDateString, groupNativeTokensByUser, groupSubscriptionsByUser } from '../src/push';

describe('getTomorrowDateString', () => {
  it('restituisce il giorno successivo in formato YYYY-MM-DD', () => {
    const now = new Date('2026-08-14T10:00:00Z');
    expect(getTomorrowDateString(now)).toBe('2026-08-15');
  });

  it('gestisce correttamente il cambio di mese', () => {
    const now = new Date('2026-08-31T23:00:00Z');
    expect(getTomorrowDateString(now)).toBe('2026-09-01');
  });
});

describe('groupSubscriptionsByUser', () => {
  it('raggruppa le iscrizioni per user_id', () => {
    const subs = [
      { id: '1', user_id: 'u1', endpoint: 'e1', p256dh: 'p1', auth: 'a1' },
      { id: '2', user_id: 'u1', endpoint: 'e2', p256dh: 'p2', auth: 'a2' },
      { id: '3', user_id: 'u2', endpoint: 'e3', p256dh: 'p3', auth: 'a3' },
    ];
    const grouped = groupSubscriptionsByUser(subs);
    expect(grouped.get('u1')).toHaveLength(2);
    expect(grouped.get('u2')).toHaveLength(1);
  });

  it('restituisce una mappa vuota per un array vuoto', () => {
    expect(groupSubscriptionsByUser([]).size).toBe(0);
  });
});

describe('groupNativeTokensByUser', () => {
  it('raggruppa i token nativi per user_id', () => {
    const tokens = [
      { id: '1', user_id: 'u1', token: 't1', platform: 'android' as const },
      { id: '2', user_id: 'u1', token: 't2', platform: 'ios' as const },
      { id: '3', user_id: 'u2', token: 't3', platform: 'android' as const },
    ];
    const grouped = groupNativeTokensByUser(tokens);
    expect(grouped.get('u1')).toHaveLength(2);
    expect(grouped.get('u2')).toHaveLength(1);
  });

  it('restituisce una mappa vuota per un array vuoto', () => {
    expect(groupNativeTokensByUser([]).size).toBe(0);
  });
});