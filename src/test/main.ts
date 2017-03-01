import { ModemWatcher, Modem as ModemAccessPoint } from "gsm-modem-connection";
import { Modem } from "../lib/index";
import { MessageStat, AtMessageList, AtImps } from "at-messages-parser";
import { CardStorage } from "../lib/CardStorage";
import * as pr from "ts-promisify";
import * as fs from "fs";
import * as path from "path";
require("colors");

import { NumberingPlanIdentification, TypeOfNumber } from "at-messages-parser";


let modemWatcher = new ModemWatcher();


modemWatcher.evtConnect.attachOnce(accessPoint => {

    modemWatcher.stop();

    console.log("CONNECTION".green, JSON.stringify(accessPoint.infos, null,2));

    Modem.create({
        "path": accessPoint.atInterface,
        "unlockCodeProvider": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
        "disableContactsFeatures": true
    }, (modem, hasSim) => {

        console.log("ModemInitialized, imei: ",modem.imei);


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


        /*
        let messageText = fs.readFileSync(path.join(__dirname, "messageText.txt").replace(/out/, "src"), "utf8");

        console.log("Sending: \n".green, JSON.stringify(messageText));

        modem.sendMessage("0636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));
        */

        //console.log(JSON.stringify(modem.contacts, null, 2).blue);


    });

});