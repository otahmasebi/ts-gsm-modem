import { SerialPortExt, SerialPortError } from "./SerialPortExt";
import { Evt, EvtError } from "ts-evt";
import { UnpackEvt } from "ts-evt/dist/lib/helperTypes";
import * as runExclusive from "run-exclusive";

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

    constructor(
        public readonly command: string,
        public readonly atMessageError: AtMessage
    ) {
        super("AT command that had to complete successfully failed ( command was set as recoverable: false )");
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toString(): string {
        return [
            `RunCommandError: ${this.message}`,
            `command: ${this.command}`,
            `AT: ${JSON.stringify(this.atMessageError.raw)}`
        ].join("\n");
    }

}

export class ParseError extends Error {

    constructor(public readonly unparsed: string) {
        super("at-message-parser could not parse data flow");
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toString(): string {
        return [
            `ParseError: ${this.message}`,
            `failed to parse: ${JSON.stringify(this.unparsed)}`
        ].join("\n")
    }

}

export class ModemNotRespondingError extends Error {

    constructor(public readonly lastCommandSent: string) {
        super("Modem stopped responding to at commands");
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toString(): string {
        return [
            `ModemNotRespondingError: ${this.message}`,
            `lastCommandSent: ${this.lastCommandSent}`
        ].join("\n");
    }

}

export class ModemDisconnectedError extends Error {

    constructor(){
        super("Modem disconnected");
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toString(): string {
        return `ModemDisconnectedError: ${this.message}`;
    }

}


export class AtStack {

    public readonly evtUnsolicitedMessage = new Evt<AtMessage>();

    private readonly serialPort: SerialPortExt;

    private readonly serialPortAtParser = getSerialPortParser(30000);

    constructor(
        public readonly dataIfPath: string,
        private readonly debug: typeof console.log
    ) {

        this.debug("Initialization");

        //TODO: here any is sloppy
        this.serialPort = new SerialPortExt(dataIfPath, {
            "parser": this.serialPortAtParser as any
        });

        this.serialPort.once("disconnect", ()=> this._terminate(new ModemDisconnectedError()));

        this.serialPort.evtError.attachOnce(error => this._terminate(error));

        this.serialPort.on("data",
            (atMessage: AtMessage | null, unparsed: string) => {

                if (!atMessage) {
                    this._terminate(new ParseError(unparsed));
                    return;
                }

                if (atMessage.isUnsolicited) {

                    this.evtUnsolicitedMessage.post(atMessage);

                } else {

                    this.evtResponseAtMessage.post(atMessage);

                }

            }
        );

        this.runCommand("ATZ\r");


    }


    private readonly _evtTerminate = new Evt<SerialPortError | RunCommandError | ParseError | ModemNotRespondingError | ModemDisconnectedError | null>();

    /** A public clone of _evtTerminate ( so user can't detach the internal handler of _evtTerminate ) */
    public readonly evtTerminate= (()=>{

        const evt: typeof AtStack.prototype._evtTerminate= new Evt();

        this._evtTerminate.attach(error=> evt.post(error));

        return evt;

    })();

    public get terminateState(): undefined | "TERMINATING" | "TERMINATED" {
        if( !this.haveTerminateFunctionBeenCalled){
            return undefined;
        }else if( this._evtTerminate.postCount === 0 ){
            return "TERMINATING";
        }else{
            return "TERMINATED";
        }
    }

    /** 
     * If RESTART MT is set evtTerminate will post a disconnect. 
     * Else it will post null.
     * */
    public async terminate(restart: "RESTART MT" | undefined = undefined): Promise<void> {

        if (!this.haveTerminateFunctionBeenCalled) {

            this.debug("Terminate called from outside of AT stack");

            if (!restart) {

                await this._terminate(null);

            }else{

                this.debug("Issuing CFUN command to restart the MT");

                this.runCommand(
                    "AT+CFUN=1,1\r",
                    { "retryOnErrors": true }
                ).then( () => this.debug("MT Restart command issued successfully") );

                await this._evtTerminate.waitFor();

            }

            return;

        } else if (this._evtTerminate.postCount === 0) {

            await this._evtTerminate.waitFor();

        } else {

            return;

        }

    }

    private haveTerminateFunctionBeenCalled = false;

    private async _terminate(
        error: UnpackEvt<typeof AtStack.prototype._evtTerminate>
    ): Promise<void> {

        //_terminate can not be called more than once.

        this.haveTerminateFunctionBeenCalled = true;

        this.evtResponseAtMessage.detach();

        clearTimeout(this.runCommandRetryTimer);

        this.serialPortAtParser.flush();

        if (this.serialPort.isOpen()) {

            await new Promise<void>(resolve =>
                this.serialPort.close(e => {

                    if ( !!e) {

                        this.debug("Serial port close error", e);

                    }

                    resolve();

                })
            );

        }

        this._evtTerminate.post(error);

    }

    private readonly evtResponseAtMessage = new Evt<AtMessage>();

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

    public runCommand = runExclusive.buildMethod(this.runCommandManageParams);

    private async runCommandManageParams(command: string): Promise<RunOutputs>;
    private async runCommandManageParams(command: String, params: RunParams['userProvided']): Promise<RunOutputs>;
    private async runCommandManageParams(...inputs: any[]): Promise<any> {

        if (this.haveTerminateFunctionBeenCalled) {
            await new Promise(resolve => { });
        }

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

    private runCommandRetryTimer: NodeJS.Timer = undefined as any;

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
                    this._terminate(new RunCommandError(command, final));
                    await new Promise<void>(resolve => { });
                }

            } else {

                this.debug(`Retrying ${JSON.stringify(command)} because ${JSON.stringify(final, null, 2)}`.yellow);

                await new Promise(
                    resolve => this.runCommandRetryTimer = setTimeout(resolve, this.delayBeforeRetry)
                );

                return this.runCommandRetry(command, params);
            }

        }

        this.retryLeft = this.maxRetry;

        return { resp, final, raw };

    }


    private readonly maxRetryWrite = 3;
    private readonly delayAfterDeemedNotResponding = 25000;
    private retryLeftWrite = this.maxRetryWrite;

    private async runCommandBase(
        command: string
    ): Promise<RunOutputs> {

        let writeAndDrainPromise = this.serialPort.writeAndDrain(command);

        let atMessage: AtMessage;

        try {

            if( !this.serialPort.isOpen() ){

                await new Promise(resolve=> this.serialPort.once("open", ()=> resolve()));
                
            }

            atMessage = await this.evtResponseAtMessage.waitFor(
                this.delayAfterDeemedNotResponding 
            );

        } catch (error) {

            if (error instanceof EvtError.Detached) {

                await new Promise(_resolve => { });

            }

            this.debug("Modem response timeout".red);

            const unparsed = this.serialPortAtParser.flush();

            if (!!unparsed) {
                (this.serialPort as any).emit("data", null, unparsed);
                await new Promise(_resolve => { });
            }

            if (!this.retryLeftWrite--) {
                this._terminate(new ModemNotRespondingError(command));
                await new Promise(_resolve => { });
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

            try {

                atMessage = await this.evtResponseAtMessage.waitFor(30000);

            } catch (error) {

                if (!(error instanceof EvtError.Detached)) {

                    this.debug("Timeout while waiting for followup response");

                    this._terminate(new ModemNotRespondingError(command));

                }

                await new Promise(_resolve => { });

            }

        }

        {

            let timer: NodeJS.Timer;

            await Promise.race([
                writeAndDrainPromise,
                new Promise<"TIMEOUT">(resolve => timer = setTimeout(
                    () => resolve("TIMEOUT"),
                    this.delayAfterDeemedNotResponding
                )),
            ]).then(hasTimedOut => new Promise(resolve => {

                if (!!hasTimedOut) {

                    if (!this.terminateState) {

                        this.debug("Timeout while waiting for drain");

                        this._terminate(new ModemNotRespondingError(command));

                    }

                } else {
                    clearTimeout(timer);
                    resolve();
                }
            }));

        }

        const raw = `${this.hideEcho ? "" : echo}${resp ? resp.raw : ""}${final.raw}`;

        if (this.retryLeftWrite !== this.maxRetryWrite) {
            this.debug("Rewrite success!".green);
        }

        this.retryLeftWrite = this.maxRetryWrite;

        return { resp, final, raw };

    }

}
