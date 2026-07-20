// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs", "dist/**", "drizzle/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: {
          // Both are tooling-only and outside the build tsconfig (include: ["src"]).
          allowDefaultProject: [
            "drizzle.config.ts",
            "scripts/generate-dbml.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
