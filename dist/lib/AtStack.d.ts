import { SerialPortError } from "./SerialPortExt";
import { AtMessage } from "at-messages-parser";
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
    toString(): string;
}
export declare class ParseError extends Error {
    readonly unparsed: string;
    constructor(unparsed: string);
    toString(): string;
}
export declare class ModemNotRespondingError extends Error {
    readonly lastCommandSent: string;
    constructor(lastCommandSent: string);
    toString(): string;
}
export declare class ModemDisconnectedError extends Error {
    constructor();
    toString(): string;
}
export declare class AtStack {
    readonly dataIfPath: string;
    private readonly debug;
    readonly evtUnsolicitedMessage: import("evt/dist/lib/types").Evt<AtMessage>;
    private readonly serialPort;
    private readonly serialPortAtParser;
    constructor(dataIfPath: string, debug: typeof console.log);
    private readonly _evtTerminate;
    /** A public clone of _evtTerminate ( so user can't detach the internal handler of _evtTerminate ) */
    readonly evtTerminate: import("evt/dist/lib/types").Evt<SerialPortError | RunCommandError | ParseError | ModemNotRespondingError | ModemDisconnectedError | null>;
    get terminateState(): undefined | "TERMINATING" | "TERMINATED";
    /**
     * If RESTART MT is set evtTerminate will post a disconnect.
     * Else it will post null.
     * */
    terminate(restart?: "RESTART MT" | undefined): Promise<void>;
    private haveTerminateFunctionBeenCalled;
    private _terminate;
    private readonly evtResponseAtMessage;
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
    private runCommandRetryTimer;
    private runCommandRetry;
    private readonly maxRetryWrite;
    private readonly delayAfterDeemedNotResponding;
    private retryLeftWrite;
    private runCommandBase;
}
