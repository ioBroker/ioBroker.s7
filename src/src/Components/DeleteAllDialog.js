import PropTypes from 'prop-types';

import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button,
} from '@mui/material';

import {
    Delete as DeleteIcon,
    Clear as ClearIcon,
} from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

const DeleteAllDialog = props => {
    return <Dialog open={!0} onClose={props.onClose}>
        <DialogTitle>{I18n.t('Delete all items')}</DialogTitle>
        <DialogContent>
            <DialogContentText>{I18n.t('Are you sure to delete all items?')}</DialogContentText>
            <DialogActions>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                        props.action();
                        props.onClose();
                    }}
                >
                    {I18n.t('Delete all items')}
                </Button>
                <Button color="grey" variant="contained" onClick={props.onClose} startIcon={<ClearIcon />}>{I18n.t('Cancel')}</Button>
            </DialogActions>
        </DialogContent>
    </Dialog>;
}

DeleteAllDialog.propTypes = {
    action: PropTypes.func,
    onClose: PropTypes.func,
    classes: PropTypes.object,
}

export default DeleteAllDialog;