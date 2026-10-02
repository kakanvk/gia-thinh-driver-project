<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI component policy

- Always prefer components provided by the project's installed UI and component libraries over native browser controls or custom implementations.
- If a suitable library component is not installed, install it through the library's official CLI or package manager before implementing the feature.
- Use a native browser control only when no suitable library component exists or the library component cannot meet the requirement. Document that reason in the implementation summary.
