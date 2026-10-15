import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 数据加载 / 定时器 / 弹窗重置等场景仍在 useEffect 里同步 setState，
      // 全部改成派生状态需要一个较大的重构；先保留为警告提示，不阻塞 lint。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 官方页面拷贝下来的第三方压缩产物，不参与 lint
    "public/**",
  ]),
]);

export default eslintConfig;
