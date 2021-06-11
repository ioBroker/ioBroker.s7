import PropTypes from 'prop-types';

import BaseRegisters from './BaseRegisters';

class Inputs extends BaseRegisters {
    nativeField = 'inputs'
}

Inputs.propTypes = {
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

export default Inputs;
