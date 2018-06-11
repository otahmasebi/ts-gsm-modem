import { SyncEvent } from "ts-events-extended";
import { Timers } from "timer-extended";
import { AtMessage } from "at-messages-parser";
import * as debug from "debug";
import "colors";
export declare type RunOutputs = {
    resp: AtMessage | undefined;
    final: AtMessage;
    raw: string;
};
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
    private readonly debug;
    readonly timers: Timers;
    readonly evtUnsolicitedMessage: SyncEvent<AtMessage>;
    readonly evtTerminate: SyncEvent<Error | null>;
    private readonly serialPort;
    private readonly serialPortAtParser;
    constructor(dataIfPath: string, debug: debug.IDebugger);
    readonly isTerminated: boolean;
    terminate(error?: Error): void;
    private readonly evtError;
    private readonly evtResponseAtMessage;
    private registerListeners;
    private static generateSafeRunParams;
    runCommand: {
        (command: string): Promise<RunOutputs>;
        (command: String, params: {
            recoverable?: boolean | undefined;
            reportMode?: AtMessage.ReportMode | undefined;
            retryOnErrors?: boolean | number[] | undefined;
        }): Promise<RunOutputs>;
    };
    private runCommandManageParams;
    private reportMode;
    private runCommandSetReportMode;
    private isEchoEnable;
    private hideEcho;
    private runCommandSetEcho;
    private readonly maxRetry;
    private readonly delayBeforeRetry;
    private retryLeft;
    private runCommandRetry;
    private readonly maxRetryWrite;
    private readonly delayReWrite;
    private retryLeftWrite;
    private runCommandBase;
}
