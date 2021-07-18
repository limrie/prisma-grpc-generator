import { mapSchema, writeProto } from '@/generator/schema'
import { getDMMF } from '@prisma/sdk'
import { join } from 'path'

test('generate grpc schema', async () => {
    const dmmf = await getDMMF({ datamodelPath: join(__dirname, './test.prisma') })
    const schema = mapSchema(dmmf)
    const proto = await writeProto(schema)
    expect(proto).toMatchSnapshot()
})