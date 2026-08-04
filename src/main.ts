/**
 * ioBroker S7 adapter
 *
 * Communicates with Siemens S7 PLCs (and LOGO!) via the snap7 library.
 *
 * Copyright (c) 2015-2026 bluefox <dogafox@gmail.com>, smiling_Jack <smiling_Jack@ioBroker.net>
 * MIT License
 */
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import { S7Client } from 'node-snap7';
import { decode, encode } from 'iconv-lite';

import { formatError, formatSysError } from './lib/errorCodes';
import { convertS7type, getByteSize, isDST, isTrue, normalizeName, sortByAddress } from './lib/tools';
import {
    S7Error,
    type DBEntry,
    type DbSize,
    type S7Category,
    type S7ParsedParams,
    type S7Register,
    type S7StateNative,
    type S7Type,
} from './lib/types';

const ADAPTER_NAME = 's7';
const ENCODING = 'iso-8859-1';
/** snap7 error code, which always requires a full reconnect */
const ERROR_CODE_RECONNECT = 0xa006e;

/** Description of one polled area (inputs, outputs or markers) */
interface AreaDefinition {
    /** Registers of this area, which must be polled */
    registers: S7Register[];
    /** Lowest used byte offset */
    lsb: number;
    /** Highest used byte offset (exclusive). `0` if this area is not used at all */
    msb: number;
}

export class S7Adapter extends Adapter {
    private s7client: S7Client | null = null;
    private isConnected: boolean | null = null;
    private nextPoll: ioBroker.Timeout | undefined;
    private reconTimer: ioBroker.Timeout | undefined;
    private infoRegExp: RegExp | null = null;
    private unloaded = false;

    /** Last acknowledged values, to write only changes into the states */
    private readonly ackObjects: Record<string, { val: ioBroker.StateValue }> = {};
    /** Currently running pulses (write and reset after `pulsetime`) */
    private readonly pulseList: Record<string, ioBroker.StateValue> = {};
    /** Values, which are waiting to be written into the PLC */
    private readonly sendBuffer: Record<string, ioBroker.StateValue> = {};
    /** Cache of the own objects, required in `stateChange` */
    private readonly objects: Record<string, ioBroker.Object> = {};
    /** Cache of the enumerations, used to sync the rooms */
    private readonly enumCache: Record<string, Record<string, ioBroker.EnumObject>> = {};
    /** True while the send buffer is processed */
    private sending = false;

    /** Normalized connection parameters */
    private params: S7ParsedParams = {} as S7ParsedParams;
    /** Rounding factor for `REAL` values, e.g. `100` for 2 decimals */
    private round = 100;
    private errorCount = 0;

    private inputs: AreaDefinition = { registers: [], lsb: 0, msb: 0 };
    private outputs: AreaDefinition = { registers: [], lsb: 0, msb: 0 };
    private markers: AreaDefinition = { registers: [], lsb: 0, msb: 0 };

    /** DB registers, which must be polled */
    private dbs: S7Register[] = [];
    /** Address range of every used data block, by DB name */
    private dbSize: Record<string, DbSize> = {};
    /** Same as `dbSize`, but as array, to iterate faster */
    private dbSizes: DbSize[] = [];

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({ ...options, name: ADAPTER_NAME });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', callback => this.onUnload(callback));

        process.on('SIGINT', () => this.cleanUp());
    }

    // ---------------------------------------------------------------- lifecycle

    private onReady(): void {
        this.infoRegExp = new RegExp(`${this.namespace.replace(/\./g, '\\.')}\\.info\\.`);
        this.s7client = new S7Client();

        void this.main().catch(error => this.log.error(`Cannot start adapter: ${error.toString()}`));
    }

    private cleanUp(): void {
        this.unloaded = true;

        try {
            this.updateConnection(false);
        } catch {
            // the adapter can be terminated before it was fully started
        }

        if (this.nextPoll) {
            this.clearTimeout(this.nextPoll);
            this.nextPoll = undefined;
        }
        if (this.reconTimer) {
            this.clearTimeout(this.reconTimer);
            this.reconTimer = undefined;
        }

        if (this.s7client) {
            try {
                if (this.s7client.Connected()) {
                    this.s7client.Disconnect();
                }
            } catch {
                // ignore
            }

            this.s7client = null;
        }
    }

    private onUnload(callback: () => void): void {
        try {
            this.cleanUp();
        } catch {
            // ignore
        }
        callback();
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack || !id || this.infoRegExp?.test(id)) {
            return;
        }

        if (this.objects[id]) {
            this.prepareWrite(id, state);
        } else {
            this.getObject(id, (err, data) => {
                if (!err && data) {
                    this.objects[id] = data;
                    this.prepareWrite(id, state);
                }
            });
        }
    }

    // ---------------------------------------------------------------- writing

    private writeHelper(id: string, state: Partial<ioBroker.State>): void {
        if (!state || state.val === null || state.val === undefined) {
            this.log.warn(`Write for ${id} cannot be done because no value provided (${state ? state.val : state})`);
            return;
        }

        this.sendBuffer[id] = state.val;

        void this.processSendBuffer();
    }

    private prepareWrite(id: string, state: ioBroker.State): void {
        const _id = id.substring(this.namespace.length + 1);
        const native = this.objects[id]?.native as S7StateNative | undefined;

        if (native?.rw) {
            if (!native.wp) {
                this.writeHelper(id, state);
                this.setTimeout(() => {
                    if (this.ackObjects[_id]) {
                        void this.setState(id, this.ackObjects[_id].val, true);
                    }
                }, this.params.poll * 1.5);
            } else if (this.pulseList[id] === undefined) {
                this.pulseList[id] = this.ackObjects[_id] ? this.ackObjects[_id].val : !state.val;

                this.setTimeout(() => {
                    this.writeHelper(id, { val: this.pulseList[id] });

                    this.setTimeout(() => {
                        if (this.ackObjects[_id]) {
                            void this.setState(id, this.ackObjects[_id].val, true);
                        }
                        delete this.pulseList[id];
                    }, this.params.poll * 1.5);
                }, this.params.pulsetime);

                this.writeHelper(id, state);
            }
        } else if (this.ackObjects[_id]) {
            setImmediate(() => this.setState(id, this.ackObjects[_id].val, true));
        }
    }

    /** Write all values of the send buffer into the PLC, one after another */
    private async processSendBuffer(): Promise<void> {
        if (this.sending) {
            return;
        }
        this.sending = true;

        try {
            let ids = Object.keys(this.sendBuffer);
            while (ids.length) {
                const id = ids[0];
                try {
                    await this.sendValue(id);
                } catch (error) {
                    this.log.error(
                        `DB write error for ${id}: Code #${error instanceof S7Error ? formatError(error.code) : (error as Error).toString()}`,
                    );
                }
                delete this.sendBuffer[id];
                ids = Object.keys(this.sendBuffer);
            }
        } finally {
            this.sending = false;
        }
    }

    /** Convert a value into the buffer, which will be written into the PLC */
    private encodeValue(type: S7Type, value: ioBroker.StateValue, length: number): Buffer | null {
        let val = value;
        let buf: Buffer | null = null;

        if (type === 'BOOL') {
            buf = Buffer.from([val === true || val === 1 || val === 'true' || val === '1' ? 1 : 0]);
        } else if (type === 'BYTE') {
            buf = Buffer.alloc(1);
            buf[0] = parseInt(String(val), 10) & 0xff;
        } else if (type === 'WORD') {
            buf = Buffer.alloc(2);
            buf.writeUInt16BE(parseInt(String(val), 10), 0);
        } else if (type === 'DWORD') {
            buf = Buffer.alloc(4);
            buf.writeUInt32BE(parseInt(String(val), 10), 0);
        } else if (type === 'INT') {
            buf = Buffer.alloc(2);
            buf.writeInt16BE(parseInt(String(val), 10), 0);
        } else if (type === 'DINT') {
            buf = Buffer.alloc(4);
            buf.writeInt32BE(parseInt(String(val), 10), 0);
        } else if (type === 'REAL') {
            buf = Buffer.alloc(4);
            buf.writeFloatBE(parseFloat(String(val)), 0);
        } else if (type === 'STRING' || type === 'ARRAY') {
            if (typeof val === 'string' && val[0] === '{') {
                try {
                    val = JSON.parse(val);
                } catch {
                    // ignore and write the string as it is
                }
            }
            buf = Buffer.alloc(length);
            if (type === 'STRING' && typeof val === 'string') {
                const encoded = encode(val, ENCODING);
                encoded.copy(buf, 0, 0, encoded.byteLength > length ? length : encoded.byteLength);
            } else {
                const array = val as unknown as ArrayLike<number>;
                let i;
                for (i = 0; i < array.length && i < length; i++) {
                    buf[i] = array[i];
                }
                // zero end string
                if (type === 'STRING') {
                    if (i >= length) {
                        i--;
                    }
                    buf[i] = 0;
                }
            }
        } else if (type === 'S7STRING') {
            buf = Buffer.alloc(length + 2);
            buf[0] = length;
            if (typeof val === 'string') {
                const encoded = encode(val, ENCODING);
                encoded.copy(buf, 2, 0, encoded.byteLength > length ? length : encoded.byteLength);
                if (encoded.byteLength < length) {
                    // zero end
                    buf[2 + encoded.byteLength] = 0;
                }
                buf[1] = encoded.byteLength;
            } else {
                const array = val as unknown as ArrayLike<number>;
                let i;
                for (i = 0; i < array.length && i < length; i++) {
                    buf[i + 2] = array[i];
                }
                // zero end string
                if (i < length - 1) {
                    buf[i] = 0;
                }
                buf[1] = i;
            }
        } else if (type === 'S5TIME') {
            // Bin : xxxx 3333 | 2222 1111
            //
            // xxxx = Faktor 0 = 10 ms 1 = 100 ms 2 = 1s 3 = 10s
            //
            // 3333 3 Stelle vom BCD Code ( 0 - 9 )
            // 2222 2 Stelle vom BCD Code ( 0 - 9 )
            // 1111 1 Stelle vom BCD Code ( 0 - 9 )
            let time = parseFloat(String(val));
            let factor;

            if (time > 999) {
                factor = 3; // 11 = 10   s
                time = time / 10;
            } else if (time > 999 * 0.1) {
                factor = 2; // 10 = 1000 ms = 1 s
                time = time / 1;
            } else if (time > 999 * 0.01) {
                factor = 1; // 01 = 100  ms
                time = time / 0.1;
            } else {
                factor = 0; // 00 = 10   ms
                time = time / 0.1;
            }

            if (time > 999) {
                time = 999;
            }

            buf = Buffer.alloc(2);
            buf[1] = Math.trunc(time / 100) | (factor >> 4);
            time = time - Math.trunc(time / 100);
            buf[0] = Math.trunc(time / 10) >> 4;
            time = time - Math.trunc(time / 10);
            buf[0] = buf[0] | Math.trunc(time);
        }

        return buf;
    }

    /** Write one value of the send buffer into the PLC */
    private sendValue(id: string): Promise<void> {
        const s7client = this.s7client;
        if (!s7client) {
            return Promise.reject(new Error('s7client not exists'));
        }

        const data = this.objects[id];
        const native = data?.native as S7StateNative | undefined;
        if (!native) {
            return Promise.reject(new Error(`Object ${id} is unknown`));
        }

        const buf = this.encodeValue(native.type, this.sendBuffer[id], native.len);
        if (!buf) {
            return Promise.reject(new Error(`Unsupported type ${native.type}`));
        }

        return new Promise<void>((resolve, reject) => {
            const done = (err: number | null): void => (err ? reject(new S7Error(err)) : resolve());
            const size = getByteSize(native.type, native.len);
            const bitAddress = native.address * 8 + native.offsetBit;

            try {
                switch (native.cat) {
                    case 'db':
                        if (native.type === 'BOOL') {
                            s7client.WriteArea(
                                s7client.S7AreaDB,
                                native.dbId as number,
                                bitAddress,
                                1,
                                s7client.S7WLBit,
                                buf,
                                done,
                            );
                        } else {
                            s7client.DBWrite(native.dbId as number, native.address, size, buf, done);
                        }
                        break;

                    case 'input':
                        if (native.type === 'BOOL') {
                            s7client.WriteArea(s7client.S7AreaPE, 0, bitAddress, 1, s7client.S7WLBit, buf, done);
                        } else {
                            s7client.EBWrite(native.address, size, buf, done);
                        }
                        break;

                    case 'output':
                        if (native.type === 'BOOL') {
                            s7client.WriteArea(s7client.S7AreaPA, 0, bitAddress, 1, s7client.S7WLBit, buf, done);
                        } else {
                            s7client.ABWrite(native.address, size, buf, done);
                        }
                        break;

                    case 'marker':
                        if (native.type === 'BOOL') {
                            s7client.WriteArea(s7client.S7AreaMK, 0, bitAddress, 1, s7client.S7WLBit, buf, done);
                        } else {
                            s7client.MBWrite(native.address, size, buf, done);
                        }
                        break;

                    default:
                        reject(new Error(`Unknown category ${native.cat as string}`));
                }
            } catch (error) {
                reject(error as Error);
            }
        });
    }

    // ---------------------------------------------------------------- enums

    private async addToEnum(enumName: string, id: string): Promise<void> {
        const obj = await this.getForeignObjectAsync(enumName);
        if (obj?.common) {
            obj.common.members = obj.common.members || [];
            if (!obj.common.members.includes(id)) {
                obj.common.members.push(id);
                await this.setForeignObjectAsync(obj._id, obj);
            }
        }
    }

    private async removeFromEnum(enumName: string, id: string): Promise<void> {
        const obj = await this.getForeignObjectAsync(enumName);
        if (obj?.common?.members) {
            const pos = obj.common.members.indexOf(id);
            if (pos !== -1) {
                obj.common.members.splice(pos, 1);
                await this.setForeignObjectAsync(obj._id, obj);
            }
        }
    }

    /** Ensure that `id` is a member of `newEnumName` and of no other enum of this group */
    private async syncEnums(enumGroup: string, id: string, newEnumName: string | undefined): Promise<void> {
        if (!this.enumCache[enumGroup]) {
            const result = await this.getEnumAsync(enumGroup);
            this.enumCache[enumGroup] = result.result || {};
        }

        // try to find this id in enums
        let found = false;
        for (const e of Object.keys(this.enumCache[enumGroup])) {
            const enumObj = this.enumCache[enumGroup][e];
            if (enumObj?.common?.members?.includes(id)) {
                if (enumObj._id !== newEnumName) {
                    await this.removeFromEnum(enumObj._id, id);
                } else {
                    found = true;
                }
            }
        }

        if (!found && newEnumName) {
            await this.addToEnum(newEnumName, id);
        }
    }

    // ---------------------------------------------------------------- objects

    private async createExtendObject(id: string, objData: ioBroker.SettableObject): Promise<void> {
        try {
            const oldObj = await this.getObjectAsync(id);
            if (oldObj) {
                await this.extendObject(id, objData);
                return;
            }
        } catch {
            // ignore, the object will be created below
        }

        await this.setObjectNotExistsAsync(id, objData);
    }

    private async deleteStates(list: string[]): Promise<void> {
        for (const id of list) {
            try {
                await this.delObjectAsync(id);
            } catch (error) {
                this.log.warn(`Cannot delete object ${id}: ${(error as Error).toString()}`);
            }
        }
    }

    private updateConnection(connected: boolean): void {
        if (this.isConnected !== connected) {
            this.isConnected = connected;
            void this.setState('info.connection', connected, true);
        }
    }

    // ---------------------------------------------------------------- configuration

    /** Normalize the connection parameters, as the GUI stores most of them as strings */
    private parseParams(): void {
        const params = { ...this.config.params } as S7ParsedParams;

        params.poll = parseInt(params.poll as unknown as string, 10) || 1000; // default is 1 second
        params.rack = parseInt(params.rack as unknown as string, 10) || 0;
        params.slot = parseInt(params.slot as unknown as string, 10);
        if (!params.slot && params.slot !== 0) {
            params.slot = 2;
        }
        params.recon = parseInt(params.recon as unknown as string, 10) || 60000;
        params.pulsetime = parseInt(params.pulsetime as unknown as string, 10) || 1000;
        params.timeOffset = parseInt(params.timeOffset as unknown as string, 10) || 0;

        this.round = Math.pow(10, params.round ? parseInt(params.round as string, 10) || 2 : 2);

        this.params = params;
    }

    /**
     * Remove all registers without address and sort the rest by address
     *
     * @param entries the configured registers
     * @param name name of the area, only used for logging
     */
    private filterEntries(entries: DBEntry[] | undefined, name: string): DBEntry[] {
        return (entries || [])
            .filter((el, i) => {
                if (!el.Address && (el.Address as unknown) !== false) {
                    this.log.info(`Ignore ${name} ${i} because no address provided: ${JSON.stringify(el)}`);
                    return false;
                }
                return true;
            })
            .sort(sortByAddress);
    }

    /**
     * Calculate offsets, IDs and sizes of all registers of one area
     *
     * @param entries the configured registers of this area
     * @param prefix ID prefix, e.g. `Inputs`
     */
    private prepareArea(entries: DBEntry[], prefix: string): AreaDefinition {
        const registers: S7Register[] = entries.map(entry => {
            const address = entry.Address.toString().replace(/\+/g, '');
            const parts = address.split('.');
            const offsetByte = parseInt(parts[0], 10) || 0;
            const offsetBit = parseInt(parts[1] || '0', 10);

            return {
                ...entry,
                Address: address,
                offsetByte,
                offsetBit,
                id: `${prefix}.${offsetByte}.${normalizeName(entry.Name) || offsetBit}`,
                len: getByteSize(entry.Type, entry.Length),
            };
        });

        if (!registers.length) {
            return { registers, lsb: 0, msb: 0 };
        }

        const last = registers[registers.length - 1];

        return {
            registers,
            lsb: registers[0].offsetByte,
            msb: last.offsetByte + last.len,
        };
    }

    /** Calculate offsets, IDs, sizes and the required address range of all data blocks */
    private prepareDbs(entries: DBEntry[]): S7Register[] {
        const registers: S7Register[] = [];
        this.dbSize = {};

        for (const entry of entries) {
            const parts = entry.Address.split(' ');
            if (parts.length !== 2) {
                this.log.error(`Invalid format of address: ${entry.Address}`);
                this.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                continue;
            }
            if (!parts[1].match(/^\+?\d+$/) && !parts[1].match(/^\+?\d+\.\d+$/)) {
                this.log.error(`Invalid format of offset: ${entry.Address}`);
                this.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                continue;
            }
            if (!parts[0].match(/^DB/i)) {
                this.log.error(`Invalid format of address: ${entry.Address}`);
                this.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                continue;
            }

            const db = parts[0].trim().toUpperCase();
            const dbId = parseInt(db.substring(2), 10);
            const configuredOffset = parts[1].replace(/\+/g, '');
            // The ID is built from the offset as it was configured, e.g. `4.1`
            const id = `DBs.${db}.${normalizeName(entry.Name) || normalizeName(configuredOffset)}`;

            const offsetParts = configuredOffset.split('.');
            const offsetByte = parseInt(offsetParts[0], 10) || 0;
            let offset: string | number = configuredOffset;
            let offsetBit = 0;

            if (entry.Type === 'BOOL') {
                offsetBit = parseInt(offsetParts[1] || '0', 10);
            } else {
                offset = offsetByte;
            }

            const register: S7Register = {
                ...entry,
                db,
                dbId,
                offset,
                offsetByte,
                offsetBit,
                id,
                len: getByteSize(entry.Type, entry.Length),
            };

            this.dbSize[db] = this.dbSize[db] || { lsb: 0xffff, msb: 0, dbId, db };

            // find size of DB
            if (register.offsetByte + register.len > this.dbSize[db].msb) {
                this.dbSize[db].msb = register.offsetByte + register.len;
            }
            if (register.offsetByte < this.dbSize[db].lsb) {
                this.dbSize[db].lsb = register.offsetByte;
            }

            registers.push(register);
        }

        return registers;
    }

    /**
     * Create the device, channel and state objects of one area
     *
     * @param registers the prepared registers of this area
     * @param prefix ID prefix, e.g. `Inputs`
     * @param cat category, which is stored in the `native` part of the state
     * @param newObjects all created IDs are collected here
     */
    private async createAreaObjects(
        registers: S7Register[],
        prefix: string,
        cat: S7Category,
        newObjects: string[],
    ): Promise<void> {
        if (!registers.length) {
            return;
        }

        await this.setObjectAsync(prefix, {
            type: 'device',
            common: { name: prefix },
            native: {},
        });
        newObjects.push(`${this.namespace}.${prefix}`);

        const channels: string[] = [];

        for (const register of registers) {
            const channel = `${prefix}.${register.offsetByte}`;
            if (!channels.includes(channel)) {
                channels.push(channel);
                await this.setObjectAsync(channel, {
                    type: 'channel',
                    common: { name: register.offsetByte.toString() },
                    native: {},
                });
                newObjects.push(`${this.namespace}.${channel}`);
            }

            await this.createRegisterObject(register, cat, newObjects);
        }
    }

    /** Create the state object of one register */
    private async createRegisterObject(register: S7Register, cat: S7Category, newObjects: string[]): Promise<void> {
        const native: S7StateNative = {
            cat,
            type: register.Type,
            address: register.offsetByte,
            offsetBit: register.offsetBit,
            rw: isTrue(register.RW),
            wp: isTrue(register.WP),
            len: parseInt(register.Length as string, 10),
        };

        if (cat === 'db') {
            native.db = register.db;
            native.dbId = register.dbId;
        }

        await this.createExtendObject(register.id, {
            type: 'state',
            common: {
                name: register.Description || '',
                role: register.Role || 'state',
                type: convertS7type[register.Type] || 'number',
                unit: register.Unit || (register.Type === 'S5TIME' ? 's' : register.Unit),
                read: true,
                write: isTrue(register.RW),
            },
            native: native as unknown as Record<string, any>,
        });

        await this.syncEnums('rooms', `${this.namespace}.${register.id}`, register.Room);

        newObjects.push(`${this.namespace}.${register.id}`);
    }

    // ---------------------------------------------------------------- main

    private async main(): Promise<void> {
        this.parseParams();

        const oldObjects = await this.getForeignObjectsAsync(`${this.namespace}.*`);

        const inputEntries = this.filterEntries(this.config.inputs, 'Input');
        const outputEntries = this.filterEntries(this.config.outputs, 'Output');
        const markerEntries = this.filterEntries(this.config.markers, 'Marker');
        const dbEntries = this.filterEntries(this.config.dbs, 'DBs');

        const inputs = this.prepareArea(inputEntries, 'Inputs');
        const outputs = this.prepareArea(outputEntries, 'Outputs');
        const markers = this.prepareArea(markerEntries, 'Markers');
        const dbs = this.prepareDbs(dbEntries);

        // ------------------ create devices, channels and states -------------
        const newObjects: string[] = [];

        await this.createAreaObjects(inputs.registers, 'Inputs', 'input', newObjects);
        await this.createAreaObjects(outputs.registers, 'Outputs', 'output', newObjects);
        await this.createAreaObjects(markers.registers, 'Markers', 'marker', newObjects);

        if (dbs.length) {
            await this.setObjectAsync('DBs', {
                type: 'device',
                common: { name: 'DBs' },
                native: {},
            });
            newObjects.push(`${this.namespace}.DBs`);

            for (const key of Object.keys(this.dbSize)) {
                if (this.dbSize[key].lsb === 0xffff) {
                    this.dbSize[key].lsb = 0;
                }

                await this.setObjectAsync(`DBs.${this.dbSize[key].db}`, {
                    type: 'channel',
                    common: { name: this.dbSize[key].db },
                    native: {},
                });
                newObjects.push(`${this.namespace}.DBs.${this.dbSize[key].db}`);
            }

            for (const register of dbs) {
                await this.createRegisterObject(register, 'db', newObjects);
            }
        }

        // ----------- remember the registers, which must be polled --------------------------
        this.inputs = { ...inputs, registers: inputs.registers.filter(item => item.poll) };
        this.outputs = { ...outputs, registers: outputs.registers.filter(item => item.poll) };
        this.markers = { ...markers, registers: markers.registers.filter(item => item.poll) };
        this.dbs = dbs.filter(item => item.poll);
        this.dbSizes = Object.keys(this.dbSize).map(key => this.dbSize[key]);

        // ------------------ create info states -------------
        await this.setObjectAsync('info', {
            type: 'device',
            common: { name: 'info', enabled: false } as ioBroker.DeviceCommon,
            native: {},
        });
        newObjects.push(`${this.namespace}.info`);

        await this.createExtendObject('info.poll_time', {
            type: 'state',
            common: {
                name: 'Poll time',
                type: 'number',
                role: 'value',
                unit: 'ms',
                read: true,
                write: false,
            },
            native: {},
        });
        newObjects.push(`${this.namespace}.info.poll_time`);

        await this.createExtendObject('info.connection', {
            type: 'state',
            common: {
                name: 'Connection status',
                role: 'indicator.connection',
                type: 'boolean',
                read: true,
                write: false,
            },
            native: {},
        });
        newObjects.push(`${this.namespace}.info.connection`);

        await this.createExtendObject('info.pdu', {
            type: 'state',
            common: {
                name: 'PDU size',
                role: 'value',
                type: 'number',
                read: true,
                write: false,
            },
            native: {},
        });
        newObjects.push(`${this.namespace}.info.pdu`);

        this.updateConnection(false);

        // clear unused objects
        await this.deleteStates(Object.keys(oldObjects || {}).filter(id => !newObjects.includes(id)));

        if (this.unloaded) {
            return;
        }

        this.subscribeStates('*');

        this.start();
    }

    private start(): void {
        const s7client = this.s7client;
        if (!s7client) {
            return;
        }

        if (this.params.connectionType) {
            s7client.SetConnectionType(parseInt(this.params.connectionType as string, 10));
        }

        const onConnected = (err: number | null, mode: string): void => {
            if (err) {
                this.log.error(`Connection failed. Code #${formatSysError(err)}`);
                this.updateConnection(false);
                this.scheduleReconnect();
            } else {
                this.log.info(`Successfully connected in ${mode} mode`);

                this.updateConnection(true);
                if (this.s7client) {
                    void this.setState('info.pdu', this.s7client.PDULength(), true);
                }

                void this.poll();
            }
        };

        const localTSAP = Number(this.params.localTSAP);
        const remoteTSAP = Number(this.params.remoteTSAP);

        if (localTSAP && remoteTSAP) {
            this.log.info(`Connect in LOGO! mode to ${localTSAP} / ${remoteTSAP}`);
            s7client.SetConnectionParams(this.params.ip, localTSAP, remoteTSAP);
            s7client.Connect(err => onConnected(err, 'LOGO!'));
        } else {
            this.log.info(`Connect in S7 mode to ${this.params.rack} / ${this.params.slot}`);
            s7client.ConnectTo(this.params.ip, this.params.rack, this.params.slot, err => onConnected(err, 'S7'));
        }
    }

    private scheduleReconnect(): void {
        if (this.reconTimer) {
            this.clearTimeout(this.reconTimer);
        }
        this.reconTimer = this.setTimeout(() => {
            this.reconTimer = undefined;
            this.start();
        }, this.params.recon);
    }

    private schedulePoll(): void {
        if (this.nextPoll) {
            this.clearTimeout(this.nextPoll);
        }
        this.nextPoll = this.setTimeout(() => void this.poll(), this.params.poll);
    }

    // ---------------------------------------------------------------- reading

    /** Decode one register out of the polled buffer and write the value into the state */
    private writeValue(
        id: string,
        buff: Buffer,
        type: S7Type,
        offsetByte: number,
        offsetBit: number,
        length: number,
    ): void {
        let val: ioBroker.StateValue = 0;
        let len = length;

        if (type === 'BOOL') {
            val = !!((buff[offsetByte] >> offsetBit) & 1);
        } else if (type === 'BYTE') {
            val = buff[offsetByte];
        } else if (type === 'WORD') {
            val = buff.readUInt16BE(offsetByte);
        } else if (type === 'DWORD') {
            val = buff.readUInt32BE(offsetByte);
        } else if (type === 'INT') {
            val = buff.readInt16BE(offsetByte);
        } else if (type === 'DINT') {
            val = buff.readInt32BE(offsetByte);
        } else if (type === 'STRING') {
            if (len > 255) {
                len = 255;
            }
            const str = Buffer.allocUnsafe(len);
            buff.copy(str, 0, offsetByte, offsetByte + len);
            val = decode(str, ENCODING);
        } else if (type === 'S7STRING') {
            let max = buff[offsetByte];
            len = buff[offsetByte + 1];
            if (max > 512) {
                max = 512;
            }
            if (len > max) {
                len = max;
            }
            const str = Buffer.allocUnsafe(len);
            buff.copy(str, 0, offsetByte + 2, offsetByte + 2 + len);
            val = decode(str, ENCODING);
        } else if (type === 'ARRAY') {
            const result = [];
            for (let i = 0; i < len; i++) {
                result.push(buff[offsetByte + i]);
            }
            val = JSON.stringify(result);
        } else if (type === 'REAL') {
            val = Math.round(buff.readFloatBE(offsetByte) * this.round) / this.round;
        } else if (type === 'S5TIME') {
            // Bin : xxxx 3333 | 2222 1111
            //
            // xxxx = Faktor 0 = 10 ms 1 = 100 ms 2 = 1s 3 = 10s
            //
            // 3333 3 Stelle vom BCD Code ( 0 - 9 )
            // 2222 2 Stelle vom BCD Code ( 0 - 9 )
            // 1111 1 Stelle vom BCD Code ( 0 - 9 )
            //
            // Factor
            // 00 = 10   ms
            // 01 = 100  ms
            // 10 = 1000 ms = 1 s
            // 11 = 10   s
            const raw = buff.readUInt16BE(offsetByte);

            let factor = (raw >> 12) & 0x3;
            if (factor === 0) {
                factor = 0.01;
            } else if (factor === 1) {
                factor = 0.1;
            } else if (factor === 2) {
                factor = 1;
            } else {
                factor = 10;
            }

            const time = ((raw >> 8) & 0xf) * 100 + ((raw >> 4) & 0xf) * 10 + (raw & 0xf);

            if (this.ackObjects[id] === undefined || this.ackObjects[id].val !== time) {
                this.ackObjects[id] = { val: time };
                void this.setState(id, time * factor, true);
            }
            return;
        } else if (type === 'S7TIME') {
            val = this.decodeS7Time(buff, offsetByte);
        } else {
            return;
        }

        if (this.ackObjects[id] === undefined || this.ackObjects[id].val !== val) {
            this.ackObjects[id] = { val };
            void this.setState(id, val, true);
        }
    }

    /** Decode a `DATE_AND_TIME` value, e.g. 0x15100822 0x42301231 = 2015.10.08 22:42:30.123 */
    private decodeS7Time(buff: Buffer, offsetByte: number): number {
        const bcd = (byte: number): number => ((byte >> 4) & 0xf) * 10 + (byte & 0xf);
        const d = new Date();

        // year: 21 = 0x15 => 2015
        let year = bcd(buff[offsetByte]);
        year += year >= 90 ? 1900 : 2000;
        d.setUTCFullYear(year);

        d.setUTCMonth(bcd(buff[offsetByte + 1]) - 1);
        d.setUTCDate(bcd(buff[offsetByte + 2]));
        d.setUTCHours(bcd(buff[offsetByte + 3]));
        d.setUTCMinutes(bcd(buff[offsetByte + 4]));
        d.setUTCSeconds(bcd(buff[offsetByte + 5]));
        d.setUTCMilliseconds(bcd(buff[offsetByte + 6]) * 10 + ((buff[offsetByte + 7] >> 4) & 0xf));

        if (this.params.timeFormat === 'utc') {
            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        } else if (this.params.timeFormat === 'summer') {
            d.setMinutes(d.getMinutes() - this.params.timeOffset + isDST(d));
        } else if (this.params.timeFormat === 'offset') {
            d.setMinutes(d.getMinutes() - this.params.timeOffset);
        }

        return d.getTime();
    }

    /** Read one of the areas: process inputs, process outputs or markers */
    private readArea(area: AreaDefinition, name: 'EBRead' | 'ABRead' | 'MBRead'): Promise<void> {
        const s7client = this.s7client;
        if (!area.msb || !s7client) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            try {
                s7client[name](area.lsb, area.msb - area.lsb, (err, res) => {
                    if (err) {
                        this.log.warn(`${name} error[${area.lsb} - ${area.msb}]: code: ${formatError(err)}`);
                        reject(new S7Error(err));
                        return;
                    }

                    for (const register of area.registers) {
                        try {
                            this.writeValue(
                                register.id,
                                res,
                                register.Type,
                                register.offsetByte - area.lsb,
                                register.offsetBit,
                                register.len,
                            );
                        } catch (error) {
                            this.log.error(`Writing ${name}. Code #${(error as Error).toString()}`);
                        }
                    }
                    resolve();
                });
            } catch (error) {
                this.log.warn(`${name} error[${area.lsb} - ${area.msb}]: ${(error as Error).toString()}`);
                reject(error as Error);
            }
        });
    }

    /** Read all used data blocks */
    private async readDbs(): Promise<void> {
        const s7client = this.s7client;
        if (!s7client || !this.dbSizes.length) {
            return;
        }

        const buffers: Record<string, Buffer> = {};

        await Promise.all(
            this.dbSizes.map(
                db =>
                    new Promise<void>((resolve, reject) => {
                        try {
                            s7client.DBRead(db.dbId, db.lsb, db.msb - db.lsb, (err, res) => {
                                if (err) {
                                    this.log.warn(
                                        `DBRead error[DB ${db.dbId}:${db.lsb} - ${db.msb}]: code: ${formatError(err)}`,
                                    );
                                    reject(new S7Error(err));
                                } else {
                                    buffers[db.db] = res;
                                    resolve();
                                }
                            });
                        } catch (error) {
                            this.log.warn(
                                `DBRead error[DB ${db.dbId}:${db.lsb} - ${db.msb}]: ${(error as Error).toString()}`,
                            );
                            reject(error as Error);
                        }
                    }),
            ),
        );

        for (const db of this.dbs) {
            const buffer = buffers[db.db as string];
            try {
                this.writeValue(
                    db.id,
                    buffer,
                    db.Type,
                    db.offsetByte - this.dbSize[db.db as string].lsb,
                    db.offsetBit,
                    db.len,
                );
            } catch (error) {
                this.log.error(`Writing DB. Code #${(error as Error).toString()}`);
                this.log.error(
                    `Writing DB: ${JSON.stringify({
                        dbID: db.id,
                        db: db.db,
                        dbType: db.Type,
                        dbOffsetByte: db.offsetByte,
                        dbOffsetBit: db.offsetBit,
                        dbLength: db.Length,
                        dbLsb: this.dbSize[db.db as string].lsb,
                        bufLength: buffer?.length,
                    })}`,
                );
            }
        }
    }

    private async poll(): Promise<void> {
        this.nextPoll = null;
        const startTime = Date.now();

        let error: unknown = null;
        try {
            await Promise.all([
                this.readArea(this.inputs, 'EBRead'),
                this.readArea(this.outputs, 'ABRead'),
                this.readArea(this.markers, 'MBRead'),
                this.readDbs(),
            ]);
        } catch (err) {
            error = err;
        }

        const s7client = this.s7client;
        if (!s7client) {
            return; // we are already unloaded
        }

        if (error) {
            const code = error instanceof S7Error ? error.code : 0;
            this.errorCount++;

            this.log.warn(`Poll error count: ${this.errorCount} code: ${formatError(code)}`);
            this.log.warn(
                `Poll error Last-Error Info: ${s7client.LastError()}: ${s7client.ErrorText(s7client.LastError())}`,
            );
            this.updateConnection(false);

            if (this.errorCount < 6 && s7client.Connected() && code !== ERROR_CODE_RECONNECT) {
                this.schedulePoll();
            } else {
                const disconnectSuccess = s7client.Disconnect();
                this.log.error(`try reconnection: Disconnect successful: ${disconnectSuccess}`);
                this.updateConnection(false);
                this.scheduleReconnect();
            }
        } else {
            void this.setState('info.poll_time', Date.now() - startTime, true);
            if (this.errorCount) {
                this.updateConnection(true);
                this.errorCount = 0;
            }
            this.schedulePoll();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new S7Adapter(options);
} else {
    // otherwise start the instance directly
    (() => new S7Adapter())();
}
