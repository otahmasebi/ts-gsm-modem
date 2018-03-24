"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var at_messages_parser_1 = require("at-messages-parser");
var node_python_messaging_1 = require("node-python-messaging");
var runExclusive = require("run-exclusive");
var ts_events_extended_1 = require("ts-events-extended");
var trackable_map_1 = require("trackable-map");
var debug = require("debug");
require("colors");
var uniqNow = (function () {
    var last = 0;
    return function () {
        var now = Date.now();
        return (now <= last) ? (++last) : (last = now);
    };
})();
var SmsStack = /** @class */ (function () {
    function SmsStack(atStack) {
        var _this = this;
        this.atStack = atStack;
        this.debug = debug("SmsStack");
        this.evtMessage = new ts_events_extended_1.SyncEvent();
        this.evtMessageStatusReport = new ts_events_extended_1.SyncEvent();
        this.evtSmsDeliver = new ts_events_extended_1.SyncEvent();
        this.evtSmsStatusReport = new ts_events_extended_1.SyncEvent();
        this.uncompletedMultipartSms = {};
        this.statusReportMap = {};
        this.mrMessageIdMap = {};
        this.maxTrySendPdu = 3;
        //TODO: More test for when message fail to send
        this.sendMessage = runExclusive.buildMethodCb(function (number, text, callback) { return __awaiter(_this, void 0, void 0, function () {
            var pdus, error_1, messageId, i, pdus_1, pdus_1_1, _a, length, pdu, mr, error, tryLeft, result, _b, _c, mr_1, e_1_1, e_1, _d, e_2, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, node_python_messaging_1.buildSmsSubmitPdus({ number: number, text: text, "request_status": true })];
                    case 1:
                        pdus = _f.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _f.sent();
                        this.debug([
                            "Can't build SMS PDU for message: \n".red,
                            "number: " + number + "\n",
                            "text: " + JSON.stringify(text),
                            "error: " + error_1.message
                        ].join(""));
                        callback(undefined);
                        return [2 /*return*/, null];
                    case 3:
                        messageId = uniqNow();
                        this.statusReportMap[messageId] = {
                            "cnt": pdus.length,
                            "completed": 0
                        };
                        i = 1;
                        _f.label = 4;
                    case 4:
                        _f.trys.push([4, 11, 12, 13]);
                        pdus_1 = __values(pdus), pdus_1_1 = pdus_1.next();
                        _f.label = 5;
                    case 5:
                        if (!!pdus_1_1.done) return [3 /*break*/, 10];
                        _a = pdus_1_1.value, length = _a.length, pdu = _a.pdu;
                        this.debug("Sending Message part " + i++ + "/" + pdus.length + " of message id: " + messageId);
                        mr = NaN;
                        error = null;
                        tryLeft = this.maxTrySendPdu;
                        _f.label = 6;
                    case 6:
                        if (!(tryLeft-- && isNaN(mr))) return [3 /*break*/, 8];
                        if (tryLeft < this.maxTrySendPdu - 1) {
                            console.log("Retry sending PDU".red);
                        }
                        return [4 /*yield*/, this.sendPdu(length, pdu)];
                    case 7:
                        result = _f.sent();
                        mr = result.mr;
                        error = result.error;
                        return [3 /*break*/, 6];
                    case 8:
                        if (error) {
                            console.log(("Send Message Error after " + this.maxTrySendPdu + ", attempt: " + error.verbose).red);
                            try {
                                for (_b = __values(Object.keys(this.mrMessageIdMap)), _c = _b.next(); !_c.done; _c = _b.next()) {
                                    mr_1 = _c.value;
                                    if (this.mrMessageIdMap[mr_1] === messageId)
                                        delete this.mrMessageIdMap[mr_1];
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (_c && !_c.done && (_e = _b.return)) _e.call(_b);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                            callback(undefined);
                            return [2 /*return*/, null];
                        }
                        this.mrMessageIdMap[mr] = messageId;
                        _f.label = 9;
                    case 9:
                        pdus_1_1 = pdus_1.next();
                        return [3 /*break*/, 5];
                    case 10: return [3 /*break*/, 13];
                    case 11:
                        e_1_1 = _f.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 13];
                    case 12:
                        try {
                            if (pdus_1_1 && !pdus_1_1.done && (_d = pdus_1.return)) _d.call(pdus_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                        return [7 /*endfinally*/];
                    case 13:
                        callback(new Date(messageId));
                        return [2 /*return*/, null];
                }
            });
        }); });
        if (atStack.debugPrefix !== undefined) {
            this.debug.namespace = atStack.debugPrefix + " " + this.debug.namespace;
            this.debug.enabled = true;
        }
        this.debug("Initialization");
        atStack.runCommand('AT+CPMS="SM","SM","SM"\r', function (resp) {
            var _a = resp.readingAndDeleting, used = _a.used, capacity = _a.capacity;
            _this.retrieveUnreadSms(used, capacity);
        });
        atStack.runCommand('AT+CNMI=1,1,0,2,0\r');
        this.registerListeners();
    }
    SmsStack.prototype.retrieveUnreadSms = function (used, capacity) {
        return __awaiter(this, void 0, void 0, function () {
            var messageLeft, index, _a, resp, p_CMGR_SET, sms, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.debug(used + " PDU in sim memory");
                        messageLeft = used;
                        index = 0;
                        _b.label = 1;
                    case 1:
                        if (!(index < capacity)) return [3 /*break*/, 8];
                        if (!messageLeft)
                            return [3 /*break*/, 8];
                        return [4 /*yield*/, this.atStack.runCommand("AT+CMGR=" + index + "\r")];
                    case 2:
                        _a = __read.apply(void 0, [_b.sent(), 1]), resp = _a[0];
                        if (!resp)
                            return [3 /*break*/, 7];
                        messageLeft--;
                        p_CMGR_SET = resp;
                        if (p_CMGR_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_READ &&
                            p_CMGR_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_UNREAD) {
                            this.debug("PDU " + at_messages_parser_1.AtMessage.MessageStat[p_CMGR_SET.stat] + ", deleting...");
                            this.atStack.runCommand("AT+CMGD=" + index + "\r");
                            return [3 /*break*/, 7];
                        }
                        sms = void 0;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, node_python_messaging_1.decodePdu(p_CMGR_SET.pdu)];
                    case 4:
                        sms = _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _b.sent();
                        this.debug("PDU not decrypted: ".red, p_CMGR_SET.pdu, error_2);
                        this.atStack.runCommand("AT+CMGD=" + index + "\r");
                        return [3 /*break*/, 7];
                    case 6:
                        if (sms instanceof node_python_messaging_1.SmsStatusReport) {
                            this.atStack.runCommand("AT+CMGD=" + index + "\r");
                            return [3 /*break*/, 7];
                        }
                        this.evtSmsDeliver.post([index, sms]);
                        _b.label = 7;
                    case 7:
                        index++;
                        return [3 /*break*/, 1];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    SmsStack.prototype.sendPdu = function (pduLength, pdu) {
        var _this = this;
        return new Promise(function (resolve) {
            _this.atStack.runCommand("AT+CMGS=" + pduLength + "\r");
            _this.atStack.runCommand(pdu + "\u001A", {
                "recoverable": true,
                "retryOnErrors": false
            }, function (resp, final) {
                var resp_t = resp;
                if (!resp_t)
                    resolve({ "error": final, "mr": NaN });
                else
                    resolve({ "error": null, "mr": resp_t.mr });
            });
        });
    };
    SmsStack.prototype.registerListeners = function () {
        var _this = this;
        this.atStack.evtUnsolicitedMessage.attach(function (urc) {
            return (urc instanceof at_messages_parser_1.AtMessage.P_CMTI_URC) || (urc instanceof at_messages_parser_1.AtMessage.P_CDSI_URC);
        }, function (_a) {
            var index = _a.index;
            return _this.retrievePdu(index);
        });
        this.evtSmsStatusReport.attach(function (smsStatusReport) {
            var messageId = _this.mrMessageIdMap[smsStatusReport.ref];
            if (!messageId)
                return;
            //console.log(JSON.stringify(smsStatusReport, null,2).blue);
            var isDelivered = true;
            switch (smsStatusReport._stClass) {
                case "RESERVED":
                case "STILL TRYING": return;
                case "PERMANENT ERROR":
                case "TEMPORARY ERROR":
                case "SPECIFIC TO SC":
                    isDelivered = false;
                    break;
                case "COMPLETED":
                    var elem = _this.statusReportMap[messageId];
                    if (++elem.completed !== elem.cnt)
                        return;
                    isDelivered = true;
                    break;
            }
            try {
                for (var _a = __values(Object.keys(_this.mrMessageIdMap)), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var mr = _b.value;
                    if (_this.mrMessageIdMap[mr] === messageId)
                        delete _this.mrMessageIdMap[mr];
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_3) throw e_3.error; }
            }
            delete _this.statusReportMap[messageId];
            _this.evtMessageStatusReport.post({
                "sendDate": new Date(messageId),
                "dischargeDate": smsStatusReport.sr.dt,
                isDelivered: isDelivered,
                "status": smsStatusReport._status,
                "recipient": smsStatusReport.sr.recipient
            });
            var e_3, _c;
        });
        this.evtSmsDeliver.attach(function (_a) {
            var _b = __read(_a, 2), index = _b[0], smsDeliver = _b[1];
            if (!(smsDeliver instanceof node_python_messaging_1.SmsDeliverPart)) {
                var number = smsDeliver.number, date = smsDeliver.date, text = smsDeliver.text;
                _this.evtMessage.post({ number: number, date: date, text: text });
                _this.atStack.runCommand("AT+CMGD=" + index + "\r");
                return;
            }
            var messageRef = smsDeliver.ref;
            var partRef = smsDeliver.seq;
            var totalPartInMessage = smsDeliver.cnt;
            var timer;
            var parts;
            if (!_this.uncompletedMultipartSms[messageRef]) {
                parts = {};
                timer = _this.atStack.timers.add(function (logMessage) {
                    _this.debug(logMessage);
                    var partRefs = trackable_map_1.TrackableMap.intKeyAsSortedArray(parts);
                    var partRefPrev = 0;
                    var concatenatedText = "";
                    var partLeft = totalPartInMessage;
                    try {
                        for (var partRefs_1 = __values(partRefs), partRefs_1_1 = partRefs_1.next(); !partRefs_1_1.done; partRefs_1_1 = partRefs_1.next()) {
                            var partRef_1 = partRefs_1_1.value;
                            var _a = parts[partRef_1], storageIndex = _a.storageIndex, text = _a.text;
                            for (var ref = partRefPrev + 1; ref < partRef_1; ref++) {
                                partLeft--;
                                concatenatedText += " *** Missing part *** ";
                            }
                            partLeft--;
                            concatenatedText += text;
                            _this.atStack.runCommand("AT+CMGD=" + storageIndex + "\r");
                            partRefPrev = partRef_1;
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (partRefs_1_1 && !partRefs_1_1.done && (_b = partRefs_1.return)) _b.call(partRefs_1);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                    while (partLeft-- > 0)
                        concatenatedText += " *** Missing part *** ";
                    delete _this.uncompletedMultipartSms[messageRef];
                    var number = smsDeliver.number, date = smsDeliver.date;
                    _this.evtMessage.post({ number: number, date: date, "text": concatenatedText });
                    var e_4, _b;
                }, 240000, "missing parts");
                _this.uncompletedMultipartSms[messageRef] = { timer: timer, parts: parts };
            }
            else {
                timer = _this.uncompletedMultipartSms[messageRef].timer;
                parts = _this.uncompletedMultipartSms[messageRef].parts;
            }
            parts[partRef] = { "storageIndex": index, "text": smsDeliver.text };
            if (Object.keys(parts).length === totalPartInMessage)
                timer.runNow("message complete");
            else {
                _this.debug("Received part n\u00B0" + partRef + " of message ref: " + messageRef + ", " + Object.keys(parts).length + "/" + totalPartInMessage + " completed");
                timer.resetDelay();
            }
        });
    };
    SmsStack.prototype.retrievePdu = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, resp, p_CMGR_SET, sms, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.atStack.runCommand("AT+CMGR=" + index + "\r")];
                    case 1:
                        _a = __read.apply(void 0, [_b.sent(), 1]), resp = _a[0];
                        if (!resp)
                            return [2 /*return*/];
                        p_CMGR_SET = resp;
                        if (p_CMGR_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_UNREAD)
                            return [2 /*return*/];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, node_python_messaging_1.decodePdu(p_CMGR_SET.pdu)];
                    case 3:
                        sms = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _b.sent();
                        this.debug("PDU not decrypted: ".red, p_CMGR_SET.pdu, error_3);
                        this.atStack.runCommand("AT+CMGD=" + index + "\r");
                        return [2 /*return*/];
                    case 5:
                        switch (sms.type) {
                            case node_python_messaging_1.TP_MTI.SMS_DELIVER:
                                this.evtSmsDeliver.post([index, sms]);
                                return [2 /*return*/];
                            case node_python_messaging_1.TP_MTI.SMS_STATUS_REPORT:
                                this.evtSmsStatusReport.post(sms);
                                this.atStack.runCommand("AT+CMGD=" + index + "\r");
                                return [2 /*return*/];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return SmsStack;
}());
exports.SmsStack = SmsStack;
