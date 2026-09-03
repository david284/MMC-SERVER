#!/usr/bin/env node

/*
 * Identifies the pull requests included in a release.
 *
 * This script determines the previous release tag, retrieves closed pull
 * requests from GitHub, and uses the Git history to identify which merged
 * pull requests are included between the previous and current release tags.
 *
 * The resulting pull request information is returned to the caller and
 * includes the PR number, title, URL, merge commit, labels, and whether the
 * PR has a valid release label.
 */

const { execFileSync } = require('node:child_process');

const { releaseLabels } = require('./release-config');
const RELEASE_LABELS = new Set(releaseLabels);

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function getRepository() {
  const remote = git('remote', 'get-url', 'origin');

  const match = remote.match(
    /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/
  );

  if (!match) {
    throw new Error(
      `Unable to determine GitHub repository from origin: ${remote}`
    );
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

async function github(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function getAllClosedPullRequests(owner, repo, token) {
  const prs = [];

  for (let page = 1; ; page++) {
    const pagePrs = await github(
      `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&page=${page}`,
      token
    );

    prs.push(...pagePrs);

    if (pagePrs.length < 100) {
      break;
    }
  }

  return prs;
}

function isCommitInRelease(commit, currentTag, previousTag) {
  try {
    git('merge-base', '--is-ancestor', commit, currentTag);
  } catch {
    return false;
  }

  if (previousTag) {
    try {
      git('merge-base', '--is-ancestor', commit, previousTag);
      return false;
    } catch {
      // Commit is not part of the previous release.
    }
  }

  return true;
}

function getPreviousReleaseTag(currentTag) {
  const tags = git(
    'tag',
    '--sort=-version:refname',
    '--list',
    'v[0-9]*.[0-9]*.[0-9]*'
  )
    .split('\n')
    .filter(Boolean);

  return tags.find(tag => tag !== currentTag);
}

function hasReleaseLabel(pr) {
  return pr.labels.some(label =>
    RELEASE_LABELS.has(label.name)
  );
}

async function getReleasePrs(currentTag, token) {
  if (!currentTag) {
    throw new Error('A release tag is required');
  }

  if (!token) {
    throw new Error('A GitHub token is required');
  }

  const { owner, repo } = getRepository();

  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Release tag: ${currentTag}`);

  const previousTag = getPreviousReleaseTag(currentTag);

  if (previousTag) {
    console.log(`Previous release: ${previousTag}`);
  } else {
    console.log(
      'No previous release tag found; treating this as the first release.'
    );
  }

  const pullRequests = await getAllClosedPullRequests(
    owner,
    repo,
    token
  );

  const releasePrs = pullRequests
    .filter(pr => pr.merged_at !== null)
    .filter(pr => pr.merge_commit_sha)
    .filter(pr =>
      isCommitInRelease(
        pr.merge_commit_sha,
        currentTag,
        previousTag
      )
    )
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      merged_at: pr.merged_at,
      merge_commit_sha: pr.merge_commit_sha,
      labels: pr.labels.map(label => label.name),
      hasReleaseLabel: hasReleaseLabel(pr)
    }))
    .sort((a, b) => a.number - b.number);

  console.log(`Found ${releasePrs.length} PR(s) in this release.`);

  for (const pr of releasePrs) {
    console.log(
      `#${pr.number}: ${pr.title} ` +
      `[${pr.labels.join(', ') || 'no labels'}]`
    );
  }

  return releasePrs;
}

module.exports = {
  RELEASE_LABELS,
  getReleasePrs
};

if (require.main === module) {
  const currentTag = process.argv[2];
  const token = process.env.GITHUB_TOKEN;

  getReleasePrs(currentTag, token)
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}
