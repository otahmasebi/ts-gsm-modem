import { Modem, InitializationError, ConnectionMonitor } from "../lib/index";
import * as fs from "fs";
import * as path from "path";
//@ts-ignore: we may un comment
import * as repl from "repl";
require("colors");

import * as _debug from "debug";
let debug= _debug("_main");

(async ()=>{

    debug("Started, looking for connected modem...");

    let accessPoint= await ConnectionMonitor.getInstance().evtModemConnect.waitFor();

    let modem: Modem;

    try{

        modem= await Modem.create({
            "dataIfPath": accessPoint.dataIfPath,
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
            "enableTrace": true
        });

    }catch(error){

        let initializationError= error as InitializationError;

        debug(initializationError);

        return;

    }

    modem.evtTerminate.attachOnce(error=>{

        debug("Modem terminate", { error });

        ConnectionMonitor.getInstance().stop();

    });

    let contacts= modem.contacts

    console.log({ contacts });

    modem.evtMessage.attach(message => debug("NEW MESSAGE: ".green, message));
    modem.evtMessageStatusReport.attach(statusReport => debug("MESSAGE STATUS REPORT: ".yellow, statusReport));


    let messageText = fs.readFileSync(path.join(__dirname, "messageText.txt").replace(/dist/, "src"), "utf8");
    //let messageText= "foo bar";

    debug("Sending: \n".green, JSON.stringify(messageText));

    let joseph= "0636786385";

    let sentMessageId= await modem.sendMessage(joseph, messageText);

    debug("SendDate( used as id): ", sentMessageId);

    await new Promise(resolve=> setTimeout(resolve, 60000));

    debug("Manual termination of the modem");

    modem.terminate();

    console.assert(modem.isTerminated === true);
    
    /*

    let { context } = repl.start({
        "terminal": true,
        "prompt": "> "
    }) as any;

    Object.assign(context, {
        modem,
        run(command: string): string  {

            modem.runCommand(command + "\r", { "recoverable": true, "retryOnErrors": false }, (resp, final) => {

                if (resp)
                    console.log(JSON.stringify(resp, null, 2));

                if (final.isError)
                    console.log(JSON.stringify(final, null, 2).red);
                else
                    console.log(final.raw.green);

            });

            return "COMMAND QUEUED";

        }
    });

    Object.defineProperty(context, "exit", {
        "get": ()=> process.exit(0)
    });

    */

    /*
    ( async function keepAlive(){

        while( true ){

            if( modem.isTerminated ) return;

            await new Promise(resolve=>setTimeout(resolve,1000));

            await modem!.ping();

            console.log("PING");

        }

    });
    */

})();
