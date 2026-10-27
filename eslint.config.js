import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

// Common React Three Fiber (R3F) and Three.js declarative properties
const R3F_PROPERTIES = [
  'position',
  'rotation',
  'scale',
  'args',
  'map',
  'transparent',
  'toneMapped',
  'roughness',
  'metalness',
  'emissive',
  'emissiveIntensity',
  'depthWrite',
  'frustumCulled',
  'fog',
  'intensity',
  'distance',
  'decay',
  'geometry',
  'material',
  'attach',
  'visible',
  'castShadow',
  'receiveShadow',
  'renderOrder',
  'object',
  'blending',
  'side',
]

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  // React Compiler experimental rules (includes immutability, purity, refs, set-state-in-effect, etc.)
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'esnext',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      // Handled at compile time by TypeScript
      'react/prop-types': 'off',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Strict standard DOM attribute validation
      'react/no-unknown-property': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message: 'Use a concrete type; keep unknown only at validated data or error boundaries.',
        },
      ],
    },
  },
  {
    // Allow React Three Fiber declarative 3D properties only in 3D scene files
    files: ['src/scene/**/*.tsx'],
    rules: {
      'react/no-unknown-property': ['error', { ignore: R3F_PROPERTIES }],
    },
  },
  prettier,
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.vite/',
      '*.config.*',
      'scripts/',
      'e2e/',
      '.features-gen/',
      '*.mjs',
      '_*.mjs',
      'public/',
      'archive/',
      'blend/',
      'docs/',
      'multi-resume-kit/',
      'oss-contribution-tracker/',
      'threejs-skills/',
      'src/data/*.generated.ts',
    ],
  }
)
