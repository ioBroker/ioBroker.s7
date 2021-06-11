import {Component} from 'react';
import PropTypes from 'prop-types';

import roles from '../data/roles';
import types from '../data/types';

import I18n from '@iobroker/adapter-react/i18n';

import RegisterTable from '../Components/RegisterTable';
import Paper from '@material-ui/core/Paper';

class BaseRegisters extends Component {

    nativeField = ''

    getRooms() {
        return this.props.rooms.map(room => ({
            value: room._id,
            title: typeof room.common.name === 'object' ? room.common.name[I18n.lang] : room.common.name
        }));
    }

    getFields() {
        let rooms = this.getRooms();
        rooms.unshift({value: '', title: ''});

        let result = [
            {name: 'Address', title: 'Address', type: 'number', sorted: true, width: 20},
            {name: 'Name', title: 'Name', type: 'text', sorted: true},
            {name: 'Description', title: 'Description', type: 'text', sorted: true},
            {name: 'Type', title: 'Type', type: 'select', options: types, sorted: true},
            {name: 'Length', title: 'Length', type: 'text', width: 20},
            {name: 'Unit', title: 'Unit', type: 'text', width: 30},
            {name: 'Role', title: 'Role', type: 'select', options: roles, sorted: true},
            {name: 'Room', title: 'Room', type: 'select', options: rooms, sorted: true},
            {name: 'poll', title: 'Poll', type: 'checkbox'},
            {name: 'RW', title: 'RW', type: 'checkbox'},
            {name: 'WP', title: 'WP', type: 'checkbox'},
        ]

        if (this.props.native.params.multiDeviceId) {
            result.splice(1, 0,
                {name: 'deviceId', title: 'Slave ID', type: 'number', sorted: true, width: 20},
            );
        }

        return result;
    }

    changeParam = (index, name, value) => {
        let data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        data[index][name] = value;
        this.props.onChange(this.nativeField, data);
    }

    addItem = () => {
        let data = JSON.parse(JSON.stringify(this.props.native[this.nativeField]));
        let newItem = {}
        this.getFields().forEach(field => newItem[field.name] = '')
        if (data.length) {
            let sortedData = JSON.parse(JSON.stringify(data));
            sortedData.sort((item1, item2) => item1.Address > item2.Address ? 1 : -1);
            let lastItem = sortedData[sortedData.length - 1];
            newItem.Address = parseInt(lastItem.Address) + 1;
            newItem.Type = lastItem.Type;
            newItem.Length = lastItem.Length;
            newItem.Unit = lastItem.Unit;
            newItem.Role = lastItem.Role;
            newItem.Room = lastItem.Room;
            newItem.poll = lastItem.poll;
            newItem.RW = lastItem.formula;
            newItem.WP = lastItem.formula;
        } else {
            newItem.role = 'level';
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
        return false;
    }

    render() {
        return <Paper>
            <RegisterTable
                fields={this.getFields()}
                data={this.props.native[this.nativeField]}
                changeParam={this.changeParam}
                addItem={this.addItem}
                deleteItem={this.deleteItem}
                changeData={this.changeData}
                getDisable={this.getDisable}
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
};

export default BaseRegisters;
