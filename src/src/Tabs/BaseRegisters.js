import { Component } from 'react';
import PropTypes from 'prop-types';

import { Paper } from '@mui/material';

import roles from '../data/roles';
import types from '../data/types';

import I18n from '@iobroker/adapter-react-v5/i18n';

import RegisterTable from '../Components/RegisterTable';

class BaseRegisters extends Component {
    constructor(props) {
        super(props);
        this.nativeField = '';
        this.state = {
            order: window.localStorage.getItem('Modbus.order') || 'asc',
            orderBy: window.localStorage.getItem('Modbus.orderBy') || 'Address',
        };
    }

    getRooms() {
        const lang = I18n.getLanguage();
        return this.props.rooms ? Object.values(this.props.rooms).map(room => ({
            value: room._id,
            title: typeof room.common.name === 'object' ? room.common.name[lang] : room.common.name
        })) : [];
    }

    getFields() {
        let rooms = this.getRooms();
        rooms.unshift({value: '', title: ''});

        let result = [
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
            result.splice(1, 0,
                { name: 'deviceId', title: 'Slave ID', type: 'number', sorted: true, width: 20 },
            );
        }

        return result;
    }

    address2struct(address) {
        if (this.nativeField === 'dbs') {
            const parts = address.split(' ');
            const db = parseInt(parts[0].replace('DB', '').replace('db', '').trim(), 10);
            if (parts[1] && parts[1].includes('.')) {
                const a = parseFloat(parts[1]);
                return { db, byte: Math.floor(a), bit: (a * 10) % 10 };
            } else {
                return { db, byte: parseInt(parts[1], 10) };
            }
        } else {
            if (address.includes('.')) {
                const a = parseFloat(address);
                return { byte: Math.floor(a), bit: (a * 10) % 10 };
            } else {
                return { byte: parseInt(address, 10) };
            }
        }
    }

    struct2address(struct) {
        if (struct.db !== undefined) {
            if (struct.bit !== undefined) {
                return `DB${struct.db} ${struct.byte}.${struct.bit}`;
            } else  {
                return `DB${struct.db} ${struct.byte}`;
            }
        } else if (struct.bit !== undefined) {
            return `${struct.byte}.${struct.bit}`;
        } else  {
            return struct.byte;
        }
    }

    changeParam = (index, name, value) => {
        let data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        data[index][name] = value;
        if (name === 'Type') {
            if (['BOOL'].includes(value)) {
                data[index].Length = 0.1;
            } else
            if (['', 'BYTE'].includes(value)) {
                data[index].Length = 1;
            } else
            if (['WORD', 'INT', 'STRING', 'S5TIME'].includes(value)) {
                data[index].Length = 2;
            } else
            if (['DWORD', 'DINT', 'REAL'].includes(value)) {
                data[index].Length = 4;
            } else
            if (['S7TIME'].includes(value)) {
                data[index].Length = 8;
            } else
            if (['S7STRING', 'ARRAY'].includes(value)) {
                data[index].Length = 32;
            }

            if (value === 'BOOL') {
                const struct = this.address2struct(data[index].Address);
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
    }

    addItem = () => {
        let data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        let newItem = {}

        this.getFields().forEach(field => newItem[field.name] = '');

        if (data.length) {
            let sortedData = JSON.parse(JSON.stringify(data));
            sortedData.sort((item1, item2) => item1.Address > item2.Address ? 1 : -1);
            let lastItem = sortedData[sortedData.length - 1];
            const struct = this.address2struct(lastItem.Address);
            if (lastItem.Type === 'BOOL') {
                struct.bit = struct.bit || 0;
                struct.bit++;
                if (struct.bit >= 8) {
                    struct.bit = struct.bit % 8;
                    struct.byte++;
                }
            } else {
                delete struct.bit;
                struct.byte += lastItem.Length;
            }

            if (struct.db !== undefined && struct.byte + lastItem.Length > 0xFFFF) {
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
            newItem.role = 'level';
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
    }

    deleteItem = (index) => {
        let data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        data.splice(index, 1);
        this.props.onChange(this.nativeField, data);
    }

    changeData = (data) => {
        this.props.onChange(this.nativeField, data);
    }

    getDisable = (index, name) => {
        return name === 'Length' &&
            !['STRING', 'S7STRING', 'ARRAY'].includes(this.props.native[this.nativeField][index].type);
    }

    getSortedData = (data, orderBy, order) => {
        this.fields = this.fields || this.getFields();

        data = data || this.props.native[this.nativeField];
        orderBy = orderBy || this.state.orderBy;
        order = order || this.state.order;
        let sortedData = [];
        data.forEach((item, index) => {sortedData[index] = {item, $index: index}});
        const field = this.fields.find(item => item.name === orderBy);

        sortedData.sort((sortedItem1, sortedItem2) => {
            let sort1;
            let sort2;
            if (orderBy === 'Address') {
                const a1 = this.address2struct(sortedItem1.item.Address);
                const a2 = this.address2struct(sortedItem2.item.Address);

                sort1 = 0;
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
                sort1 = parseInt(sortedItem1.item[orderBy], 10);
                sort2 = parseInt(sortedItem2.item[orderBy], 10);
            } else {
                sort1 = sortedItem1.item[orderBy];
                sort2 = sortedItem2.item[orderBy];
            }
            return (order === 'asc' ? sort1 > sort2 : sort1 < sort2) ? 1 : -1;
        });

        return sortedData;
    }

    render() {
        this.fields = this.fields || this.getFields();

        return <Paper>
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
                rooms={this.props.rooms}
                order={this.state.order}
                orderBy={this.state.orderBy}
                showSnackbar={this.props.showSnackbar}
                onChangeOrder={(orderBy, order) => {
                    this.setState({orderBy, order});
                    window.localStorage.setItem('Modbus.orderBy', orderBy);
                    window.localStorage.setItem('Modbus.order', order);
                }}
            />
        </Paper>
    }
}

BaseRegisters.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    changed: PropTypes.bool,
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    showSnackbar: PropTypes.func,
};

export default BaseRegisters;
