import { DMMF } from '@prisma/generator-helper'
import { Enum, Field, Root, Type } from 'protobufjs'
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

const mapModel = (model: DMMF.Model) : Type => {
    const mapped = new Type(model.name)

    model.fields.forEach((field, idx) => {
        mapped.add(mapField(field, idx))
    })

    return mapped
}


export const mapSchema = (doc: DMMF.Document) : Root => {
    const root = new Root()

    doc.datamodel.enums.forEach(e => {
        root.add(mapEnum(e))
    })

    doc.datamodel.models.forEach(model => {
        root.add(mapModel(model))
    })

    return root
}

export const writeProto = (root: Root, pkg = '') => {
    return proto(root, pkg)
}
