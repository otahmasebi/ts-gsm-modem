/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events-extended";
import { execStack } from "ts-exec-stack";

require("colors");

import { 
    atMessagesParser, 
    atIdDict, 
    AtMessage, 
    AtImps, 
    ReportMode 
} from "at-messages-parser";


export type RunCallback= {
        (resp: AtMessage, final: AtMessage, raw: string):void;
};

export type RunParams= {
        recoverable?: boolean;
        reportMode?: ReportMode;
        retryOnErrors?: boolean | number[];
};


export class AtStack {

    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    public readonly evtError = new SyncEvent<Error>();

    private readonly serialPort: SerialPort;

    constructor(path: string){

        this.serialPort = new SerialPort(path);

        this.registerListeners();

        this.runCommandBase("ATE0\r",()=>{});
        this.setReportMode(ReportMode.DEBUG_INFO_CODE);


    }


    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();

    private registerListeners(): void {


        this.serialPort.on("error", error => this.evtError.post(new SerialPortError(error)));
        this.serialPort.on("disconnect", error => this.evtError.post(new SerialPortError(error)));
        this.serialPort.on("close", error => this.evtError.post(new Error("Serial port closed")));

        let rawAtMessagesBuffer = "";
        let timer: NodeJS.Timer = null;

        this.serialPort.on("data", (data: Buffer) => {

            //console.log(JSON.stringify(data.toString("utf8")).yellow);

            if (timer) clearTimeout(timer);

            rawAtMessagesBuffer += data.toString("utf8");

            let atMessages: AtMessage[];

            try {

                atMessages = atMessagesParser(rawAtMessagesBuffer);

            } catch (error) {

                //console.log("Parsing failed".red, JSON.stringify(rawAtMessagesBuffer));

                timer = setTimeout(() => this.evtError.post(new ParseError(rawAtMessagesBuffer, error)), 10000);

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

    private write(rawAtCommand: string, callback: () => void): void {

        if (!this.serialPort.isOpen()) {

            this.serialPort.on("open", () => this.write(rawAtCommand, callback));
            return;
        }

        this.serialPort.write(rawAtCommand, errorStr => {

            if (errorStr) this.evtError.post(new SerialPortError(new Error(errorStr)));

            callback();

        });

    }

    private reportMode: ReportMode = undefined;

    private setReportMode(reportMode: ReportMode, callback?: RunCallback): void {

        callback = callback || function () { };

        if (this.reportMode === reportMode){
            callback(undefined, new AtMessage("\r\nOK\r\n", "OK"), "\r\nOK\r\n");
            return;
        }
        

        this.reportMode = reportMode;

        let command = `AT+CMEE=${reportMode}\r`;

        this.runCommandBase(command, (resp, final, raw) => {
            if (final.isError) {
                console.log("Meeeeeerde");
                this.evtError.post(new CommandError(command, final))
                return;
            }

            //console.log("on a set report mode to", ReportMode[this.reportMode]);

            callback(resp, final, raw);

        });

    }

    public runCommandExt(command: String, params: RunParams, callback?: RunCallback): void{
        this.runCommand(command, params, callback);
    }
    public runCommandSimple(command: string, callback?: RunCallback): void{ 
        this.runCommand(command, callback); 
    }

    public runCommand(command: string, callback?: RunCallback): void;
    public runCommand(command: String, params: RunParams, callback?: RunCallback): void;
    public runCommand(...inputs: any[]): void {

        let command: string;
        let params: RunParams = {};
        let callback: RunCallback = function () { };

        for (let input of inputs) {
            switch (typeof input) {
                case "string": command = input; break;
                case "object": params = input; break;
                case "function": callback = input; break;
            }
        }

        let match = command.match(/^AT\+CMEE=([0-9]+)\r$/);

        if (match) {
            this.setReportMode(parseInt(match[1]) as ReportMode, callback);
            return;
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
                    params.retryOnErrors = [14];
        }


        if (!params.retryOnErrors) 
            params.retryOnErrors = [];
        else if (typeof params.retryOnErrors === "boolean") {
            params.retryOnErrors = [];
            (params.retryOnErrors as number[]).indexOf = (...inputs) => { return 0; };
        }

        this.runCommandSetReportMode(command, params, callback);

    }

    private runCommandSetReportMode = execStack(
        (command: string, params: RunParams, callback: RunCallback): void => {

            let backupReportMode = this.reportMode;

            this.setReportMode(params.reportMode);
            this.runCommandRetry(command, params, (resp, final, raw) =>
                this.setReportMode(backupReportMode, () =>
                    callback(resp, final, raw))
            );

        }
    );

    private readonly maxRetry = 3;
    private readonly delayBeforeRetry = 15000;

    private retryLeft = this.maxRetry;

    private runCommandRetry = execStack(
        function runCommandRetry(command: string, params: RunParams, callback: RunCallback) {

            let self = this as AtStack;
            let codes = params.retryOnErrors as number[];

            self.runCommandBase(command, (resp, final, raw) => {
                if (final.isError) {

                    let atError = final as AtImps.P_CME_ERROR | AtImps.P_CMS_ERROR

                    if (self.retryLeft-- && codes.indexOf(atError.code) >= 0)
                        setTimeout(runCommandRetry.bind(self, command, params, callback), self.delayBeforeRetry);
                    else {

                        self.retryLeft = self.maxRetry;

                        if (params.recoverable)
                            callback(resp, final, raw);
                        else {
                            this.evtError.post(new CommandError(command, final));
                            callback(null, null, null);
                        }
                    }

                } else {

                    self.retryLeft = self.maxRetry;
                    callback(resp, final, raw);
                }

            });
        }
    );

    private runCommandBase = execStack(
        (command: string, callback: RunCallback): void => {

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
    );

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

    constructor(public readonly originalError: Error) {
        super(SerialPortError.name);
        Object.setPrototypeOf(this, SerialPortError.prototype)
    }

}