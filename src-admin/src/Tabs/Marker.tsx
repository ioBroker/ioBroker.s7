import BaseRegisters, { type BaseRegistersProps } from './BaseRegisters';

export default class Marker extends BaseRegisters {
    constructor(props: BaseRegistersProps) {
        super(props, 'markers');
    }
}
