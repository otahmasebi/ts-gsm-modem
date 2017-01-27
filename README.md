# ts-gsm-modem

GSM Modem manager for HUAWEI 3G dongles.

This module can be used alongside with chan_dongle.

* Manage card lock, ( PIN PUK )
* Send and receive SMS ( support multiparts SMS )
* Get status report for SMS sent.

*Incoming features:*

* Bridge to chan dongle for VOICE features.
* Manage SIM storage, contacts, write subscriber number ect...

#Install

npm install garronej/ts-modem-interface

#Usage

See *./src/test/main.ts*

```` JavaScript
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

        for (let i = 0; i < 4; i++) messageText += messageText;

        console.log("Sending: \n".green, JSON.stringify(messageText));

        modem.sendMessage("+33636786385", messageText, messageId => console.log("MESSAGE ID: ".red, messageId));

    });

});
````
*outputs:* ( +33636786385 replied Ok it works! 👌🏻 )
```` shell
Awaiting GSM modem connections...
CONNECTION { vendorIdHex: '0x12d1',
  modelIdHex: '0x1003',
  isKnowModel: true,
  rpiPort: 4,
  atInterface: '/dev/ttyUSB1',
  audioInterface: '/dev/ttyUSB0',
  isFullyBooted: true }
SIM PIN requested, 3 try left, entering PIN code: 0001
SIM PIN requested, 2 try left, entering PIN code: 1234
Modem ready
Sending:
 "I build a long message!\nI build a long message!\nI build a long message!\nI build a long message!\nI build a long message!\nI build a long message!\nI build a long message!\nI buil
d a long message!\n"
MESSAGE ID:  0
MESSAGE STATUS REPORT:  { messageId: 0,
  dischargeTime: Fri Jan 27 2017 19:21:13 GMT+0000 (UTC),
  isDelivered: true,
  status: 'COMPLETED_RECEIVED' }
NEW MESSAGE:  { number: '+33636786385',
  date: Fri Jan 27 2017 19:21:52 GMT+0000 (UTC),
  text: 'Ok it works! 👌🏻' }
````