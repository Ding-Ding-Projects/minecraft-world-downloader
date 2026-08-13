# Vendored: mineflayer

Source: https://github.com/PrismarineJS/mineflayer
Version: 4.37.1
Licence: MIT (see `LICENSE` in this directory)

This is a shallow clone with its own git history removed, vendored so the bot control surface can
be built against the library's real API rather than against a remembered one. Every method, event
and option the application calls is read out of `index.d.ts`, `docs/api.md` and `lib/plugins/`
here — a plausible-looking method that does not exist fails at runtime with nothing in a type-check
to catch it.

The application also declares `mineflayer` as an ordinary dependency at the same version, which is
what actually runs. This tree is the reference the interface was built from, and the source
`scripts/check-mineflayer-coverage.mjs` reads to prove every plugin has a home in the feature
inventory.

Do not edit files in this directory. To move to a newer version, re-clone at that tag, update the
version above and in `app/package.json`, and re-run the coverage check — a plugin added upstream
fails that check until it is given a place in the interface.
