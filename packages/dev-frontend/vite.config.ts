/// <reference types="vitest" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [react()],
    define: { "process.env": {} }, // Coinbase SDK wants this
    optimizeDeps: {
        include: [
            "@kumodao/providers",
            "@kumodao/lib-base",
            "@kumodao/lib-ethers",
            "@kumodao/lib-react",
        ],
        esbuildOptions: {
            plugins: [NodeModulesPolyfillPlugin()],
        }
    },
    build: {
        commonjsOptions: {
            include: ["**.cjs", "**.js"]
        },
        rollupOptions: {
            plugins: [ rollupNodePolyFill()],
            output: {
                format: 'esm'
            }
        }
    },
    resolve: {
        alias: {
            assert: "rollup-plugin-node-polyfills/polyfills/assert",
            events: "rollup-plugin-node-polyfills/polyfills/events"
        }
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        deps: {
            inline: [
                "connectkit", // fixes import of "react/jsx-runtime"
                "rollup-plugin-node-polyfills"
            ]
        },
        testTimeout: 10000,
        // the WalletConnect connector of wagmi throws "EthereumProvider.init is not a function" ???
        dangerouslyIgnoreUnhandledErrors: true
    },
    server: {
        host: 'localhost',
        port: 3000,
        cors: false
    }
});