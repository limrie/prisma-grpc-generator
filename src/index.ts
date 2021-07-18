import { generatorHandler } from '@prisma/generator-helper'

generatorHandler({
    onGenerate: async (options) => {},
    onManifest: config => ({
        requiresGenerators: ["prisma-client-js"],
    })
})