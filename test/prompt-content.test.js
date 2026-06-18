import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparePersonaContent } from '../src/prompt-content.js';

test('preparePersonaContent removes image sections by heading boundary', () => {
  const content = [
    '# Persona',
    '',
    '## 图片保存规则',
    '- save photos somewhere',
    '- this section has no role-name anchor',
    '',
    '## 日记存储规则（必须严格遵守）',
    '- 这个角色使用以下日记文件记录长期互动：{{ SHARED_LOG_PATH }}',
    '',
    '{{ ROLE_NAME }} is ready'
  ].join('\n');

  const prepared = preparePersonaContent(content, {
    autoDiary: true,
    relatedInstallations: []
  });

  assert.doesNotMatch(prepared, /图片保存规则/u);
  assert.doesNotMatch(prepared, /save photos/u);
  assert.match(prepared, /## 日记存储规则/u);
  assert.match(prepared, /\{\{ ROLE_NAME \}\} is ready/u);
});

test('preparePersonaContent removes inline image rule bullets', () => {
  const content = [
    '# Persona',
    '- 图片保存规则：save images',
    '- keep this line',
    '',
    '{{ ROLE_NAME }} is ready'
  ].join('\n');

  const prepared = preparePersonaContent(content, {
    autoDiary: true,
    relatedInstallations: []
  });

  assert.doesNotMatch(prepared, /save images/u);
  assert.match(prepared, /keep this line/u);
});

test('preparePersonaContent collapses excess blank lines after section removal', () => {
  const content = [
    '# Persona',
    '',
    '## 家庭成员关系（必须永远记住并在读日记时使用）',
    '- {{ COMPANION_A_NAME }}',
    '',
    '## 外貌与身体特征',
    '- detail'
  ].join('\n');

  const prepared = preparePersonaContent(content, {
    autoDiary: true,
    relatedInstallations: []
  });

  assert.doesNotMatch(prepared, /\n{3,}/u);
  assert.match(prepared, /# Persona\n\n## 外貌与身体特征/u);
});
