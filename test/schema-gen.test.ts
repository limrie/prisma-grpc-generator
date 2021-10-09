import { mapSchema, writeProto } from '@/generator/schema'
import { getDMMF } from '@prisma/sdk'
import { join } from 'path'

test('generate grpc schema (mongo)', async () => {
    const dmmf = await getDMMF({ datamodelPath: join(__dirname, './mongo.test.prisma') })
    const schema = mapSchema(dmmf)
    const proto = await writeProto(schema)
    expect(proto).toMatchSnapshot()
})

test('generate grpc schema (postgresql)', async () => {
    const dmmf = await getDMMF({ datamodelPath: join(__dirname, './sql.test.prisma') })
    const schema = mapSchema(dmmf)
    const proto = await writeProto(schema)
    expect(proto).toMatchSnapshot()
})
