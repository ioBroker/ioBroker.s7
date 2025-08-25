export interface DBEntry {
    Type:
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
    deviceId?: number | string;
    Length?: number | string;
    Address: string;
    Description?: string;
    Name?: string;
    Unit?: string;
    Role?: string;
    Room?: string;
    poll?: boolean;
    RW?: boolean;
    WP?: boolean;
    dec?: string;
    _address?: string;
    _id?: string;
}

export interface S7AdapterConfig {
    params: {
        ip: string;
        multiDeviceId: string | number;
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
    };
    inputs: DBEntry[];
    outputs: DBEntry[];
    markers: DBEntry[];
    dbs: DBEntry[];
}
