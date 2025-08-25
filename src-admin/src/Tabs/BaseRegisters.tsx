import React, { Component } from 'react';

import { Paper } from '@mui/material';

import { type AdminConnection, I18n, type ThemeType } from '@iobroker/adapter-react-v5';

import roles from '../data/roles.json';
import types from '../data/types.json';

import RegisterTable from '../Components/RegisterTable';
import type { DBEntry, S7AdapterConfig } from '../types';

export interface BaseRegistersProps {
    common: ioBroker.InstanceCommon;
    native: S7AdapterConfig;
    instance: number;
    adapterName: string;
    onError?: (err: string) => void;
    onLoad?: () => void;
    onChange: (nativeField: string, value: DBEntry[]) => void;
    changed?: boolean;
    socket: AdminConnection;
    themeType: ThemeType;
    showSnackbar: (
        text: React.JSX.Element | string,
        options?: { variant: 'error' | 'success' | 'info' | 'warning' },
    ) => void;
    rooms?: Record<string, ioBroker.EnumObject>;
}

interface BaseRegistersState {
    order: 'asc' | 'desc';
    orderBy: keyof DBEntry | '$index';
}

export default class BaseRegisters extends Component<BaseRegistersProps, BaseRegistersState> {
    private readonly nativeField: 'dbs' | 'markers' | 'outputs' | 'inputs';
    private fields:
        | {
              name: keyof DBEntry;
              type: string;
              title: string;
              width?: number;
              options?: { value: string; title: string }[];
              expert?: boolean;
              tooltip?: string;
              sorted?: boolean;
              formulaDisabled?: boolean;
          }[]
        | undefined;

    constructor(props: BaseRegistersProps, nativeField: 'dbs' | 'markers' | 'outputs' | 'inputs') {
        super(props);
        this.nativeField = nativeField;
        this.state = {
            order: (window.localStorage.getItem('Modbus.order') as 'asc' | 'desc') || 'asc',
            orderBy: (window.localStorage.getItem('Modbus.orderBy') as keyof DBEntry | '$index') || 'Address',
        };
    }

    getRooms(): { value: string; title: string }[] {
        const lang = I18n.getLanguage();
        return this.props.rooms
            ? Object.values(this.props.rooms).map(room => ({
                  value: room._id,
                  title:
                      (typeof room.common.name === 'object' ? room.common.name[lang] : room.common.name) ||
                      room._id.split('.').pop() ||
                      '',
              }))
            : [];
    }

    getFields(): {
        name: keyof DBEntry;
        type: string;
        title: string;
        width?: number;
        options?: { value: string; title: string }[];
        expert?: boolean;
        tooltip?: string;
        sorted?: boolean;
        formulaDisabled?: boolean;
    }[] {
        const rooms = this.getRooms();
        rooms.unshift({ value: '', title: '' });

        const result: {
            name: keyof DBEntry;
            type: string;
            title: string;
            width?: number;
            options?: { value: string; title: string }[];
            expert?: boolean;
            tooltip?: string;
            sorted?: boolean;
        }[] = [
            { name: 'Address', title: 'Address', type: 'text', sorted: true, width: 20 },
            { name: 'Name', title: 'Name', type: 'text', sorted: true },
            { name: 'Description', title: 'Description', type: 'text', sorted: true },
            { name: 'Type', title: 'Type', type: 'select', options: types, sorted: true },
            { name: 'Length', title: 'Length', type: 'text', width: 20 },
            { name: 'Unit', title: 'Unit', type: 'text', width: 30 },
            { name: 'Role', title: 'Role', type: 'select', options: roles, sorted: true },
            { name: 'Room', title: 'Room', type: 'rooms', options: rooms, sorted: true },
            { name: 'poll', title: 'Poll', type: 'checkbox' },
            { name: 'RW', title: 'RW', type: 'checkbox', expert: true },
            { name: 'WP', title: 'WP', type: 'checkbox', expert: true },
        ];

        if (this.props.native.params.multiDeviceId) {
            result.splice(1, 0, { name: 'deviceId', title: 'Slave ID', type: 'number', sorted: true, width: 20 });
        }

        return result;
    }

    address2struct(address: string): {
        db?: number;
        byte: number;
        bit?: number;
    } {
        if (this.nativeField === 'dbs') {
            const parts = address.split(' ');
            const db = parseInt(parts[0].replace('DB', '').replace('db', '').trim(), 10);
            if (parts[1] && parts[1].includes('.')) {
                const a = parseFloat(parts[1]);
                return { db, byte: Math.floor(a), bit: (a * 10) % 10 };
            }
            return { db, byte: parseInt(parts[1], 10) };
        }

        if (address.includes('.')) {
            const a = parseFloat(address);
            return { byte: Math.floor(a), bit: (a * 10) % 10 };
        }

        return { byte: parseInt(address, 10) };
    }

    struct2address(struct: { db?: number; byte: number; bit?: number }): string {
        if (struct.db !== undefined) {
            if (struct.bit !== undefined) {
                return `DB${struct.db} ${struct.byte}.${struct.bit}`;
            }
            return `DB${struct.db} ${struct.byte}`;
        }
        if (struct.bit !== undefined) {
            return `${struct.byte}.${struct.bit}`;
        }
        return struct.byte.toString();
    }

    changeParam = (index: number, name: keyof DBEntry, value: string | number): void => {
        const data: DBEntry[] = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        (data[index] as unknown as Record<string, string | number>)[name] = value;
        if (name === 'Type') {
            if (['BOOL'].includes(value as DBEntry['Type'])) {
                data[index].Length = 0.1;
            } else if (['', 'BYTE'].includes(value as DBEntry['Type'])) {
                data[index].Length = 1;
            } else if (['WORD', 'INT', 'STRING', 'S5TIME'].includes(value as DBEntry['Type'])) {
                data[index].Length = 2;
            } else if (['DWORD', 'DINT', 'REAL'].includes(value as DBEntry['Type'])) {
                data[index].Length = 4;
            } else if (['S7TIME'].includes(value as DBEntry['Type'])) {
                data[index].Length = 8;
            } else if (['S7STRING', 'ARRAY'].includes(value as DBEntry['Type'])) {
                data[index].Length = 32;
            }

            if (value === 'BOOL') {
                const struct = this.address2struct(data[index].Address.toString());
                if (struct.bit === undefined) {
                    struct.bit = 0;
                    data[index].Address = this.struct2address(struct);
                }
            } else {
                const struct = this.address2struct(data[index].Address);
                if (struct.bit !== undefined) {
                    if (struct.bit > 0) {
                        struct.byte++;
                    }
                    delete struct.bit;

                    data[index].Address = this.struct2address(struct);
                }
            }
        }
        this.props.onChange(this.nativeField, data);
    };

    addItem = (): void => {
        const data: DBEntry[] = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        const newItem: DBEntry = {} as DBEntry;

        this.getFields().forEach(field => ((newItem as unknown as Record<string, any>)[field.name] = ''));

        if (data.length) {
            const sortedData: DBEntry[] = JSON.parse(JSON.stringify(data));
            sortedData.sort((item1, item2) => (item1.Address > item2.Address ? 1 : -1));
            const lastItem = sortedData[sortedData.length - 1];
            const struct = this.address2struct(lastItem.Address);
            if (lastItem.Type === 'BOOL') {
                struct.bit ||= 0;
                struct.bit++;
                if (struct.bit >= 8) {
                    struct.bit = struct.bit % 8;
                    struct.byte++;
                }
            } else {
                delete struct.bit;
                struct.byte += parseFloat(lastItem.Length as string);
            }

            if (struct.db !== undefined && struct.byte + parseFloat(lastItem.Length as string) > 0xffff) {
                struct.db++;
                struct.byte = 0;
                if (lastItem.Type === 'BOOL') {
                    struct.bit = 0;
                }
            }

            newItem.Address = this.struct2address(struct);
            newItem.Type = lastItem.Type;
            newItem.Length = lastItem.Length;
            newItem.Unit = lastItem.Unit;
            newItem.Role = lastItem.Role;
            newItem.Room = lastItem.Room;
            newItem.poll = lastItem.poll;
            newItem.RW = lastItem.RW;
            newItem.WP = lastItem.WP;
        } else {
            newItem.Role = 'level';
            newItem.Type = 'BOOL';
            newItem.Length = '0.1';
            newItem.poll = true;
            if (this.nativeField === 'dbs') {
                newItem.Address = 'DB1 0.0';
            } else {
                newItem.Address = '0.0';
            }
        }
        data.push(newItem);
        this.props.onChange(this.nativeField, data);
    };

    deleteItem = (index: number): void => {
        const data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        data.splice(index, 1);
        this.props.onChange(this.nativeField, data);
    };

    changeData = (data: DBEntry[]): void => {
        this.props.onChange(this.nativeField, data);
    };

    getDisable = (index: number, name: keyof DBEntry): boolean => {
        return (
            name === 'Length' &&
            !['STRING', 'S7STRING', 'ARRAY'].includes(this.props.native[this.nativeField][index].Type)
        );
    };

    getSortedData = (
        data: DBEntry[],
        orderBy: keyof DBEntry | '$index',
        order: 'asc' | 'desc',
    ): { item: DBEntry; $index: number }[] => {
        this.fields ||= this.getFields();

        data ||= this.props.native[this.nativeField];
        orderBy ||= this.state.orderBy;
        order ||= this.state.order;
        const sortedData: { item: DBEntry; $index: number }[] = [];
        data.forEach((item, index) => {
            sortedData[index] = { item, $index: index };
        });
        const field = this.fields.find(item => item.name === orderBy);

        sortedData.sort((sortedItem1, sortedItem2) => {
            let sort1: number | string;
            let sort2: number | string;
            if (orderBy === 'Address') {
                const a1 = this.address2struct(sortedItem1.item.Address);
                const a2 = this.address2struct(sortedItem2.item.Address);

                sort1 = 0;
                sort2 = 0;
                if (a1.db !== undefined) {
                    sort1 = a1.db << 24;
                }
                if (a2.db !== undefined) {
                    sort2 = a2.db << 24;
                }
                sort1 |= a1.byte << 8;
                sort2 |= a2.byte << 8;
                sort1 |= a1.bit || 0;
                sort2 |= a2.bit || 0;
            } else if (orderBy === '$index') {
                sort1 = sortedItem1[orderBy];
                sort2 = sortedItem2[orderBy];
            } else if (field && field.type === 'number') {
                sort1 = parseInt(sortedItem1.item[orderBy] as string, 10);
                sort2 = parseInt(sortedItem2.item[orderBy] as string, 10);
            } else {
                sort1 = sortedItem1.item[orderBy] as string;
                sort2 = sortedItem2.item[orderBy] as string;
            }
            return (order === 'asc' ? sort1 > sort2 : sort1 < sort2) ? 1 : -1;
        });

        return sortedData;
    };

    render(): React.JSX.Element | null {
        this.fields ||= this.getFields();

        return (
            <Paper>
                <RegisterTable
                    prefix={this.nativeField === 'dbs' ? 'DB' : ''}
                    fields={this.fields}
                    getSortedData={this.getSortedData}
                    data={this.props.native[this.nativeField]}
                    changeParam={this.changeParam}
                    addItem={this.addItem}
                    deleteItem={this.deleteItem}
                    changeData={this.changeData}
                    getDisable={this.getDisable}
                    themeType={this.props.themeType}
                    rooms={this.props.rooms!}
                    order={this.state.order}
                    orderBy={this.state.orderBy}
                    showSnackbar={this.props.showSnackbar}
                    onChangeOrder={(orderBy, order) => {
                        this.setState({ orderBy, order });
                        window.localStorage.setItem('Modbus.orderBy', orderBy);
                        window.localStorage.setItem('Modbus.order', order);
                    }}
                />
            </Paper>
        );
    }
}
