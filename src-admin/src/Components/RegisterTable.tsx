import React, { useState, useRef } from 'react';

import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Checkbox,
    TextField,
    IconButton,
    Select,
    MenuItem,
    TableSortLabel,
    Tooltip,
} from '@mui/material';

import { Delete as DeleteIcon, Add as AddIcon, ImportExport } from '@mui/icons-material';

import {
    I18n,
    IconExpert,
    TextWithIcon,
    SelectWithIcon,
    type IobTheme,
    type ThemeType,
} from '@iobroker/adapter-react-v5';

import TsvDialog from './TsvDialog';
import DeleteAllDialog from './DeleteAllDialog';
import DeleteDialog from './DeleteDialog';
import type { DBEntry } from '../types';

const styles: Record<string, any> = {
    tableHeader: {
        whiteSpace: 'nowrap',
        fontWeight: 'bold',
        fontSize: '80%',
        padding: '0px 8px',
    },
    tableHeaderExtended: (theme: IobTheme): React.CSSProperties => ({
        color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
    }),
    tableCell: {
        whiteSpace: 'nowrap',
        fontSize: '80%',
        padding: '0px 8px',
    },
    tableContainer: {
        overflow: 'auto',
        maxHeight: 'calc(100vh - 180px)',
    },
    tableTextField: {
        // fontSize: '80%',
    },
    tableSelect: {
        // fontSize: '80%',
    },
    tableTextFieldContainer: {
        width: '100%',
    },
    tableSelectContainer: {
        width: '100%',
    },
    nonEditMode: {
        cursor: 'pointer',
    },
};
interface DataCellProps {
    sortedItem: { item: DBEntry; $index: number };
    field: {
        name: keyof DBEntry;
        type: string;
        title: string;
        width?: number;
        options?: { value: string; title: string }[];
        expert?: boolean;
        tooltip?: string;
        sorted?: boolean;
        formulaDisabled?: boolean;
    };
    editMode: boolean;
    setEditMode: (editMode: boolean) => void;
    changeParam: (index: number, param: string, value: any) => void;
    getDisable: (index: number, param: string) => boolean;
    rooms: Record<string, ioBroker.EnumObject>;
    themeType: ThemeType;
}

function DataCell(props: DataCellProps): React.JSX.Element {
    const sortedItem = props.sortedItem;
    const field = props.field;
    const editMode = props.editMode;
    const setEditMode = props.setEditMode;

    const ref = useRef<any>(null);

    const item = sortedItem.item;
    let result;
    if (field.type === 'checkbox') {
        result = (
            <Tooltip title={I18n.t(field.title)}>
                <Checkbox
                    ref={ref}
                    style={styles.tableCheckbox}
                    checked={!!item[field.name]}
                    disabled={props.getDisable(sortedItem.$index, field.name)}
                    onChange={e => props.changeParam(sortedItem.$index, field.name, e.target.checked)}
                />
            </Tooltip>
        );
    } else if (field.type === 'rooms') {
        if (!editMode) {
            result = (
                <TextWithIcon
                    lang={I18n.getLanguage()}
                    list={props.rooms}
                    value={item[field.name] as string}
                    themeType={props.themeType}
                />
            );
        } else {
            result = (
                <SelectWithIcon
                    lang={I18n.getLanguage()}
                    t={I18n.t}
                    list={props.rooms}
                    allowNone
                    value={item[field.name] as string}
                    dense
                    themeType={props.themeType}
                    inputProps={{ ref, style: styles.tableSelect }}
                    disabled={props.getDisable(sortedItem.$index, field.name)}
                    onChange={value => props.changeParam(sortedItem.$index, field.name, value)}
                    style={styles.tableSelectContainer}
                />
            );
        }
    } else if (field.type === 'select') {
        if (!editMode) {
            const option = field.options?.find(option => option.value === item[field.name]);
            result = option ? option.title : '';
        } else {
            result = (
                <Select
                    variant="standard"
                    ref={ref}
                    value={item[field.name]}
                    slotProps={{
                        input: {
                            style: styles.tableSelect,
                        },
                    }}
                    disabled={props.getDisable(sortedItem.$index, field.name)}
                    onChange={e => props.changeParam(sortedItem.$index, field.name, e.target.value)}
                    style={styles.tableSelectContainer}
                >
                    {field.options?.map(option => (
                        <MenuItem
                            key={option.value}
                            value={option.value}
                        >
                            {option.title ? option.title : <i>{I18n.t('Nothing')}</i>}
                        </MenuItem>
                    ))}
                </Select>
            );
        }
    } else {
        if (!editMode) {
            result = item[field.name] ? item[field.name] : null;
        } else {
            result = (
                <TextField
                    ref={ref}
                    variant="standard"
                    value={item[field.name]}
                    style={styles.tableTextFieldContainer}
                    slotProps={{
                        input: {
                            style: styles.tableTextField,
                        },
                    }}
                    type={field.type}
                    onChange={e => props.changeParam(sortedItem.$index, field.name, e.target.value)}
                    disabled={props.getDisable(sortedItem.$index, field.name)}
                />
            );
        }
    }

    return (
        <TableCell
            style={{ ...styles.tableCell, ...(!editMode ? styles.nonEditMode : undefined) }}
            onClick={() => {
                setEditMode(true);
                window.localStorage.setItem('Modbus.editMode', 'true');
                window.setTimeout(() => ref.current?.focus(), 100);
            }}
        >
            {result}
        </TableCell>
    );
}

interface RegisterTableProps {
    data: DBEntry[];
    fields: {
        name: keyof DBEntry;
        type: string;
        title: string;
        width?: number;
        options?: { value: string; title: string }[];
        expert?: boolean;
        tooltip?: string;
        sorted?: boolean;
        formulaDisabled?: boolean;
    }[];
    addItem: () => void;
    changeData: (data: DBEntry[]) => void;
    deleteItem: (index: number) => void;
    changeParam: (index: number, param: string, value: any) => void;
    getDisable: (index: number, param: string) => boolean;
    rooms: Record<string, ioBroker.EnumObject>;
    formulaDisabled?: boolean;
    getSortedData: (
        data: DBEntry[],
        orderBy: keyof DBEntry | '$index',
        order: 'asc' | 'desc',
    ) => { item: DBEntry; $index: number }[];
    orderBy: keyof DBEntry | '$index';
    order: 'asc' | 'desc';
    onChangeOrder: (orderBy: keyof DBEntry | '$index', order: 'asc' | 'desc') => void;
    themeType: ThemeType;
    prefix: string;
    showSnackbar: (
        text: string | React.JSX.Element,
        options?: { variant: 'error' | 'success' | 'info' | 'warning' },
    ) => void;
}
export default function RegisterTable(props: RegisterTableProps): React.JSX.Element {
    const [tsvDialogOpen, setTsvDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(parseInt(window.localStorage.getItem('Modbus.editMode') || '0', 10) || 0);
    const [extendedMode, setExtendedMode] = useState(window.localStorage.getItem('Modbus.extendedMode') === 'true');
    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        open: boolean;
        action: null | (() => void);
    }>({
        open: false,
        action: null,
    });
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        item: Record<string, any> | null;
        action: null | ((result?: boolean) => void);
    }>({
        open: false,
        item: null,
        action: null,
    });

    const sortedData = props.getSortedData(props.data, props.orderBy, props.order);

    return (
        <div>
            <div>
                <Tooltip title={I18n.t('Add line')}>
                    <IconButton onClick={() => props.addItem()}>
                        <AddIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={I18n.t('Edit as TSV (Tab separated values)')}>
                    <IconButton onClick={() => setTsvDialogOpen(true)}>
                        <ImportExport />
                    </IconButton>
                </Tooltip>
                <Tooltip title={I18n.t('Toggle extended mode')}>
                    <IconButton
                        color={extendedMode ? 'primary' : 'inherit'}
                        onClick={() => {
                            window.localStorage.setItem('Modbus.extendedMode', extendedMode ? 'false' : 'true');
                            setExtendedMode(!extendedMode);
                        }}
                    >
                        <IconExpert />
                    </IconButton>
                </Tooltip>
            </div>
            <div style={styles.tableContainer}>
                <Table
                    size="small"
                    stickyHeader
                    padding="none"
                >
                    <TableHead>
                        <TableRow>
                            {props.fields
                                .filter(
                                    item =>
                                        (extendedMode || !item.expert) &&
                                        (!props.formulaDisabled || !item.formulaDisabled),
                                )
                                .map(field => {
                                    let isChecked = false;
                                    let indeterminate = false;
                                    let trueFound = false;
                                    let falseFound = false;
                                    for (const k in props.data) {
                                        if (props.data[k][field.name]) {
                                            isChecked = true;
                                            trueFound = true;
                                        } else {
                                            isChecked = false;
                                            falseFound = true;
                                        }

                                        if (trueFound && falseFound) {
                                            indeterminate = true;
                                            isChecked = false;
                                            break;
                                        }
                                    }

                                    return (
                                        <TableCell
                                            key={field.name}
                                            style={{
                                                ...styles.tableHeader,
                                                width: field.type === 'checkbox' ? 20 : field.width,
                                            }}
                                            sx={field.expert ? styles.tableHeaderExtended : undefined}
                                            title={field.tooltip ? I18n.t(field.tooltip) : undefined}
                                        >
                                            {field.type === 'checkbox' ? (
                                                <Tooltip title={I18n.t('Change all')}>
                                                    <Checkbox
                                                        indeterminate={indeterminate}
                                                        checked={isChecked}
                                                        onChange={e => {
                                                            const newData: DBEntry[] = JSON.parse(
                                                                JSON.stringify(props.data),
                                                            );
                                                            newData.forEach(
                                                                item =>
                                                                    ((item as Record<string, any>)[field.name] =
                                                                        e.target.checked),
                                                            );
                                                            props.changeData(newData);
                                                        }}
                                                    />
                                                </Tooltip>
                                            ) : null}
                                            {field.sorted ? (
                                                <TableSortLabel
                                                    active={field.name === props.orderBy}
                                                    direction={props.order}
                                                    onClick={() => {
                                                        const isAsc =
                                                            props.orderBy === field.name && props.order === 'asc';
                                                        props.onChangeOrder(field.name, isAsc ? 'desc' : 'asc');
                                                    }}
                                                >
                                                    {I18n.t(field.title)}
                                                </TableSortLabel>
                                            ) : (
                                                I18n.t(field.title)
                                            )}
                                        </TableCell>
                                    );
                                })}
                            <TableCell>
                                <Tooltip title={I18n.t('Delete all')}>
                                    <div>
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                setDeleteAllDialog({
                                                    open: true,
                                                    action: () => props.changeData([]),
                                                })
                                            }
                                            disabled={!props.data.length}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </div>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedData.map(sortedItem => (
                            <TableRow
                                hover
                                key={sortedItem.$index}
                            >
                                {props.fields
                                    .filter(
                                        item =>
                                            (extendedMode || !item.expert) &&
                                            (!props.formulaDisabled || !item.formulaDisabled),
                                    )
                                    .map(field => (
                                        <DataCell
                                            key={field.name}
                                            sortedItem={sortedItem}
                                            field={field}
                                            editMode={editMode === sortedItem.$index}
                                            setEditMode={() => setEditMode(sortedItem.$index)}
                                            changeParam={props.changeParam}
                                            getDisable={props.getDisable}
                                            rooms={props.rooms}
                                            themeType={props.themeType}
                                        />
                                    ))}
                                <TableCell>
                                    <Tooltip title={I18n.t('Delete')}>
                                        <div>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    const lastTime =
                                                        window.sessionStorage.getItem('disableDeleteDialogs');
                                                    if (
                                                        lastTime &&
                                                        Date.now() - new Date(lastTime).getTime() < 1000 * 60 * 5
                                                    ) {
                                                        props.deleteItem(sortedItem.$index);
                                                        return;
                                                    }
                                                    setDeleteDialog({
                                                        open: true,
                                                        action: disableDialogs => {
                                                            if (disableDialogs) {
                                                                window.sessionStorage.setItem(
                                                                    'disableDeleteDialogs',
                                                                    new Date().toISOString(),
                                                                );
                                                            }
                                                            props.deleteItem(sortedItem.$index);
                                                        },
                                                        item: sortedItem.item,
                                                    });
                                                }}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </div>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {tsvDialogOpen ? (
                <TsvDialog
                    showSnackbar={props.showSnackbar}
                    save={data => {
                        if (props.prefix) {
                            data.forEach(line => {
                                line.Address = (line.Address || '').toUpperCase();
                                if (line.Address && !line.Address.startsWith(props.prefix)) {
                                    line.Address = props.prefix + line.Address;
                                }
                            });
                        }
                        props.changeData(data);
                    }}
                    onClose={() => setTsvDialogOpen(false)}
                    data={props.data}
                    fields={props.fields}
                />
            ) : null}
            {deleteAllDialog.open ? (
                <DeleteAllDialog
                    action={deleteAllDialog.action!}
                    onClose={() =>
                        setDeleteAllDialog({
                            open: false,
                            action: null,
                        })
                    }
                />
            ) : null}
            {deleteDialog.open ? (
                <DeleteDialog
                    action={deleteDialog.action!}
                    onClose={() =>
                        setDeleteDialog({
                            open: false,
                            action: null,
                            item: null,
                        })
                    }
                    item={deleteDialog.item!}
                />
            ) : null}
        </div>
    );
}
