import PropTypes from 'prop-types';

import BaseRegisters from './BaseRegisters';

class Dbs extends BaseRegisters {
    nativeField = 'dbs';
}

Dbs.propTypes = {
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

export default Dbs;
