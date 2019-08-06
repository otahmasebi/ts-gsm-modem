/// <reference path="../../src/lib/ambient/serialport.d.ts" />
import * as SerialPort from "serialport";
import { SyncEvent } from "ts-events-extended";
/** Do not use on("error",) use evtError otherwise use as SerialPort */
export declare class SerialPortExt extends SerialPort {
    readonly evtError: SyncEvent<SerialPortError>;
    readonly writeHistory: (Buffer | string)[];
    /**
     * Never throw, never resolve if error ( an evtError will be posted )
     * Assert is not called after close as we have no way to test if closed.
     */
    writeAndDrain: (buffer: string | Buffer) => Promise<void>;
}
export declare class SerialPortError extends Error {
    readonly writeHistory: (Buffer | string)[];
    readonly origin: "ERROR CALLING DRAIN" | "ERROR CALLING WRITE" | "OPEN TIMEOUT" | "EMITTED BY SERIAL PORT INSTANCE";
    readonly originalError: Error;
    constructor(originalError: Error | string, writeHistory: (Buffer | string)[], origin: "ERROR CALLING DRAIN" | "ERROR CALLING WRITE" | "OPEN TIMEOUT" | "EMITTED BY SERIAL PORT INSTANCE");
    toString(): string;
}
