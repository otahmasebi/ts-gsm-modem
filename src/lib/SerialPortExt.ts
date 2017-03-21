/// <reference path="./ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";
import { execStack, ExecStack } from "ts-exec-stack";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import * as pr from "ts-promisify";

const openTimeOut= 5000;

export class SerialPortExt extends SerialPort {

    //Todo test if when terminate still running because of evtError

    public readonly evtError = new SyncEvent<SerialPortError>();

    public readonly evtOpen= new VoidSyncEvent();

    public readonly evtData= new SyncEvent<any[]>();



    private registerListener: void= (()=>{

        this.on("error", error => this.evtError.post(new SerialPortError(error)));

        this.on("open", () => this.evtOpen.post());

        this.on("data", (...data) => this.evtData.post(data));

    })();



    public writeAndDrain = execStack(
        async (
            buffer: Buffer | string,
            callback?: () => void
        ): Promise<void> => {

            if (!this.isOpen()) {

                let hasTimeout = await this.evtOpen.waitFor(openTimeOut);

                if (hasTimeout) {
                    let error = new SerialPortError("Serial port took too much time to open", "OPEN_TIMEOUT");
                    this.evtError.post(error);
                    return;
                }
            }

            let [errorWrite] = await pr.typed(this, this.write)(buffer);

            if (errorWrite) {
                let serialPortError = new SerialPortError(errorWrite, "WRITE");
                this.evtError.post(serialPortError);
                return;
            }

            let [errorDrain] = await pr.typed(this, this.drain)();

            if (errorDrain) {
                let serialPortError = new SerialPortError(errorDrain, "DRAIN");
                this.evtError.post(serialPortError);
                return;
            }

            callback!();

        }
    );


}


export class SerialPortError extends Error {

    public readonly originalError: Error;

    constructor(originalError: Error | string, public readonly causedBy?: "DRAIN" | "WRITE" | "OPEN_TIMEOUT") {
        super(SerialPortError.name);
        Object.setPrototypeOf(this, SerialPortError.prototype)

        if (typeof originalError === "string")
            this.originalError = new Error(originalError);
        else
            this.originalError = originalError;

    }
}