# Feature modules

One directory per feature. Each directory owns exactly one entry point:

```
src/renderer/features/<feature-id>/index.ts
```

That file's **default export** is a `FeatureModule`, and the boot sequence finds
it automatically — `main.ts` globs `./features/*/index.ts`, registers every
default export and calls each module's `init`. Adding a feature is adding one
directory; no file outside that directory is edited.

Read `INTEGRATION_CONTRACT.md` at the root of `app/` before writing one. It is
the exact contract: the import paths, the exported names, the CSS custom
properties, the registration shape and the per-feature checklist.

A feature directory may contain as many additional files as it likes
(`panel.ts`, `docs.ts`, `styles.css`, …) as long as `index.ts` is the only entry
point and nothing outside the directory is modified.
