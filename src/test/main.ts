import { ModemWatcher, Modem as ModemAccessPoint} from "gsm-modem-connection";
import { Modem, pinStates } from "../lib/index";
import { MessageStat, AtMessageList, AtImps } from "at-messages-parser";
import { CardStorage } from "../lib/CardStorage";
import * as pr from "ts-promisify";
require("colors");

import { NumberingPlanIdentification, TypeOfNumber } from "at-messages-parser";


let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtConnect.attachOnce(accessPoint => {

    modemWatcher.stop();

    console.log("CONNECTION".green, accessPoint.infos);

    let modem = new Modem(accessPoint.atInterface, "1234");

    modem.evtTerminate.attachOnce(error => {

        console.log("Terminate!");

        if( error ) console.log(error);
        else console.log("Modem disconnect or manually terminate");

    });

    modem.evtNoSim.attach(() => {

        console.log("There is no SIM card".green);

        modem.terminate();

    });

    modem.evtUnlockCodeRequest.attach(request => {

        switch (request.pinState) {
            case pinStates.SIM_PIN:
                let pin: string= "";
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
                        return process.exit(1);
                }
                console.log(`SIM PUK requested, ${request.times} try left, entering PUK code ${puk}, and setting the new PIN as ${newPin}`.blue);
                break;
            default:
                console.log(`${request.pinState} requested, exiting`.red);
                process.exit(1);
        }

    });


    modem.evtMessage.attach(message => console.log("NEW MESSAGE: ".green, message));
    modem.evtMessageStatusReport.attach(statusReport => console.log("MESSAGE STATUS REPORT: ".yellow, statusReport));

    //modem.evtCardStorageReady.attach(()=> console.log(modem.contacts) );

    modem.evtCardStorageReady.attachOnce(()=>{


        console.log("Storage ready");

        console.log("storage left: ".blue, modem.storageLeft);

        console.log("Nombre de contacts:".green, modem.contacts!.length);

        console.log(JSON.stringify(modem.contacts, null, 2).green);

        //modem.updateContact(8, { "number": "12345678" }, contact => console.log("updated contact: ", contact));

        /*
        for( let contact of modem.contacts! )
            modem.deleteContact(contact.index, ()=> console.log(`Deleted contact: ${JSON.stringify(contact)}`.blue));
        */

        modem.createContact("+33636786385","Le nouveau" , contact => { 

            console.log(`Created contact: ${JSON.stringify(contact)}`.green);

            modem.updateContact(contact.index, { "name": "Nouveau update" }, contact=> console.log("updated contact: ", contact));

            modem.updateContact(contact.index, { "number": "007" }, contact=> console.log("updated contact: ", modem.contacts));

        });


    });


    //modem.runCommand("AT+CNUM\r", output => console.log("CNUM :", (output.atMessage as any).atMessages));

    let messageText = "I build a message\n";

    for (let i = 0; i < 5; i++) messageText += messageText;

    console.log("Sending: \n".green, JSON.stringify(messageText));

    modem.sendMessage("+33636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));




});