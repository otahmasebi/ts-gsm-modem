"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts_events_extended_1 = require("ts-events-extended");
var debug = require("debug");
require("colors");
var CardLockFacility = /** @class */ (function () {
    function CardLockFacility(atStack) {
        this.atStack = atStack;
        this.debug = debug("CardLockFacility");
        this.evtUnlockCodeRequest = new ts_events_extended_1.SyncEvent();
        this.evtPinStateReady = new ts_events_extended_1.VoidSyncEvent();
        this.retrieving = true;
        this.unlocking = false;
        if (atStack.debugPrefix !== undefined) {
            this.debug.namespace = atStack.debugPrefix + " " + this.debug.namespace;
            this.debug.enabled = true;
        }
        this.debug("Initialization");
        this.retrieveCX_CPIN_READ();
    }
    CardLockFacility.prototype.enterPin = function (pin) {
        if (this.pinState !== "SIM PIN")
            throw new Error();
        this.__enterPin__(pin);
    };
    CardLockFacility.prototype.enterPin2 = function (pin2) {
        if (this.pinState !== "SIM PIN2")
            throw new Error();
        this.__enterPin__(pin2);
    };
    CardLockFacility.prototype.enterPuk = function (puk, newPin) {
        if (this.pinState !== "SIM PUK")
            throw new Error();
        this.__enterPuk__(puk, newPin);
    };
    CardLockFacility.prototype.enterPuk2 = function (puk, newPin2) {
        if (this.pinState !== "SIM PUK2")
            throw new Error();
        this.__enterPuk__(puk, newPin2);
    };
    Object.defineProperty(CardLockFacility.prototype, "pinState", {
        get: function () {
            return this.cx_CPIN_READ.pinState;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CardLockFacility.prototype, "times", {
        get: function () { return this.cx_CPIN_READ.times; },
        enumerable: true,
        configurable: true
    });
    CardLockFacility.prototype.retrieveCX_CPIN_READ = function () {
        var _this = this;
        this.retrieving = true;
        this.atStack.runCommand("AT^CPIN?\r", function (resp) {
            _this.retrieving = false;
            _this.cx_CPIN_READ = resp;
            if (_this.pinState === "READY")
                return _this.evtPinStateReady.post();
            _this.evtUnlockCodeRequest.post({
                "pinState": _this.pinState,
                "times": _this.times
            });
        });
    };
    CardLockFacility.prototype.__enterPin__ = function (pin) {
        var _this = this;
        if (this.retrieving)
            throw new Error();
        if (this.unlocking)
            throw new Error();
        if (!pin.match(/^[0-9]{4}$/))
            throw new Error();
        this.unlocking = true;
        this.atStack.runCommand("AT+CPIN=" + pin + "\r", {
            "recoverable": true,
        }, function (_, final) {
            _this.unlocking = false;
            if (!final.isError)
                return _this.evtPinStateReady.post();
            _this.retrieveCX_CPIN_READ();
        });
    };
    CardLockFacility.prototype.__enterPuk__ = function (puk, newPin) {
        var _this = this;
        if (this.retrieving)
            throw new Error();
        if (this.unlocking)
            throw new Error();
        if (!puk.match(/^[0-9]{8}$/))
            throw new Error();
        if (!newPin.match(/^[0-9]{4}$/))
            throw new Error();
        this.unlocking = true;
        this.atStack.runCommand("AT+CPIN=" + puk + "," + newPin + "\r", {
            "recoverable": true,
        }, function (_, resp) {
            _this.unlocking = false;
            if (!resp.isError)
                return _this.evtPinStateReady.post();
            _this.retrieveCX_CPIN_READ();
        });
    };
    return CardLockFacility;
}());
exports.CardLockFacility = CardLockFacility;
