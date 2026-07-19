import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.tsx',
    'trackman/index': 'src/trackman/index.ts',
  },
  format: ['esm'],
  // tsup's dts worker still passes baseUrl, deprecated in TS 6.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [/^three(\/|$)/, 'react', 'react/jsx-runtime'],
})
