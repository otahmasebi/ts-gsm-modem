import { Monitor } from "gsm-modem-connection";
import { Modem } from "../lib/index";
import { AtMessage } from "at-messages-parser";
import { CardStorage } from "../lib/CardStorage";
import * as pr from "ts-promisify";
import * as fs from "fs";
import * as path from "path";
import * as repl from "repl";
require("colors");

Monitor.evtModemConnect.attach(async accessPoint => {

    //Monitor.stop();

    console.log("CONNECTION: ", accessPoint.toString());

    let [error, modem, hasSim] = await Modem.create({
        "path": accessPoint.dataIfPath,
        "unlockCodeProvider": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
        "disableContactsFeatures": false
    });

    if (error) {
        console.log("Initialization error: ".red, error);
        return;
    }


    modem.evtTerminate.attachOnce(error => {

        console.log("Terminate!");

        if (error) console.log(error);
        else console.log("Modem disconnect or manually terminate");

    });

    if (!hasSim) {
        console.log("NO SIM".red);
        modem.terminate();
        return;
    }

    modem.evtMessage.attach(message => console.log("NEW MESSAGE: ".green, message));
    modem.evtMessageStatusReport.attach(statusReport => console.log("MESSAGE STATUS REPORT: ".yellow, statusReport));

    let messageText = fs.readFileSync(path.join(__dirname, "messageText.txt").replace(/out/, "src"), "utf8");

    console.log("Sending: \n".green, JSON.stringify(messageText));

    modem.sendMessage("0636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));



    let r = repl.start({
        "terminal": true,
        "prompt": "> "
    });

    Object.assign((r as any).context, {
        modem,
        "run": (command: string): string => {

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



});