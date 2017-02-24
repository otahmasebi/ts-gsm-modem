// Type definitions for serialport 4.0.7

declare module "serialport" {


    class SerialPort {
        constructor(path: string, options?: Object, openImmediately?: boolean, callback?: (err: string) => void)
        isOpen(): boolean;
        on(event: "data", callback: (data: Buffer|string)=> void):void;
        on(event: "error", callback: (error: string|Error)=> void):void;
        on(event: "disconnect", callback: (error: string|Error|null|undefined)=>void):void;
        on(event: "open", callback: ()=>void):void;
        open(callback: () => void): void;
        write(buffer: Buffer|string, callback?: (error: string|Error|null|undefined) => void): void
        pause(): void;
        resume(): void;
        disconnected(error: string|Error): void;
        close(callback?: (error: string|Error|null|undefined) => void): void;
        flush(callback?: (err: string|Error|null|undefined) => void): void;
        set(options: SerialPort.setOptions, callback: () => void): void;
        drain(callback?: (error:string|Error|null|undefined) => void): void;
        update(options: SerialPort.updateOptions, callback?: () => void): void;
        static list(callback: (err: string, ports: SerialPort.portConfig[]) => void): void;
        static parsers: {
            readline: (delimiter: string) => void,
            raw: (emitter: any, buffer: string) => void
        };
    }

    namespace SerialPort {
        interface portConfig {
            comName: string;
            manufacturer: string;
            serialNumber: string;
            pnpId: string;
            locationId: string;
            vendorId: string;
            productId: string;
        }

        interface setOptions {
            brk?: boolean;
            cts?: boolean;
            dsr?: boolean;
            dtr?: boolean;
            rts?: boolean;
        }

        interface updateOptions {
            baudRate?: number;
        }
    }

    export = SerialPort
}
