import React, { Component, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import PropTypes from 'prop-types';

import {
    Typography,
    TextField,
    Checkbox,
    Select,
    MenuItem,
    FormControlLabel,
    FormControl,
    Input,
    InputLabel,
    InputAdornment,
    Grid,
    Paper,
    Box,
} from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import connectionInputs from '../data/optionsConnection';
import generalInputs from '../data/optionsGeneral';

const styles = {
    optionsSelect: {
        width: 280,
    },
    optionsTextField: {
        width: 280,
    },
    optionContainer: {
    },
    optionsContainer: {
        width: `calc(100% - 32px)`,
        padding: 16,
        marginBottom: 20,
        display: 'inline-block',
        textAlign: 'left'
    },
    optionsGrid: {
        textAlign: 'center',
        padding: 16,
    },
    optionsLabel: {
        fontSize: 12,
    },
    header: {
        fontSize: 24,
    },
    fileInput: {
        textAlign: 'center',
        display: 'inline-block',
        height: 80,
        width: 200,
        border: '2px dashed #777',
        borderRadius: 10,
        marginTop: 12,
        padding: 4,
    },
};

let FileInput = function (props) {
    const onDrop = useCallback(acceptedFiles => {
        props.onChange(acceptedFiles);
        props.showSnackbar(I18n.t('Data updated'));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const { getRootProps, getInputProps, isDragActive} = useDropzone({onDrop, accept: props.accept});

    return <FormControl style={{ padding: 3, paddingRight: 40 }} variant="standard">
        <Typography variant="h6" gutterBottom>{I18n.t(props.label)}</Typography>
        <div
            {...getRootProps()}
            style={{
                ...styles.fileInput,
                ...(isDragActive ? { backgroundColor: 'rgba(0, 255, 0, 0.1)' } : { cursor: 'pointer' }),
            }}
        >
            <input {...getInputProps()} />
            {
                isDragActive ?
                    <p>{I18n.t('Drop the file here ...')}</p> :
                    <p>{I18n.t(`Drag 'n' drop file here, or click to select file`)}</p>
            }
        </div>
    </FormControl>;
};

class Options extends Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    getValue(name) {
        if (name === 's7logo') {
            return this.props.native.params.slot === null;
        }
        return this.props.native.params[name];
    }

    inputDisabled = input => {
        return false;
    }

    inputDisplay = input => {
        if (this.props.native.params.slot === null) {
            if (['rack', 'slot'].includes(input.name)) {
                return false;
            }
        } else {
            if (['localTSAP', 'remoteTSAP'].includes(input.name)) {
                return false;
            }
        }
        if (input.name === 'timeOffset') {
            return ['summer', 'offset'].includes(this.props.native.params.timeFormat);
        }
        return true;
    }

    getInputsBlock(inputs, title) {
        return <Paper style={styles.optionsContainer}>
            <Typography variant="h4" gutterBottom style={styles.header}>{I18n.t(title)}</Typography>
            <Grid container spacing={2} direction="column">
                {inputs.map(input => {
                    if (!this.inputDisplay(input)) {
                        return null;
                    }
                    if (input.type === 'checkbox') {
                        return <Grid item style={styles.optionContainer} key={input.name}>
                            <FormControlLabel
                                label={I18n.t(input.title)}
                                control={<Checkbox
                                    label={I18n.t(input.title)}
                                    style={styles.optionsCheckbox}
                                    disabled={this.inputDisabled(input)}
                                    checked={this.getValue(input.name)}
                                    onChange={e => this.changeParam(input.name, e.target.checked)}
                                />}/> {input.dimension ? I18n.t(input.dimension) : null}</Grid>;
                    } else if (input.type === 'select') {
                        return <Grid item style={styles.optionContainer} key={input.name}>
                            <FormControl variant="standard">
                                <InputLabel shrink>{I18n.t(input.title)}</InputLabel>
                                <Select
                                    variant="standard"
                                    style={styles.optionsSelect}
                                    displayEmpty
                                    disabled={this.inputDisabled(input)}
                                    value={this.getValue(input.name)}
                                    onChange={e => this.changeParam(input.name, e.target.value)}
                                >
                                    {input.options.map(option =>
                                        <MenuItem key={option.value} value={option.value}>{option.title}</MenuItem>
                                    )}
                                </Select>
                            </FormControl> {input.dimension ? I18n.t(input.dimension) : null}
                        </Grid>;
                    } else if (input.type === 'hex') {
                        let value = parseInt(this.getValue(input.name)) ? parseInt(this.getValue(input.name)) : 0;
                        let top = (value >> 8) & 0xFF;
                        let bottom = value & 0xFF;

                        return <Grid item style={styles.optionContainer} key={input.name}>
                            <InputLabel style={styles.optionsLabel}>{I18n.t(input.title)}</InputLabel>
                            <Input
                                title={I18n.t('Connection type: 0x1 - PG, 0x2 - OP, 0x3-0x10 - S7 Basic')}
                                style={{width: '6ch'}}
                                value={top.toString(16) ? top.toString(16).toUpperCase() : 0}
                               onChange={e => {
                                   if (parseInt(e.target.value, 16) > 0xFF || parseInt(e.target.value, 16) < 0) {
                                       return;
                                   }
                                   this.changeParam(input.name, (parseInt(e.target.value, 16) << 8) | bottom);
                               }}
                            />
                            <Input
                                title={I18n.t('Rack and slot: [Rack * 0x20 + Slot]')}
                                style={{marginLeft: 5, width: '6ch'}}
                                value={bottom.toString(16) ? bottom.toString(16).toUpperCase() : 0}
                                onChange={e => {
                                    if (parseInt(e.target.value, 16) > 0xFF || parseInt(e.target.value, 16) < 0) {
                                        return;
                                    }
                                    this.changeParam(input.name, (top << 8) | parseInt(e.target.value, 16));
                                }}
                            />
                        </Grid>;
                    } else {
                        return <Grid item style={styles.optionContainer} key={input.name}>
                            <TextField
                                type={input.type}
                                variant="standard"
                                label={I18n.t(input.title)}
                                style={styles.optionsTextField}
                                disabled={this.inputDisabled(input)}
                                value={this.getValue(input.name)}
                                InputProps={{
                                    endAdornment: input.dimension ?
                                        <InputAdornment position="end">{I18n.t(input.dimension)}</InputAdornment> : null
                                }}
                                onChange={e => this.changeParam(input.name, e.target.value)}
                            />
                        </Grid>;
                    }
                })}
            </Grid>
        </Paper>;
    }

    getImportsBlock() {
        return <Paper style={styles.optionsContainer}>
            <Typography variant="h4" gutterBottom style={styles.header}>{I18n.t('Import')}</Typography>
            <Box style={styles.optionContainer}>
                <FileInput
                    onChange={this.loadSymbols}
                    label="Load symbols"
                    accept=".asc"
                    showSnackbar={this.props.showSnackbar}
                />
                <FileInput
                    onChange={this.addDb}
                    label="Add DB"
                    accept=".csv,.prn"
                    showSnackbar={this.props.showSnackbar}
                />
            </Box>
        </Paper>;
    }

    render() {
        return <form style={styles.tab}>
            <Grid container spacing={2} >
                <Grid item xs={12} md={6} style={styles.optionsGrid}>
                    {this.getInputsBlock(connectionInputs, 'PLC Connection')}
                    {this.getImportsBlock()}
                </Grid>
                <Grid item xs={12} md={6} style={styles.optionsGrid}>{this.getInputsBlock(generalInputs, 'General')}</Grid>
            </Grid>
        </form>;
    }

    changeParam = (name, value) => {
        let native = JSON.parse(JSON.stringify(this.props.native));
        if (name === 's7logo') {
            if (value) {
                native.params.localTSAP = '';
                native.params.remoteTSAP = '';
                native.params.rack = null;
                native.params.slot = null;
            } else {
                native.params.localTSAP = null;
                native.params.remoteTSAP = null;
                native.params.rack = '';
                native.params.slot = '';
            }
        } else {
            native.params[name] = value;
        }
        this.props.changeNative(native);
    }

    loadSymbols = e => {
        let native = JSON.parse(JSON.stringify(this.props.native));
        const reader = new FileReader();

        reader.onload = e => {
            const localData = {
                inputs:  [],
                outputs: [],
                markers: []
//                counter: [],
//                timer: [],
//                dbs: []
            };
            let text = reader.result;

            text = text.split('126,');
            text.forEach(line => {
                const typ = line.slice(23, 29).replace(/( )/g, '');

                const d = {
                    Name:         line.slice(0, 23).replace(/( ){2,}/g, ''),
                    Address:      line.slice(29, 36).replace(/( )/g, ''),
                    Type:         line.slice(36, 41).replace(/( )/g, ''),
                    Description:  line.slice(46, 126).replace(/( ){2,}/, ''),
                    Unit:         '',
//                    Role:         '',
//                    Room:         '',
                    poll:         true,
                    RW:           false,
                    WP:           false
                };

//                    if (typ == 'E' || typ == 'EB' ||typ == 'EW' ||typ == 'ED'||typ == 'PEB'||typ == 'PEW'||typ == 'PED')data.inputs.push(d);
//                    if (typ == 'A' || typ == 'AB' ||typ == 'AW' ||typ == 'AD'||typ == 'PAB'||typ == 'PAW'||typ == 'PAD')data.outputs.push(d);
                if (typ === 'E' || typ === 'EB' || typ === 'EW' || typ === 'ED') localData.inputs.push(d);
                if (typ === 'A' || typ === 'AB' || typ === 'AW' || typ === 'AD') localData.outputs.push(d);
                if (typ === 'M' || typ === 'MB' || typ === 'MW' || typ === 'MD') localData.markers.push(d);
//                if (typ == 'C')data.counter.push(d);
//                if (typ == 'T')data.timer.push(d);
//                if (typ == 'DB')data.dbs.push(d);
            });

            ['inputs', 'outputs', 'markers'].forEach(table => {
                native[table] = localData[table];
            });
            this.props.changeNative(native);
        };

        reader.readAsText(e[0], 'ISO-8859-1');
    }

    addDb = e => {
        let native = JSON.parse(JSON.stringify(this.props.native));
        const reader = new FileReader();

        reader.onload = e => {
            setTimeout(function () {
                const text       = reader.result;
                const changes  = {
                    inputs: false,
                    outputs: false,
                    markers: false,
                    dbs: false
                };
                const newParts = {
                    inputs:     native.inputs || [],
                    outputs:    native.outputs || [],
                    markers:    native.markers || [],
                    dbs:        native.dbs || []
                };

                if (text.indexOf('Leseanforderung') !== -1) {
                    // Graphpic format
                    const lines = text.replace(/\r\n/g, '\n').split('\n');
                    const mapping = {
                        'Name':             {attr: 'Name'},
                        'Typ':              {attr: ''},
                        'Operand':          {attr: 'Address',       process: f => {
                            // DB 504.DBW 1462 => DB504 1462
                            f = f.trim();
                            const db     = f.match(/^DB (\d+)/);
                            if (!db) {
                                // M
                                // MB
                                let m = f.match(/^MB? (\d+)\.?(\d+)?$/);
                                if (m) {
                                    return 'M ' + parseInt(m[1], 10) + (m[2] !== undefined ? '.' + m[2] : '');
                                } else {
                                    m = f.match(/^AB? (\d+)\.?(\d+)?$/);
                                    if (m) {
                                        return 'OUT ' + parseInt(m[1], 10) + (m[2] !== undefined ? '.' + m[2] : '');
                                    } else {
                                        m = f.match(/^EB? (\d+)\.?(\d+)?$/);
                                        if (m) {
                                            return 'IN ' + parseInt(m[1], 10) + (m[2] !== undefined ? '.' + m[2] : '');
                                        } else {
                                            return f;
                                        }
                                    }
                                }
                            }

                            const offset = f.match(/(\d+).?(\d+)?$/);
                            if (db && offset) {
                                return `DB${db[1]} ${offset[1]}${offset[2] !== undefined ? '.' + offset[2] : ''}`;
                            } else {
                                return f;
                            }
                        }},
                        'SPS-Format':       { attr: 'Type',          process: function (f) {return f;} },
                        'Byteanzahl':       { attr: 'Length',        process: function (f) {return parseInt(f, 10);} },
                        'Zugriff':          { attr: 'RW',            process: function (f) {return f !== 'read';} },
                        'Leseanforderung':  { attr: 'poll',          process: function (f) {return f === 'zyklisch';} },
                        'AktZeit (ms)':     { attr: '' },
                        'Kommentar':        { attr: 'Description' },
                        'Clients (Anzahl)': { attr: '' }
                    };
                    // First line
                    // "Name","Typ","Operand","SPS-Format","Byteanzahl","Zugriff","Leseanforderung","AktZeit (ms)","Kommentar","Clients (Anzahl)"
                    let sFields = lines[0].split(',');
                    // create mapping
                    const fields = [];
                    for (let m = 0; m < sFields.length; m++) {
                        sFields[m] = sFields[m].replace(/"/g, '');
                        fields.push(mapping[sFields[m]]);
                    }
                    for (let l = 1; l < lines.length; l++) {
                        lines[l] = lines[l].trim();
                        if (!lines[l]) continue;
                        sFields = lines[l].trim().split(',');
                        let obj = {
                            Type: 'ARRAY',
                            Unit: '',
                            Role: '',
                            Room: '',
                            poll: true,
                            RW:   false,
                            WP:   false,
                        };
                        for (let f = 0; f < fields.length; f++) {
                            if (!fields[f].attr) {
                                continue;
                            }
                            if (!sFields[f]) {
                                console.log('error');
                                break;
                            }
                            sFields[f] = sFields[f].replace(/"/g, '');
                            obj[fields[f].attr] = fields[f].process ? fields[f].process(sFields[f]) : sFields[f];

                            if (obj.Name.match(/^@/)) {
                                obj = null;
                                break;
                            }
                        }
                        if (obj) {
                            if (obj.Type === 'BYTE' && obj.Length !== 1) {
                                obj.Type = 'ARRAY';
                            }
                            if (obj.Type === 'CHAR') {
                                obj.Type = 'STRING';
                            }
                            if (obj.Type === 'BYTE' || obj.Type === 'BOOL' || obj.Type === 'INT') {
                                obj.Length = '';
                            }
                            let _attr;
                            if (obj.Address.match(/^DB/)) {
                                _attr = 'dbs';
                            } else if (obj.Address.match(/^IN/)) {
                                obj.Address = obj.Address.replace(/^IN\s?/, '');
                                _attr = 'inputs';
                            } else if (obj.Address.match(/^OUT/)) {
                                _attr = 'outputs';
                                obj.Address = obj.Address.replace(/^OUT\s?/, '');
                            } else if (obj.Address.match(/^M/)) {
                                _attr = 'markers';
                                obj.Address = obj.Address.replace(/^M\s?/, '');
                            } else {
                                console.error('Unknown TYPE: ' + obj.Address);
                                continue;
                            }
                            // try to find same address
                            for (let aaa = 0; aaa < newParts[_attr].length; aaa++) {
                                if (newParts[_attr][aaa].Address === obj.Address) {
                                    newParts[_attr][aaa] = obj;
                                    changes[_attr] = true;
                                    obj = null;
                                    break;
                                }
                            }
                            if (obj) {
                                changes[_attr] = true;
                                newParts[_attr].push(obj);
                            }
                        }
                    }
                } else {
                    const mm = text.match(/(DB)[0-9]+\s-\s/g);
                    const db = mm ? mm[0].replace(' - ', '') : '';
                    const vv = text.split('STRUCT');

                    const struck = vv[1] ? vv[1].split('=')[0].split('\n') : [];

                    struck.forEach((item) => {
                        if (item.length > 10) {
                            const x = item.split(/\s+/g);
                            x.shift();

                            let obj = {
                                Address:        `${db} ${x.shift()}`,
                                Name:           x.shift(),
                                Type:           x.shift(),
                                dec:            x.shift(),
                                Description:    x.join(' '),
                                Unit:           '',
                                Role:           '',
                                Room:           '',
                                poll:           true,
                                RW:             false,
                                WP:             false,
                            };

                            // try to find same address
                            for (let aaa = 0; aaa < newParts.dbs.length; aaa++) {
                                if (newParts.dbs[aaa].Address === obj.Address) {
                                    newParts.dbs[aaa] = obj;
                                    changes.dbs = true;
                                    obj = null;
                                    break;
                                }
                            }
                            if (obj) {
                                changes.dbs = true;
                                newParts.dbs.push(obj);
                            }
                        }
                    });
                }
                for (const attr in newParts) {
                    if (!newParts.hasOwnProperty(attr)) {
                        continue;
                    }
                    newParts[attr].sort((a, b) => {
                        const aDB = a.Address.match(/^D?B?\s?(\d+)/);
                        const bDB = b.Address.match(/^D?B?\s?(\d+)/);
                        if (!aDB) return -1;
                        if (!bDB) return 1;
                        if (parseInt(aDB[1], 10) > parseInt(bDB[1], 10)) return 1;
                        if (parseInt(aDB[1], 10) < parseInt(bDB[1], 10)) return -1;
                        const aOffset = a.Address.match(/\s(\d+).?(\d+)?$/);
                        const bOffset = b.Address.match(/\s(\d+).?(\d+)?$/);
                        if (!aOffset) return -1;
                        if (!bOffset) return 1;
                        if (parseInt(aOffset[1], 10) > parseInt(bOffset[1], 10)) return 1;
                        if (parseInt(aOffset[1], 10) < parseInt(bOffset[1], 10)) return -1;
                        if (aOffset[2] === undefined && bOffset[2] !== undefined) return 1;
                        if (bOffset[2] === undefined && aOffset[2] !== undefined) return -1;
                        if (aOffset[2] === undefined && bOffset[2] === undefined) return 0;
                        if (parseInt(aOffset[2], 10) > parseInt(bOffset[2], 10)) return 1;
                        if (parseInt(aOffset[2], 10) < parseInt(bOffset[1], 10)) return -1;
                        return 0;
                    });
                }
                if (changes.dbs) {
                    native.dbs = newParts.dbs;
                }
                if (changes.inputs) {
                    native.inputs = newParts.inputs;
                }
                if (changes.outputs) {
                    native.outputs = newParts.outputs;
                }
                if (changes.markers) {
                    native.markers = newParts.markers;
                }
                console.log(native);
                //this.props.changeNative(native);
            }, 200);
        };

        reader.readAsText(e[0], 'ISO-8859-1');
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    changed: PropTypes.bool,
    socket: PropTypes.object.isRequired,
    showSnackbar: PropTypes.func,
};

export default Options;
