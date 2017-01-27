import { ModemWatcher, Modem as ModemAccessPoint } from "gsm-modem-connection";
import { Modem, pinStates } from "../lib/index";

require("colors");

let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtConnect.attach( accessPoint => {

    console.log("CONNECTION".green, accessPoint.infos);

    let modem = new Modem(accessPoint.atInterface);

    modem.evtNoSim.attach(() => {

        console.log("There is no SIM card in the modem, exiting".green);

        process.exit(0);

    });

    modem.evtUnlockCodeRequest.attach(request => {

        switch (request.pinState) {
            case pinStates.SIM_PIN:
                let pin: string;
                switch (request.times) {
                    case 3: pin = "0001"; break;
                    case 2: pin = "1234"; break;
                    case 1: pin = "0000"; break;
                }
                console.log(`SIM PIN requested, ${request.times} try left, entering PIN code: ${pin}`.cyan);
                modem.enterPin(pin);
                break;
            case pinStates.SIM_PUK:
                let puk: string;
                let newPin = "1234";
                switch (request.times) {
                    case 10: puk = "62217721"; break;
                    case 9: puk = "89390485"; break;
                    case 8: puk = "62217721"; break;
                    default:
                        console.log(`SIM PUK requested, ${request.times} try left, we stop here`.red);
                        process.exit(1);
                }
                console.log(`SIM PUK requested, ${request.times} try left, entering PUK code ${puk}, and setting the new PIN as ${newPin}`.blue);
                break;
            default:
                console.log(`${request.pinState} requested, exiting`.red);
                process.exit(1);
        }

    });

    modem.evtReady.attach(() => {

        console.log("Modem ready");

        modem.evtMessage.attach(message => console.log("NEW MESSAGE: ".green, message));
        modem.evtMessageStatusReport.attach(statusReport => console.log("MESSAGE STATUS REPORT: ".yellow, statusReport));

        let messageText = "I build a long message!\n";

        for (let i = 0; i < 3; i++) messageText += messageText;

        console.log("Sending: \n".green, JSON.stringify(messageText));

        modem.sendMessage("+33636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));

    });

});