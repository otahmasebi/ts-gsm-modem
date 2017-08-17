// Type definitions for serialport 4.0.7




declare module "serialport" {

    type Parser= (emitter: NodeJS.EventEmitter, buffer: Buffer | string)=> void;

    type Options = {
        baudRate?: number;
        autoOpen?: boolean;
        parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
        xon?: boolean,
        xoff?: boolean,
        xany?: boolean,
        rtscts?: boolean,
        hupcl?: boolean,
        dataBits?: number,
        stopBits?: number,
        bufferSize?: number,
        lock?: boolean,
        parser?: Parser,
        platformOptions?: Object
    };


    class SerialPort{
        constructor(path: string, options?: Options, openImmediately?: boolean, callback?: (err: string) => void)
        isOpen(): boolean;
        on(event: "data", callback: (...data: any[]) => void): SerialPort;
        once(event: "data", callback: (...data: any[]) => void): SerialPort;
        on(event: "error", callback: (error: string | Error) => void): SerialPort;
        once(event: "error", callback: (error: string | Error) => void): SerialPort;
        on(event: "disconnect", callback: (error: string | Error | null) => void): SerialPort;
        once(event: "disconnect", callback: (error: string | Error | null) => void): SerialPort;
        on(event: "open", callback: () => void): SerialPort;
        once(event: "open", callback: () => void): SerialPort;
        on(event: "close", callback: (error: string | Error | null)=> void): SerialPort;
        once(event: "close", callback: (error: string | Error | null)=> void): SerialPort;
        open(callback: () => void): void;
        write(buffer: Buffer | string, callback?: (error: string | Error | null) => void): void
        pause(): void;
        resume(): void;
        disconnected(error: string | Error): void;
        close(callback?: (error: string | Error | null) => void): void;
        flush(callback?: (err: string | Error | null) => void): void;
        set(options: SerialPort.setOptions, callback: () => void): void;
        drain(callback?: (error: string | Error | null) => void): void;
        update(options: SerialPort.updateOptions, callback?: () => void): void;
        static list(callback: (err: string, ports: SerialPort.portConfig[]) => void): void;
        static parsers: {
            readline(delimiter: string): Parser;
            raw: Parser;
            byteDelimiter(byteArray: number[]): Parser;
        };
        listenerCount: NodeJS.EventEmitter["listenerCount"];

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
