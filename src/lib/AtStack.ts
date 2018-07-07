import { SerialPortExt } from "./SerialPortExt";
import { SyncEvent, EvtError } from "ts-events-extended";
import * as runExclusive from "run-exclusive";
import { Timers } from "timer-extended";

import { getSerialPortParser, AtMessage } from "at-messages-parser";

import "colors";


export type RunOutputs = { resp: AtMessage | undefined, final: AtMessage, raw: string };

export type RunParams = {
    userProvided: {
        recoverable?: boolean;
        reportMode?: AtMessage.ReportMode;
        retryOnErrors?: boolean | number[];
    };
    safe: {
        recoverable: boolean;
        reportMode: AtMessage.ReportMode;
        retryOnErrors: number[];
    }
};

export class RunCommandError extends Error {
    constructor(public readonly command: string,
        public readonly atMessageError: AtMessage) {
        super(RunCommandError.name);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class ParseError extends Error {
    constructor(public readonly unparsed: string) {
        super(ParseError.name);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}


export class AtStack {


    public readonly timers = new Timers();

    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    public readonly evtTerminate = new SyncEvent<Error | null>();

    private readonly serialPort: SerialPortExt;
    private readonly serialPortAtParser = getSerialPortParser(30000);
    constructor(
        dataIfPath: string,
        private readonly debug: typeof console.log
    ) {

        this.debug("Initialization");

        //TODO: here any is sloppy
        this.serialPort = new SerialPortExt(dataIfPath, {
            "parser": this.serialPortAtParser as any
        });

        this.registerListeners();

        this.runCommand("ATZ\r");


    }

    public get isTerminated(): boolean {
        return (this.evtTerminate.postCount !== 0);
    }

    public async terminate(error?: Error): Promise<void> {

        if (this.isTerminated){
             return
        }

        if (error) {

            this.debug("Terminate have been called from outside of the class...");

            this.evtError.post(error);

        } else {

            this.debug("User called terminate");

            this.evtTerminate.post(null);

            if (this.serialPort.isOpen()) {

                await new Promise<void>((resolve, reject) =>
                    this.serialPort.close(error => !error ? resolve() : reject(error))
                );

            }

        }


    }

    private readonly evtError = new SyncEvent<Error>();

    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();

    private registerListeners(): void {

        this.evtError.attachOnce(async error => {

            this.debug("unrecoverable error: ".red, error);

            if (!this.isTerminated) this.evtTerminate.post(error);

            await new Promise<void>(resolve => setImmediate(resolve));

            if (this.serialPort.isOpen()) { this.serialPort.close(); }

        });

        this.serialPort.once("disconnect", () => {
            this.debug("disconnect");
            if (!this.isTerminated) {
                this.evtTerminate.post(new Error("Modem disconnected"));
            }
        });

        this.serialPort.once("close", () => {
            this.debug("serial port close");
            this.evtResponseAtMessage.detach();
            this.timers.clearAll();
            this.serialPortAtParser.flush();
        });

        this.serialPort.evtError.attach(error => {
            this.debug("Serial port error: ", error);
            this.evtError.post(error);
        });

        this.serialPort.on("data",
            (atMessage: AtMessage | null, unparsed: string) => {

                if (!atMessage) {
                    this.evtError.post(new ParseError(unparsed));
                    return;
                }

                if (atMessage.isUnsolicited) {

                    this.evtUnsolicitedMessage.post(atMessage);

                } else {

                    this.evtResponseAtMessage.post(atMessage);

                }

            }
        );

    }

    private static generateSafeRunParams(
        params: RunParams['userProvided'] | undefined
    ): RunParams['safe'] {

        if (!params) {
            params = {};
        }

        if (typeof params.recoverable !== "boolean") {
            params.recoverable = false;
        }

        if (typeof params.reportMode !== "number") {
            params.reportMode = AtMessage.ReportMode.DEBUG_INFO_VERBOSE;
        }

        switch (typeof params.retryOnErrors) {
            case "boolean": break;
            case "object":
                if (params.reportMode === AtMessage.ReportMode.NO_DEBUG_INFO) {
                    params.retryOnErrors = false;
                }
                break;
            default:
                if (params.reportMode === AtMessage.ReportMode.NO_DEBUG_INFO) {
                    params.retryOnErrors = false;
                } else {
                    params.retryOnErrors = [14, 500];
                }
        }

        if (!params.retryOnErrors) {
            params.retryOnErrors = [];
        } else if (typeof params.retryOnErrors === "boolean") {
            params.retryOnErrors = [];
            (params.retryOnErrors as number[]).indexOf = (...inputs) => { return 0; };
        }

        return params as RunParams['safe'];

    }


    //public runCommand = execQueue(this.runCommandManageParams);
    public runCommand = runExclusive.buildMethod(this.runCommandManageParams);

    private async runCommandManageParams(command: string): Promise<RunOutputs>;
    private async runCommandManageParams(command: String, params: RunParams['userProvided']): Promise<RunOutputs>;
    private async runCommandManageParams(...inputs: any[]): Promise<any> {

        let command: string | undefined = undefined;
        let params: RunParams['userProvided'] | undefined = undefined;

        for (let input of inputs) {
            switch (typeof input) {
                case "string": command = input; break;
                case "object": params = input; break;
            }
        }

        return this.runCommandSetReportMode(
            command!,
            AtStack.generateSafeRunParams(params),
        );

    }



    private reportMode: AtMessage.ReportMode | undefined = undefined;

    private async runCommandSetReportMode(
        command: string,
        params: RunParams['safe']
    ): Promise<RunOutputs> {

        let { reportMode } = params;

        if (reportMode !== this.reportMode) {

            await this.runCommandSetEcho(
                `AT+CMEE=${reportMode}\r`,
                { "recoverable": false, "retryOnErrors": [] } as any
            );

            this.reportMode = params.reportMode;

        }

        const runOutputs = await this.runCommandSetEcho(command, params);

        if (command.match(/(^ATZ\r$)|(^AT\+CMEE=\ ?[0-9]\r$)/))
            this.reportMode = undefined;

        return runOutputs;


    }

    private isEchoEnable: boolean | undefined = undefined;
    private hideEcho = false;

    private async runCommandSetEcho(
        command: string,
        params: RunParams['safe'],
    ): Promise<RunOutputs> {

        if (!this.isEchoEnable) {

            await this.runCommandRetry(
                `ATE1\r`,
                { "recoverable": false, "retryOnErrors": [] } as any
            );

            this.isEchoEnable = true;

        }

        const runOutputs = await this.runCommandRetry(command, params);

        if (command.match(/^ATZ\r$/)) {
            this.isEchoEnable = undefined;
            this.hideEcho = false;
        } else if (command.match(/^ATE0\r$/)) {
            this.isEchoEnable = false;
            this.hideEcho = true;
        } else if (command.match(/^ATE1?\r$/)) {
            this.isEchoEnable = true;
            this.hideEcho = false;
        }

        return runOutputs;

    }


    private readonly maxRetry = 10;
    private readonly delayBeforeRetry = 5000;

    private retryLeft = this.maxRetry;

    private async runCommandRetry(
        command: string,
        params: RunParams['safe'],
    ): Promise<RunOutputs> {

        let { retryOnErrors, recoverable } = params;

        const { resp, final, raw } = await this.runCommandBase(command);

        if (final.isError) {

            let code = NaN;

            if (
                final.id === AtMessage.idDict.COMMAND_NOT_SUPPORT ||
                final.id === AtMessage.idDict.TOO_MANY_PARAMETERS
            ) {
                this.retryLeft = 0;
            } else if (
                final.id === AtMessage.idDict.P_CME_ERROR ||
                final.id === AtMessage.idDict.P_CMS_ERROR
            ) {
                code = (final as AtMessage.P_CME_ERROR | AtMessage.P_CMS_ERROR).code;
            }

            if (!this.retryLeft-- || retryOnErrors.indexOf(code) < 0) {

                if (!recoverable) {
                    this.evtError.post(new RunCommandError(command, final));
                    await new Promise<void>(resolve => { });
                }

            } else {

                this.debug(`Retrying ${JSON.stringify(command)} because ${JSON.stringify(final, null, 2)}`.yellow);

                await new Promise(resolve => this.timers.add(resolve, this.delayBeforeRetry));

                return this.runCommandRetry(command, params);
            }

        }

        this.retryLeft = this.maxRetry;

        return { resp, final, raw };

    }


    private readonly maxRetryWrite = 3;
    private readonly delayReWrite = 1000;
    private retryLeftWrite = this.maxRetryWrite;

    private async runCommandBase(
        command: string
    ): Promise<RunOutputs> {

        let writeAndDrainPromise = this.serialPort.writeAndDrain(command);

        let atMessage: AtMessage;

        try {

            atMessage = await this.evtResponseAtMessage.waitFor(this.delayReWrite);

        } catch (error) {

            if (error instanceof EvtError.Detached) {

                await new Promise(resolve => { });

            }

            this.debug("Modem response timeout!".red);

            let unparsed = this.serialPortAtParser.flush();

            if (unparsed) {
                (this.serialPort as any).emit("data", null, unparsed);
                await new Promise(resolve => { });
            }

            if (!this.retryLeftWrite--) {
                this.evtError.post(new Error("Modem not responding"));
                await new Promise(resolve => { });
            }

            this.debug(`Retrying command ${JSON.stringify(command)}`);

            return await this.runCommandBase(command);


        }

        let echo = "";
        let resp: AtMessage | undefined = undefined;
        let final: AtMessage;

        while (true) {

            if (atMessage.isFinal) {
                final = atMessage;
                break;
            } else if (atMessage.id === AtMessage.idDict.ECHO)
                echo += atMessage.raw;
            else resp = atMessage;

            atMessage = await this.evtResponseAtMessage.waitFor();

        }

        await writeAndDrainPromise;

        let raw = `${this.hideEcho ? "" : echo}${resp ? resp.raw : ""}${final.raw}`;

        if (this.retryLeftWrite !== this.maxRetryWrite)
            this.debug("Rewrite success!".green);

        this.retryLeftWrite = this.maxRetryWrite;

        return { resp, final, raw };

    }

}
