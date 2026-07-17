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
          // drizzle.config.ts is kit-only and outside the build tsconfig.
          allowDefaultProject: ["drizzle.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
