/// <reference path="../../src/lib/ambient/serialport.d.ts" />
/// <reference types="node" />
import * as SerialPort from "serialport";
import { ExecQueue } from "ts-exec-queue";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
export declare class SerialPortExt extends SerialPort {
    readonly evtError: SyncEvent<SerialPortError>;
    readonly evtOpen: VoidSyncEvent;
    readonly evtData: SyncEvent<any[]>;
    private registerListener;
    writeAndDrain: ((buffer: string | Buffer, callback?: (() => void) | undefined) => Promise<void>) & ExecQueue;
}
export declare class SerialPortError extends Error {
    readonly causedBy: "DRAIN" | "WRITE" | "OPEN_TIMEOUT";
    readonly originalError: Error;
    constructor(originalError: Error | string, causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT");
}
