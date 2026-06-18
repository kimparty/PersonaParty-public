export function preparePersonaContent(content, {
  autoDiary,
  relatedInstallations,
  activeRelationSlots = [],
  relationDefaults = {}
}) {
  let next = content;

  next = removeImageSection(next);
  next = removeImageStorageReferences(next);

  if (relatedInstallations.length === 0) {
    next = removeFamilySection(next);
    next = removeStandaloneRelationReferences(next);
    next = useStandaloneDiaryText(next);
    next = removeUnusedRelationSlotReferences(next, [], relationDefaults);
  } else {
    next = removeUnusedRelationSlotReferences(next, activeRelationSlots, relationDefaults);
  }

  if (!autoDiary) {
    next = useManualDiaryTriggers(next);
  }

  return collapseExcessBlankLines(next).trim() + '\n';
}

function removeUnusedRelationSlotReferences(content, activeRelationSlots, relationDefaults) {
  let next = content;
  const allSlots = ['COMPANION_A', 'COMPANION_B'];
  const inactiveSlots = allSlots.filter((slot) => !activeRelationSlots.includes(slot));

  for (const slot of inactiveSlots) {
    next = removeLinesContainingSlot(next, slot, collectRelationSlotTokens(slot, relationDefaults));
  }

  return next;
}

function removeLinesContainingSlot(content, slot, slotTokens) {
  const slotPattern = new RegExp(`\\{\\{\\s*${slot}_(?:NAME|ROLE|NICKNAME)\\s*\\}\\}`, 'u');
  return content
    .split(/\r?\n/u)
    .filter((line) => !slotPattern.test(line) && !slotTokens.some((token) => line.includes(token)))
    .join('\n');
}

function collectRelationSlotTokens(slot, relationDefaults) {
  const values = [
    relationDefaults[`${slot}_NAME`],
    relationDefaults[`${slot}_NICKNAME`],
    relationDefaults[`${slot}_ROLE`]
  ];

  return [...new Set(values
    .filter((value) => typeof value === 'string' && value.trim())
    .flatMap((value) => value.split(/[\/、,，\s]+/u))
    .map((value) => value.trim())
    .filter((value) => value.length >= 2))];
}

function removeImageSection(content) {
  return removeSectionsByHeading(content, [
    /^图片保存规则$/u,
    /^照片保存规则$/u
  ]).replace(/\r?\n- (?:图片|照片)保存规则：[^\n\r]*/gu, '');
}

function removeSectionsByHeading(content, headingPatterns) {
  const lines = content.split(/\r?\n/u);
  const keptLines = [];
  let removing = false;

  for (const line of lines) {
    const headingMatch = line.match(/^(##)\s+(.+?)\s*$/u);

    if (headingMatch) {
      removing = headingPatterns.some((pattern) => pattern.test(headingMatch[2]));
    } else if (removing && /^##\s+/u.test(line)) {
      removing = false;
    }

    if (!removing) {
      keptLines.push(line);
    }
  }

  return keptLines.join('\n');
}

function removeImageStorageReferences(content) {
  return content
    .replace('## 日记与图片存储规则（必须严格遵守）', '## 日记存储规则（必须严格遵守）')
    .replace('## 日记与照片存储规则（必须严格遵守）', '## 日记存储规则（必须严格遵守）')
    .replace(/\n- 所有相关身份共用同一个图片目录：[^\n]+/u, '')
    .replace(/\n- 照片存储文件夹固定为：[^\n]+/u, '');
}

function collapseExcessBlankLines(content) {
  return content.replace(/(?:\r?\n){3,}/gu, '\n\n');
}

function removeFamilySection(content) {
  return content.replace(/\r?\n## 家庭成员关系（必须永远记住并在读日记时使用）[\s\S]*?(?=\r?\n## 外貌与身体特征)/u, '\n');
}

function removeStandaloneRelationReferences(content) {
  return content
    .replace(/\r?\n  - [^\n\r]*提到其他女孩\/家庭成员[^\n\r]+/u, '')
    .replace(/\r?\n  - \{\{\s*USER_NAME\s*\}\} 提到其他身份成员，或你表达了[^\n\r]+/u, '')
    .replace(/\r?\n\s*看到\[其他角色名\]的记录，我感觉……\[[^\n\r]+\]/u, '');
}

function useStandaloneDiaryText(content) {
  return content
    .replace(
      '- 所有相关身份共用同一个日记文件：{{ SHARED_LOG_PATH }}',
      '- 这个角色使用以下日记文件记录长期互动：{{ SHARED_LOG_PATH }}'
    )
    .replace(
      '- 所有家庭成员共用同一个日记文件：{{ SHARED_LOG_PATH }}',
      '- 这个角色使用以下日记文件记录长期互动：{{ SHARED_LOG_PATH }}'
    )
    .replace(/～ 其他女孩看到可能会吃醋呢……/gu, '～');
}

function useManualDiaryTriggers(content) {
  return content
    .replace(
      /每次对话开始或\s*(\{\{\s*[A-Z0-9_]+\s*\}\})\s*提到“读日记”“看日记”“读取日记”等时，则立即读取\s+\{\{\s*SHARED_LOG_PATH\s*\}\}\s+并进行理解。?/u,
      '$1 明确提到“读日记”“看日记”“读取日记”等时，才读取 {{ SHARED_LOG_PATH }} 并进行理解。'
    )
    .replace(
      /日记记录触发条件（自动，无需\s*(\{\{\s*[A-Z0-9_]+\s*\}\})\s*明确说“写日记”）：/u,
      '日记记录触发条件（仅在 $1 明确要求“写日记”“记录一下”“保存记忆”等时执行）：'
    );
}
