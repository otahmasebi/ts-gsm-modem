/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as promisify from "ts-promisify";
import { SyncEvent } from "ts-events";

require("colors");

import { 
    atMessagesParser, 
    atIds, 
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


export class CommandError extends Error{

    //public readonly parsedAtCommand: ParsedAtCommand;
    public readonly rawAtCommand: string;
    
    constructor(rawAtCommand: string,
    public readonly atMessageError: AtMessage){
        super("RunAtCommandError");
        Object.setPrototypeOf(this, CommandError.prototype)

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

export interface CommandResp {
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


export class AtStack {

    private readonly serialPort: SerialPort;
    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    private readonly evtError = new SyncEvent<Error>();
    public readonly evtCommandError= new SyncEvent<CommandError>();

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


    public static checkCommand(rawAtCommand): ParsedAtCommand {

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
            console.log("UNRECOVERABLE ERROR MODEM INTERFACE".yellow, error); 
            process.exit(1);
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

                    this.evtUnsolicitedMessage.post(atMessage);

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

    private runCommand_0(rawAtCommand: string, callback: (output: CommandResp) => void): void {
        (async () => {

            await promisify.typed(this, this.write)(rawAtCommand);

            let output: CommandResp = {
                "raw": "",
                "isSuccess": true,
                "atMessage": undefined,
                finalAtMessage: undefined
            };

            this.evtResponseAtMessage.attach(atMessage => {

                output.raw += atMessage.raw;

                if (atMessage.id === atIds.ECHO) {

                    if (output.atMessage) {
                        this.evtUnsolicitedMessage.post(output.atMessage);
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
                    this.evtCommandError.post(new CommandError(rawAtCommand, atMessage));
                    output.isSuccess = false;
                }

                this.evtResponseAtMessage.detach();
                callback(output);

            });

        })();
    }


    private callStack_runCommand_1: (() => void)[] = [];
    private isReady_runAtCommand_1 = true;

    private runCommand_1(rac: string, cb: (o: CommandResp) => void): void {
        (async () => {

            if (!this.isReady_runAtCommand_1) {

                this.callStack_runCommand_1.push(this.runCommand_1.bind(this, rac, cb));

                return;

            }

            this.isReady_runAtCommand_1 = false;

            let [output] = await promisify.typed(this, this.runCommand_0)(rac);

            cb(output);

            this.isReady_runAtCommand_1 = true;

            if (this.callStack_runCommand_1.length) this.callStack_runCommand_1.shift()();

        })();
    }

    private runCommand_2( unrecoverableCommandError: boolean, rac: string, cb: (o: CommandResp)=> void ):void {

        try {

            AtStack.checkCommand(rac);

        } catch (error) {

            if (unrecoverableCommandError) this.evtError.post(error);
            else throw error;

        }

        this.runCommand_1(rac, cb);

    }


    private runCommand_3(reportMode: ReportMode, uce: boolean, rac: string, cb: (o: CommandResp) => void): void {

        if ( reportMode !== undefined ) {

            this.runCommand_2(true, "AT+CMEE?\r", o => {

                if (!o.isSuccess) this.evtError.post(new CommandError("AT+CMEE?\r", o.finalAtMessage));

                let currentReportMode = (<AtMessageImplementations.CMEE>o.atMessage).reportMode;

                if (currentReportMode !== reportMode) this.runCommand_2(true, `AT+CMEE=${reportMode}\r`, o => {
                    if (!o.isSuccess) this.evtError.post(new CommandError(`AT+CMEE=${reportMode}\r`, o.finalAtMessage));
                })

                this.runCommand_2(uce, rac, cb);

                if (currentReportMode !== reportMode) this.runCommand_2(true, `AT+CMEE=${currentReportMode}\r`, o => {
                    if (!o.isSuccess) this.evtError.post(new CommandError(`AT+CMEE=${currentReportMode}\r`, o.finalAtMessage));
                })

            });

        } else {

            this.runCommand_2(uce, rac, cb);

        }

    }

    private runCommand_4(retryCount: number, delay: number, rm: ReportMode, uce: boolean, rac: string, cb: (o: CommandResp) => void): void {

        this.runCommand_3(rm, uce, rac, o => {

            if (o.isSuccess || retryCount === 0) return cb(o);

            //console.log("error retry".red, rac, o);

            setTimeout(() => this.runCommand_4(retryCount - 1, delay, rm, uce, rac, cb), delay);

        });

    }


    private runCommand_5(unrecoverable: boolean, rc: number, d: number, rm: ReportMode, uce: boolean, rac: string, cb: (o: CommandResp) => void): void {

        this.runCommand_4(rc, d, rm, uce, rac, o=>{

                    if (unrecoverable && !o.isSuccess) this.evtError.post(new CommandError(rac, o.finalAtMessage));

                    cb(o);

        });

    }

    private runCommand_6(rac: string, p: RunCommandParam, cb: (o: CommandResp) => void): void {

        if (typeof (p.unrecoverable) !== "boolean") p.unrecoverable = true;
        if (typeof (p.retryCount) !== "number") p.retryCount = 10;
        if (typeof (p.delay) !== "number") p.delay = 1000;
        if (typeof (p.reportMode) !== "number") p.reportMode = undefined;
        if (typeof (p.unrecoverableCommandError) !== "boolean") p.unrecoverableCommandError = true;

        this.runCommand_5( p.unrecoverable, p.retryCount, p.delay, p.reportMode, p.unrecoverableCommandError, rac, cb);

    }

    private callStack_runCommand_7: (() => void)[] = [];
    private isReady_runCommand_7 = true;

    private runCommand_7(rac: string, p: RunCommandParam, cb: (o: CommandResp) => void): void {
        (async () => {

            cb = cb || function () { };

            if (!this.isReady_runCommand_7) {

                this.callStack_runCommand_7.push(this.runCommand_7.bind(this, rac, p, cb));

                return;

            }

            this.isReady_runCommand_7 = false;

            let [output] = await promisify.typed(this, this.runCommand_6)(rac, p);

            cb(output);

            this.isReady_runCommand_7 = true;

            if (this.callStack_runCommand_7.length) this.callStack_runCommand_7.shift()();

        })();
    }

    public runCommand(rawAtCommand: string, param: RunCommandParam, callback?: (output: CommandResp) => void): void;
    public runCommand(rawAtCommand: string, callback?: (output: CommandResp) => void): void;
    public runCommand(...inputs: any[]): void {

        if( typeof(inputs[1]) === "object" ) this.runCommand_7(inputs[0], inputs[1], inputs[2]);
        else this.runCommand_7(inputs[0], {}, inputs[1]);

    }

}