/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events-extended";
import { execStack, ExecStack } from "ts-exec-stack";

require("colors");

import { 
    atMessagesParser, 
    atIdDict, 
    AtMessage, 
    AtImps, 
    ReportMode 
} from "at-messages-parser";


export type RunCallback= {
        (resp: AtMessage | undefined, final: AtMessage, raw: string): void;
};

//TODO use Partial

export type RunParams= {
        recoverable?: boolean;
        reportMode?: ReportMode;
        retryOnErrors?: boolean | number[];
};


type SafeRunParams= {
        recoverable: boolean;
        reportMode: ReportMode;
        retryOnErrors: number[];
}

export class AtStack {

    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    public readonly evtTerminate= new SyncEvent<Error | null>();

    private readonly serialPort: SerialPort;
    constructor(path: string){

        this.serialPort = new SerialPort(path);

        this.registerListeners();

    }

    public terminate(): void{
        this.serialPort.close();
        this.evtTerminate.post(null);
    }

    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();
    public readonly evtError = new SyncEvent<Error>();
    private readonly parseErrorDelay= 30000;

    private registerListeners(): void {



        this.evtError.attach(error => {
            
                if( error instanceof SerialPortError) console.log("LOOK HERE");

                this.serialPort.close();

                this.evtTerminate.post(error);

        });

        this.serialPort.on("disconnect", ()=> this.evtTerminate.post(null));
        this.serialPort.on("error", error => this.evtError.post(new SerialPortError(error)));


        let rawAtMessagesBuffer = "";
        let timer: NodeJS.Timer;

        this.serialPort.on("data", (data:Buffer) => {

            //console.log(JSON.stringify(data.toString("utf8")).yellow);

            if (timer) clearTimeout(timer);

            rawAtMessagesBuffer += data.toString("utf8");

            let atMessages: AtMessage[];

            try {

                atMessages = atMessagesParser(rawAtMessagesBuffer);

            } catch (error) {

                console.log("Parsing failed".red, JSON.stringify(rawAtMessagesBuffer));

                timer = setTimeout(
                    () => this.evtError.post(new ParseError(rawAtMessagesBuffer, error)),
                    this.parseErrorDelay
                );

                return;

            }

            rawAtMessagesBuffer = "";

            //console.log("Parsed".green, JSON.stringify(atMessages, null, 2).green);

            for (let atMessage of atMessages)
                if (atMessage.isUnsolicited)
                    this.evtUnsolicitedMessage.post(atMessage);
                else
                    this.evtResponseAtMessage.post(atMessage);

        });

    }



    //For ts-promisify

    public runCommand = execStack(this.runCommandManageParams);

    public runCommandExt: (command: String, params: RunParams, callback?: RunCallback) => void = this.runCommand;
    public runCommandDefault: (command: string, callback?: RunCallback) => void = this.runCommand;

    public runCommandManageParams(command: string, callback?: RunCallback): void;
    public runCommandManageParams(command: String, params: RunParams, callback?: RunCallback): void;
    public runCommandManageParams(...inputs: any[]): void {

        let command: string = "";
        let params: RunParams = {};
        let callback: RunCallback = function () { };

        for (let input of inputs) {
            switch (typeof input) {
                case "string": command = input; break;
                case "object": params = input; break;
                case "function": callback = input; break;
            }
        }

        if (typeof params.recoverable !== "boolean") params.recoverable = false;
        if (typeof params.reportMode !== "number") params.reportMode = ReportMode.DEBUG_INFO_CODE;
        switch (typeof params.retryOnErrors) {
            case "boolean": break;
            case "object":
                if (params.reportMode === ReportMode.NO_DEBUG_INFO)
                    params.retryOnErrors = false;
                break;
            default:
                if (params.reportMode === ReportMode.NO_DEBUG_INFO)
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

        this.runCommandSetReportMode(command, params as SafeRunParams, callback);

    }

    private reportMode: ReportMode | undefined = undefined;

    private runCommandSetReportMode(
        command: string,
        params: SafeRunParams,
        callback: RunCallback
    ): void {

        if (params.reportMode === this.reportMode) {
            this.runCommandRetry(command, params, callback);
        } else {

            //console.log(JSON.stringify(command), "Here we set the report mode to :".green, ReportMode[params.reportMode]);

            this.runCommandRetry(`AT+CMEE=${params.reportMode}\r`,
                { "recoverable": false, "retryOnErrors": [] } as any,
                () => this.runCommandRetry(command, params, callback));

            this.reportMode = params.reportMode;

        }

        if (command.match(/(^ATZ\r$)|(^AT\+CMEE=\ ?[0-9]\r$)/)) {

            //console.log("On reset le report mode".yellow, JSON.stringify(command));

            this.reportMode = undefined;
        }

    }


    private readonly maxRetry = 10;
    private readonly delayBeforeRetry = 5000;

    private retryLeft = this.maxRetry;

    private runCommandRetry(
        command: string,
        params: SafeRunParams,
        callback: RunCallback
    ): void {

        this.runCommandBase(command, (resp, final, raw) => {
            if (final.isError) {

                let code = NaN;

                if (!(final instanceof AtImps.ERROR))
                    code = (final as AtImps.P_CME_ERROR | AtImps.P_CMS_ERROR).code;

                if (this.retryLeft-- && params.retryOnErrors.indexOf(code) >= 0)
                    setTimeout(() => this.runCommandRetry(command, params, callback), this.delayBeforeRetry);
                else {

                    this.retryLeft = this.maxRetry;

                    if (params.recoverable)
                        callback(resp, final, raw);
                    else {
                        this.evtError.post(new CommandError(command, final));
                        return;
                    }
                }

            } else {

                this.retryLeft = this.maxRetry;
                callback(resp, final, raw);
            }

        });
    }

    private runCommandBase(command: string,
        callback: RunCallback): void {

        this.write(command, () => {

            let raw = "";
            let resp: AtMessage;
            let final: AtMessage;

            this.evtResponseAtMessage.attach(atMessage => {

                raw += atMessage.raw;

                if (atMessage.id === atIdDict.ECHO)
                    return;

                if (!atMessage.isFinal) {
                    resp = atMessage;
                    return;
                }

                final = atMessage;

                this.evtResponseAtMessage.detach();

                callback(resp, final, raw);

            });

        });
    }

    private write(rawAtCommand: string, callback: () => void): void {

        if (!this.serialPort.isOpen()) {

            this.serialPort.on("open", () => this.write(rawAtCommand, callback));
            return;
        }


        this.serialPort.write(rawAtCommand, originalSerialPortError => {

            if (originalSerialPortError) {
                this.evtError.post(new SerialPortError(originalSerialPortError));
                return;
            }

            callback();

        });


        /*
    this.serialPort.write(rawAtCommand, errorStr => {

        

        if (errorStr){
            this.evtError.post(new SerialPortError(new Error(errorStr)));
            return;
        }


        this.serialPort.drain(errorStr => {


            if (errorStr) {
                this.evtError.post(new SerialPortError(new Error(errorStr)));
                return;
            }

            callback();

        });

    });
    */

    }



}


export class CommandError extends Error {

    public readonly command: string;

    constructor(command: string,
        public readonly atMessageError: AtMessage) {
        super(CommandError.name);
        Object.setPrototypeOf(this, CommandError.prototype)

        this.command = String.raw`${command}`;
    }
}

export class ParseError extends Error {

    constructor(public readonly input: string,
        public readonly originalError: Error) {
        super(ParseError.name);
        Object.setPrototypeOf(this, ParseError.prototype)
    }

}

export class SerialPortError extends Error {

    public readonly originalError: Error;

    constructor(originalError: Error | string) {
        super(SerialPortError.name);
        Object.setPrototypeOf(this, SerialPortError.prototype)

        if (typeof originalError === "string")
            this.originalError = new Error(originalError);
        else
            this.originalError = originalError;

    }

}
