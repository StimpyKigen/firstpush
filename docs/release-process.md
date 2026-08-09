# Release Process & Versioning Protocol

## 1. Semantic Versioning Protocol

Mshindi Projo follows [Semantic Versioning 2.0.0](https://semver.org/):

`MAJOR.MINOR.PATCH` (e.g. `1.2.0`)

- **MAJOR**: Incompatible API changes or complete platform architecture shifts.
- **MINOR**: Backward-compatible new features (e.g. adding new jackpot bookmakers, new Gemini AI endpoints).
- **PATCH**: Backward-compatible bug fixes and security hotfixes.

---

## 2. Pre-Release Verification Checklist

Before tagging a new release:

- [ ] **Linter Check**: Run `npm run lint` — verify zero TypeScript errors (`tsc --noEmit`).
- [ ] **Build Check**: Run `npm run build` — confirm Vite client build and esbuild server script compile without errors.
- [ ] **Environment Verification**: Confirm `.env.example` includes all new environment variables.
- [ ] **Changelog Update**: Update `CHANGELOG.md` with release notes detailing Added, Changed, Fixed, and Removed items under the target version header.
- [ ] **Metadata Verification**: Check `metadata.json` version and capability declarations.

---

## 3. Release Execution Steps

1. **Update `package.json` Version**:
   ```json
   "version": "1.2.0"
   ```

2. **Commit Changes**:
   ```bash
   git add .
   git commit -m "chore(release): bump version to 1.2.0"
   ```

3. **Tag Git Release**:
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin main --tags
   ```

4. **Deploy to Production Container**:
   Deploy the tagged release to GCP Cloud Run via automated CI/CD pipeline or AI Studio deployment workflow.

---

## 4. Rollback Procedure

If a critical issue occurs in production:

1. Identify the last known stable Docker image digest in Google Artifact Registry.
2. Direct Cloud Run traffic to the prior revision:
   ```bash
   gcloud run services update-traffic mshindi-projo --to-revisions MSHINDI-PROJO-00012-PREV=100
   ```
3. Document the incident in `docs/troubleshooting.md`.
