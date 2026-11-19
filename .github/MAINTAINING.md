# Maintainer guide

## Development

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
npm run build:demo
```

The package build produces an ES module in `dist/`, with the worker inlined and
Vue externalized. The demo build is not included in the npm package.

The `Deploy demo` workflow deploys the demo to GitHub Pages. In repository
settings under Pages, set the build and deployment source to **GitHub Actions**.

## Releasing

The npm release workflow prepares a patch release when the head commit pushed
to `master` contains `#release`. It verifies the package, increments the patch
version in `package.json` and `package-lock.json`, and opens a pull request.
Review and merge that pull request to run the publish job. The job verifies
the merged commit and publishes it to npm using trusted publishing. A direct
push to `master` still requires permission to bypass its ruleset; a normal pull
request can also deliver the release request.

Before using the workflow:

1. In GitHub repository settings, under Actions > General > Workflow permissions,
   enable "Allow GitHub Actions to create and approve pull requests". This
   permits the workflow to open the version-bump pull request; it does not
   approve or merge it.
2. In the npm package settings, configure a GitHub Actions trusted publisher
   for owner `phreakradio`, repository `arbor-vue`, and workflow
   `release.yml`. Leave the environment field empty.
3. Ensure the workflow is on `master` and review any outstanding security
   advisories before requesting a release.

Pull requests created using GitHub's built-in token do not automatically
trigger ordinary pull-request workflows. The release workflow therefore runs
the package checks both before creating the pull request and again after it
is merged, before publication. Review the version-bump PR before merging;
the merge initiates a public npm publish.

If preparing a release fails after its branch is pushed, remove or reuse the
existing release branch and pull request before retrying. If publication fails,
inspect the publish job and correct the reported problem before rerunning it.
A package name and version already published to npm cannot be reused.
