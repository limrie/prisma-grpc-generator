import { DMMF } from '@prisma/generator-helper'
import { Enum, Field, Method, OneOf, ReflectionObject, Root, Service, Type } from 'protobufjs'
import proto from './protobuf'

const TypeMap = {
    String: 'string',
    Boolean: 'bool',
    Int: 'sint32',
    BigInt: 'sint64',
    Float: 'float',
    DateTime: 'google.protobuf.Timestamp',
    Json: 'google.protobuf.Struct',
    Bytes: 'bytes'
}

type TypeKey = keyof typeof TypeMap

const camelCase = (str : string) => str.substr(0, 1).toLowerCase() + str.substr(1)

const pluralize = (str: string) => str + 's'

const mapEnum = (e : DMMF.DatamodelEnum) : Enum => {
    // ToDo : Keep track of enum field values
    // ToDo : Allow to specify default
    const enumValues = e.values.reduce((agg, value, idx) => ({
        ...agg,
        [value.name]: idx + 1, 
    }), {
        'UNKNOWN': 0
    }) 

    return new Enum(e.name, enumValues)
}

const mapField = (field: DMMF.Field, idx: number) : Field => {
    const rule = field.isList ? 'repeated' : field.isRequired ? 'required' : 'optional'

    let fieldType : string
    switch (field.kind) {
        case 'enum':
        case 'object':
            fieldType = field.type
            break
        case 'scalar':
            if (field.type as TypeKey) {
               fieldType = TypeMap[field.type as TypeKey] 
            } else {
                throw new Error(`Scalar fields of type ${field.type} are not supported by the grpc generator`)
            }
            break
        default:
            throw new Error(`${field.kind} fields are not supported by the grpc generator`)
    }

    return new Field(field.name, idx, fieldType, rule)
}

const mapModel = (model: DMMF.Model) : ReflectionObject[] => {
    const mapped = new Type(model.name)
    const service = new Service(`${model.name}Service`)
    const relationFields = model.fields.map(f => f.relationFromFields).filter(Boolean).flat()

    model.fields.filter(f => !relationFields.includes(f.name)).forEach((field, idx) => {
        mapped.add(mapField(field, idx + 1))
    })

    const camelCased = camelCase(model.name)
    const pluralized = pluralize(model.name)
    const camelCasedPlural = camelCase(pluralized)

    const scalars = new Enum(`${model.name}ScalarField`, model.fields.filter(f => f.kind == 'scalar').map(f => f.name).reduce((agg, f, idx) => ({...agg, [f]: idx + 1}), {UNKNOWN: 0}))

    // CRUD
    // Create One
    const createInput = new Type(`Create${model.name}Input`)
    let idx = 0
    model.fields.filter(f => !f.isGenerated && !relationFields.includes(f.name)).forEach( f => {
        if (f.relationName) {

        } else
            createInput.add(mapField(f, ++idx))
    })

    const creator = new Type(`Create${model.name}Request`)
    creator.add(new Field(camelCased, 1, createInput.name))
    
    const created = new Type(`Create${model.name}Response`)
    created.add(new Field(camelCased, 1, model.name))

    service.add(new Method(`create${model.name}`, 'rpc', creator.name, created.name))
    // Create Many
    const manyCreator = new Type(`CreateMany${pluralized}Request`)
    manyCreator.add(new Field(camelCasedPlural, 1, createInput.name, 'repeated'))
    const manyCreated = new Type(`CreateMany${pluralized}Response`)
    manyCreated.add(new Field(camelCasedPlural, 1, model.name, 'repeated'))

    service.add(new Method(`createMany${pluralized}`, 'rpc', manyCreator.name, manyCreated.name))

    // Find Unique
    const findUniqueRequest = new Type(`FindUnique${model.name}Request`)
    const findUniqueInput = new Type(`${model.name}WhereUniqueInput`)
    const uniqueFields = model.fields.filter(f => f.isUnique || f.isId)
    uniqueFields.forEach((f, idx) => {
        findUniqueInput.add(mapField(f, idx))
    })
    findUniqueInput.add(new OneOf('where', uniqueFields.map(f => f.name)))
    findUniqueRequest.add(findUniqueInput)

    const findUniqueResponse = new Type(`FindUnique${model.name}Response`)
    findUniqueResponse.add(new Field(camelCased, 1, mapped.name))

    service.add(new Method(`findUnique${model.name}`, 'rpc', findUniqueRequest.name, mapped.name))

    // Find Many
    const findManyRequest = new Type(`FindMany${pluralized}Request`)
    const findManyInput = new Type(`${model.name}WhereInput`)
    findManyInput.add(new Field('and', 1, findManyInput.name, 'repeated'))
    findManyInput.add(new Field('or', 2, findManyInput.name, 'repeated'))
    findManyInput.add(new Field('not', 3, findManyInput.name, 'repeated'))
    model.fields.filter(f => f.kind == 'scalar').forEach((field, idx) => {
        findManyInput.add(new Field(field.name, idx + 4, `${field.type}WhereInput`))
    })
    findManyRequest.add(new Field('where', 1, findManyInput.name))  

    const orderByInput = new Type(`${model.name}OrderByInput`)
    const orderables = model.fields
        .filter(field => field.kind == 'scalar' && !relationFields.includes(field.name))
        .map(field => field.name)
    orderables.forEach((f, idx) => {
        orderByInput.add(new Field(f, idx + 1, 'SortOrder'))
    })
    orderByInput.add(new OneOf('field', orderables))
    findManyRequest.add(new Field('orderBy', 2, orderByInput.name, 'repeated'))
    findManyRequest.add(new Field('cursor', 3, findUniqueInput.name))
    findManyRequest.add(new Field('take', 4, 'uint32'))
    findManyRequest.add(new Field('skip', 5, 'int32'))
    findManyRequest.add(new Field('distinct', 6, scalars.name, 'repeated'))

    const findManyResponse = new Type(`FindMany${pluralized}Response`)
    findManyResponse.add(new Field(camelCasedPlural, 1, mapped.name, 'repeated'))

    const findManyStreamResponse = new Type(`FindMany${pluralized}StreamResponse`)
    findManyStreamResponse.add(new Field(camelCased, 1, mapped.name))
    findManyStreamResponse.add(new OneOf('case', [camelCased]))

    service.add(new Method(`findMany${pluralized}`, 'rpc', findManyRequest.name, findManyResponse.name))
    service.add(new Method(`findMany${pluralized}Streamed`, 'rpc', findManyRequest.name, findManyStreamResponse.name, false, true))

    // Delete One
    const deleter = new Type(`Delete${model.name}Request`)
    deleter.add(new Field(camelCased, 1, findUniqueInput.name))
    const deleted = new Type(`Delete${model.name}Response`)
    deleted.add(new Field(camelCased, 1, mapped.name))
    service.add(new Method(`delete${model.name}`, 'rpc', deleter.name, deleted.name))

    const manyDeleter = new Type(`DeleteMany${pluralized}Requests`)
    manyDeleter.add(new Field('where', 1, findManyInput.name))
    const manyDeleted = new Type(`DeleteMany${pluralized}Reponse`)
    manyDeleted.add(new Field('count', 1, 'uint32'))
    service.add(new Method(`deleteMany${pluralized}`, 'rpc', manyDeleter.name, manyDeleted.name))

    return [
        mapped, scalars,
        creator, createInput, created, manyCreator, manyCreated,
        findUniqueRequest, findUniqueInput, findUniqueResponse, 
        findManyRequest, findManyInput, findManyResponse, findManyStreamResponse,
        orderByInput,
        deleter, deleted, manyDeleter, manyDeleted,
        service
    ]
}


export const mapSchema = (doc: DMMF.Document) : Root => {
    const root = new Root()

    // system types
    // sort
    root.add(new Enum('SortOrder', {ASC: 0, DESC: 1}))
    //filter
    doc.datamodel.models.map(model => model.fields
            .filter(f => f.kind == 'scalar')
            .map(f => f.type))
        .flat()
        .reduce((agg : string[], f) => agg.includes(f) ? agg : [...agg, f] , [])
    .forEach(scalar => {
        const scalarWhere = new Type(`${scalar}WhereInput`)
        const protoType = TypeMap[scalar as keyof typeof TypeMap]
        scalarWhere.add(new Field('equals', 1, protoType))
        scalarWhere.add(new Field('in', 2, protoType, 'repeated'))
        root.add(scalarWhere)
    })
    

    doc.datamodel.enums.forEach(e => {
        root.add(mapEnum(e))
    })

    doc.datamodel.models.forEach(model => {
        const operations = doc.mappings.modelOperations.find(mo => mo.model == model.name)
        mapModel(model).forEach(obj => root.add(obj))
    })

    return root
}

export const writeProto = (root: Root, pkg = '') => {
    return proto(root, pkg)
}
