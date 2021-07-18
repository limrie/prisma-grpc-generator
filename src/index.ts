import { EnvValue, generatorHandler } from '@prisma/generator-helper'
import { parseEnvValue } from '@prisma/sdk'
import { writeProto, mapSchema } from './generator'
import { writeFile, mkdir } from 'fs/promises'
import { ConfigOptions } from '@/types'
import { join } from 'path'
import execa from 'execa'

const DEFAULT_OUTPUT_NAME = 'crud.proto'

generatorHandler({
    onGenerate: async (options) => {
        const {output, config} : {output: EnvValue | null, config : ConfigOptions} = options.generator
        const outputDir = parseEnvValue(output!)
        const outfile = config.outputName || DEFAULT_OUTPUT_NAME

        console.log("Generating proto definitions...")
        const mkdirPromise = mkdir(outputDir, {recursive: true})
        const protoRoot = mapSchema(options.dmmf)
        if (config.options)
            protoRoot.setOptions(config.options)

        const protoPromise = writeProto(protoRoot, config.package || '')

        const [_, proto] = await Promise.all([mkdirPromise, protoPromise])
        const protoPath = join(outputDir, outfile)
        await writeFile(protoPath, proto)
        console.log("Generated proto definitions.")

        console.log("Generating typescript grpc stubs...")
        execa('proto-loader-gen-types', ["--grpcLib=@grpc/grpc-js", `--outDir=${join(outputDir, 'proto')}`, protoPath])
    },
    onManifest: config => ({
        requiresGenerators: ["prisma-client-js"],
        defaultOutput: './grpc',
        prettyName: 'GRPC Service Generator'
    })
})