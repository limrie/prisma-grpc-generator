import { Config } from "@jest/types"
import { pathsToModuleNameMapper } from 'ts-jest/utils'
const { compilerOptions } = require('./tsconfig.json')

const config: Config.InitialOptions = {
    verbose: false,
    testEnvironment: "node",
    preset: "ts-jest",
    testMatch: ["<rootDir>/test/**/*.ts"],
    testPathIgnorePatterns: [
    ],
    rootDir: "./",
    globals: {
        "ts-jest": {
            tsconfig: "<rootDir>/tsconfig.json",
        },
    },
    collectCoverage: false,
    coverageDirectory: "<rootDir>/coverage",
    collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/**/*.d.ts"],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' }),
    modulePathIgnorePatterns: [
        "<rootDir>/experiments",
        "<rootDir>/lib",
        "<rootDir>/package",
        "<rootDir>/tests/artifacts",
    ],
    testTimeout: 10000,
};

export default config;