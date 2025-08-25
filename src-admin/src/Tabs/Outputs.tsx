import BaseRegisters, { type BaseRegistersProps } from './BaseRegisters';

export default class Outputs extends BaseRegisters {
    constructor(props: BaseRegistersProps) {
        super(props, 'outputs');
    }
}
