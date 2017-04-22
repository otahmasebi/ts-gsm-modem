import { SyncEvent } from "ts-events-extended";
import { ExecQueue } from "ts-exec-queue";
import { Timer } from "timer-extended";
import "colors";
import { AtMessage } from "at-messages-parser";
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
export declare class Timers extends Array<Timer<any>> {
    constructor();
    add<T>(timer: Timer<T>): Timer<T>;
    clearAll(): void;
}
export declare class AtStack {
    readonly timers: Timers;
    readonly evtUnsolicitedMessage: SyncEvent<AtMessage>;
    readonly evtTerminate: SyncEvent<Error | null>;
    readonly isTerminated: boolean;
    private readonly serialPort;
    private readonly serialPortAtParser;
    constructor(path: string);
    terminate(error?: Error): void;
    readonly evtError: SyncEvent<Error>;
    private readonly evtResponseAtMessage;
    private readonly parseErrorDelay;
    private registerListeners();
    private static generateSafeRunParams(params);
    runCommand: {
        (command: string, callback?: RunCallback | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
        (command: String, params: {
            recoverable?: boolean | undefined;
            reportMode?: AtMessage.ReportMode | undefined;
            retryOnErrors?: boolean | number[] | undefined;
        }, callback?: RunCallback | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
    } & ExecQueue;
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
export declare class RunCommandError extends Error {
    readonly command: string;
    readonly atMessageError: AtMessage;
    constructor(command: string, atMessageError: AtMessage);
}
export declare class ParseError extends Error {
    readonly unparsed: string;
    constructor(unparsed: string);
}
