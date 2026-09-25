import { describe, expect, it } from 'vitest';
import { friendlyError, PERMISSION_MESSAGE } from './supabase';
import { redact } from './observability';

describe('friendlyError', () => {
  it('never shows raw row-level-security or permission errors', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "payments"', code: '42501' })).toBe(PERMISSION_MESSAGE);
    expect(friendlyError({ message: 'permission denied for function fn_notify', code: '42501' })).toBe(PERMISSION_MESSAGE);
    expect(friendlyError({ message: 'not authorised', code: '42501' })).toBe(PERMISSION_MESSAGE);
  });

  it('hides Postgres internals behind safe messages', () => {
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "payments_receipt_number_key"', code: '23505' })).toBe('This has already been recorded.');
    expect(friendlyError({ message: 'insert or update on table "payments" violates foreign key constraint', code: '23503' })).toMatch(/linked to other records/);
    expect(friendlyError({ message: 'invalid input syntax for type uuid: "abc"', code: '22P02' })).toMatch(/not valid/);
    expect(friendlyError({ message: 'column "id_number" does not exist', code: '42703' })).toMatch(/Something went wrong/);
    expect(friendlyError({ message: 'Could not find the function public.x in the schema cache', code: 'PGRST202' })).toMatch(/not available yet/);
  });

  it('keeps MCSLI business-rule messages, which are written for people', () => {
    expect(friendlyError({ message: 'payment date cannot be in the future', code: '22023' })).toBe('Payment date cannot be in the future');
    expect(friendlyError({ message: 'A Ugandan NIN has 14 characters', code: '22023' })).toBe('A Ugandan NIN has 14 characters');
    expect(friendlyError({ message: 'Too many verification requests. Please wait a few minutes and try again.', code: 'P0001' })).toMatch(/^Too many verification requests/);
  });

  it('maps auth errors', () => {
    expect(friendlyError({ message: 'Invalid login credentials' })).toBe('Incorrect e-mail or password.');
    expect(friendlyError({ message: 'Email not confirmed' })).toMatch(/confirm your e-mail/);
    expect(friendlyError({ message: 'For security purposes, you can only request this after 60 seconds.' })).toMatch(/Too many attempts/);
  });
});

describe('redact', () => {
  it('removes identification numbers, e-mails, phone numbers and tokens', () => {
    const out = redact('NIN CM12345678ABCD for jane@example.com +256 701 806 993 token eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl');
    expect(out).not.toMatch(/CM12345678ABCD|jane@example.com|701 806 993|eyJhbGciOi/);
  });
});
