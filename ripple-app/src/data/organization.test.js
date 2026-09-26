import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationRipples, applyOrganizationAction, feedbackOptions } from './organization.js';

test('organization actions preserve community signals and the original data', () => {
  const source = structuredClone(organizationRipples[0]);
  let result = applyOrganizationAction(source, { type: 'acknowledge', date: '2026-09-26' });
  assert.equal(result.acknowledged, true);
  assert.equal(result.status, 'Listening');
  result = applyOrganizationAction(result, { type: 'question', question: 'What would help?', options: feedbackOptions });
  assert.deepEqual(result.questions[0].results, [0, 0, 0, 0]);
  result = applyOrganizationAction(result, { type: 'update', title: 'Service review', message: 'Our review is complete.', status: 'Resolved' });
  assert.equal(result.status, 'Resolved');
  assert.equal(result.updates.length, 1);
  for (const key of ['id', 'voices', 'weekly', 'description', 'location']) assert.equal(result[key], source[key]);
  assert.deepEqual(source, organizationRipples[0]);
});
test('invalid updates and unsupported actions cannot change a Ripple', () => {
  const source = organizationRipples[0];
  for (const action of [
    { type: 'delete' }, { type: 'hide' }, { type: 'update', title: 'Title', message: 'Message', status: 'Invalid concern' },
    { type: 'update', title: ' ', message: 'Message', status: 'Listening' },
    { type: 'question', question: 'Question', options: ['Only one'] },
  ]) assert.equal(applyOrganizationAction(source, action), source);
});
test('publishing appends to existing update history', () => {
  const source = organizationRipples[1];
  const result = applyOrganizationAction(source, { type: 'update', title: 'Next step', message: 'Work has started.', status: 'In progress' });
  assert.equal(result.updates.length, source.updates.length + 1);
  assert.deepEqual(result.updates[0], source.updates[0]);
});
