import { Modem, InitializationError, ConnectionMonitor } from "../lib/index";
//@ts-ignore: we may un comment
import * as repl from "repl";
import * as logger from "logger";

process.on("unhandledRejection", error => { throw error; });

const debug = logger.debugFactory();

debug("Started, looking for connected modem...");

let modem: Modem;

ConnectionMonitor.getInstance().evtModemConnect.attach(
    async accessPoint => {

        debug("New Modem!");

        try {

            modem = await Modem.create({
                "dataIfPath": accessPoint.dataIfPath,
                "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" }
            });

        } catch (error) {

            const initializationError = error as InitializationError;

            debug(`${initializationError}`);

            return;

        }

        modem.evtTerminate.attachOnce(error => debug(`Modem terminate ${error}`));

        debug("Modem ready");

    }
);

const replInstance = repl.start({
    "terminal": true,
    "prompt": "> "
});

const { context } = replInstance;

Object.assign(context, {
    run(command: string): string {

        modem.runCommand(command + "\r", { "recoverable": true, "retryOnErrors": false }).then(({ resp, final, raw }) => {

            if (resp) {
                console.log(JSON.stringify(resp, null, 2));
            }

            if (final.isError) {
                console.log(JSON.stringify(final, null, 2).red);
            } else {
                console.log(final.raw.green);
            }

        });

        return "COMMAND QUEUED";

    }
});

Object.defineProperty(context, "modem", {
    "get": () => modem
});

Object.defineProperty(context, "exit", {
    "get": () => {

        ConnectionMonitor.getInstance().stop();

        modem.terminate().then(() => {

            replInstance.close();

            console.log("Should stop....");

        });


    }
});
