/// <reference types="debug" />
import { SyncEvent } from "ts-events-extended";
import { Timers } from "timer-extended";
import { AtMessage } from "at-messages-parser";
import * as debug from "debug";
import "colors";
export declare type RunOutputs = [AtMessage | undefined, AtMessage, string];
export declare type RunCallback = (resp: RunOutputs[0], final: RunOutputs[1], raw: RunOutputs[2]) => void;
export declare type RunParams = {
    userProvided: {
        recoverable?: boolean;
        reportMode?: AtMessage.ReportMode;
        retryOnErrors?: boolean | number[];
    };
    safe: {
        recoverable: boolean;
        reportMode: AtMessage.ReportMode;
        retryOnErrors: number[];
    };
};
export declare class RunCommandError extends Error {
    readonly command: string;
    readonly atMessageError: AtMessage;
    constructor(command: string, atMessageError: AtMessage);
}
export declare class ParseError extends Error {
    readonly unparsed: string;
    constructor(unparsed: string);
}
export declare class AtStack {
    readonly debugPrefix: string | undefined;
    debug: debug.IDebugger;
    readonly timers: Timers;
    readonly evtUnsolicitedMessage: SyncEvent<AtMessage>;
    readonly evtTerminate: SyncEvent<Error | null>;
    private readonly serialPort;
    private readonly serialPortAtParser;
    constructor(dataIfPath: string, debugPrefix?: string | undefined);
    readonly isTerminated: boolean;
    terminate(error?: Error): void;
    private readonly evtError;
    private readonly evtResponseAtMessage;
    private registerListeners();
    private static generateSafeRunParams(params);
    runCommand: {
        (command: string, callback?: RunCallback | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
        (command: String, params: {
            recoverable?: boolean | undefined;
            reportMode?: AtMessage.ReportMode | undefined;
            retryOnErrors?: boolean | number[] | undefined;
        }, callback?: RunCallback | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
    };
    private runCommandManageParams(command, callback?);
    private runCommandManageParams(command, params, callback?);
    private reportMode;
    private runCommandSetReportMode(command, params);
    private isEchoEnable;
    private hideEcho;
    private runCommandSetEcho(command, params);
    private readonly maxRetry;
    private readonly delayBeforeRetry;
    private retryLeft;
    private runCommandRetry(command, params);
    private readonly maxRetryWrite;
    private readonly delayReWrite;
    private retryLeftWrite;
    private runCommandBase(command);
}
