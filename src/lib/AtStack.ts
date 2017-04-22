import { SerialPortExt } from "./SerialPortExt";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events-extended";
import { execQueue, ExecQueue } from "ts-exec-queue";
import { Timer, setTimeout } from "timer-extended";

import * as _debug from "debug";
let debug= _debug("_AtStack");

require("colors");

import { 
    getSerialPortParser, 
    AtMessage 
} from "at-messages-parser";


export type RunOutputs= [ AtMessage | undefined, AtMessage, string ];
export type RunCallback= (resp: RunOutputs[0], final: RunOutputs[1], raw: RunOutputs[2])=> void;

export type RunParams= {
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

export class Timers extends Array<Timer<any>> {

    constructor(){
        super();
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public add<T>(timer: Timer<T>): Timer<T>{

        for( let index=0; index<this.length; index++ )
            if( this[index].hasExec || this[index].hasBeenCleared )
                this.splice(index, 1);

        super.push(timer);

        return timer;

    }

    public clearAll(): void {
        for( let timer of this)
            timer.clear();
    }

}



export class AtStack {

    public readonly timers= new Timers();

    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    public readonly evtTerminate = new SyncEvent<Error | null>();

    public get isTerminated(): boolean {
        return (this.evtTerminate.postCount !== 0);
    }


    private readonly serialPort: SerialPortExt;
    private readonly serialPortAtParser= getSerialPortParser(30000);
    constructor(path: string) {

        this.serialPort = new SerialPortExt(path, {
            "parser": this.serialPortAtParser
        });

        this.registerListeners();

        this.runCommand("ATZ\r");


    }

    public terminate(error?: Error): void {

        debug("terminate have been called externally".red);

        if (this.serialPort.isOpen())
            this.serialPort.close();

        this.evtTerminate.post((error)?error:null);
    }

    public readonly evtError = new SyncEvent<Error>();
    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();


    private readonly parseErrorDelay = 30000;


    private registerListeners(): void {

        this.evtError.attach(async error => {

            debug("unrecoverable error: ".red, error);

            await new Promise<void>(resolve => setImmediate(resolve));

            if (this.serialPort.isOpen()) {
                debug("we clause because it was open");
                this.serialPort.close();
            }

            debug("post event terminate with error");

            this.evtTerminate.post(error);

        });

        //this.serialPortAtParser.evtRawData.attach(rawAtMessages => debug(JSON.stringify(rawAtMessages).yellow));
        //this.evtUnsolicitedMessage.attach(atMessage => debug(JSON.stringify(atMessage, null, 2).yellow));

        this.serialPort.once("disconnect", () => {
            debug("disconnect");
            this.evtTerminate.post(null);
        });

        this.serialPort.once("close", () => { 
            debug("close, stopWaiting, and clear all timeout"); 
            this.evtResponseAtMessage.stopWaiting();
            this.timers.clearAll(); 
            this.serialPortAtParser.flush(); 
        });

        this.serialPort.evtError.attach(error => {

            debug("Serial port error: ", error);

            this.evtError.post(error);
        });

        this.serialPort.on("data", (atMessage: AtMessage | null, unparsed: string) => {

            if (!atMessage) {
                this.evtError.post(new ParseError(unparsed));
                return;
            }

            //debug(JSON.stringify(atMessage.id));

            if (atMessage.isUnsolicited)
                this.evtUnsolicitedMessage.post(atMessage);
            else {
                this.evtResponseAtMessage.post(atMessage);
            }

        });

    }

    private static generateSafeRunParams(
        params: RunParams['userProvided'] | undefined
    ): RunParams['safe'] {

        if (!params) params = {};

        if (typeof params.recoverable !== "boolean")
            params.recoverable = false;

        if (typeof params.reportMode !== "number")
            params.reportMode = AtMessage.ReportMode.DEBUG_INFO_VERBOSE;

        switch (typeof params.retryOnErrors) {
            case "boolean": break;
            case "object":
                if (params.reportMode === AtMessage.ReportMode.NO_DEBUG_INFO)
                    params.retryOnErrors = false;
                break;
            default:
                if (params.reportMode === AtMessage.ReportMode.NO_DEBUG_INFO)
                    params.retryOnErrors = false;
                else
                    params.retryOnErrors = [14, 500];
        }

        if (!params.retryOnErrors)
            params.retryOnErrors = [];
        else if (typeof params.retryOnErrors === "boolean") {
            params.retryOnErrors = [];
            (params.retryOnErrors as number[]).indexOf = (...inputs) => { return 0; };
        }

        return params as RunParams['safe'];


    }


    public runCommand = execQueue(this.runCommandManageParams);

    private async runCommandManageParams(command: string, callback?: RunCallback): Promise<RunOutputs>;
    private async runCommandManageParams(command: String, params: RunParams['userProvided'], callback?: RunCallback): Promise<RunOutputs>;
    private async runCommandManageParams(...inputs: any[]): Promise<any> {


        let command: string | undefined = undefined;
        let params: RunParams['userProvided'] | undefined = undefined;
        let callback: RunCallback | undefined = undefined;

        for (let input of inputs) {
            switch (typeof input) {
                case "string": command = input; break;
                case "object": params = input; break;
                case "function": callback = input; break;
            }
        }


        let [ resp, final, raw ]= await this.runCommandSetReportMode(
            command!,
            AtStack.generateSafeRunParams(params),
        );

        callback!(resp, final, raw);

        return null as any;

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

        let runOutputs = await this.runCommandSetEcho(command, params);


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

        let runOutputs = await this.runCommandRetry(command, params);

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

        let [ resp, final, raw ]= await this.runCommandBase(command);

        if (final.isError) {

            let code = NaN;

            if (
                final.id === AtMessage.idDict.COMMAND_NOT_SUPPORT ||
                final.id === AtMessage.idDict.TOO_MANY_PARAMETERS
            ) this.retryLeft = 0;
            else if (
                final.id === AtMessage.idDict.P_CME_ERROR ||
                final.id === AtMessage.idDict.P_CMS_ERROR
            ) code = (final as AtMessage.P_CME_ERROR | AtMessage.P_CMS_ERROR).code;

            if (!this.retryLeft-- || retryOnErrors.indexOf(code) < 0) {

                if (!recoverable) {
                    this.evtError.post(new RunCommandError(command, final));
                    await new Promise<void>(resolve => {});
                }

            } else {

                debug(`Retrying ${JSON.stringify(command)} because ${JSON.stringify(final, null, 2)}`.yellow);

                await new Promise<void>(
                    resolve => this.timers.add(
                        setTimeout(resolve, this.delayBeforeRetry)
                    )
                );

                return await this.runCommandRetry(command, params);
            }


        }

        this.retryLeft = this.maxRetry;

        return [resp, final, raw];

    }


    private readonly maxRetryWrite = 3;
    private readonly delayReWrite = 1000;
    private retryLeftWrite = this.maxRetryWrite;

    private async runCommandBase(
        command: string
    ): Promise<RunOutputs> {

        //debug(JSON.stringify(command).blue);

        let echo: string;

        let writeAndDrainPromise = this.serialPort.writeAndDrain(command);

        try {

            let { raw } = await this.evtResponseAtMessage.waitFor(this.delayReWrite);

            echo= raw;

        } catch (error) {

            debug("Modem response timeout!".red);

            let unparsed = this.serialPortAtParser.flush();

            if (unparsed) {
                (this.serialPort as any).emit("data", null, unparsed);
                await new Promise(resolve => { });
            }

            if (!this.retryLeftWrite--) {
                this.evtError.post(new Error("Modem not responding"));
                await new Promise(resolve => { });
            }

            debug(`Retrying command ${JSON.stringify(command)}`);

            return await this.runCommandBase(command);


        }

        let resp: AtMessage | undefined = undefined;
        let final: AtMessage;

        while( true ){

            let atMessage = await this.evtResponseAtMessage.waitFor();

            if (atMessage.isFinal) {
                final = atMessage;
                break;
            } else if (atMessage.id === AtMessage.idDict.ECHO)
                echo += atMessage.raw;
            else resp = atMessage;

        }

        await writeAndDrainPromise;

        let raw = `${this.hideEcho ? "" : echo}${resp ? resp.raw : ""}${final.raw}`

        if (this.retryLeftWrite !== this.maxRetryWrite)
            debug("Rewrite success!".green);

        this.retryLeftWrite = this.maxRetryWrite;

        return [resp, final, raw];

    }



}

export class RunCommandError extends Error {

    constructor(public readonly command: string,
        public readonly atMessageError: AtMessage) {
        super(RunCommandError.name);
        Object.setPrototypeOf(this, RunCommandError.prototype)

    }
}

export class ParseError extends Error {

    constructor(public readonly unparsed: string) {
        super(ParseError.name);
        Object.setPrototypeOf(this, ParseError.prototype)
    }

}