import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { execSync } from 'child_process';
import { generateDescription, updateDescription } from './utils';

(async () => {
  // Inputs
  const openaiApiKey = getInput('openai_api_key', { required: true });
  const openaiModel = getInput('openai_model') || 'gpt-4o-mini';
  const temperature = parseFloat(getInput('temperature') || '0.7');
  const userPrompt = getInput('user_prompt');
  const githubToken = getInput('github_token', { required: true });
  const replaceMode = JSON.parse(
    getInput('replace_mode') || 'false'
  ) as boolean;
  const skipDiffFolders = (getInput('skip_diff_folders') || '')
    .split(',')
    .filter(Boolean);

  if (context.eventName !== 'pull_request') {
    setFailed('This action only runs on pull_request events.');
    return;
  }

  if (!context.payload.pull_request) {
    setFailed('Unable to get the basic pull request context.');
    return;
  }

  const prNumber = context.payload.pull_request.number;
  const baseRef = context.payload.pull_request.base.ref;
  const headRef = context.payload.pull_request.head.ref;

  // Set up Git
  execSync(`git config --global user.name "GitHub"`);
  execSync(
    `git config --global user.email "github-actions[bot]@users.noreply.github.com"`
  );

  // Fetch branches
  execSync(`git fetch origin ${baseRef} ${headRef}`);

  // Get the diff
  let diffCommand = `git diff origin/${baseRef} origin/${headRef}`;
  if (skipDiffFolders.length) {
    for (const folder of skipDiffFolders) {
      diffCommand += ` ":(exclude)${folder}"`;
    }
  }

  const diffOutput = execSync(diffCommand, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10
  });

  // Generate the PR description
  const generatedDescription = await generateDescription({
    openaiApiKey,
    openaiModel,
    temperature,
    diffOutput,
    userPrompt
  });

  // Update the PR
  await updateDescription({
    githubToken,
    context,
    prNumber,
    replaceMode,
    generatedDescription
  });

  setOutput('pr_number', prNumber.toString());
  setOutput('description', generatedDescription);
  console.log(`Successfully updated PR #${prNumber} description`);
})().catch(error => {
  setFailed(error.message);
});
