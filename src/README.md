# Packages

Each folder under `src/` is a **package**, and each package is a deep module: a lot of behaviour behind a small interface. Today: `sender`, `receiver`, `shared` and `testing` (test doubles for the Sender).

```
src/<name>/
  index.ts      ← entry point (public): import this from outside
  other.ts      ← another entry point; a package may expose several
  lib/          ← implementation: private, files import each other freely
```

**Entry points are a package's root files.** Anything in a subfolder is private, so a new subfolder never needs a config change, and adding an entry point is just adding a root file. Prefer several small entry points over a barrel `index.ts` that re-exports a whole subtree. The `sender`, `receiver` and `testing` entry points are also the published subpath exports (`webhook-delivery/sender`, `webhook-delivery/receiver`, `webhook-delivery/testing`).

**Outside code imports only entry points.** Tests in `test/` and code in other packages may import a package's root files, never its subfolders. Tests import the published names (`webhook-delivery/receiver`), which resolve to `src` through the `source` export condition.

**Inside a package, anything goes.** A package's own files import each other freely, including into `lib/`.

**No cycles.** No dependency cycles anywhere.

Checked by `pnpm lint:boundaries` (dependency-cruiser, rules in `.dependency-cruiser.cjs`), which also runs in the pre-commit hook.
