#!/usr/bin/env node

/*
 * Validates the pull requests included in a release.
 *
 * This script uses get-release-prs.js to identify the merged pull requests
 * included between the previous and current release tags and verifies that
 * each has a valid release label.
 */

const {
  releaseLabels
} = require('./release-config');

const {
  getReleasePrs
} = require('./get-release-prs');

const path = require('node:path');

const scriptName = path.basename(process.argv[1]);

async function main() {
  const currentTag = process.argv[2];

  if (!currentTag) {
    console.error(
      `Usage: ${scriptName} <release-tag>`
    );
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const releasePrs = await getReleasePrs(
    currentTag,
    token
  );

  const invalidPrs = releasePrs.filter(
    pr => !pr.hasReleaseLabel
  );

  if (invalidPrs.length > 0) {
    console.error('');
    console.error('The following PRs have no valid release label:');

    for (const pr of invalidPrs) {
      console.error(
        `  #${pr.number} ${pr.title}`
      );

      console.error(
        `     Current labels: ${
          pr.labels.join(', ') || 'none'
        }`
      );
    }

    console.error('');
    console.error('Each PR must have at least one of:');

    for (const label of releaseLabels) {
      console.error(`  ${label}`);
    }

    process.exit(1);
  }

  console.log('');
  console.log('All release PRs have a valid release label.');

  // GitHub Release creation will go here.
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
