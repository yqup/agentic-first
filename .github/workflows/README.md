# GitHub Actions

Two workflows.

## `ci.yml` - run on every push and PR

- Parses every file in `directory/schemas/` and `directory/examples/` as JSON.
- Installs the `agentic-first-schema` package on Python 3.11-3.13.
- Runs `agentic-first-validate --help`.
- Runs `agentic-first-validate <file>` against every example profile.
- Runs `agentic-first-validate -` against an example via stdin.
- Builds the sdist + wheel and runs `twine check`.
- Uploads the dist as a workflow artifact (kept 14 days).

No external secrets needed. CI must be green before `publish.yml` runs.

## `publish.yml` - publishes to PyPI on every `v*` tag

Uses **PyPI Trusted Publishing** ([OIDC](https://docs.pypi.org/trusted-publishers/)).
No API tokens stored in this repo.

### One-time PyPI setup (required before the first tag works)

1. Sign in (or create an account) at <https://pypi.org/>. Use the
   account that should own the `agentic-first-schema` project.
2. Reserve the project name with a manual upload, OR (preferred) use
   ["pending publishers"](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)
   to register the GitHub source before any release exists. Settings:

   | Field             | Value                                |
   |-------------------|--------------------------------------|
   | PyPI project name | `agentic-first-schema`               |
   | Owner             | `yqup`                               |
   | Repository name   | `agentic-first`                      |
   | Workflow filename | `publish.yml`                        |
   | Environment name  | `pypi`                               |

3. (Optional but recommended) On GitHub, go to repo Settings -> Environments
   -> New environment -> name `pypi`. Add a "Required reviewers"
   protection rule so a human has to click "Approve" before any release
   actually publishes - cheap insurance.

That's it. After the one-time setup, tagging a release publishes:

```bash
cd /path/to/agentic-first
git tag -a v0.1.1 -m "agentic-first standard v0.1.1"
git push origin v0.1.1
```

The tag triggers `publish.yml`, which builds the package and uploads
to PyPI without any stored credentials.
