/**
 * Form validation (src/lib/validation.ts).
 *
 * The messages are the ones the auth screens and Add plant show under a field,
 * so both the boundary conditions and the wording are asserted: a message the
 * user cannot act on is a bug.
 */

import { amountIssue, emailIssue, nicknameIssue, passwordIssue } from '../validation';

describe('emailIssue', () => {
  it('accepts ordinary addresses, including plus and subdomains', () => {
    expect(emailIssue('alex@leafcare.app')).toBeNull();
    expect(emailIssue('alex.morgan+plants@mail.example.co.uk')).toBeNull();
  });

  it('trims surrounding whitespace before judging', () => {
    expect(emailIssue('  alex@leafcare.app  ')).toBeNull();
  });

  it('asks for an address when the field is empty', () => {
    expect(emailIssue('')).toBe('Enter your email address.');
    expect(emailIssue('   ')).toBe('Enter your email address.');
  });

  it('rejects malformed addresses', () => {
    expect(emailIssue('alex')).toBe('That email address does not look right.');
    expect(emailIssue('alex@leafcare')).toBe('That email address does not look right.');
    expect(emailIssue('alex leaf@mail.com')).toBe('That email address does not look right.');
    expect(emailIssue('alex@mail.c')).toBe('That email address does not look right.');
  });
});

describe('passwordIssue', () => {
  it('requires eight characters', () => {
    expect(passwordIssue('1234567')).toBe('Use at least 8 characters.');
    expect(passwordIssue('12345678')).toBeNull();
  });

  it('asks for a password when the field is empty', () => {
    expect(passwordIssue('')).toBe('Enter a password.');
  });
});

describe('nicknameIssue', () => {
  it('accepts a normal nickname, trimmed', () => {
    expect(nicknameIssue('Ficus')).toBeNull();
    expect(nicknameIssue('  Monstera  ')).toBeNull();
  });

  it('requires a nickname and caps it at 60 characters', () => {
    expect(nicknameIssue('   ')).toBe('Give your plant a nickname.');
    expect(nicknameIssue('a'.repeat(60))).toBeNull();
    expect(nicknameIssue('a'.repeat(61))).toBe('Nicknames are limited to 60 characters.');
  });
});

describe('amountIssue', () => {
  it('treats an empty amount as "not recorded"', () => {
    expect(amountIssue('')).toBeNull();
    expect(amountIssue('   ')).toBeNull();
  });

  it('accepts the documented range', () => {
    expect(amountIssue('0')).toBeNull();
    expect(amountIssue('250')).toBeNull();
    expect(amountIssue('5000')).toBeNull();
  });

  it('rejects values outside the range and non-numbers', () => {
    const message = 'Enter an amount between 0 and 5000 ml.';
    expect(amountIssue('5001')).toBe(message);
    expect(amountIssue('-1')).toBe(message);
    expect(amountIssue('a lot')).toBe(message);
    expect(amountIssue('Infinity')).toBe(message);
  });
});
