# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Neuron morphology

The apical and basal dendritic topology is adapted from Allen Institute Cell Types Database mouse visual-cortex specimen [524850271](https://celltypes.brain-map.org/experiment/electrophysiology/524850271), reconstruction [544723120](https://api.brain-map.org/api/v2/well_known_file_download/544723120). The source reconstruction is dendrite-only. The soma is artistically reshaped, and the displayed hillock and axon are illustrative additions; this is not a complete or independently validated anatomical reconstruction.

The Allen Institute's [Terms of Use](https://alleninstitute.org/legal/terms-of-use/) restrict use of its content to research or other noncommercial purposes unless otherwise stated or permission is obtained. Confirm permission before using the included morphology data commercially.
