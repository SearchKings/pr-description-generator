import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { execSync } from 'child_process';
import { generateDescription, updateDescription } from './utils';

(async () => {
  // Inputs
  const openaiApiKey = getInput('openai_api_key', { required: true });
  const openaiModel = getInput('openai_model') || 'gpt-4o-mini';
  const temperature = parseFloat(getInput('temperature') || '0.7');
  const userPrompt =
    getInput('user_prompt') ||
    `**Instructions:**
Please generate a **Pull Request description** for the provided diff, following these guidelines:
- Add appropriate emojis to the description.
- Do **not** include the words "Title" and "Description" in your output.
- Format your answer in **Markdown**.`;
  const githubToken = getInput('github_token', { required: true });
  const replaceMode = JSON.parse(
    getInput('replace_mode') || 'false'
  ) as boolean;

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
  const diffOutput = execSync(`git diff origin/${baseRef} origin/${headRef}`, {
    encoding: 'utf8'
  });

  // Generate the PR description
  const generatedDescription = await generateDescription({
    openaiApiKey,
    openaiModel,
    temperature,
    userPrompt,
    diffOutput
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
  console.log(`Successfully updated PR #${prNumber} description.`);
})().catch(error => {
  setFailed(error.message);
});
