import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { Command } from 'commander';
import {
  fetchRegistry,
  normalizeAgent,
  normalizeNamePacks,
  normalizePersona,
  normalizeStorageProfiles
} from '../registry.js';
import { extractVariablesFromTemplates } from '../variables.js';
import { renderTemplate } from '../render.js';
import { createTranslator } from '../i18n.js';
import { materializePersonaTemplate } from '../persona-template.js';
import { checkForUpdates } from '../update-check.js';
import { findExistingAgentFiles } from '../file-guard.js';
import { APP_CONFIG } from '../app-config.js';
import { buildAgentTemplates, resolveAgentAdapter } from '../agent-adapters.js';
import { preparePersonaContent } from '../prompt-content.js';
import {
  createInstallationRecord,
  formatInstallationChoice,
  readInstallations,
  writeInstallation
} from '../installations.js';

export function initCommand() {
  const t = createTranslator(APP_CONFIG.defaultLocale);

  return new Command('init')
    .description(t('commandDescription'))
    .option('-r, --registry <url-or-path>', t('optionRegistry'))
    .option('-o, --output <dir>', t('optionOutput'), APP_CONFIG.defaultOutputDir)
    .option('-a, --agent <id>', t('optionAgent'))
    .option('-p, --persona <id>', t('optionPersona'))
    .option('--platform <platform>', t('optionPlatform'))
    .option('-n, --role-name <name>', t('optionRoleName'))
    .option('--split', t('optionSplit'))
    .option('-y, --yes', t('optionYes'))
    .option('-f, --force', t('optionForce'))
    .action(async (options) => {
      await runInit(options);
    });
}

export async function runInit(options) {
  const registry = await fetchRegistry({
    explicitRegistry: options.registry,
    remoteRegistryUrl: APP_CONFIG.defaultRemoteRegistryUrl,
    localRegistryPath: APP_CONFIG.localRegistryPath,
    systemRegistryPath: APP_CONFIG.systemRegistryPath
  });
  const locale = registry.locale ?? APP_CONFIG.defaultLocale;
  const t = createTranslator(locale);
  const agents = registry.agents.map(normalizeAgent);
  const personas = registry.personas.map(normalizePersona);
  const namePacks = normalizeNamePacks(registry.namePacks);
  const storageProfiles = normalizeStorageProfiles(registry.storageProfiles);

  if (agents.length === 0) {
    throw new Error(t('noAgents'));
  }
  if (personas.length === 0) {
    throw new Error(t('noPersonas'));
  }

  validateInitOptions({ agents, personas, options, t });
  const updates = await checkForUpdates({
    packageName: APP_CONFIG.packageName,
    currentVersion: APP_CONFIG.currentVersion,
    localRegistryPath: APP_CONFIG.localRegistryPath,
    remoteRegistryUrl: APP_CONFIG.defaultRemoteRegistryUrl,
    remoteVersionManifestUrl: APP_CONFIG.remoteVersionManifestUrl,
    skipRemote: Boolean(options.registry)
  });

  await renderBanner(t, { skipPulse: Boolean(options.yes) });
  renderHomeCard(t);
  renderUpdateSummary(updates, t);
  const selectedAgent = await chooseAgent(agents, options.agent, options, t);
  const selectedPlatform = resolveTargetPlatform(options.platform);
  const outputDir = path.resolve(process.cwd(), options.output);
  const selectedPersona = await choosePersona(personas, options.persona, options, t);
  const roleName = await chooseRoleName(selectedPersona, namePacks, options, t);
  const personaTemplate = await materializePersonaTemplate(
    selectedPersona,
    registry.sourceUrl,
    storageProfiles,
    selectedPlatform
  );
  const seededDefaults = resolveDefaults({
    ...personaTemplate.defaults,
    ROLE_NAME: roleName
  });
  const relationSlots = getPersonaRelationSlots(selectedPersona, seededDefaults);
  const relatedInstallations = await chooseRelatedInstallations({
    currentRoleName: roleName,
    relationSlots,
    options,
    outputDir,
    t
  });
  const relationAssignments = assignRelationSlots(relationSlots, relatedInstallations);
  const autoDiary = await chooseDiaryMode(options, t);
  const relationDefaults = resolveRelationDefaults(seededDefaults, relationAssignments);
  const preparedPersonaContent = preparePersonaContent(personaTemplate.content, {
    autoDiary,
    relatedInstallations,
    activeRelationSlots: relationAssignments.map((assignment) => assignment.slot),
    relationDefaults: relationSlotsToDefaults(relationSlots)
  });
  const selectedAdapter = resolveAgentAdapter(selectedAgent);
  const useSplitOutput = Boolean(options.split && selectedAdapter.supportsSplit);
  const templates = buildAgentTemplates({
    agent: selectedAgent,
    personaContent: preparedPersonaContent,
    split: useSplitOutput
  });
  await warnAboutExistingFiles(outputDir, templates.map((template) => template.path), options, t);
  const variables = extractVariablesFromTemplates(templates);
  const answers = await askVariables(variables, relationDefaults, options, t);

  await fs.ensureDir(outputDir);
  printSetupSummary({
    registry: registry.sourceUrl || APP_CONFIG.localRegistryPath,
    agent: `${selectedAgent.name} -> ${selectedAgent.defaultFile}`,
    adapter: selectedAdapter.title,
    outputMode: useSplitOutput ? t('outputModeSplit') : t('outputModeImmersive'),
    platform: selectedPlatform,
    persona: selectedPersona.name,
    roleName,
    relatedRoles: relatedInstallations.map((item) => item.roleName).filter(Boolean),
    diaryMode: autoDiary ? t('diaryModeAutoSummary') : t('diaryModeManualSummary'),
    outputDir
  }, t);

  const writtenFiles = [];

  printResultHeader(t);
  for (const template of templates) {
    const outputPath = path.join(outputDir, template.path);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, renderTemplate(template.content, answers), 'utf8');
    writtenFiles.push(outputPath);

    console.log(chalk.green(t('complete', selectedPersona.name, selectedAgent.name, outputPath)));
  }

  await writeInstallation(createInstallationRecord({
    agent: selectedAgent,
    adapter: selectedAdapter,
    outputDir,
    outputFile: path.join(outputDir, selectedAgent.defaultFile),
    persona: selectedPersona,
    platform: selectedPlatform,
    registry: registry.sourceUrl || APP_CONFIG.localRegistryPath,
    relatedInstallations: summarizeRelatedInstallations(relatedInstallations),
    variables: answers,
    generatedFiles: writtenFiles,
    diaryMode: autoDiary ? 'auto' : 'manual',
    outputMode: useSplitOutput ? 'split' : 'immersive'
  }));
}

function validateInitOptions({ agents, personas, options, t }) {
  if (!process.stdin.isTTY && !options.yes) {
    throw new Error(t('nonInteractiveRequiresYes'));
  }

  if (options.agent && !agents.some((agent) => agent.id === options.agent)) {
    throw new Error(t('agentNotFound', options.agent));
  }

  if (options.persona && !personas.some((persona) => persona.id === options.persona)) {
    throw new Error(t('personaNotFound', options.persona));
  }
}

async function renderBanner(t, { skipPulse = false } = {}) {
  const width = Math.max(36, Math.min(process.stdout.columns || 72, 72));
  const line = chalk.cyan('='.repeat(width));
  const art = [
    '  ____                                      ____            _         ',
    ' |  _ \\ ___ _ __ ___  ___  _ __   __ _    |  _ \\ __ _ _ __| |_ _   _ ',
    ' | |_) / _ \\  __/ __|/ _ \\|  _ \\ / _` |   | |_) / _` |  __| __| | | |',
    ' |  __/  __/ |  \\__ \\ (_) | | | | (_| |   |  __/ (_| | |  | |_| |_| |',
    ' |_|   \\___|_|  |___/\\___/|_| |_|\\__,_|   |_|   \\__,_|_|   \\__|\\__, |',
    '                                                                |___/ '
  ];

  if (!skipPulse) {
    await playWelcomePulse();
  }
  console.log(line);
  for (const row of art) {
    console.log(chalk.bold.magenta(row));
  }
  console.log(chalk.bold.cyan(`  ${t('bannerTitle')} · ${t('bannerSubtitle')}`));
  console.log(chalk.dim(`  ${t('bannerTagline')}`));
  console.log(line);
}

async function playWelcomePulse() {
  if (!process.stdout.isTTY || process.env.CI || process.env.NO_COLOR) {
    return;
  }

  const frames = ['Loading persona kit', 'Loading persona kit.', 'Loading persona kit..', 'Loading persona kit...'];
  for (const frame of frames) {
    process.stdout.write(chalk.dim(`\r  ${frame}`));
    await sleep(45);
  }
  process.stdout.write('\r' + ' '.repeat(20) + '\r');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderHomeCard(t) {
  console.log(chalk.bold(`  ${t('homeTitle')}`));
  console.log(chalk.dim(`  ${t('homeSubtitle')}`));
  console.log('');
}

function printSetupSummary(summary, t) {
  console.log('');
  console.log(chalk.bold(t('sectionSetup')));
  console.log(chalk.dim(`  ${t('selectedPersona', summary.persona)}`));
  console.log(chalk.dim(`  ${t('roleSummary', summary.roleName)}`));
  console.log(chalk.dim(`  ${t('selectedAgent', summary.agent)}`));
  console.log(chalk.dim(`  ${t('selectedOutput', summary.outputDir)}`));
  if (summary.relatedRoles.length > 0) {
    console.log(chalk.dim(`  ${t('relatedSummary', summary.relatedRoles.join('、'))}`));
  }
  console.log(chalk.dim(`  ${t('diaryModeSummary', summary.diaryMode)}`));
  console.log('');
  console.log(chalk.dim(`  ${t('sectionAdvanced')}`));
  console.log(chalk.dim(`    ${t('selectedRegistry', summary.registry)}`));
  console.log(chalk.dim(`    ${t('selectedAdapter', summary.adapter)}`));
  console.log(chalk.dim(`    ${t('selectedOutputMode', summary.outputMode)}`));
  console.log(chalk.dim(`    ${t('selectedPlatform', summary.platform)}`));
  console.log('');
}

function printResultHeader(t) {
  console.log(chalk.bold(t('sectionResult')));
}

function renderUpdateSummary(updates, t) {
  console.log(chalk.bold(t('sectionUpdate')));

  if (!updates.cli && !updates.registry) {
    console.log(chalk.dim(`  ${t('noUpdate')}`));
    console.log('');
    return;
  }

  if (updates.cli) {
    console.log(chalk.yellow(`  ${t('cliUpdateAvailable', updates.cli.currentVersion, updates.cli.latestVersion)}`));
  }

  if (updates.registry) {
    console.log(chalk.yellow(`  ${t('registryUpdateAvailable', updates.registry.currentVersion, updates.registry.latestVersion)}`));
  }

  console.log(chalk.dim(`  ${t('updateHint')}`));
  console.log('');
}

async function warnAboutExistingFiles(outputDir, files, options, t) {
  if (options.force) {
    return;
  }

  const existingFiles = await findExistingAgentFiles(outputDir, files);
  if (existingFiles.length === 0) {
    return;
  }

  console.log(chalk.yellow.bold(t('sectionWarning')));
  console.log(chalk.yellow(t('overwriteDetected')));
  for (const file of existingFiles) {
    console.log(chalk.yellow(`  - ${file}`));
  }
  console.log('');

  if (options.yes) {
    console.log(chalk.yellow(t('overwriteForceHint')));
    throw new Error(t('cancelled'));
  }

  const { proceed } = await inquirer.prompt([
    {
      type: 'list',
      name: 'proceed',
      message: t('overwriteConfirmPrompt'),
      choices: [
        { name: t('confirmContinue'), value: true },
        { name: t('confirmExit'), value: false }
      ]
    }
  ]);

  if (!proceed) {
    console.log(chalk.yellow(t('cancelled')));
    throw new Error(t('cancelled'));
  }
}

function resolveTargetPlatform(platform) {
  if (platform) {
    return platform;
  }

  const platformMap = {
    win32: 'windows',
    darwin: 'darwin',
    linux: 'linux'
  };

  return platformMap[os.platform()] ?? 'default';
}

async function chooseAgent(agents, agentId, options, t) {
  if (agentId) {
    const selected = agents.find((agent) => agent.id === agentId);
    if (!selected) {
      throw new Error(t('agentNotFound', agentId));
    }
    return selected;
  }

  if (options.yes) {
    return agents[0];
  }

  const { agent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: t('chooseAgent'),
      choices: agents.map((item) => {
        const hint = [item.description, t('agentFileHint', item.defaultFile)]
          .filter(Boolean)
          .join(' · ');
        return {
          name: `${item.name}${hint ? chalk.dim(` - ${hint}`) : ''}`,
          value: item.id
        };
      })
    }
  ]);

  return agents.find((item) => item.id === agent);
}

async function choosePersona(personas, personaId, options, t) {
  if (personaId) {
    const selected = personas.find((persona) => persona.id === personaId);
    if (!selected) {
      throw new Error(t('personaNotFound', personaId));
    }
    return selected;
  }

  if (options.yes) {
    return personas[0];
  }

  const { persona } = await inquirer.prompt([
    {
      type: 'list',
      name: 'persona',
      message: t('choosePersona'),
      choices: personas.map((item) => ({
        name: `${item.name}${item.description ? chalk.dim(` - ${item.description}`) : ''}`,
        value: item.id
      }))
    }
  ]);

  return personas.find((item) => item.id === persona);
}

async function chooseRoleName(persona, namePacks, options, t) {
  const defaultName = persona.defaults.ROLE_NAME ?? persona.name;
  const availableNames = namePacks.flatMap((pack) => pack.names);

  if (options.roleName) {
    return options.roleName;
  }

  if (options.yes) {
    return defaultName;
  }

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: t('chooseNameMode'),
      choices: [
        { name: `${t('nameModeDefault')} (${defaultName})`, value: 'default' },
        ...(availableNames.length > 0 ? [{ name: t('nameModePick'), value: 'pick' }] : []),
        { name: t('nameModeCustom'), value: 'custom' }
      ]
    }
  ]);

  if (mode === 'default') {
    return defaultName;
  }

  if (mode === 'pick') {
    const { roleName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'roleName',
        message: t('chooseName'),
        choices: availableNames
      }
    ]);
    return roleName;
  }

  const { roleName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'roleName',
      message: t('enterName'),
      default: defaultName
    }
  ]);
  return roleName;
}

async function chooseRelatedInstallations({ currentRoleName, relationSlots, options, outputDir, t }) {
  if (options.yes) {
    return [];
  }

  const index = await readInstallations();
  const candidates = index.installations.filter((installation) => {
    return path.resolve(installation.outputDir ?? '') !== outputDir ||
      (installation.roleName && installation.roleName !== currentRoleName);
  });

  if (candidates.length === 0) {
    return [];
  }

  console.log('');
  console.log(chalk.dim(`  ${t('relatedPromptHint')}`));

  const { shouldRelate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldRelate',
      message: t('chooseRelatedPrompt'),
      default: false
    }
  ]);

  if (!shouldRelate) {
    return [];
  }

  const maxRelations = countRelationSlots(relationSlots);
  const { relatedIds } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'relatedIds',
      message: t('chooseRelatedInstallations', maxRelations),
      choices: candidates.map((installation) => ({
        name: formatInstallationChoice(installation),
        value: installation.id
      })),
      validate: (value) => value.length <= maxRelations || t('tooManyRelatedInstallations', maxRelations)
    }
  ]);

  return relatedIds
    .map((id) => candidates.find((installation) => installation.id === id))
    .filter(Boolean)
    .slice(0, maxRelations);
}

async function chooseDiaryMode(options, t) {
  if (options.yes) {
    return true;
  }

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: t('chooseDiaryMode'),
      choices: [
        { name: t('diaryModeAuto'), value: 'auto' },
        { name: t('diaryModeManual'), value: 'manual' }
      ]
    }
  ]);

  return mode === 'auto';
}

function resolveRelationDefaults(defaults, relationAssignments) {
  const resolved = { ...defaults };

  relationAssignments.forEach(({ slot, installation }) => {
    const { nameKey, roleKey, nicknameKey } = getRelationSlotConfig(slot);
    resolved[nameKey] = installation.roleName || installation.personaName || resolved[nameKey];
    resolved[roleKey] = installation.roleLabel || installation.personaName || resolved[roleKey];

    if (nicknameKey) {
      resolved[nicknameKey] = installation.roleName || resolved[nicknameKey];
    }

    if (installation.sharedLogPath) {
      resolved.SHARED_LOG_PATH = installation.sharedLogPath;
    }
    if (installation.sharedPhotoDir) {
      resolved.SHARED_PHOTO_DIR = installation.sharedPhotoDir;
    }
    if (installation.sharedDir) {
      resolved.SHARED_DIR = installation.sharedDir;
    }
  });

  return resolveDefaults(resolved);
}

function assignRelationSlots(relationSlots, relatedInstallations) {
  const availableSlots = relationSlots.map((slot) => ({
    ...getRelationSlotConfig(slot.slot),
    label: slot.label,
    targetPersonaIds: slot.targetPersonaIds
  }));
  const assignments = [];

  for (const installation of relatedInstallations) {
    if (availableSlots.length === 0) {
      break;
    }

    const bestSlot = findBestRelationSlot(installation, availableSlots) ?? availableSlots[0];
    assignments.push({
      slot: bestSlot.prefix,
      installation
    });
    availableSlots.splice(availableSlots.indexOf(bestSlot), 1);
  }

  return assignments;
}

function findBestRelationSlot(installation, slots) {
  return slots.find((slot) => slot.targetPersonaIds.includes(installation.personaId)) ?? null;
}

function countRelationSlots(relationSlots) {
  return Math.max(1, relationSlots.length);
}

function getPersonaRelationSlots(persona) {
  return persona.relationSlots;
}

function relationSlotsToDefaults(relationSlots) {
  return Object.fromEntries(relationSlots.map((slot) => [
    `${slot.slot}_ROLE`,
    slot.label || ''
  ]));
}

function getRelationSlotConfig(prefix) {
  return {
    prefix,
    nameKey: `${prefix}_NAME`,
    roleKey: `${prefix}_ROLE`,
    nicknameKey: `${prefix}_NICKNAME`
  };
}

function summarizeRelatedInstallations(installations) {
  return installations.map((installation) => ({
    id: installation.id,
    personaId: installation.personaId,
    personaName: installation.personaName,
    roleName: installation.roleName,
    roleLabel: installation.roleLabel,
    outputFile: installation.outputFile,
    sharedLogPath: installation.sharedLogPath
  }));
}

async function askVariables(variables, defaults, options, t) {
  if (variables.length === 0) {
    return {};
  }

  const configurableVariables = variables.filter((variable) => shouldPromptVariable(variable, defaults));
  if (options.yes) {
    return defaults;
  }

  const prompts = configurableVariables.map((variable) => ({
    type: 'input',
    name: variable,
    message: getVariablePrompt(variable, t),
    default: defaults[variable] ?? ''
  }));

  return {
    ...defaults,
    ...await inquirer.prompt(prompts)
  };
}

function resolveDefaults(defaults) {
  const resolved = { ...defaults };

  for (let index = 0; index < 5; index += 1) {
    let changed = false;

    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value !== 'string') {
        continue;
      }

      const next = value.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (placeholder, variable) => {
        return Object.hasOwn(resolved, variable) ? resolved[variable] : placeholder;
      });

      if (next !== value) {
        resolved[key] = next;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return resolved;
}

function shouldPromptVariable(variable, defaults) {
  const internalOrDerivedVariables = new Set([
    'ROLE_NAME',
    'ROLE_NICKNAME',
    'ARCHETYPE_TITLE',
    'LOG_LABEL',
    'COMPANION_A_NAME', 'COMPANION_A_ROLE', 'COMPANION_A_NICKNAME',
    'COMPANION_B_NAME', 'COMPANION_B_ROLE', 'COMPANION_B_NICKNAME',
    'DOWNLOAD_COMMAND_HINT', 'CREATE_PHOTO_DIR_HINT',
    'SHARED_DIR'
  ]);

  if (internalOrDerivedVariables.has(variable)) {
    return false;
  }

  return Object.hasOwn(defaults, variable);
}

function getVariablePrompt(variable, t) {
  const labels = t('variableLabels');
  const label = labels?.[variable];
  return label ? t('enterVariableLabel', label) : t('enterVariable', variable);
}
