# ts-gsm-modem
GSM Modem manager


# ts-modem-interface

Stack at command, split messages between response to a command and unsolicited messages

#Install

npm install garronej/ts-modem-interface

#Usage

```` JavaScript
/*Example for reading received SMS as PDU.*/

import { AtMessageId } from "ts-modem-interface";
import { MemStorage } from "ts-modem-interface";
import { AtMessage } from "ts-modem-interface";
import { AtMessageImplementations } from "ts-modem-interface";

console.log("Now send a SMS to your GSM modem");

//Here put the serial port for at command of your modem (e.g. /dev/ttyUSB2)
let modemInterface = new ModemInterface("/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.2-port0");

modemInterface.evtError.attach(error => console.log("modemInterface error: ", error));

//Tell the modem to alert when there is a new SMS.
modemInterface.runAtCommand("AT+CNMI=2,1,0,0,0\r");

modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

    //Reception of a new SMS
    if (atMessage.id === AtMessageId.CMTI) {

        let atMessageCMTI = <AtMessageImplementations.CMTI>atMessage;

        //Reading the received SMS from memory
        modemInterface.runAtCommand(`AT+CMGR=${atMessageCMTI.index}\r`, (error, output) => {

            if (error) throw error;
            if (!output.isSuccess) throw new Error("error reading message");

            let atMessageCMGR= <AtMessageImplementations.CMGR>output.atMessages.pop();

            console.log("new message received: ", atMessageCMGR);

            //Now the PDU have to be parsed, for example with garronej/node-python-messaging

        });

    }

});


````


```` shell


✓ pi @ localhost ~/github/ts-modem-interface $ npm run test

> ts-modem-interface@0.1.0 test /home/pi/github/ts-modem-interface
> node ./generatedJs/exemples/tests

Now send a SMS to your GSM modem
new message received:  CMGR {
  id: 7,
  raw: '\r\n+CMGR: 0,,23\r\n07913306092021F0040B913336766883F50000612113205220400442B1180D\r\n',
  idName: 'CMGR',
  stat: 0,
  length: 23,
  pdu: '07913306092021F0040B913336766883F50000612113205220400442B1180D' }



````

# ts-modem-pin-manager

This module aim to manage the PIN/PUK facility system on a Huawei GSM modem,

See ts/examples/tests.ts for usage information.

Running the example: npm test

Warning: Running the example on your SIM card will lock it for good, make sure to replace the PUK code

