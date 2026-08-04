/**
 * Minimal type definitions for the `node-snap7` package.
 *
 * `node-snap7` is a native binding without bundled typings. Only the parts that are used by this
 * adapter are declared here, plus the constants of the S7 protocol, which are exposed by the
 * binding both as static and as instance members.
 */
declare module 'node-snap7' {
    /** Callback of an asynchronous snap7 call. `err` is the numeric snap7 error code */
    export type S7Callback = (err: number | null) => void;
    /** Callback of an asynchronous snap7 read call */
    export type S7ReadCallback = (err: number | null, data: Buffer) => void;

    export class S7Client {
        // ------------------------------------------------------------------ areas
        static readonly S7AreaPE: number;
        static readonly S7AreaPA: number;
        static readonly S7AreaMK: number;
        static readonly S7AreaDB: number;
        static readonly S7AreaCT: number;
        static readonly S7AreaTM: number;
        readonly S7AreaPE: number;
        readonly S7AreaPA: number;
        readonly S7AreaMK: number;
        readonly S7AreaDB: number;
        readonly S7AreaCT: number;
        readonly S7AreaTM: number;

        // ------------------------------------------------------------------ word length
        static readonly S7WLBit: number;
        static readonly S7WLByte: number;
        static readonly S7WLWord: number;
        static readonly S7WLDWord: number;
        static readonly S7WLReal: number;
        static readonly S7WLCounter: number;
        static readonly S7WLTimer: number;
        readonly S7WLBit: number;
        readonly S7WLByte: number;
        readonly S7WLWord: number;
        readonly S7WLDWord: number;
        readonly S7WLReal: number;
        readonly S7WLCounter: number;
        readonly S7WLTimer: number;

        // ------------------------------------------------------------------ connection types
        static readonly CONNTYPE_PG: number;
        static readonly CONNTYPE_OP: number;
        static readonly CONNTYPE_BASIC: number;
        readonly CONNTYPE_PG: number;
        readonly CONNTYPE_OP: number;
        readonly CONNTYPE_BASIC: number;

        // ------------------------------------------------------------------ control
        /** Connects the client to the PLC with the parameters set with `SetConnectionParams` */
        Connect(callback: S7Callback): void;
        Connect(): boolean;

        /** Connects the client to the hardware at (IP, Rack, Slot) */
        ConnectTo(ip: string, rack: number, slot: number, callback: S7Callback): void;
        ConnectTo(ip: string, rack: number, slot: number): boolean;

        /** Sets the connection resource type, i.e. the way in which the client connects to a PLC */
        SetConnectionType(connectionType: number): boolean;

        /** Sets internally IP, LocalTSAP and RemoteTSAP (LOGO!/S7-200 mode) */
        SetConnectionParams(ip: string, localTSAP: number, remoteTSAP: number): boolean;

        /** Disconnects "gracefully" the client from the PLC */
        Disconnect(): boolean;

        /** Returns the connection state */
        Connected(): boolean;

        /** Returns the negotiated PDU length */
        PDULength(): number;

        /** Returns the last job result */
        LastError(): number;

        /** Returns a textual explanation of a given error number */
        ErrorText(errorCode: number): string;

        // ------------------------------------------------------------------ data I/O
        ReadArea(
            area: number,
            dbNumber: number,
            start: number,
            amount: number,
            wordLen: number,
            callback: S7ReadCallback,
        ): void;
        ReadArea(area: number, dbNumber: number, start: number, amount: number, wordLen: number): Buffer | false;

        WriteArea(
            area: number,
            dbNumber: number,
            start: number,
            amount: number,
            wordLen: number,
            buffer: Buffer,
            callback: S7Callback,
        ): void;
        WriteArea(
            area: number,
            dbNumber: number,
            start: number,
            amount: number,
            wordLen: number,
            buffer: Buffer,
        ): boolean;

        /** Reads a part of a DB */
        DBRead(dbNumber: number, start: number, size: number, callback: S7ReadCallback): void;
        DBRead(dbNumber: number, start: number, size: number): Buffer | false;

        /** Writes a part of a DB */
        DBWrite(dbNumber: number, start: number, size: number, buffer: Buffer, callback: S7Callback): void;
        DBWrite(dbNumber: number, start: number, size: number, buffer: Buffer): boolean;

        /** Reads merkers */
        MBRead(start: number, size: number, callback: S7ReadCallback): void;
        MBRead(start: number, size: number): Buffer | false;

        /** Writes merkers */
        MBWrite(start: number, size: number, buffer: Buffer, callback: S7Callback): void;
        MBWrite(start: number, size: number, buffer: Buffer): boolean;

        /** Reads process inputs */
        EBRead(start: number, size: number, callback: S7ReadCallback): void;
        EBRead(start: number, size: number): Buffer | false;

        /** Writes process inputs */
        EBWrite(start: number, size: number, buffer: Buffer, callback: S7Callback): void;
        EBWrite(start: number, size: number, buffer: Buffer): boolean;

        /** Reads process outputs */
        ABRead(start: number, size: number, callback: S7ReadCallback): void;
        ABRead(start: number, size: number): Buffer | false;

        /** Writes process outputs */
        ABWrite(start: number, size: number, buffer: Buffer, callback: S7Callback): void;
        ABWrite(start: number, size: number, buffer: Buffer): boolean;
    }
}
