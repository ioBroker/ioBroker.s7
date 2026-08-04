/** All data types, which are supported by this adapter */
export type S7Type =
    | 'BOOL'
    | 'BYTE'
    | 'WORD'
    | 'DWORD'
    | 'INT'
    | 'DINT'
    | 'REAL'
    | 'STRING'
    | 'S5TIME'
    | 'S7TIME'
    | 'S7STRING'
    | 'ARRAY'
    | '';

/** The category of a register, as it is stored in the `native` part of a state object */
export type S7Category = 'input' | 'output' | 'marker' | 'db';

/** One register (input, output, marker or DB entry), as it is configured in the admin GUI */
export interface DBEntry {
    Type: S7Type;
    deviceId?: number | string;
    Length?: number | string;
    Address: string;
    Description?: string;
    Name?: string;
    Unit?: string;
    Role?: string;
    Room?: string;
    poll?: boolean;
    RW?: boolean | string;
    WP?: boolean | string;
    dec?: string;
    _address?: string;
    _id?: string;
}

/** Connection and general parameters of the adapter */
export interface S7Params {
    ip: string;
    multiDeviceId?: string | number;
    rack: string | number | null;
    slot: string | number | null;
    round: string | number;
    poll: string | number;
    recon: string | number;
    pulsetime: string | number;
    localTSAP: string | number | null;
    remoteTSAP: string | number | null;
    timeFormat: string;
    timeOffset: string | number;
    connectionType?: string | number;
}

/** `native` part of the adapter instance object */
export interface S7AdapterConfig {
    params: S7Params;
    inputs: DBEntry[];
    outputs: DBEntry[];
    markers: DBEntry[];
    dbs: DBEntry[];
}

/** The parameters after they were normalized to numbers in `parseParams()` */
export interface S7ParsedParams extends S7Params {
    poll: number;
    rack: number;
    slot: number;
    recon: number;
    pulsetime: number;
    timeOffset: number;
}

/**
 * A register, enriched with all values, which are calculated once at start-up:
 * the position inside the polled buffer and the ioBroker ID.
 */
export interface S7Register extends DBEntry {
    /** Byte offset inside the area (or inside the DB) */
    offsetByte: number;
    /** Bit offset, only relevant for `BOOL` */
    offsetBit: number;
    /** ioBroker ID of the state, relative to the adapter namespace */
    id: string;
    /** Size of this register in bytes */
    len: number;
    /** Name of the data block, e.g. `DB2`. Only for DB registers */
    db?: string;
    /** Number of the data block, e.g. `2`. Only for DB registers */
    dbId?: number;
    /** Offset as it was configured, e.g. `4.1`. Only for DB registers */
    offset?: string | number;
}

/** `native` part of a state object created by this adapter */
export interface S7StateNative {
    cat: S7Category;
    type: S7Type;
    db?: string;
    dbId?: number;
    address: number;
    offsetBit: number;
    rw: boolean;
    wp: boolean;
    len: number;
}

/** The address range, which must be read for one data block */
export interface DbSize {
    /** Lowest used byte offset */
    lsb: number;
    /** Highest used byte offset (exclusive) */
    msb: number;
    /** Number of the data block */
    dbId: number;
    /** Name of the data block, e.g. `DB2` */
    db: string;
}

/** Error of a snap7 call. `code` is the numeric error code delivered by snap7 */
export class S7Error extends Error {
    public readonly code: number;

    public constructor(code: number, message?: string) {
        super(message ?? `snap7 error 0x${(code >>> 0).toString(16)}`);
        this.name = 'S7Error';
        this.code = code;
    }
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        // The `native` part of the instance object. It is used to type `adapter.config`
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface AdapterConfig extends S7AdapterConfig {}
    }
}
