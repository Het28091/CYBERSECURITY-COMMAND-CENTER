#!/usr/bin/env bun
import { redact } from '../src/lib/cyber/security/redact';

function assert(name: string, actual: string, expected: string) {
  if (actual !== expected) { console.error(`FAIL: ${name}\n  expected: ${expected}\n  actual:   ${actual}`); process.exit(1); }
  console.log(`PASS: ${name}`);
}

// Build inputs at runtime so they don't get redacted by any static scan.
const awsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
const ghPat = 'ghp_' + 'abc1234567890abcdefghijklmnopqrstuvwxyz';
const jwt = 'eyJ' + 'hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----';

assert('AWS key redacted',
  redact(`aws key ${awsKey} in text`),
  'aws key [REDACTED:AWS_KEY] in text');

assert('GitHub PAT redacted',
  redact(`token ${ghPat}`),
  'token [REDACTED:GITHUB_PAT]');

assert('Private key block redacted',
  redact(privateKey),
  '[REDACTED:PRIVATE_KEY]');

assert('JWT redacted',
  redact(`Authorization: Bearer ${jwt}`),
  'Authorization: Bearer [REDACTED:BEARER]');

assert('Generic api_key= redacted',
  redact('api_key=thisismysupersecretapikey1234'),
  '[REDACTED:API_KEY]');

assert('URL with basic auth redacted',
  redact('https://user:pass@example.com/path'),
  '[REDACTED:URL_BASIC_AUTH]/path');

assert('Plain text untouched',
  redact('Hello world'),
  'Hello world');

console.log('\nAll redaction tests passed.');
