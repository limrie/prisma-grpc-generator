import { FieldOptions, FileOptions } from 'google-protobuf/google/protobuf/descriptor_pb'

export interface ConfigOptions {
    package? : string,
    options?: FileOptions.AsObject,
    outputName?: string,
}