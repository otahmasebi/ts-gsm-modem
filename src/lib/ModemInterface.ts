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

export class RunAtCommandError extends Error{

    public readonly parsedAtCommand: ParsedAtCommand;
    
    constructor(rawAtCommand: string,
    public readonly atMessageError: AtMessage){
        super("RunAtCommandError");
        Object.setPrototypeOf(this, RunAtCommandError.prototype)

        this.parsedAtCommand= atCommandsParser(rawAtCommand);
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

export interface RunAtCommandOutput {
    raw: string;
    atMessage: AtMessage;
    isSuccess: boolean;
    finalAtMessage: AtMessage;
}

export class ModemInterface {

    private readonly serialPort: SerialPort;
    public readonly evtUnsolicitedAtMessage = new SyncEvent<AtMessage>();
    private readonly __evtError__ = new SyncEvent<Error>();
    public readonly evtError = new SyncEvent<Error>();
    public readonly evtParseError= new SyncEvent<ParseError>();
    public readonly evtSerialPortError= new SyncEvent<SerialPortError>();
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

        if( typeof(options.reportMode) === "number" ) this.setReportMode(options.reportMode);


    }

    private registerListeners(): void {

        this.__evtError__.attach( error => {

            this.evtError.post(error);

            if( error instanceof ParseError ) this.evtParseError.post(error)
            else if( error instanceof SerialPortError ) this.evtSerialPortError.post(error)
            else if( error instanceof RunAtCommandError ) this.evtRunAtCommandError.post(error);

        });


        this.serialPort.on("error", error => this.__evtError__.post(new SerialPortError(error)));

        this.serialPort.on("data", (data: Buffer) => {

            let rawAtMessages = data.toString("utf8");

            let atMessages: AtMessage[];

            try {

                atMessages = atMessagesParser(rawAtMessages);

            } catch (error) {

                this.__evtError__.post(new ParseError(rawAtMessages, error));
                return;

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

    private write(atCommand: string,
        callback?: (isSuccess: boolean) => void): void {
        (async () => {

            if (!this.serialPort.isOpen()) {

                this.serialPort.on("open", () => this.write(atCommand, callback));
                return;
            }

            let [errorStr] = await promisify.typed(this.serialPort, this.serialPort.write)(atCommand);

            if (errorStr) callback(false);
            else callback(true);

        })();
    }



    public getReportMode(callback: (reportMode: ReportMode)=>void):void{

        this.runAtCommand("AT+CMEE?\r", output => {

            if( !output.isSuccess ) return callback(null);

            callback((<AtMessageImplementations.CMEE>output.atMessage).reportMode);

        });

    }

    private stack: (() => void)[] = [];
    private isRunAtCommandReady = true;

    public runAtCommand(rawAtCommand: string, reportMode: ReportMode, callback?: (output: RunAtCommandOutput) => void): void;
    public runAtCommand(rawAtCommand: string, callback?: (output: RunAtCommandOutput) => void): void;
    public runAtCommand(...inputs: any[]): any { 

        let rawAtCommand= <string>inputs[0];

        let callback: (output: RunAtCommandOutput)=>void= null;

        if( typeof inputs[1] === "number" ){

            let reportMode= <ReportMode>inputs[1];
            if( inputs.length === 3) callback= inputs[2];

            return this.getReportMode(currentReportMode => {

                if( currentReportMode === reportMode ){
                    this.runAtCommand(rawAtCommand, callback);
                }else{
                    this.runAtCommand(`AT+CMEE=${reportMode}\r`);
                    this.runAtCommand(rawAtCommand, callback);
                    this.runAtCommand(`AT+CMEE=${currentReportMode}\r`);
                }

            });

        }

        if( inputs.length === 2 ) callback= inputs[1];

        let parsedAtCommand: ParsedAtCommand;

        try {

            parsedAtCommand = atCommandsParser(rawAtCommand);

        } catch (error) {

            throw new Error("At command could not be parsed");

        }

        if (parsedAtCommand.commands.length > 1) 
            throw new Error("Multiple at command not supported");

        if (parsedAtCommand.commands.length === 1
            && parsedAtCommand.commands[0].raw === "+CMEE=2")
            throw new Error("+CMEE=2 not supported");

        (async () => {

            if (!this.isRunAtCommandReady) {

                this.stack.push(this.runAtCommand.bind(this, rawAtCommand, callback));

                return;

            }

            this.isRunAtCommandReady = false;

            let [output] = await promisify.typed(this, this.__runAtCommand__)(rawAtCommand);

            if (callback) callback(output);

            this.isRunAtCommandReady = true;

            if (this.stack.length) this.stack.shift()();

        })();
    }

    private readonly evtResponseAtMessage = new SyncEvent<AtMessage>();

    private __runAtCommand__(rawAtCommand: string, callback: (output: RunAtCommandOutput) => void): void {
        (async () => {

            let [isSuccess] = await promisify.typed(this, this.write)(rawAtCommand);

            if (!isSuccess) return callback(null);

            let output: RunAtCommandOutput = {
                "raw": "",
                "isSuccess": true,
                "atMessage": undefined,
                finalAtMessage: undefined
            };

            this.evtResponseAtMessage.attach(atMessage => {

                output.raw += atMessage.raw;

                if (atMessage.id === AtMessageId.AT_COMMAND){

                    if( output.atMessage ){
                        this.evtUnsolicitedAtMessage.post(output.atMessage);
                        output.atMessage= undefined;
                        output.raw= atMessage.raw;
                    }

                    return;

                }

                if (!atMessage.isFinal) return output.atMessage = atMessage;

                output.finalAtMessage = atMessage;

                if (atMessage.isError) {
                    output.isSuccess = false;
                    this.__evtError__.post(new RunAtCommandError(rawAtCommand, atMessage));
                }

                this.evtResponseAtMessage.detach();
                callback(output);

            });

        })();
    }

}