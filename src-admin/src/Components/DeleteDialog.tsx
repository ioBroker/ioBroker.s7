import React, { useState } from 'react';

import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button,
    FormControlLabel,
    Checkbox,
} from '@mui/material';

import { Delete as DeleteIcon, Clear as ClearIcon } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';
interface DeleteDialogProps {
    action: (disableWarnings: boolean) => void;
    onClose: () => void;
    item: Record<string, any>;
}

export default function DeleteDialog(props: DeleteDialogProps): React.JSX.Element {
    const [disableWarnings, setDisableWarnings] = useState(false);

    return (
        <Dialog
            open={!0}
            onClose={props.onClose}
        >
            <DialogTitle>{I18n.t('Delete item')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {I18n.t('Are you sure to delete item with address "%s"?', props.item._address)}
                </DialogContentText>
                <DialogContentText>
                    <FormControlLabel
                        label={I18n.t("Don't show this message in 5 minutes")}
                        control={
                            <Checkbox
                                checked={disableWarnings}
                                onChange={e => setDisableWarnings(e.target.checked)}
                            />
                        }
                    />
                </DialogContentText>
                <DialogActions>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<DeleteIcon />}
                        onClick={() => {
                            props.action(disableWarnings);
                            props.onClose();
                        }}
                    >
                        {I18n.t('Delete')}
                    </Button>
                    <Button
                        color="grey"
                        variant="contained"
                        onClick={props.onClose}
                        startIcon={<ClearIcon />}
                    >
                        {I18n.t('Cancel')}
                    </Button>
                </DialogActions>
            </DialogContent>
        </Dialog>
    );
}
