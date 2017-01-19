/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events";

import { 
    atMessagesParser, 
    AtMessageId, 
    AtMessage, 
    AtMessageImplementations, 
    ReportMode 
} from "at-messages-parser";

import { 
    atCommandsParser, 
    ParsedAtCommand, 
    AtCommandImplementations 
} from "at-commands-parser";

//TODO: Quand il y a eut une parse error vider la stack de command
//TODO: Les parse error n'on pas a être traité a l'exterieur, elle ne peuvent être traitée qu'en interne, faire crasher le program.
//TODO: Gerer les exceptions en cas de déconéction inopiné de la clef.

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR MODEM INTERFACE");
    console.log(error);
    throw error; 
});

export class RunAtCommandError extends Error{

    //public readonly parsedAtCommand: ParsedAtCommand;
    public readonly rawAtCommand: string;
    
    constructor(rawAtCommand: string,
    public readonly atMessageError: AtMessage){
        super("RunAtCommandError");
        Object.setPrototypeOf(this, RunAtCommandError.prototype)

        //this.parsedAtCommand= atCommandsParser(rawAtCommand);
        this.rawAtCommand= rawAtCommand;
    }
}

export class ParseError extends Error{

    constructor(public readonly input: string, 
    public readonly originalError: Error){
        super("ParseError");
        Object.setPrototypeOf(this, ParseError.prototype)
    }

}

export class SerialPortError extends Error{

    constructor( public readonly originalError: Error ){
        super("SerialPortError");
        Object.setPrototypeOf(this, SerialPortError.prototype)
    }

}

export interface RunCommandOutput {
    raw: string;
    atMessage: AtMessage;
    isSuccess: boolean;
    finalAtMessage: AtMessage;
}

export interface RunCommandParam {
        unrecoverable?: boolean;
        retryCount?: number;
        delay?: number;
        reportMode?: ReportMode;
        unrecoverableCommandError?: boolean;
}


export class ModemInterface {

    private readonly serialPort: SerialPort;
    public readonly evtUnsolicitedAtMessage = new SyncEvent<AtMessage>();
    private readonly evtError = new SyncEvent<Error>();
    public readonly evtRunAtCommandError= new SyncEvent<RunAtCommandError>();

    public readonly baudRate?: number;

    constructor(public readonly path: string, options?: {
        baudRate?: number;
        reportMode?: ReportMode;
    }) {

        options= options || {};

        let serialPortOptions: any= {};

        if( typeof(options.baudRate) === "number" ) serialPortOptions.baudRate= options.baudRate;
        
        this.serialPort = new SerialPort(path, serialPortOptions);

        this.registerListeners();

        if (typeof (options.reportMode) === "number") this.runCommand(`AT+CMEE=${options.reportMode}\r`);


    }

    public runCommand(rawAtCommand: string, param: RunCommandParam, callback?: (output: RunCommandOutput) => void): void;
    public runCommand(rawAtCommand: string, callback?: (output: RunCommandOutput) => void): void;
    public runCommand(...inputs: any[]): void {

        if( typeof(inputs[1]) === "object" ) this.runCommand_7(inputs[0], inputs[1], inputs[2]);
        else this.runCommand_7(inputs[0], {}, inputs[1]);

    }

    public static checkAtCommand(rawAtCommand): ParsedAtCommand {

        let parsedAtCommand: ParsedAtCommand;

        try {

            parsedAtCommand = atCommandsParser(rawAtCommand);

        } catch (error) {

            throw new Error(`At command ${rawAtCommand} could not be parsed`);

        }

        if (parsedAtCommand.commands.length > 1)
            throw new Error("Multiple at command not supported");

        if (parsedAtCommand.commands.length === 1
            && parsedAtCommand.commands[0].raw === "+CMEE=2")
            throw new Error("+CMEE=2 not supported");

        return parsedAtCommand;

    }

    private registerListeners(): void {

        this.evtError.attach(error => {

            console.log("UNRECOVERABLE ERROR MODEM INTERFACE", error); 
            setTimeout(()=> process.exit(1), 10);
        });

        this.serialPort.on("error", error => this.evtError.post(new SerialPortError(error)));
        this.serialPort.on("disconnect", error => this.evtError.post(new SerialPortError(error)));
        this.serialPort.on("close", error => this.evtError.post(new Error("Serial port closed")));
        this.serialPort.on("data", (data: Buffer) => {

            let rawAtMessages = data.toString("utf8");

            let atMessages: AtMessage[];

            try {

                atMessages = atMessagesParser(rawAtMessages);

            } catch (error) {

                this.evtError.post(new ParseError(rawAtMessages, error));

            }

            for (let atMessage of atMessages) {

                if (atMessage.isUnsolicited ||
                    !this.evtResponseAtMessage.listenerCount()) {

                    this.evtUnsolicitedAtMessage.post(atMessage);

                } else {

                    this.evtResponseAtMessage.post(atMessage);

                }

            }

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

    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();

    private runCommand_0(rawAtCommand: string, callback: (output: RunCommandOutput) => void): void {
        (async () => {

            await promisify.typed(this, this.write)(rawAtCommand);

            let output: RunCommandOutput = {
                "raw": "",
                "isSuccess": true,
                "atMessage": undefined,
                finalAtMessage: undefined
            };

            this.evtResponseAtMessage.attach(atMessage => {

                output.raw += atMessage.raw;

                if (atMessage.id === AtMessageId.AT_COMMAND) {

                    if (output.atMessage) {
                        this.evtUnsolicitedAtMessage.post(output.atMessage);
                        output.atMessage = undefined;
                        output.raw = atMessage.raw;
                    }

                    return;

                }

                if (!atMessage.isFinal) {
                    output.atMessage = atMessage;
                    return;
                }

                output.finalAtMessage = atMessage;

                if (atMessage.isError){ 
                    this.evtRunAtCommandError.post(new RunAtCommandError(rawAtCommand, atMessage));
                    output.isSuccess = false;
                }

                this.evtResponseAtMessage.detach();
                callback(output);

            });

        })();
    }


    private callStack_runCommand_1: (() => void)[] = [];
    private isReady_runAtCommand_1 = true;

    private runCommand_1(rawAtCommand: string, callback?: (output: RunCommandOutput) => void): void {
        (async () => {

            callback = callback || function () { };

            if (!this.isReady_runAtCommand_1) {

                this.callStack_runCommand_1.push(this.runCommand_1.bind(this, rawAtCommand, callback));

                return;

            }

            this.isReady_runAtCommand_1 = false;

            let [output] = await promisify.typed(this, this.runCommand_0)(rawAtCommand);

            callback(output);

            this.isReady_runAtCommand_1 = true;

            if (this.callStack_runCommand_1.length) this.callStack_runCommand_1.shift()();

        })();
    }

    private runCommand_2( unrecoverableCommandError: boolean, rawAtCommand: string, callback: (output: RunCommandOutput)=> void ):void {

        try {

            ModemInterface.checkAtCommand(rawAtCommand);

        } catch (error) {

            if (unrecoverableCommandError) this.evtError.post(error);
            else throw error;

        }

        this.runCommand_1(rawAtCommand, callback);

    }


    private runCommand_3(reportMode: ReportMode, uce: boolean, rac: string, cb: (output: RunCommandOutput) => void): void {

        if ( reportMode !== undefined ) {

            this.runCommand_2(true, "AT+CMEE?\r", output => {

                if (!output.isSuccess) this.evtError.post(new RunAtCommandError("AT+CMEE?\r", output.finalAtMessage));

                let currentReportMode = (<AtMessageImplementations.CMEE>output.atMessage).reportMode;

                if (currentReportMode !== reportMode) this.runCommand_2(true, `AT+CMEE=${reportMode}\r`, output => {
                    if (!output.isSuccess) this.evtError.post(new RunAtCommandError(`AT+CMEE=${reportMode}\r`, output.finalAtMessage));
                })

                this.runCommand_2(uce, rac, cb);

                if (currentReportMode !== reportMode) this.runCommand_2(true, `AT+CMEE=${currentReportMode}\r`, output => {
                    if (!output.isSuccess) this.evtError.post(new RunAtCommandError(`AT+CMEE=${currentReportMode}\r`, output.finalAtMessage));
                })

            });

        } else {

            this.runCommand_2(uce, rac, cb);

        }

    }

    private runCommand_4(retryCount: number, delay: number, rm: ReportMode, uce: boolean, rac: string, cb: (output: RunCommandOutput) => void): void {

        this.runCommand_3(rm, uce, rac, output => {

            if (output.isSuccess || retryCount === 0) return cb(output);

            setTimeout(() => this.runCommand_4(retryCount - 1, delay, rm, uce, rac, cb), delay);

        });

    }


    private runCommand_5(unrecoverable: boolean, rc: number, d: number, rm: ReportMode, uce: boolean, rac: string, cb: (output: RunCommandOutput) => void): void {

        this.runCommand_4(rc, d, rm, uce, rac, output=>{

                    if (unrecoverable && !output.isSuccess) this.evtError.post(new RunAtCommandError(rac, output.finalAtMessage));

                    cb(output);

        });

    }

    private runCommand_6(rawAtCommand: string, param: RunCommandParam, callback: (output: RunCommandOutput) => void): void {

        if (typeof (param.unrecoverable) !== "boolean") param.unrecoverable = true;
        if (typeof (param.retryCount) !== "number") param.retryCount = 10;
        if (typeof (param.delay) !== "number") param.delay = 1000;
        if (typeof (param.reportMode) !== "number") param.reportMode = undefined;
        if (typeof (param.unrecoverableCommandError) !== "boolean") param.unrecoverableCommandError = true;

        this.runCommand_5(
            param.unrecoverable,
            param.retryCount,
            param.delay,
            param.reportMode,
            param.unrecoverableCommandError, rawAtCommand, callback);

    }

    private callStack_runCommand_7: (() => void)[] = [];
    private isReady_runCommand_7 = true;

    private runCommand_7(rawAtCommand: string, param: RunCommandParam, callback: (output: RunCommandOutput) => void): void {
        (async () => {

            callback = callback || function () { };

            if (!this.isReady_runCommand_7) {

                this.callStack_runCommand_7.push(this.runCommand_7.bind(this, rawAtCommand, param, callback));

                return;

            }

            this.isReady_runCommand_7 = false;

            let [output] = await promisify.typed(this, this.runCommand_6)(rawAtCommand, param);

            callback(output);

            this.isReady_runCommand_7 = true;

            if (this.callStack_runCommand_7.length) this.callStack_runCommand_7.shift()();

        })();
    }


}