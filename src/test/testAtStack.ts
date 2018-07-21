import * as logger from "logger";
import { AtStack } from "../lib/AtStack";
import { ConnectionMonitor } from "../lib";
import * as repl from "repl";

import "colors";

process.on("unhandledRejection", error => { throw error; });

const debug= logger.debugFactory("main");

let atStack: AtStack;

const connectionMonitor= ConnectionMonitor.getInstance(logger.debugFactory("ConnectionMonitor"))

connectionMonitor.evtModemConnect.attach( accessPoint => {

    atStack= new AtStack(
        accessPoint.dataIfPath, 
        logger.debugFactory("AtStack")
    );

    atStack.evtTerminate.attachOnce(error=> debug(`evtTerminate posted ${error}` ));

    //atStack.evtUnsolicitedMessage.attach( unsolicitedAtMessage => debug(unsolicitedAtMessage.raw));

    debug("AtStack Ready");

});


const replInstance = repl.start({
    "terminal": true,
    "prompt": "> "
});

const { context }= replInstance;

Object.assign(context, {
    run(command: string): string {

        atStack.runCommand(command + "\r", { "recoverable": true, "retryOnErrors": false }).then(({ resp, final, raw }) => {

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

Object.defineProperty(context, "atStack", {
    "get": () => atStack
});

Object.defineProperty(context, "exit", {
    "get": () => {

        connectionMonitor.stop();

        atStack.terminate().then(()=>{

            replInstance.close();

            console.log("Should stop....");

        });


    }
});

