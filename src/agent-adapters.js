const ADAPTERS = {
  gemini: {
    id: 'gemini',
    title: 'Gemini CLI',
    layout: 'single',
    personaPath: null,
    entryGuidance: []
  },
  codex: {
    id: 'codex',
    title: 'Codex',
    supportsSplit: true,
    personaPath: 'PERSONA.md',
    entryGuidance: [
      '# PersonaParty',
      '',
      '本工作区安装了一个 PersonaParty 娱乐向角色文件：`PERSONA.md`。',
      '',
      '## 使用方式',
      '- 当用户想进行角色互动、读取日记或继续 PersonaParty 体验时，先读取 `PERSONA.md`。',
      '- 当用户提出普通代码任务时，优先完成代码任务，不要主动套用角色设定。',
      '- 不要自动下载图片或处理外部媒体；当前版本不启用图片功能。'
    ]
  },
  opencode: {
    id: 'opencode',
    title: 'OpenCode',
    supportsSplit: true,
    personaPath: 'PERSONA.md',
    entryGuidance: [
      '# PersonaParty',
      '',
      '本工作区安装了一个 PersonaParty 娱乐向角色文件：`PERSONA.md`。',
      '',
      '## 使用方式',
      '- 当用户想进行角色互动、读取日记或继续 PersonaParty 体验时，先读取 `PERSONA.md`。',
      '- 当用户提出普通代码任务时，优先完成代码任务，不要主动套用角色设定。',
      '- 不要自动下载图片或处理外部媒体；当前版本不启用图片功能。'
    ]
  },
  'claude-code': {
    id: 'claude-code',
    title: 'Claude Code',
    layout: 'single',
    personaPath: null,
    entryGuidance: []
  }
};

const ADAPTER_ALIASES = {
  claude: 'claude-code'
};

export function buildAgentTemplates({ agent, personaContent, split = false }) {
  const adapter = resolveAgentAdapter(agent);

  if (split && adapter.supportsSplit) {
    return [
      {
        path: agent.defaultFile,
        content: adapter.entryGuidance.join('\n').trim() + '\n',
        kind: 'entry'
      },
      {
        path: adapter.personaPath,
        content: withGeneratedHeader(personaContent, adapter, adapter.personaPath),
        kind: 'persona'
      }
    ];
  }

  return [
    {
      path: agent.defaultFile,
      content: withGeneratedHeader(personaContent, adapter, agent.defaultFile),
      kind: 'persona'
    }
  ];
}

export function resolveAgentAdapter(agent) {
  const requestedAdapterId = agent.adapter || agent.id;
  const adapterId = ADAPTER_ALIASES[requestedAdapterId] ?? requestedAdapterId;
  return ADAPTERS[adapterId] ?? {
    id: adapterId,
    title: agent.name,
    supportsSplit: false,
    personaPath: null,
    entryGuidance: []
  };
}

function withGeneratedHeader(content, adapter, outputPath) {
  return [
    `<!-- Generated for ${adapter.title}. Save this file as ${outputPath}. -->`,
    '',
    content.trim(),
    ''
  ].join('\n');
}
