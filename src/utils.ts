import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import OpenAI from 'openai';

export const generateDescription = async ({
  openaiApiKey,
  openaiModel,
  temperature,
  diffOutput,
  userPrompt
}: {
  openaiApiKey: string;
  openaiModel: string;
  temperature: number;
  diffOutput: string;
  userPrompt: string;
}): Promise<string> => {
  const client = new OpenAI({
    apiKey: openaiApiKey
  });

  const defaultPrompt = `**Instructions:** \n
      Please generate a **Pull Request description** for the provided diff, following these guidelines: \n
      - Add appropriate emojis to the description.
      - Do **not** include the words "Title" and "Description" in your output.
      - Format your answer in **Markdown**.`;

  const prompt = `${userPrompt || defaultPrompt} \n
  **Diff:** \n
  ${diffOutput}`;

  const response = await client.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant who generates pull request descriptions based on diffs.'
      },
      { role: 'user', content: prompt }
    ],
    model: openaiModel,
    temperature,
    max_tokens: 1024
  });

  const [choice] = response?.choices || [];

  if (typeof choice?.message?.content !== 'string') {
    throw new Error(
      `OpenAI API Error: invalid response – unexpected structure or missing content`
    );
  }

  const description = choice.message.content.trim();
  return description;
};

export const updateDescription = async ({
  githubToken,
  context,
  prNumber,
  replaceMode,
  generatedDescription
}: {
  githubToken: string;
  context: Context;
  prNumber: number;
  replaceMode: boolean;
  generatedDescription: string;
}): Promise<RestEndpointMethodTypes['pulls']['update']['response']> => {
  let newDescription: string = generatedDescription;
  const octokit = getOctokit(githubToken);

  if (!replaceMode) {
    // Fetch the current PR description
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber
    });

    const currentDescription = pullRequest.body || '';

    newDescription = `${currentDescription}\n\n---\n## ✨ GENERATED DESCRIPTION\n\n${generatedDescription}`;
  } else {
    newDescription = generatedDescription;
  }

  return octokit.rest.pulls.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    body: newDescription
  });
};
