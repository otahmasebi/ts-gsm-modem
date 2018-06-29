/// <reference path="../../src/lib/ambient/serialport.d.ts" />
/// <reference types="node" />
import * as SerialPort from "serialport";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
export declare class SerialPortExt extends SerialPort {
    readonly evtError: SyncEvent<SerialPortError>;
    readonly evtOpen: VoidSyncEvent;
    readonly evtData: SyncEvent<any[]>;
    private registerListener;
    writeAndDrain: (buffer: string | Buffer, callback?: (() => void) | undefined) => Promise<void>;
}
export declare class SerialPortError extends Error {
    readonly causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT" | undefined;
    readonly originalError: Error;
    constructor(originalError: Error | string, causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT" | undefined);
}
