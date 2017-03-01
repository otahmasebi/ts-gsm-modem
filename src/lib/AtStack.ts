import { SerialPortExt } from "./SerialPortExt";
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
    userProvided: {
        recoverable?: boolean;
        reportMode?: ReportMode;
        retryOnErrors?: boolean | number[];
    };
    safe: {
        recoverable: boolean;
        reportMode: ReportMode;
        retryOnErrors: number[];
    }
};


export class AtStack {

    public readonly evtUnsolicitedMessage = new SyncEvent<AtMessage>();
    public readonly evtTerminate = new SyncEvent<Error | null>();

    private readonly serialPort: SerialPortExt;
    private readonly serialPortAtParser= getSerialPortParser(61000);
    constructor(path: string) {

        this.serialPort = new SerialPortExt(path, {
            "baudRate": 9600,
            "parser": this.serialPortAtParser
        });

        this.registerListeners();


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

            this.serialPort.close();

            console.log("unrecoverable error: ".red, error);

            this.evtTerminate.post(error);

        });

        this.serialPortAtParser.evtRawData.attach(rawAtMessages => console.log(JSON.stringify(rawAtMessages).yellow));
        //this.evtUnsolicitedMessage.attach(atMessage=> console.log(JSON.stringify(atMessage,null,2).yellow));

        this.serialPort.on("disconnect", () => this.evtTerminate.post(null));

        this.serialPort.evtError.attach(serialPortError=> this.evtError.post(serialPortError));

        this.serialPort.on("data", (atMessage: AtMessage | null, unparsed: string) => {

            if (!atMessage) {
                this.evtError.post(new ParseError(unparsed));
                return;
            }

            if (atMessage.isUnsolicited)
                this.evtUnsolicitedMessage.post(atMessage);
            else{

                if( !this.evtResponseAtMessage.listenerCount() ){

                    console.log("======================> attention il n'y a pas de listener!!!".red);

                }

                 this.evtResponseAtMessage.post(atMessage);
            }

        });

    }



    //For ts-promisify

    
    private static generateSafeRunParams(params: RunParams['userProvided'] | undefined): RunParams['safe'] {

        if( !params ) 
            params= {};

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

        return params as RunParams['safe'];


    }

    public runCommand = execStack(this.runCommandManageParams);

    public runCommandExt: (command: String, params: RunParams['userProvided'], callback?: RunCallback) => void = this.runCommand;
    public runCommandDefault: (command: string, callback?: RunCallback) => void = this.runCommand;

    public runCommandManageParams(command: string, callback?: RunCallback): void;
    public runCommandManageParams(command: String, params: RunParams['userProvided'], callback?: RunCallback): void;
    public runCommandManageParams(...inputs: any[]): void {

        let command: string | undefined = undefined;
        let params: RunParams['userProvided'] | undefined = undefined;
        let callback: RunCallback = function () { };

        for (let input of inputs) {
            switch (typeof input) {
                case "string": command = input; break;
                case "object": params = input; break;
                case "function": callback = input; break;
            }
        }

        this.runCommandSetReportMode(
            command!,
            AtStack.generateSafeRunParams(params),
            callback
        );

    }

    private reportMode: ReportMode | undefined = undefined;

    private runCommandSetReportMode(
        command: string,
        params: RunParams['safe'],
        callback: RunCallback
    ): void {

        if (params.reportMode === this.reportMode) 
            this.runCommandRetry(command, params, callback);
        else {

            //console.log(JSON.stringify(command), "Here we set the report mode to :".green, ReportMode[params.reportMode]);

            this.runCommandRetry(`AT+CMEE=${params.reportMode}\r`,
                { "recoverable": false, "retryOnErrors": [] } as any,
                () => {
                    this.reportMode = params.reportMode;
                    this.runCommandRetry(command, params, callback)
                });

        }

        if (command.match(/(^ATZ\r$)|(^AT\+CMEE=\ ?[0-9]\r$)/)) 
            this.reportMode = undefined;

    }


    private readonly maxRetry = 10;
    private readonly delayBeforeRetry = 5000;

    private retryLeft = this.maxRetry;

    private runCommandRetry(
        command: string,
        params: RunParams['safe'],
        callback: RunCallback
    ): void {

        this.runCommandBase(command, (resp, final, raw) => {
            if (final.isError) {

                let code = NaN;

                if( final.id === atIdDict.COMMAND_NOT_SUPPORT || final.id === atIdDict.TOO_MANY_PARAMETERS )
                    this.retryLeft= 0;
                else if (final.id === atIdDict.P_CME_ERROR || final.id === atIdDict.P_CMS_ERROR)
                    code = (final as AtImps.P_CME_ERROR | AtImps.P_CMS_ERROR).code;

                if (this.retryLeft-- && params.retryOnErrors.indexOf(code) >= 0)
                    setTimeout(() => this.runCommandRetry(command, params, callback), this.delayBeforeRetry);
                else {

                    this.retryLeft = this.maxRetry;

                    if (params.recoverable)
                        callback(resp, final, raw);
                    else {
                        this.evtError.post(new RunCommandError(command, final));
                        return;
                    }
                }

            } else {

                this.retryLeft = this.maxRetry;
                callback(resp, final, raw);
            }

        });
    }

    private static isPduSubmit(command: string): boolean {
        return command[command.length - 1] !== "\r";
    }

    private runCommandBase(
        command: string,
        callback: RunCallback
    ): void {

        console.log(`write: ${JSON.stringify(command)}`.blue);

        let resp: AtMessage | undefined = undefined;
        let final: AtMessage;
        let raw = "";

        let timer: NodeJS.Timer;

        //TODO: When we timeout on CMGS we have to cancel command.

        if (AtStack.isPduSubmit(command)) {
            let atError = new AtImps.ERROR("\r\nERROR\r\n");
            timer = setTimeout(() => {
                this.evtResponseAtMessage.detach();
                console.log("ERROR PDU SUBMIT".red);
                callback(undefined, atError, raw + atError.raw);
            }, 60000);
        } else {
            timer = setTimeout(() => {

                this.evtResponseAtMessage.detach();

                let unparsed = this.serialPortAtParser.flush();

                console.log(`Timeout with command ${JSON.stringify(command)}`.red)
                console.log("unparsed: ", JSON.stringify(unparsed));
                console.log("raw: ", JSON.stringify(raw).blue);
                console.log("resp: ", JSON.stringify(resp));

                this.runCommandBase(command, callback);

            }, 30000);
        }


        Promise.all([
            new Promise(resolve => this.serialPort.writeAndDrain(command, serialPortError => {
                if (serialPortError) {
                    this.serialPort.evtError.post(serialPortError);
                    return;
                }
                resolve();
            })),
            new Promise<[AtMessage | undefined, AtMessage, string]>(resolve => {

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

                    clearTimeout(timer);

                    console.log(`raw: ${JSON.stringify(raw, null, 2)}`.green);

                    resolve([resp, final, raw]);

                });


            })
        ]).then(([_, [resp, final, raw]]) => callback(resp, final, raw));

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

