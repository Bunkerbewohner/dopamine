import { defineConfig } from 'vite'

export default defineConfig({
    esbuild: {
        jsxInject: `import React from 'react'`,
    },
    build: {
        outDir: 'docs',
    },
    base: 'https://bunkerbewohner.github.io/dopamine/'
})
