# Development and Release Workflow

This document describes how the project is developed, integrated, and released.

It is intended as a reference for both contributors and maintainers, with particular emphasis on the project's **branching model, integration process, and release process**.

For step-by-step instructions on submitting a contribution, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

# 1. Development Model

The project uses a lightweight release-oriented workflow designed for a project with a single primary maintainer and contributions from external developers.

The central principle is:

> **`main` always represents the latest released version.**

Unreleased work is kept separate from `main` until the maintainer decides that it is ready for release.

The basic model is:

```text
Contributor fork
      │
      │ Pull Request
      ▼
release/x.y
      │
      │ Selected and integrated changes
      ▼
main
      │
      │ Version tag
      ▼
vX.Y.Z
      │
      ▼
Automated release process
```

---

# 2. Branches

## `main`

`main` represents the latest released version of the project.

For example:

```text
main → v2.4.0
```

Unreleased development work should not normally be merged directly into `main`.

This gives `main` a clear and useful meaning:

> If something is on `main`, it corresponds to a released state of the project.

---

## `release/x.y`

A release branch is used to assemble the next release.

For example:

```text
main
 │
 └── release/2.5
```

The branch contains the changes selected for the upcoming release.

Multiple pull requests can be integrated into the branch:

```text
release/2.5
    ├── PR #101
    ├── PR #103
    ├── PR #107
    └── PR #109
```

The branch is normally temporary. Once the release is complete, it is merged into `main` and can be deleted.

---

## Contributor branches

Contributors work in branches in their own forks.

The details of creating and submitting these branches are covered in [CONTRIBUTING.md](CONTRIBUTING.md).

---

# 3. Integration

The release branch acts as the integration point for the next release.

The maintainer decides which pull requests are accepted and merged.

This allows the project to bundle several changes into a single release:

```text
release/2.5
    │
    ├── Feature A
    ├── Bug fix B
    ├── Feature C
    └── Documentation update
```

An accepted pull request does not necessarily have to be included in the immediately following release.

For example:

```text
PR #101 → v2.5.0
PR #103 → v2.5.0
PR #107 → v2.5.0
PR #109 → later release
```

This gives the maintainer control over the contents and timing of each release.

---

# 4. Dependency Management

The project uses `npm` for dependency management.

`package.json` defines the project's dependencies and acceptable version
ranges, while `package-lock.json` records the exact dependency tree used by
the project.

## `package-lock.json`

**Note:** `package-lock.json` is part of the project's source code and **must
be committed to Git**.

When dependencies are changed, changes to `package.json` and
`package-lock.json` should normally be committed together.

## Install dependencies

When installing dependencies from an existing `package-lock.json` file:

```bash
npm ci
```

`npm ci` deletes the `node_modules` directory (if it exists) and then
installs the exact dependency tree specified by `package-lock.json`.

`npm ci` does **not** modify `package.json` or `package-lock.json`.

> **Do not use `npm install` or `npm update` when simply installing the
project's existing dependencies. Use `npm ci` instead.**

When adding, removing, or updating dependencies, developers should use `npm`
commands rather than manually editing `package.json` or `package-lock.json`.
`npm` will update `package.json` and `package-lock.json` as appropriate.

                 `npm` command
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    `package.json`          `package-lock.json`
   dependency metadata     exact dependency tree

## Runtime dependency

```bash
npm install <package>
```

## Development dependency

```bash
npm install --save-dev <package>
```

## Remove a dependency

```bash
npm uninstall <package>
```

---

# 5. Pull Request Validation

Changes should be subject to automated CI checks before they are integrated. The current checks and their triggers are defined by the repository's CI configuration.

These checks provide automated verification, while the maintainer remains responsible for deciding whether a change is appropriate for the project.

---

# 6. Integration Testing

Individual pull requests may pass their automated checks while the combination of several changes introduces an unexpected problem.

The release branch should therefore be tested as an integrated whole.

As a release approaches, the maintainer should verify:

- The complete test suite passes.
- The project builds successfully.
- Important functionality works as expected.
- Changes do not introduce unacceptable compatibility problems.
- Documentation and release information are ready.

The release branch should eventually represent:

> **The exact set of changes intended for the next release.**

---

# 7. Tracking a Release

GitHub Issues, pull requests, labels, and milestones can be used to track release contents.

For example, a milestone named:

```text
v2.5.0
```

can contain the issues and pull requests intended for that release.

This provides a convenient answer to:

> "What is expected to be in the next release?"

### Issue Lifecycle

```text
Issue opened
    ↓
PR created
    ↓
PR reviewed/tested
    ↓
PR merged to release branch
    ↓
Issue remains open
    ↓
Release created
    ↓
Issue closed
```

An issue remains open until the change it represents has been included in a
completed release. Merging the associated pull request into the release branch
does not, by itself, close the issue, as the change has not yet been released.

Pull requests should reference their associated issues without using GitHub's
automatic issue-closing keywords (e.g. Use `Implements #123` rather than `Closes #123`).
Issues are closed as part of the release process after the release containing the change has been
successfully completed.

The exact tracking mechanism is a project-management choice and does not affect the branch model.

---

# 8. Versioning

The project should use [Semantic Versioning](https://semver.org/) where appropriate:

```text
MAJOR.MINOR.PATCH
```

For example:

```text
2.5.0
```

Generally:

- **PATCH** — backwards-compatible bug fixes.
- **MINOR** — backwards-compatible new functionality.
- **MAJOR** — breaking changes.

The maintainer determines the appropriate version for each release.

Contributors should not normally modify the project version as part of their pull requests.

This keeps version management centralised and prevents multiple PRs from competing to update the version.

---

# 9. Preparing a Release

When the maintainer decides that the current release branch is ready:

```text
release/2.5
      │
      ▼
Ready for release
```

The maintainer performs the final release preparation, which may include:

1. Final testing.
2. Reviewing the changes included in the release.
3. Determining the version number.
4. Preparing or generating the changelog.
5. Preparing release notes.
6. Confirming that the project is ready to publish.

The resulting release should accurately describe the changes that have been integrated.

---

# 10. Promoting a Release to `main`

Once the release is ready, the release branch is merged into `main`.

```text
release/2.5
      │
      ▼
    main
      │
      ▼
   v2.5.0
```

At this point:

- `main` contains the newly released code.
- The release branch can normally be deleted.
- A new release branch can be created for the next development cycle.

For example:

```text
main → v2.5.0
  │
  └── release/2.6
```

---

# 11. Git Tags and Releases

Each released version should have a corresponding Git tag.

For example:

```text
v2.5.0
```

The tag provides a permanent reference to exactly what was released.

A corresponding GitHub Release should normally be created for the tag and contain the release notes.

The release history therefore becomes:

```text
main
 │
 ● v2.3.0
 │
 ● v2.4.0
 │
 ● v2.5.0
```

---

# 12. Automated Release Process

MMC-SERVER releases include a pre-built version of MMC-CLIENT. The corresponding MMC-CLIENT release must therefore exist **before** the MMC-SERVER release is created.

MMC-CLIENT and MMC-SERVER should use the same version number.

The version tag is the trigger for the automated release process.

## Beta Releases

Beta releases allow the integrated release to be packaged and tested before it is promoted to `main`.

Beta versions use Semantic Versioning pre-release identifiers:

```text id="mj81yv"
0.24.0-beta.1
0.24.0-beta.2
0.24.0-beta.3
```

Both MMC-CLIENT and MMC-SERVER must use the same beta version.

> [!IMPORTANT]
> **Do not edit the version number manually in `package.json` or `package-lock.json` when preparing a release.**
>
> Use `npm version` as shown below. It updates the version consistently in both `package.json` and `package-lock.json`.
>
> The `--no-git-tag-version` option prevents npm from automatically creating the Git commit and tag, allowing those steps to remain explicit in the release procedure.

For example:

```bash id="brzrhj"
npm version 0.24.0-beta.11 --no-git-tag-version
```

After running the command, both version files can be committed together:

```bash id="27kb4m"
git add package.json package-lock.json
git commit -m "Bump version to 0.24.0-beta.11"
```

### Release MMC-CLIENT Beta

From the MMC-CLIENT release branch:

```bash id="emjq79"
npm version <version>-beta.<n> --no-git-tag-version
git add package.json package-lock.json
git commit -m "Bump version to <version>-beta.<n>"
git push origin <branch>
```

Create and push the beta tag:

```bash id="gqt0nb"
git tag v<version>-beta.<n>
git push origin v<version>-beta.<n>
```

Wait for the MMC-CLIENT release workflow to complete and confirm that the beta GitHub Release and release artifact have been created successfully.

### Release MMC-SERVER Beta

Update MMC-SERVER to the **same beta version**:

```bash id="a2fxnx"
npm version <version>-beta.<n> --no-git-tag-version
git add package.json package-lock.json
git commit -m "Bump version to <version>-beta.<n>"
git push origin <branch>
```

Verify that MMC-SERVER can install the released client:

```bash id="96f0r9"
npm run install:client
```

Run the required tests and release checks.

Create and push the server beta tag:

```bash id="h1yvpg"
git tag v<version>-beta.<n>
git push origin v<version>-beta.<n>
```

The release workflow builds the supported operating-system artifacts and creates the MMC-SERVER beta release.

Additional beta releases can be produced by incrementing the beta number.

For example:

```text id="rlk9vb"
v0.24.0-beta.1
v0.24.0-beta.2
v0.24.0-beta.3
```

Beta releases do **not** require the release branch to be promoted to `main`.

## Production Release

Once the beta has been tested and the release is considered ready, the release branch is promoted to `main` as described in Section 10.

The production version does not contain the beta suffix:

```text id="xhwstj"
0.24.0
```

Use `npm version` to set the final production version. Do not edit the version files manually.


```bash id="7umwq8"
npm version <version> --no-git-tag-version
git add package.json package-lock.json
git commit -m "Bump version to <version>"
```

As with beta releases, MMC-CLIENT must be released first.

Create and push the MMC-CLIENT production tag:

```bash id="hnl2io"
git tag v<version>
git push origin v<version>
```

Confirm that the MMC-CLIENT production release completed successfully before releasing MMC-SERVER.

Once MMC-SERVER contains the matching version and has been promoted to `main`, create and push its production tag:

```bash id="mxthxb"
git tag v<version>
git push origin v<version>
```

The MMC-SERVER release workflow then creates the production GitHub Release and its supported operating-system artifacts.

## Release Order

For both beta and production releases, the dependency order is:

```text id="45ryy9"
MMC-CLIENT
    │
    │ release completes
    ▼
MMC-SERVER
    │
    ▼
OS release artifacts
```

The complete release sequence is:

1. Set the MMC-CLIENT version.
2. Commit and push the version change.
3. Tag and release MMC-CLIENT.
4. Confirm the MMC-CLIENT release completed successfully.
5. Set MMC-SERVER to exactly the same version.
6. Verify MMC-SERVER can install the released MMC-CLIENT.
7. Complete the server tests and release checks.
8. Tag and release MMC-SERVER.
9. Confirm the GitHub Release and OS-specific artifacts were created successfully.

> **Never create an MMC-SERVER release tag until the corresponding MMC-CLIENT release is available.**

Beta releases allow this process to be exercised and the resulting application packages tested before the final release is promoted to `main`.

---

# 13. Release Notifications

Release announcements should preferably be generated as part of the release process.

For example:

```text
v2.5.0
   │
   ▼
Release workflow
   │
   ├── GitHub Release
   ├── npm publish
   └── phpBB announcement
```

For this project, the release notification could automatically announce the new version on the relevant phpBB forum.

This means the maintainer does not need to remember to perform a separate manual announcement after every release.

The release itself becomes the source of truth for the announcement.

---

# 14. Responsibilities

## Contributors

Contributors are responsible for producing changes that are suitable for review.

The detailed contribution process is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

In summary:

```text
Find/discuss work
      ↓
Fork
      ↓
Branch
      ↓
Develop
      ↓
Test
      ↓
Pull Request
      ↓
Review
```

---

## Maintainer

The maintainer is responsible for:

- Maintaining `main` as the latest released version.
- Creating and managing release branches.
- Reviewing contributions.
- Deciding which contributions are accepted.
- Deciding which accepted changes belong in each release.
- Testing the integrated release.
- Determining release timing.
- Determining the release version.
- Preparing release information.
- Promoting the release to `main`.
- Creating the release tag.
- Managing the release process and automation.

The maintainer therefore controls the boundary between:

```text
accepted development
        ↓
official release
```

---

# 15. Complete Release Cycle

A typical release cycle looks like this:

```text
                  main
               v2.4.0
                  │
                  │
                  ▼
            release/2.5
                  │
        ┌─────────┼─────────┐
        │         │         │
      PR #101   PR #103   PR #107
        │         │         │
        └─────────┼─────────┘
                  │
           Integration testing
                  │
             Release ready
                  │
                  ▼
                main
                  │
                v2.5.0
                  │
                  ▼
            GitHub Actions
             │    │    │
             │    │    └── Notification
             │    └─────── Publish
             └──────────── Release
```

The next cycle then begins from `v2.5.0`.

---

# 16. Guiding Principles

### `main` is stable

`main` represents the latest released version.

### Releases are bundles

Multiple accepted pull requests can be accumulated and released together.

### Pull requests are proposals

A pull request proposes a change. The maintainer decides whether and when it is integrated.

### Accepted does not mean immediately released

A change can be accepted but deferred to a later release.

### The maintainer controls releases

The maintainer determines the contents, timing, and version of each release.

### Tags identify releases

A tag such as `v2.5.0` identifies the exact source code released as that version.

### Automate repetitive work

Testing, building, publishing, creating release artifacts, and sending notifications should be automated wherever practical.

### Keep the process lightweight

The workflow should provide enough structure to make development and releases safe and reproducible without imposing unnecessary process on a small project.

---

# Related Documentation

- **`CONTRIBUTING.md`** — practical instructions for contributors.
- **`CHANGELOG.md`** — history of released changes.
- **`SECURITY.md`** — security vulnerability reporting, if provided.
