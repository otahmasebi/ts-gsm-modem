import { ModemWatcher, Modem as ModemAccessPoint} from "gsm-modem-connection";
import { Modem, pinStates, CommandResp } from "../lib/index";
import { MessageStat, AtMessageList, AtImps } from "at-messages-parser";
import { CardStorage } from "../lib/CardStorage";
import * as pr from "ts-promisify";
require("colors");

import { NumberingPlanIdentification, TypeOfNumber } from "at-messages-parser";


let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtConnect.attach(accessPoint => {

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

        console.log("=>Modem ready");



        let allowedChar = [
            'abcdefghijk',
            'lmnopqrst',
            'uvwxyz',
            'ABCDEFG',
            'HIJKLMNOP',
            'QRSTUVWXYZ',
            '0123456789',
            '0 <',
            '1 >',
            '2 !',
            '4 &',
            '5 *',
            '6 #',
            '7 %',
            '8 ,',
            '9 ;',
            '11 .',
            "12 '",
            "13 (",
            "14 )",
            "19 ?",
            "22 -"
        ];

        let allowedAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789<>!&*#%,;.'()?-";

        let contactNames = [
            "e",
            "ae",
            "aae",
            "aaae",
            "aaaae",
            "aaaaae",
            "aaaaaae",
            "aaaaaaae",
            "aaaaaaaae",
            "aaaaaaaaae",
            "aaaaaaaaaae",
            "aaaaaaaaaaae",
            "aaaaaaaaaaaaae",
            "Joseph Garrone",
            "Alex prepa 2",
            "My love <3",
            "Pascal @Boulot",
            "Marie-Luce",
            "Francoi_fillon"
        ];

        let generate = (length: number) => {

            let out: string[] = [];

            let str = "";

            for (let char of allowedAlphabet) {

                str += char;

                if (str.length === length) {

                    out.push(str);

                    str = "";

                }

            }

            if (str) out.push(str);

            return out;

        };

        contactNames = contactNames.concat(generate(10));
        contactNames = contactNames.concat(generate(11));
        contactNames = contactNames.concat(generate(12));
        contactNames = contactNames.concat(generate(13));
        contactNames = contactNames.concat(generate(14));


        let startIndex = 5;


        //store();
        //checks();
        //clearPhoneBookMemory();
        //testGSM();
        readContacts();


        function clearPhoneBookMemory() {
            (async () => {

                console.log("Start CLEAR");

                let [output] = await pr.generic(modem, modem.runCommand)("AT+CPBR=?\r") as [CommandResp];

                let p_CPBR_TEST = output.atMessage as AtImps.P_CPBR_TEST;

                for (let i = p_CPBR_TEST.range[0]; i <= p_CPBR_TEST.range[1]; i++) {

                    await pr.generic(modem, modem.runCommand)(`AT+CPBW=${i}\r`);

                }

                console.log("DONE CLEAR");

            })();
        }

        function testGSM() {
            (async () => {

                console.log("Start TEST GSM");

                let enc = "GSM";

                await pr.generic(modem, modem.runCommand)(`AT+CSCS="${enc}"\r`);

                for (let i = 0; i < allowedChar.length; i++) {

                    let contactName = allowedChar[i];

                    if (contactName.length % 2 === 1)
                        contactName = contactName + " ";

                    console.log(String.raw`Storing: "${contactName}" at index ${startIndex + i}`.blue);

                    let [output] = await pr.generic(modem, modem.runCommand)(
                        `AT+CPBW=${startIndex + i},"+33636786385",145,"${contactName}"\r`,
                        { "retryCount": 0, "unrecoverable": false }
                    ) as [CommandResp];

                    if (!output.isSuccess) console.log(`failed: ${(output.finalAtMessage as AtImps.P_CME_ERROR).verbose}`.red);


                }

                console.log("END TEST GSM");


            })();
        }

        function store() {

            (async () => {

                for (let enc of ["IRA", "GSM", "UCS2"]) {

                    console.log(`Enc: ${enc}`.green);

                    await pr.generic(modem, modem.runCommand)(`AT+CSCS="${enc}"\r`);

                    for (let i = 0; i < contactNames.length; i++) {

                        let contactName = contactNames[i];

                        console.log(String.raw`Storing: "${contactName}" at index ${startIndex + i}`.blue);

                        if (enc === "UCS2")
                            contactName = CardStorage.encodeUCS2(contactName);
                        await pr.generic(modem, modem.runCommand)(`AT+CPBW=${startIndex + i},"+33636786385",145,"${contactName}"\r`, { "retryCount": 0 });

                    }

                    startIndex += contactNames.length;

                }

                console.log("DONE".green);

            })();

        }

        function checks() {
            (async () => {

                for (let enc of ["IRA", "GSM", "UCS2"]) {

                    console.log(`Enc: ${enc}`.blue);

                    await pr.generic(modem, modem.runCommand)(`AT+CSCS="${enc}"\r`);

                    for (let i = 0; i < contactNames.length; i++) {


                        let [output] = await pr.generic(modem, modem.runCommand)(
                            `AT+CPBR=${startIndex + i}\r`,
                            { "retryCount": 0, "unrecoverable": false }
                        ) as [CommandResp];


                        if (!output.isSuccess) {

                            console.log((output.finalAtMessage as AtImps.P_CME_ERROR).verbose.red);

                            process.exit(1);

                        }

                        let contactName = (output.atMessage as AtImps.P_CPBR_EXEC).text;

                        if (enc === "UCS2")
                            contactName = CardStorage.decodeUCS2(contactName);

                        if (contactName === contactNames[i])
                            console.log(String.raw`Pass: "${contactName}", index: ${startIndex + i}`.green);
                        else {
                            console.log(String.raw`Fail! read: "${contactName}", expect: "${contactNames[i]}", index: ${startIndex + i}`.red);
                            if (contactName.length !== contactNames[i].length) {
                                console.log(String.raw`read length: ${contactName.length}, expect length: ${contactNames[i].length}`.red);
                            }
                        }

                    }

                    startIndex += contactNames.length;

                }

                console.log("DONE".green);

            })();
        }




        /*

        function selectBest(texts: { [enc: string]: string; }): string {

            try {

                let scores: { [enc: string]: number; } = {};

                let minScore = Number.MAX_SAFE_INTEGER;
                let minEnc: Encoding = undefined;

                for (let enc of encodings) {

                    if (typeof (texts[enc]) !== "string")
                        continue;

                    scores[enc] = computeScore(texts[enc]);

                    if (scores[enc] === 0)
                        return texts[enc];

                    if (scores[enc] < minScore) {
                        minEnc = enc;
                        minScore = scores[enc];
                    }

                }

                return texts[minEnc];

            } catch (error) {
                return "";
            }

        }

        */




        type Encoding = "IRA" | "GSM" | "UCS2";

        let encodings: Encoding[] = ["IRA", "GSM", "UCS2"];

        interface Contact {
            index: number;
            number: string;
            name?: string;
            numberingPlanId: NumberingPlanIdentification;
            typeOfNumber: TypeOfNumber;
        }

        function readContacts(): void {


        }


        //modem.runCommand("AT+CNUM\r", output => console.log("CNUM :", (output.atMessage as any).atMessages));

        modem.evtMessage.attach(message => console.log("NEW MESSAGE: ".green, message));
        modem.evtMessageStatusReport.attach(statusReport => console.log("MESSAGE STATUS REPORT: ".yellow, statusReport));

        /*

        let messageText = "I build a message\n";

        for (let i = 0; i < 3; i++) messageText += messageText;

        console.log("Sending: \n".green, JSON.stringify(messageText));

        modem.sendMessage("+33636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));

        */




    });

});