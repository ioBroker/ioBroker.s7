import type { DBEntry, S7Type } from './types';

/** Mapping of the S7 data types to the ioBroker state types */
export const convertS7type: Record<string, ioBroker.CommonType> = {
    BOOL: 'boolean',
    BYTE: 'number',
    WORD: 'number',
    DWORD: 'number',
    INT: 'number',
    DINT: 'number',
    REAL: 'number',
    STRING: 'string',
    S7STRING: 'string',
    S5TIME: 'number',
    ARRAY: 'array',
    S7TIME: 'number',
};

/**
 * Calculate the size of one register in bytes
 *
 * @param type S7 data type
 * @param length configured length. Only used for the types with a variable size
 */
export function getByteSize(type: S7Type, length?: number | string): number {
    switch (type) {
        case 'WORD':
        case 'INT':
        case 'S5TIME':
            return 2;
        case 'DWORD':
        case 'DINT':
        case 'REAL':
            return 4;
        case 'S7TIME':
            return 8;
        case 'STRING':
        case 'ARRAY':
        case 'S7STRING':
            return parseInt(length as string, 10);
    }
    return 1;
}

/**
 * Detect if the given time is in the daylight saving period and return the offset in minutes
 *
 * @param time the time to check
 */
export function isDST(time: Date): number {
    const jan = new Date(time.getFullYear(), 0, 1);
    const jul = new Date(time.getFullYear(), 6, 1);
    return Math.min(jan.getTimezoneOffset(), jul.getTimezoneOffset()) - time.getTimezoneOffset();
}

/**
 * Comparator to sort the registers by their address
 *
 * @param a first register
 * @param b second register
 */
export function sortByAddress(a: DBEntry, b: DBEntry): number {
    const ad = parseFloat(a.Address);
    const bd = parseFloat(b.Address);
    return ad < bd ? -1 : ad > bd ? 1 : 0;
}

/**
 * Interpret a configuration value as boolean. The GUI can deliver strings too
 *
 * @param value the value to convert
 */
export function isTrue(value: boolean | string | number | undefined): boolean {
    return value === true || value === 'true';
}

/**
 * Build the ioBroker name part of an ID: dots and spaces are not allowed
 *
 * @param name the configured name
 */
export function normalizeName(name: string | undefined): string {
    return (name || '').replace(/[.\s]+/g, '_');
}
