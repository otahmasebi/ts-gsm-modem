/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import * as runExclusive from "run-exclusive";
import { Evt } from "ts-evt";


const openTimeOut = 45000;

/** Do not use on("error",) use evtError otherwise use as SerialPort */
export class SerialPortExt extends SerialPort {

    //Todo test if when terminate still running because of evtError

    public readonly evtError = (()=>{

        const evt= new Evt<SerialPortError>();

        this.once("error", error => evt.post( 
            new SerialPortError(error, this.writeHistory, "EMITTED BY SERIAL PORT INSTANCE"))
        );

        return evt;

    })();

    public readonly writeHistory: (Buffer | string )[]= [];

    /** 
     * Never throw, never resolve if error ( an evtError will be posted )
     * Assert is not called after close as we have no way to test if closed.
     */
    public writeAndDrain = runExclusive.buildMethod(
        async (buffer: Buffer | string): Promise<void> => {

            if( this.writeHistory.length > 6 ){
                this.writeHistory.shift();
            }

            this.writeHistory.push(buffer);

            if (!this.isOpen()) {

                let timer: NodeJS.Timer;
                let onceOpen: ()=> void;
                let onceClose: ()=> void;
                let onceError: ()=> void;

                //TODO: check if close is called even if never open.
                const result= await Promise.race([
                    new Promise<"OPEN">(resolve => { 
                        onceOpen= ()=> resolve("OPEN");
                        this.once("open", onceOpen) ;
                    }),
                    new Promise<"TERMINATED">(resolve => { 
                        onceClose= ()=> resolve("TERMINATED");
                        this.once("close", onceClose); 
                    }),
                    new Promise<"TERMINATED">(resolve => { 
                        onceError= ()=> resolve("TERMINATED");
                        this.once("error", onceClose); 
                    }),
                    new Promise<"TIMEOUT">(resolve => 
                        timer = setTimeout(() => resolve("TIMEOUT"), openTimeOut)
                    )
                ]);

                this.removeListener("open", onceOpen!);
                this.removeListener("close", onceClose!);
                this.removeListener("error", onceError!);
                clearTimeout(timer!);

                switch(result){
                    case "OPEN": 
                        await new Promise(resolve => setTimeout(resolve, 500));
                        break;
                    case "TERMINATED": 
                        await new Promise(resolve=> {});
                    case "TIMEOUT": 
                        this.evtError.post(new SerialPortError(
                            "Serial port took too much time to open", 
                            this.writeHistory, 
                            "OPEN TIMEOUT"
                        ));
                        await new Promise(resolve => { });
                }

            }


            {

                const error = await new Promise<string | Error | null>(
                    resolve => this.write(buffer, error => resolve(error))
                );

                if (!!error) {

                    this.evtError.post(
                        new SerialPortError(error, this.writeHistory, "ERROR CALLING WRITE")
                    );

                    await new Promise(_resolve => { });

                }

            }

            {

                const error = await new Promise<string | Error | null>(
                    resolve => this.drain(error => resolve(error))
                );

                if (!!error) {

                    this.evtError.post(
                        new SerialPortError(error, this.writeHistory, "ERROR CALLING DRAIN")
                    );

                    await new Promise(_resolve => { });

                }

            }


        }
    );

}

export class SerialPortError extends Error {

    public readonly originalError: Error;

    constructor(
        originalError: Error | string,
        public readonly writeHistory: (Buffer | string)[],
        public readonly origin: "ERROR CALLING DRAIN" |
            "ERROR CALLING WRITE" |
            "OPEN TIMEOUT" |
            "EMITTED BY SERIAL PORT INSTANCE"
    ) {

        super("Error produced by node-serialport");

        Object.setPrototypeOf(this, new.target.prototype);

        if (typeof originalError === "string") {
            this.originalError = new Error(originalError);
        } else {
            this.originalError = originalError;
        }

    }

    public toString(): string {

        return [
            `SerialPortExtError: ${this.message}`,
            `Origin: ${this.origin}`,
            `message: ${this.originalError.message}`,
            `Previous write (older to newest): ${JSON.stringify(this.writeHistory.map(b => `${b}`), null, 2)}`
        ].join("\n");

    }

}