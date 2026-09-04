# Contributing to the Project

Thank you for your interest in contributing!

This project uses a **fork and pull request** workflow. Contributors work in their own GitHub fork, while the maintainer reviews and integrates accepted changes.

For an overview of how contributions are integrated and released, see [DEVELOPMENT.md](DEVELOPMENT.md).

For an architectural overview of MMC-SERVER, see the
[architecture guide](Documents/Architecture/README.md).

---

## 1. Before You Start

Before beginning work:

1. Check the existing GitHub Issues to see whether the problem or feature has already been discussed.
2. For significant changes, discuss the proposed approach before starting development.
3. Check existing pull requests for overlapping work.
4. Make sure you are starting from an up-to-date version of the project.

For small bug fixes and documentation improvements, prior discussion may not be necessary.

---

## 2. Fork the Repository

Contributors work in their own GitHub fork.

```text
Main repository
      │
      └── Your fork
             │
             └── Your feature/fix branch
```

You do not need write access to the main repository.

Create your fork using GitHub's **Fork** button on the project repository.

---

## 3. Clone Your Fork

Clone your fork to your development machine:

```bash
git clone <your-fork-url>
cd <project-directory>
```

It is useful to configure the original repository as an `upstream` remote:

```bash
git remote add upstream <main-repository-url>
```

You can check the configured remotes with:

```bash
git remote -v
```

Typically:

```text
origin    → your fork
upstream  → main project
```

### Git hooks

The repository includes optional Git hooks which perform quick checks before changes are committed.

To enable them for your local clone:

```bash
git config core.hooksPath .githooks
```

To disable them:

```bash
git config --unset core.hooksPath
```

The hooks are optional and do not replace the checks performed by CI.

---

## 4. Keep Your Fork Up to Date

Before starting new work, update your local copy from the main repository:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

Then update your fork if required:

```bash
git push origin main
```

Keeping your starting point current reduces the likelihood of merge conflicts.

---

## 5. Create a Branch

Do not develop directly on your fork's `main` branch.

Create a separate branch for each change.

Examples:

```text
feature/add-new-option
fix/handle-invalid-input
docs/update-installation
```

For example:

```bash
git checkout -b fix/handle-invalid-input
```

Keep each branch focused on a single feature, bug fix, or related change.

---

## 6. Make Your Changes

Follow the existing structure and conventions of the project.

Where appropriate:

- Treat unit tests as compulsory for changes to server behaviour: add tests for
  new functionality and update tests when behaviour changes.
- Update documentation.
- Update the relevant architecture diagram or recipe when changing component
  responsibilities, event contracts, connection behaviour, or extension points.
- Preserve existing behaviour unless a change is intentional.
- Avoid unrelated refactoring.
- Keep the change focused.

Read [TESTING.md](TESTING.md) before making a code change. It explains the
project's test-first expectations, commands, coverage practice, and test tools.

### Do not change the project version

Contributors should **not normally update the version number** in `package.json` or other release files.

Versioning is handled as part of the release process by the maintainer.

---

## 7. Dependencies

If your change requires a new dependency:

1. Confirm that the dependency is appropriate for the project.
2. Use the project's package manager.
3. Commit the resulting lockfile changes where appropriate.
4. Explain the reason for the dependency in the pull request.

Avoid adding dependencies when the functionality can reasonably be provided by existing dependencies or Node.js itself.

---

## 8. Run Tests and Checks

Before submitting a pull request, run the project's normal checks locally.

The project currently provides these commands:

```bash
npm test
npm run lint
npm run test:coverage
```

Make a reasonable effort to ensure that:

- Existing tests pass.
- New or changed server behaviour has appropriate unit tests. If there is a
  genuine reason not to add one, explain it in the pull request.
- Coverage does not slip without a clear, reviewed reason.
- Linting passes.

The project's automated checks normally repeat these checks for relevant repository updates, including commits pushed to a pull request.

---

## 9. Commit Your Changes

Use clear commit messages.

For example:

```text
Fix handling of invalid configuration
```

or:

```text
Add support for custom notification messages
```

Avoid vague messages such as:

```text
changes
fix stuff
update
```

There is no requirement to produce a particular number of commits. Focus on making the change and pull request easy to understand.

---

## 10. Push Your Branch

Push your branch to your fork:

```bash
git push -u origin fix/handle-invalid-input
```

---

## 11. Create a Pull Request

Create a pull request from your fork to the project's **current release/integration branch**.

For example:

```text
Your fork
   │
   │ fix/handle-invalid-input
   ▼
Main repository
   │
   ▼
release/2.5
```

> **Check the repository for the current target branch before opening your PR.** The target branch may change as new releases are prepared.

Do not assume that `main` is the correct target branch.

---

## 12. Pull Request Description

A good pull request should explain:

- What problem it solves.
- What has changed.
- Why the approach was chosen.
- How the change was tested.
- Any limitations or considerations.

For example:

```markdown
## Summary

Describe the change.

## Why

Explain the problem or motivation.

## Testing

Describe the tests and checks that were run.

## Additional notes

Mention anything the maintainer should be aware of.
```

If the PR addresses an existing issue, reference it where appropriate:

```text
Implements #123
```

---

## 13. Automated Checks

The project runs automated checks for relevant repository updates. When a change is part of a pull request, its check results are shown on that pull request. The checks are defined by the repository's current CI configuration and may change over time.

If checks fail, investigate the failure and push a fix to the same branch.

The existing pull request will update automatically.

---

## 14. Code Review

The maintainer will review your pull request.

They may:

- Approve it.
- Ask questions.
- Request changes.
- Suggest improvements.
- Request additional tests.
- Ask for the implementation to be simplified or restructured.
- Decide that the change should be deferred.
- Decide that the change is not appropriate for the project.

If changes are requested, make them on your existing branch and push them to your fork.

---

## 15. After the Pull Request

Once your pull request has been approved, the maintainer decides when and where it is merged.

An approved PR may be:

- Merged into the current release branch.
- Deferred to a later release.
- Held while other related work is completed.

> **PR approval and release are separate events.**

You do not need to create a release or change the project version.

See [DEVELOPMENT.md](DEVELOPMENT.md) for information about how accepted contributions are integrated and released.

---

## 16. Security Issues

Do **not** report security vulnerabilities through a public GitHub Issue.

If the repository contains a `SECURITY.md` file, follow the security reporting instructions there.

---

# Contributor Checklist

Before submitting a pull request:

- [ ] I have checked for an existing issue or discussed the proposed change where appropriate.
- [ ] I am working from an up-to-date version of the project.
- [ ] My changes are on a dedicated branch.
- [ ] My changes are focused on the intended issue or feature.
- [ ] I have added or updated unit tests for changed server behaviour, or explained why a test is not appropriate.
- [ ] I have checked that coverage has not slipped without a clear reason.
- [ ] I have updated documentation where appropriate.
- [ ] I have updated the architecture documentation when the system behaviour or boundaries changed.
- [ ] I have run the project's tests locally.
- [ ] I have run the project's lint checks.
- [ ] I have not changed the project version.
- [ ] I have not included unrelated changes.
- [ ] My commits have clear messages.
- [ ] My pull request explains what changed and how it was tested.
- [ ] I have selected the current release/integration branch as the PR target.

---

# In Summary

The contributor workflow is:

```text
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
  ↓
Address feedback
  ↓
Maintainer integration
```

The maintainer controls integration and release decisions. Contributors are not expected to manage releases or publishing.
