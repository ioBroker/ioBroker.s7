import BaseRegisters, { type BaseRegistersProps } from './BaseRegisters';

export default class Dbs extends BaseRegisters {
    constructor(props: BaseRegistersProps) {
        super(props, 'dbs');
    }
}
