# Changesets

Run `pnpm changeset` to describe a change, select the affected packages and
bump types, then commit the generated file with the change.

On `main`, the release workflow opens a version pull request with changelogs
and version bumps. Merging it publishes the packages to npm.
