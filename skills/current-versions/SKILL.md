---
name: current-versions
description: Look up the current stable version and the official documentation before writing code, instead of trusting memory. Use when adding, installing or upgrading a dependency (npm, pip, uv, NuGet, a container base image, a GitHub Action), when starting a new project or choosing a runtime, language or framework version, and when writing code against a framework, SDK, CLI or cloud API (for example Azure, Microsoft Graph, React, Fastify, FastAPI). Also use when someone asks which version to use, whether a package is still maintained or deprecated, or how to do a major upgrade.
---

# Current versions and current documentation

What you remember about versions is old. Packages release, deprecate and change their APIs after
your training data ends. Look it up every time. One command is enough.

## Rules

1. **Never state a version from memory.** Before you name, install or pin a version, look it up
   with a command or in the official documentation. Say where the number came from.
2. **Read the official documentation for the version you will use** before you write code against
   a framework, SDK, CLI or cloud API. Do not write a call signature, option name or import path
   from memory.
3. **New projects start on the current stable release**, and on the current LTS release where the
   runtime has one (Node.js, .NET). No preview, beta or release-candidate versions unless a person
   asks for one.
4. **No deprecated or unmaintained packages.** Check before you add one. If the registry marks it
   deprecated, or it has had no release for a long time and has open security issues, pick the
   maintained replacement and say why.
5. **Keep the lock file.** Commit it. Never delete it to make an install pass. Install with the
   command that respects it (`npm ci`, `uv sync --locked`, `dotnet restore --locked-mode`).
6. **A major upgrade is its own change.** Do not mix it into a feature or a bug fix. Read the
   migration guide first, upgrade one major version at a time, and run the whole test suite.
7. **Add as few dependencies as you can.** A few lines of your own code are better than a package
   you have to keep current.
8. **If you cannot look it up, say so.** With no network and no lookup tool, write "version not
   checked" next to the version and tell the person. Never present a remembered version as
   current.

## Where to look

| What | Source |
|---|---|
| A library or framework | The vendor's own documentation site and its release notes or changelog |
| Azure and other Microsoft products | Microsoft Learn (`learn.microsoft.com`), with a documentation search tool if you have one |
| A package version | The package registry, with the commands below |
| A breaking change | The project's migration or upgrade guide for the target major version |

Blog posts, forum answers and your own memory are not sources. If two sources disagree, the
vendor's documentation for the installed version wins.

## Commands

Run these in the project folder. They read; they change nothing.

**npm**

```
npm view <pkg> version dist-tags     # current stable version and the tags (latest, next, ...)
npm view <pkg> deprecated            # prints a message when the package is deprecated
npm outdated                         # installed, wanted and latest version per dependency
npm audit --omit=dev                 # known vulnerabilities in what ships
```

**Python**

```
pip index versions <pkg>             # versions on the index, newest first
uv pip list --outdated               # installed packages with a newer release
```

**.NET**

```
dotnet list package --outdated       # packages with a newer release
dotnet list package --deprecated     # packages the author has deprecated
dotnet list package --vulnerable     # packages with known vulnerabilities
```

**Runtimes, base images and actions:** read the vendor's release page for the supported and LTS
versions (Node.js, Python, .NET). Pin a container base image to a version tag and its digest, and
a GitHub Action to a release commit. Look both up; do not copy them from an old project.

## Starting a project

1. Look up the current LTS or stable version of the runtime and of each main framework.
2. Write those versions into the manifest (`package.json` with `engines`, `pyproject.toml` with
   `requires-python`, the `.csproj` target framework) and the Dockerfile.
3. Install once, commit the lock file, and run the audit command.
4. Tell the person which versions you chose and where you looked them up.

## Upgrading

- Patch and minor upgrades: run the outdated command, upgrade, run the tests, commit the manifest
  and the lock file together.
- A major upgrade: its own branch and its own change. Read the migration guide, list the breaking
  changes that touch this code, upgrade, fix, and run every test. Do not skip a major version.
- An upgrade that needs a code change you do not understand: stop and ask a person.

## Web projects

Browser features move as fast as packages. State the browser support target once, in the
project's `AGENTS.md` (or `CLAUDE.md`), with this sentence:

```
This project's Baseline target is Baseline Widely available.
```

Baseline Widely available means the feature has worked in every major browser for at least 30
months. Use such features without a fallback. For a newer feature, add the fallback its
documentation gives, or ask a person to change the target.

For current HTML, CSS and browser API practice, use the Modern Web Guidance skill from Google
Chrome (`GoogleChrome/modern-web-guidance`) when it is installed. It is a separate install, it
runs a package with `npx`, and it sends usage data unless `DISABLE_TELEMETRY=1` is set. If it is
not installed, read MDN and web.dev for the feature and check its Baseline status there.

## Before you finish

Say which versions you looked up and with which command or page, and name anything you did not
check.
