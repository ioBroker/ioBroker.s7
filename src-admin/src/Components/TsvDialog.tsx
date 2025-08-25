import React, { useState } from 'react';

import { tsv2json, json2tsv } from 'tsv-json';
import AceEditor from 'react-ace';

import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';

import { Clear as ClearIcon, Save as SaveIcon, FileCopy as FileCopyIcon } from '@mui/icons-material';

import { Utils, I18n } from '@iobroker/adapter-react-v5';
import type { DBEntry } from '../types';

const styles: Record<string, React.CSSProperties> = {
    tsvEditor: {
        width: '100%',
        height: 400,
    },
    tsvEditorTextarea: {
        fontFamily: 'monospace',
    },
};
interface TsvDialogProps {
    onClose: () => void;
    save: (data: DBEntry[]) => void;
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
    data: DBEntry[];
    showSnackbar: (
        text: React.JSX.Element | string,
        options?: { variant: 'error' | 'success' | 'info' | 'warning' },
    ) => void;
}

export default function TsvDialog(props: TsvDialogProps): React.JSX.Element {
    const tsvResult: string[][] = [];
    tsvResult.push(props.fields.map(field => field.name));

    props.data.forEach(item =>
        tsvResult.push(
            props.fields.map(field =>
                item[field.name] !== undefined && item[field.name] !== null
                    ? (item as Record<string, any>)[field.name].toString()
                    : '',
            ),
        ),
    );

    const [tsv, setTsv] = useState(json2tsv(tsvResult));

    const saveTsv = (): void => {
        const data: string[][] = tsv2json(tsv.endsWith('\n') ? tsv : `${tsv}\n`);
        const fields = data.shift() || [];
        let success = true;
        const errors = [];
        for (const index in props.fields) {
            if (props.fields[index].name !== fields[index]) {
                errors.push(
                    <>
                        No field <i>{props.fields[index].name}</i> in position <i>{parseInt(index) + 1}</i>!
                    </>,
                );
                success = false;
            }
        }

        const arrayOfData: DBEntry[] = data.map((itemValues, itemIndex) => {
            const item: DBEntry = {} as DBEntry;
            for (const index in props.fields) {
                if (
                    props.fields[index].type === 'select' &&
                    props.fields[index].options &&
                    !props.fields[index].options.map(option => option.value).includes(itemValues[index])
                ) {
                    errors.push(
                        <>
                            Value <i>{itemValues[index]}</i> is wrong for field <i>{props.fields[index].name}</i> in
                            position <i>{itemIndex + 1}</i>!
                        </>,
                    );
                    success = false;
                }
                if (props.fields[index].type === 'checkbox') {
                    (item as Record<string, any>)[props.fields[index].name] = itemValues[index] === 'true';
                } else {
                    (item as Record<string, any>)[props.fields[index].name] = itemValues[index];
                }
            }
            return item;
        });

        if (!success) {
            props.showSnackbar(
                <div>
                    {errors.map((error, index) => (
                        <div key={index}>{error}</div>
                    ))}
                </div>,
                { variant: 'error' },
            );
            return;
        }
        props.save(arrayOfData);
        props.onClose();
    };

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>{I18n.t('Edit data as TSV')}</DialogTitle>
            <DialogContent>
                <DialogContentText>{I18n.t('You can copy, paste and edit data as TSV.')}</DialogContentText>
                <div>
                    <AceEditor
                        onChange={e => setTsv(e)}
                        height="400px"
                        showPrintMargin={false}
                        value={tsv}
                        style={styles.tsvEditor}
                        width="100%"
                        setOptions={{ firstLineNumber: 0 }}
                    />
                </div>
            </DialogContent>
            <DialogActions>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => {
                        Utils.copyToClipboard(tsv);
                        props.showSnackbar(I18n.t('TSV was copied to clipboard'));
                    }}
                    startIcon={<FileCopyIcon />}
                >
                    {I18n.t('Copy to clipboard')}
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={saveTsv}
                    startIcon={<SaveIcon />}
                >
                    {I18n.t('Import')}
                </Button>
                <Button
                    color="grey"
                    variant="contained"
                    onClick={props.onClose}
                    startIcon={<ClearIcon />}
                >
                    {I18n.t('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
