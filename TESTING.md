# Testing in the Development Lifecycle

Testing is a core part of contributing to MMC. Unit tests give us quick,
repeatable evidence that a small part of the server behaves as intended. They
make defects cheaper to find, preserve bug fixes as regression tests, document
the supported behaviour of the code, and make later changes and refactoring
safer. A useful test suite lets contributors work with confidence without
requiring physical CBUS hardware for every change.

For contribution and release workflow, see [CONTRIBUTING.md](CONTRIBUTING.md)
and [DEVELOPMENT.md](DEVELOPMENT.md).

## The expectation for changes

Unit tests should normally be considered compulsory whenever a change affects
server behaviour. Add tests for new behaviour and update tests when intentional
behaviour changes. A bug fix should, where practical, include a test that fails
before the fix and passes afterwards; this stops the same defect returning.

Tests may not be needed for a documentation-only change, a purely mechanical
change with no behavioural effect, or a change that cannot sensibly be isolated
as a unit test. Explain that exception in the pull request. Do not omit a test
simply because the change is small or because the existing suite passes.

If you are unsure what to test, how to isolate a dependency, or how to use the
test tools, please ask for help in the issue or pull request. The project is
available to help contributors find an appropriate testing approach.

## Local checks

Install the project's dependencies, then run the checks provided by the current
`package.json` scripts:

```bash
npm ci
npm run lint
npm test
npm run test:coverage
```

Run lint first as a quick check for static issues. Use `npm test` frequently
while developing, then use `npm run test:coverage` before opening or updating a
pull request to check the suite and its coverage. CI runs linting and the
coverage-enabled unit tests for pushes and pull requests; run the same checks
locally where possible.

Some tests create output and diagnostic files under `unit_tests/`. Keep test
data isolated there and do not depend on a developer's personal configuration,
network connection, or physical hardware.

## A test-first workflow

Where feasible, start with a small test describing the required observable
behaviour. See it fail for the right reason, implement only what is needed to
make it pass, then improve the code and test while keeping the suite green.
This test-first approach clarifies the requirement before implementation and
helps prevent tests that merely confirm the current implementation.

When working in an unfamiliar area, first read the nearest existing
`unit_tests/*.spec.js` file. Follow its CommonJS style, use `describe` and
`it`, and use Chai's `expect` assertions, as the existing suite does. Prefer:

- One behaviour per test, with a descriptive name that states the result.
- Clear arrange, act, assert structure.
- Assertions on observable results, events, errors, or side effects—not private
  implementation details.
- Deterministic inputs, isolated fixtures, and reliable cleanup.
- Async tests that return or `await` their promise so Mocha can observe failures.

Avoid broad tests that conceal several behaviours, timing-dependent sleeps,
uncontrolled external services, and assertions that only prove a function was
called without checking its useful outcome.

## Coverage is a signal, not a substitute for judgement

Coverage helps reveal code paths that the tests do not exercise. This project
uses c8 with `all: true`, so eligible server files that are never loaded by the
tests are visible in the report. Keep coverage from slipping when changing code:
add meaningful tests for new branches, error paths, and boundary conditions,
then inspect the coverage result if it falls.

Do not chase a percentage with weak or duplicate tests. A high number does not
prove correctness, while a focused test that demonstrates an important failure
mode can be very valuable. Never reduce coverage by deleting useful tests or
excluding production code merely to improve a report. If a path is deliberately
untestable, document the reason in the pull request and discuss it with the
maintainer.

## Pull-request evidence

In the pull request, state the commands run and the result. Mention the tests
added or updated and any relevant manual or integration verification. If an
expected check could not be run, say why and what alternative evidence was
obtained. CI is an important final check, but it should confirm local work—not
be the first time a contributor runs the tests.

## Further reading

### Learn to write tests

- [Mocha: Getting Started](https://mochajs.org/getting-started/) — a practical
  first test, how to organise it, and how to run it.
- [Mocha: Asynchronous Code](https://mochajs.org/features/asynchronous-code/)
  — writing reliable callback, Promise, and `async`/`await` tests.
- [Chai: Getting Started](https://www.chaijs.com/guide/) — setting up Chai and
  choosing an assertion style.
- [Chai `expect` assertions](https://www.chaijs.com/guide/styles/#expect) —
  examples of the assertion style already used in MMC's test suite.

### Tool reference

- [Mocha documentation](https://mochajs.org/) — test structure, hooks,
  asynchronous tests, and command-line options.
- [Chai `expect` assertions](https://www.chaijs.com/guide/styles/) — the BDD
  assertion style used by this repository's tests.
- [c8 documentation](https://github.com/bcoe/c8) — Node.js coverage reports,
  included files, and coverage checks.
- [ESLint core concepts](https://eslint.org/docs/latest/use/core-concepts/) —
  understanding and resolving lint findings before review.
