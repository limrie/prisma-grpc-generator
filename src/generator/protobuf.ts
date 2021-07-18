import Protobuf, { Enum, Field, MapField, Method, Namespace, OneOf, ReflectionObject, Root, Service, Type } from 'protobufjs'

const snakecase = (str: string) : string => str.substr(0, 1) 
    + str.substr(1)
    .replace(/([A-Z])(?=[a-z]|$)/g, (_, $1) => '_' + $1.toLowerCase())

const escape = (str: string): string => str
    .replace(/[\\"']/g, "\\$&")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u0000/g, "\\0")

const value = (v: any) => {
    switch (typeof v) {
        case "boolean":
            return v ? "true" : "false"
        case "number":
            return v.toString()
        default:
            return "\"" + escape(String(v)) + "\""
    }
}

export const WELL_KNOWN_TYPES = {
    'google.protobuf.Timestamp': 'google/protobuf/timestamp.proto',
    'google.protobuf.Struct': 'google/protobuf/struct.proto'
}

export default async (root: Root, pkg = '', imports = WELL_KNOWN_TYPES) : Promise<string> => {
    const out : string[] = []
    const preamble : string[] = []
    const imported : string[] = []
    let indent = 0

    const importPaths = Object.values(imports).reduce((agg : string[], p) => agg.includes(p) ? agg : [...agg, p], [])

    await root.load(importPaths)

    const push = (line: string) => {
        if (line === "")
            out.push("")
        else {
            let ind = ""
            for (var i = 0; i < indent; ++i)
                ind += "    "
            out.push(ind + line);
        }
    }

    root.resolveAll()

    out.push(`syntax = "proto3";`)
    if(pkg.length) 
      out.push('', `package ${pkg};`)
    buildOptions(root)

    preamble.push(...out)
    out.splice(0, out.length)

    root.nestedArray.forEach(build)

    buildImports()

    return preamble.concat(out).join("\n")


    function build(object: ReflectionObject) {
        if (object instanceof Enum)
            buildEnum(object)
        else if (object instanceof Type)
            buildType(object)
        else if (object instanceof Field)
            buildField(object)
        else if (object instanceof OneOf)
            buildOneOf(object)
        else if (object instanceof Service)
            buildService(object)
        else if (object instanceof Method)
            buildMethod(object)
        else if (object instanceof Namespace)
            buildNamespace(object)
        else 
          throw new Error("Unexpected reflection object of type " + (typeof object))
    }

    function buildEnum(obj: Enum) {
        push("")
        push(`enum ${obj.name} {`)
        ++indent
        const built = buildOptions(obj)
        if(built)
            push("")
        Object.keys(obj.values).forEach(name => {
            const val = obj.values[name]
            push(`${name} = ${val};`)
        })
        --indent
        push("")
    }

    function buildType(obj: Type) {
        const oneOfFields = obj.oneofsArray.map(ofs => ofs.fieldsArray.map(f => f.name)).flat()

        push("")
        push(`message ${obj.name} {`)
        ++indent
        const built = buildOptions(obj)
        if (built) 
            push('')
        obj.oneofsArray.forEach(build)
        obj.fieldsArray.filter(field => !oneOfFields.includes(field.name)).forEach(build)
        obj.nestedArray.forEach(build)
        buildRanges('reserved', obj.reserved)
        --indent
        push("}")
    }

    function buildField(obj: Field) {
        const sb : string[] = []
        if(obj instanceof MapField) 
            sb.push(`map<${obj.keyType}, ${obj.type}>`)
        else if(obj.repeated) 
            sb.push(`repeated ${obj.type}`)
        else
            sb.push(obj.type)
        sb.push(`${snakecase(obj.name)} = ${obj.id}`)
        const opts = buildFieldOptions(obj)
        if(opts)
          sb.push(opts)
        
        push(sb.join(" ") + ';')

        if(imports.hasOwnProperty(obj.type) && !imported.includes(imports[obj.type as keyof typeof imports])) 
            imported.push(imports[obj.type as keyof typeof imports])
    }

    function buildFieldOptions(obj: Field) : string | void | null {
        const opts = obj.options
        if(opts) {
            const sb: string[] = []
            Object.keys(opts).forEach(key => {
                let val = opts[key]
                const typeKey = obj.resolvedType instanceof Enum ? 'int32' : obj.type
                const wireType = Protobuf.types.packed[typeKey as (keyof typeof Protobuf.types.packed)]
                switch(key) {
                    case 'packed':
                        val = Boolean(val)
                        if(wireType === undefined || val)
                            return
                        break
                    case 'default':
                        return
                    default:
                        val = value(val)
                    break
                }
                sb.push(`${key} = ${val}`)
            })

            return sb.length ? `[${sb.join(', ')}]` : null
        }

        return
    }

    function buildOneOf(obj: OneOf) {
        push(`oneof ${snakecase(obj.name)} {`)
        ++indent
        obj.oneof.forEach(fieldname => {
            const field = obj.parent?.get(fieldname)
            if(!(field instanceof Field)) {
                throw new Error(`Unable to find field ${fieldname} for oneof ${obj.name}`)
            } else {
                const opts = buildFieldOptions(field)
                push(`${field.type} ${snakecase(field.name)} = ${field.id}${opts ? ` ${opts}` : ''};`)
            }
        })
        --indent
        push('}')
    }

    function buildService(obj: Service) {
        push(`service ${obj.name} {`)
        ++indent
        obj.methodsArray.forEach(build)
        obj.nestedArray.forEach(build)
        --indent
        push('}')
    }

    function buildMethod(obj: Method) {
        push(`${obj.type} ${obj.name} (${obj.requestStream ? 'stream ' : ''}${obj.requestType}) returns (${obj.responseStream ? 'stream ' : ''}${obj.responseType}) {}`)
    }

    function buildNamespace(obj: Namespace) {
        // skip - this should mean something has come from an import
    }

    function buildOptions(obj: ReflectionObject) {
        const options = obj.options
        if (options && options.length) {
            push("")
            Object.keys(options).forEach(key => {
                push(`option ${key} = ${JSON.stringify(options[key])}`)
            })
            return true
        }
        return false
    }

    function buildRanges(keyword : string, ranges : (string | number[])[]) {
        if (ranges && ranges.length) {
            let parts : string[] = []
            ranges.forEach(function (range) {
                if (typeof range === "string")
                    parts.push(`"${escape(range)}"`)
                else if (range[0] === range[1])
                    parts.push(`${range[0]}`);
                else
                    parts.push(`${range[0]} to ${range[1] === 0x1FFFFFFF ? 'max' : range[1]}`)
            })
            push("")
            push(`${keyword} ${parts.join(', ')};`)
        }
    }

    function buildImports() {
        if (imported.length)
            preamble.push('')

        imported.forEach(path => {
            preamble.push(`import "${path}";`)
        })
    }
}