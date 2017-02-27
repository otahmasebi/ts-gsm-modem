/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events-extended";
import { execStack, ExecStack } from "ts-exec-stack";

require("colors");

import { 
    atMessagesParser, 
    getSerialPortParser,
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
    public readonly evtTerminate = new SyncEvent<Error | null>();

    private readonly serialPort: SerialPort;
    private readonly serialPortAtParser= getSerialPortParser();
    constructor(path: string) {

        this.serialPort = new SerialPort(path, {
            "baudRate": 9600,
            "parser": this.serialPortAtParser
        });
        //this.serialPort = new SerialPort(path);

        this.registerListeners();

        //this.runCommand("ATZ\r");

    }

    public terminate(): void {
        this.serialPort.close();
        this.evtTerminate.post(null);
    }

    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();
    public readonly evtError = new SyncEvent<Error>();
    private readonly parseErrorDelay = 30000;

    private registerListeners(): void {



        this.evtError.attach(error => {

            if (error instanceof SerialPortError) console.log("LOOK HERE");

            this.serialPort.close();

            this.evtTerminate.post(error);

        });

        //this.serialPortAtParser.evtRawData.attach(rawAtMessages => console.log(JSON.stringify(rawAtMessages).yellow));
        //this.evtUnsolicitedMessage.attach(atMessage=> console.log(JSON.stringify(atMessage,null,2).yellow));

        this.serialPort.on("disconnect", () => this.evtTerminate.post(null));
        this.serialPort.on("error", error => this.evtError.post(new SerialPortError(error)));
        this.serialPort.on("data", (atMessage: AtMessage | null, unparsed: string) => {

            if (!atMessage) {
                this.evtError.post(new ParseError(unparsed));
                return;
            }

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
                () => {
                    this.reportMode = params.reportMode;
                    this.runCommandRetry(command, params, callback)
                });


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

        Promise.all([
            new Promise(resolve => this.write(command, resolve)),
            new Promise<[AtMessage | undefined, AtMessage, string]>(resolve => {

                let resp: AtMessage | undefined = undefined;
                let final: AtMessage;
                let raw = "";

                let timer = setTimeout(() => {

                    console.log(`Timeout with command ${JSON.stringify(command)}`.red)

                    //TODO: flush pending

                    this.evtResponseAtMessage.detach();

                    let unparsed = this.serialPortAtParser.flush();

                    console.log("unparsed: ", JSON.stringify(unparsed));
                    console.log("raw: ", JSON.stringify(raw).blue);
                    console.log("resp: ", JSON.stringify(resp));

                    if( command[ command.length-1 ] !== "\r" ){

                        console.log("c'etais un pdu".red);

                        let error= new AtImps.ERROR("\r\nERROR\r\n");

                        callback(undefined, error, raw+error.raw);
                        return;

                    }

                    this.runCommandBase(command, callback);


                }, 60000);


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

                    try {

                        clearTimeout(timer);

                    } catch (error) {

                        console.log("error clear timeout".red, error);

                    }

                    resolve([resp, final, raw]);

                });


            })
        ]).then(([_, [resp, final, raw]]) => callback(resp, final, raw));

    }

    private write(rawAtCommand: string, callback: () => void): void {

        if (!this.serialPort.isOpen()) {

            this.serialPort.on("open", () => this.write(rawAtCommand, callback));
            return;
        }

        this.serialPort.write(rawAtCommand, originalSerialPortError => {

            //console.log("Write: ".blue, JSON.stringify(rawAtCommand));

            if (originalSerialPortError) {
                this.evtError.post(new SerialPortError(originalSerialPortError));
                return;
            }

            this.serialPort.drain(originalSerialPortError => {

                if (originalSerialPortError) {
                    console.log("drain issue");
                    this.evtError.post(new SerialPortError(originalSerialPortError));
                    return;
                }

                callback();

            });


        });



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

    constructor(public readonly unparsed: string) {
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
