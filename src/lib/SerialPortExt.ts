/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import { execStack, ExecStack } from "ts-exec-stack";
import { SyncEvent } from "ts-events-extended";

export class SerialPortExt extends SerialPort {

    private readonly openTimeOut= 5000;

    //Todo test if when terminate still running because of evtError

    public readonly evtError= (()=>{

        let out= new SyncEvent<SerialPortError>();

        this.on("error", error=> out.post(new SerialPortError(error)));

        return out;

    })();

    private timer: NodeJS.Timer | undefined= undefined;

    public writeAndDrain = execStack(
        function callee(
            buffer: Buffer | string,
            callback?: (error: SerialPortError | null) => void
        ): void {

            let self = this as SerialPortExt;

            if (!self.isOpen()) {

                self.timer = setTimeout(() => {

                    let error= new SerialPortError("Serial port took too much time to open", "open time out");

                    if( !(callback as any).hasCallback )
                        self.evtError.post(error);

                    callback!(error);

                }, self.openTimeOut);

                self.on("open", () => {

                    clearTimeout(self.timer!);

                    callee.call(self, buffer, callback);

                });

                return;

            }


            self.write(buffer, error => {

                if (error) {
                    let serialPortError= new SerialPortError(error, "write");

                    if( !(callback as any).hasCallback )
                        self.evtError.post(serialPortError);

                    callback!(serialPortError);
                    return;
                }

                self.drain(error => {

                    if (error) {
                        let serialPortError= new SerialPortError(error, "drain");

                        if (!(callback as any).hasCallback )
                            self.evtError.post(serialPortError);

                        callback!(serialPortError);

                        return;
                    }

                    //console.log("write success".blue, JSON.stringify(buffer));

                    callback!(null);

                });

            });
        });

}


export class SerialPortError extends Error {

    public readonly originalError: Error;

    constructor(originalError: Error | string, public readonly causedBy?: "drain" | "write" | "open time out") {
        super(SerialPortError.name);
        Object.setPrototypeOf(this, SerialPortError.prototype)

        if (typeof originalError === "string")
            this.originalError = new Error(originalError);
        else
            this.originalError = originalError;

    }
}