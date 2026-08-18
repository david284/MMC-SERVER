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

# 4. Pull Request Validation

Pull requests should be subject to automated CI checks.

A typical workflow is:

```text
Pull Request
    │
    ▼
GitHub Actions
    │
    └── Common CI
          ├── Install dependencies
          ├── Lint
          ├── Test
          └── Build
     │
     ▼
Pass / Fail
```

The exact checks are defined by the project.

These checks provide automated verification, while the maintainer remains responsible for deciding whether a change is appropriate for the project.

---

# 5. Integration Testing

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

# 6. Tracking a Release

GitHub Issues, pull requests, labels, and milestones can be used to track release contents.

For example, a milestone named:

```text
v2.5.0
```

can contain the issues and pull requests intended for that release.

This provides a convenient answer to:

> "What is expected to be in the next release?"

The exact tracking mechanism is a project-management choice and does not affect the branch model.

---

# 7. Versioning

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

# 8. Preparing a Release

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

# 9. Promoting a Release to `main`

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

# 10. Git Tags and Releases

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

# 11. Automated Release Process

Once the release tag is created, GitHub Actions can perform the repetitive release tasks.

A typical release pipeline is:

```text
v2.5.0 tag
    │
    ▼
GitHub Actions
    │
    ├── Common CI
    │     ├── Install dependencies
    │     ├── Lint
    │     ├── Test
    │     └── Build
    │
    ├── Create GitHub Release
    ├── Publish npm package
    └── Send release notification
```

The exact steps depend on the project.

The important principle is:

> **The version tag is the trigger for the release process.**

This makes releases reproducible and minimises manual steps.

---

# 12. Release Notifications

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

# 13. Responsibilities

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

# 14. Complete Release Cycle

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

# 15. Guiding Principles

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
