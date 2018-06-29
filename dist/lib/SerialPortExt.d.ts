/// <reference path="../../src/lib/ambient/serialport.d.ts" />
import * as SerialPort from "serialport";
export declare class SerialPortExt extends SerialPort {
    readonly evtError: any;
    readonly evtOpen: any;
    readonly evtData: any;
    private registerListener;
    writeAndDrain: any;
}
export declare class SerialPortError extends Error {
    readonly causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT" | undefined;
    readonly originalError: Error;
    constructor(originalError: Error | string, causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT" | undefined);
}
